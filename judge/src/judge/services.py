"""Application services for run/submit orchestration and worker execution."""

from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from judge.models import JobOperation
from judge.problems import ExecutionPlanFactory, TestCase, load_compiled_test_cases
from judge.runner import IsolateConfig, run_execution_plan

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from judge.problems import CompiledTestCase, ProblemRepository, ProblemSpec
    from judge.queue import RedisQueue
    from judge.results import ResultsStore


@dataclass(frozen=True)
class StreamRouting:
    by_profile: Mapping[str, str]
    by_stream_group: Mapping[str, str]

    def stream_for_profile(self, profile: str) -> str:
        stream = self.by_profile.get(profile)
        if stream is None:
            raise ValueError(f"Unknown worker profile: {profile}")
        return stream

    def group_for_stream(self, stream: str) -> str:
        group = self.by_stream_group.get(stream)
        if group is None:
            raise ValueError(f"Unknown queue stream: {stream}")
        return group


DEFAULT_STREAM_ROUTING = StreamRouting(
    by_profile={
        "light": "queue:light",
        "torch": "queue:torch",
    },
    by_stream_group={
        "queue:light": "workers-light",
        "queue:torch": "workers-torch",
    },
)


class SubmissionError(Exception):
    """Base class for submission failures."""


class ProblemNotFoundError(SubmissionError):
    """Raised when a problem id cannot be resolved."""


class InvalidProblemError(SubmissionError):
    """Raised when a problem id is malformed."""


class InvalidRunRequestError(SubmissionError):
    """Raised when a /run request contains invalid test cases."""


class QueueUnavailableError(SubmissionError):
    """Raised when queue operations fail."""


class QueueFullError(SubmissionError):
    """Raised when queue admission rejects new submissions."""


@dataclass(frozen=True)
class SubmissionAccepted:
    job_id: str
    status: str


class SubmissionService:
    """Handles API-side validation and queue enqueue for run/submit jobs."""

    def __init__(
        self,
        *,
        queue: RedisQueue,
        results: ResultsStore,
        problems: ProblemRepository,
        queue_maxlen: int,
        stream_routing: StreamRouting = DEFAULT_STREAM_ROUTING,
        job_id_factory: Callable[[], str] | None = None,
        now_factory: Callable[[], int] | None = None,
        log: logging.Logger | None = None,
    ) -> None:
        self.queue = queue
        self.results = results
        self.problems = problems
        self.queue_maxlen = queue_maxlen
        self.stream_routing = stream_routing
        self.job_id_factory = job_id_factory or (lambda: str(uuid.uuid4()))
        self.now_factory = now_factory or (lambda: int(time.time()))
        self.log = log or logger

    def enqueue_submit(self, *, problem_id: str, code: str) -> SubmissionAccepted:
        spec = self._resolve_problem_spec(problem_id)
        return self._enqueue_job(
            spec=spec,
            operation="submit",
            code=code,
            cases_json=None,
        )

    def enqueue_run(
        self,
        *,
        problem_id: str,
        code: str,
        cases: list[TestCase],
    ) -> SubmissionAccepted:
        spec = self._resolve_problem_spec(problem_id)
        try:
            compiled_cases = self.problems.compiler.compile_cases(spec, cases)
        except ValueError as exc:
            raise InvalidRunRequestError(str(exc)) from exc
        return self._enqueue_job(
            spec=spec,
            operation="run",
            code=code,
            cases_json=_serialize_compiled_cases(compiled_cases),
        )

    def _enqueue_job(
        self,
        *,
        spec: ProblemSpec,
        operation: JobOperation,
        code: str,
        cases_json: str | None,
    ) -> SubmissionAccepted:
        profile = spec.execution_profile
        stream = self.stream_routing.stream_for_profile(profile)
        group = self.stream_routing.group_for_stream(stream)

        if self.queue_maxlen > 0:
            try:
                stream_backlog = self.queue.backlog(stream, group)
            except Exception as exc:
                raise QueueUnavailableError("Judge queue unavailable") from exc
            if stream_backlog >= self.queue_maxlen:
                raise QueueFullError("Judge queue is full. Please retry.")

        job_id = self.job_id_factory()
        created_at = self.now_factory()
        self.results.create_job(job_id, spec.problem_id, profile, operation, created_at=created_at)

        payload = {
            "job_id": job_id,
            "problem_id": spec.problem_id,
            "profile": profile,
            "operation": operation,
            "code": code,
            "created_at": created_at,
        }
        if cases_json is not None:
            payload["cases_json"] = cases_json

        try:
            self.queue.enqueue(stream, payload)
        except Exception as exc:
            self._persist_enqueue_failure(job_id=job_id, stream=stream)
            raise QueueUnavailableError("Judge queue unavailable") from exc

        return SubmissionAccepted(job_id=job_id, status="queued")

    def _resolve_problem_spec(self, problem_id: str) -> ProblemSpec:
        try:
            return self.problems.get_problem_spec(problem_id)
        except FileNotFoundError as exc:
            raise ProblemNotFoundError("Problem not found") from exc
        except ValueError as exc:
            raise InvalidProblemError("Invalid problem id") from exc

    def _persist_enqueue_failure(self, *, job_id: str, stream: str) -> None:
        try:
            persisted = self.results.mark_error(
                job_id,
                "Failed to enqueue job",
                error_kind="internal",
            )
            if not persisted:
                self.log.error(
                    "Failed to persist enqueue failure result: row not updatable job_id=%s stream=%s",
                    job_id,
                    stream,
                )
        except Exception:
            self.log.exception(
                "Failed to persist enqueue failure result: job_id=%s stream=%s",
                job_id,
                stream,
            )


@dataclass(frozen=True)
class WorkerJob:
    job_id: str
    problem_id: str
    operation: JobOperation
    code: str
    cases_payload: list[dict[str, Any]] | None = None


@dataclass(frozen=True)
class WorkerExecutionOutcome:
    executed: bool
    status: str
    error_kind: str
    should_ack: bool


class WorkerExecutionService:
    """Handles worker-side execution and result persistence for one job."""

    def __init__(
        self,
        *,
        results: ResultsStore,
        problems: ProblemRepository,
        isolate: IsolateConfig,
        max_output_chars: int,
        run_execution_plan_fn: Callable[..., dict[str, Any]] = run_execution_plan,
        plan_factory: ExecutionPlanFactory | None = None,
        log: logging.Logger | None = None,
    ) -> None:
        self.results = results
        self.problems = problems
        self.isolate = isolate
        self.max_output_chars = max_output_chars
        self.run_execution_plan_fn = run_execution_plan_fn
        self.plan_factory = plan_factory or ExecutionPlanFactory(problems)
        self.log = log or logger

    def execute(
        self,
        job: WorkerJob,
        *,
        on_started: Callable[[], None] | None = None,
    ) -> WorkerExecutionOutcome:
        if not self.results.mark_running(job.job_id):
            return WorkerExecutionOutcome(
                executed=False,
                status="skipped",
                error_kind="none",
                should_ack=True,
            )

        if on_started is not None:
            on_started()

        try:
            plan = self._build_execution_plan(job)
            result = self.run_execution_plan_fn(
                plan,
                job.code,
                self.max_output_chars,
                isolate=self.isolate,
            )

            if result.get("error"):
                error_kind = str(result.get("error_kind") or "internal")
                persisted = self.results.mark_error(
                    job.job_id,
                    str(result["error"]),
                    result,
                    error_kind=error_kind,
                )
                if not persisted:
                    self.log.error(
                        "Failed to persist execution error result: row not updatable job_id=%s",
                        job.job_id,
                    )
                return WorkerExecutionOutcome(
                    executed=True,
                    status="error",
                    error_kind=error_kind,
                    should_ack=True,
                )

            persisted = self.results.mark_done(job.job_id, result)
            if not persisted:
                self.log.error(
                    "Failed to persist done result: row not updatable job_id=%s",
                    job.job_id,
                )
            return WorkerExecutionOutcome(
                executed=True,
                status="done",
                error_kind="none",
                should_ack=True,
            )
        except Exception as exc:
            self.log.exception(
                "Worker failed while processing job execution: job_id=%s",
                job.job_id,
            )
            try:
                persisted = self.results.mark_error(
                    job.job_id,
                    f"Worker error: {exc}",
                    error_kind="internal",
                )
                if not persisted:
                    self.log.error(
                        "Failed to persist worker exception result: row not updatable job_id=%s",
                        job.job_id,
                    )
                return WorkerExecutionOutcome(
                    executed=True,
                    status="error",
                    error_kind="internal",
                    should_ack=True,
                )
            except Exception:
                self.log.exception(
                    "Failed to persist worker error result: job_id=%s",
                    job.job_id,
                )
                return WorkerExecutionOutcome(
                    executed=True,
                    status="error",
                    error_kind="internal",
                    should_ack=False,
                )

    def _build_execution_plan(self, job: WorkerJob):
        if job.operation == "submit":
            return self.plan_factory.build_submit_plan(job.problem_id)
        if job.operation == "run":
            if job.cases_payload is None:
                raise ValueError("Run job is missing compiled cases payload")
            spec = self.problems.get_problem_spec(job.problem_id)
            compiled_cases = load_compiled_test_cases(
                job.cases_payload,
                spec,
                context="queued_run_payload",
            )
            return self.plan_factory.build_run_plan(job.problem_id, list(compiled_cases))
        raise ValueError(f"Invalid job operation: {job.operation}")


def _serialize_compiled_cases(cases: list[CompiledTestCase]) -> str:
    payload = [
        {
            "id": case.id,
            "input_code": case.input_code,
            "expected_literal": case.expected_literal,
        }
        for case in cases
    ]
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
