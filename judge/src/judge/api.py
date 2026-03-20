"""FastAPI service for the judge."""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from judge.config import Settings, load_settings
from judge.metrics import (
    record_http_request,
    register_process_exit,
    render_metrics,
    update_runtime_metrics,
)
from judge.models import (
    AcceptedResponse,
    ApiTestCase,
    JobResult,
    ProblemInfo,
    ReadinessCheck,
    ReadinessChecks,
    ReadinessResponse,
    RunRequest,
    SubmitRequest,
)
from judge.services import (
    DEFAULT_STREAM_ROUTING,
    InvalidProblemError,
    InvalidRunRequestError,
    ProblemNotFoundError,
    QueueFullError,
    QueueUnavailableError,
    StreamRouting,
    SubmissionService,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from judge.problems import ProblemRepository
    from judge.queue import RedisQueue
    from judge.results import ResultsStore


@dataclass(frozen=True)
class ApiDependencies:
    settings: Settings
    queue: RedisQueue
    results: ResultsStore
    problems: ProblemRepository
    submission: SubmissionService
    stream_routing: StreamRouting


def build_api_dependencies(
    *,
    settings: Settings | None = None,
    stream_routing: StreamRouting = DEFAULT_STREAM_ROUTING,
) -> ApiDependencies:
    from judge.problems import ProblemRepository
    from judge.queue import RedisQueue
    from judge.results import ResultsStore

    resolved_settings = settings or load_settings()
    queue = RedisQueue(resolved_settings.redis_url)
    results = ResultsStore(resolved_settings.results_db)
    problems = ProblemRepository(resolved_settings.problems_root)
    submission = SubmissionService(
        queue=queue,
        results=results,
        problems=problems,
        queue_maxlen=resolved_settings.queue_maxlen,
        stream_routing=stream_routing,
        log=logger,
    )
    return ApiDependencies(
        settings=resolved_settings,
        queue=queue,
        results=results,
        problems=problems,
        submission=submission,
        stream_routing=stream_routing,
    )


def _sanitize_job(job: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(job)
    error_kind = sanitized.get("error_kind")
    if error_kind not in {"user", "internal"}:
        error_kind = None
        sanitized["error_kind"] = None

    result = sanitized.get("result")
    if isinstance(result, dict):
        result = dict(result)
        # Keep error kind at the top-level response only.
        result.pop("error_kind", None)
        if {"status", "summary", "tests"}.issubset(result.keys()):
            sanitized["result"] = result
        else:
            result = None
            sanitized["result"] = None

    if error_kind == "internal":
        if sanitized.get("error"):
            sanitized["error"] = "Internal judge error. Please retry."
        if isinstance(result, dict) and result.get("error"):
            result["error"] = "Internal judge error. Please retry."
            sanitized["result"] = result
    return sanitized


def _check_redis_ready(dependencies: ApiDependencies) -> ReadinessCheck:
    try:
        dependencies.queue.client.ping()
    except Exception:
        logger.exception("Readiness check failed: redis unavailable")
        return ReadinessCheck(ok=False, detail="unavailable")
    return ReadinessCheck(ok=True, detail="ok")


def _check_db_ready(dependencies: ApiDependencies) -> ReadinessCheck:
    try:
        dependencies.results.ping()
    except Exception:
        logger.exception("Readiness check failed: database unavailable")
        return ReadinessCheck(ok=False, detail="unavailable")
    return ReadinessCheck(ok=True, detail="ok")


def _canonical_problems_available(root: Path) -> bool:
    try:
        return any(root.rglob("problem.json"))
    except OSError:
        logger.exception("Readiness check failed: problem repository scan failed")
        return False


def _check_problems_ready(dependencies: ApiDependencies) -> ReadinessCheck:
    root = dependencies.problems.root
    if not root.exists():
        return ReadinessCheck(ok=False, detail="missing")
    if not root.is_dir():
        return ReadinessCheck(ok=False, detail="invalid")
    if not _canonical_problems_available(root):
        return ReadinessCheck(ok=False, detail="empty")
    return ReadinessCheck(ok=True, detail="ok")


def _to_domain_test_case(case: ApiTestCase):
    from judge.problems import TestCase

    return TestCase(
        id=case.id,
        inputs=dict(case.inputs),
        expected_literal=case.expected_literal,
        explanation=case.explanation,
    )


def create_app(
    dependencies: ApiDependencies | None = None,
    *,
    register_metrics_exit_hook: bool = False,
) -> FastAPI:
    deps: ApiDependencies | None = dependencies
    settings = dependencies.settings if dependencies is not None else load_settings()

    def _deps() -> ApiDependencies:
        nonlocal deps
        if deps is None:
            deps = build_api_dependencies(settings=settings)
        return deps

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        nonlocal deps
        if deps is None:
            deps = build_api_dependencies(settings=settings)
        if register_metrics_exit_hook:
            register_process_exit()
        try:
            yield
        finally:
            deps = None

    app = FastAPI(title="AI Deep Dive Judge", lifespan=lifespan)
    if settings.allowed_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.allowed_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.perf_counter() - start
            record_http_request(request.method, request.url.path, 500, duration)
            raise

        duration = time.perf_counter() - start
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        record_http_request(request.method, path, response.status_code, duration)
        return response

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/ready", response_model=ReadinessResponse)
    def ready() -> ReadinessResponse | JSONResponse:
        deps = _deps()
        checks = ReadinessChecks(
            redis=_check_redis_ready(deps),
            db=_check_db_ready(deps),
            problems=_check_problems_ready(deps),
        )
        is_ready = checks.redis.ok and checks.db.ok and checks.problems.ok
        payload = ReadinessResponse(
            status="ready" if is_ready else "not_ready",
            checks=checks,
        )
        if is_ready:
            return payload
        return JSONResponse(status_code=503, content=payload.model_dump())

    @app.get("/metrics")
    def metrics() -> Response:
        deps = _deps()
        update_runtime_metrics(
            deps.queue.client,
            deps.results,
            deps.stream_routing.by_profile.values(),
            dict(deps.stream_routing.by_stream_group),
        )
        data, content_type = render_metrics()
        return Response(content=data, media_type=content_type)

    @app.get("/problems/{problem_id:path}", response_model=ProblemInfo)
    def get_problem(problem_id: str) -> ProblemInfo:
        deps = _deps()
        try:
            problem = deps.problems.get_problem_spec(problem_id)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="Problem not found")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid problem id")
        return ProblemInfo(
            id=problem.problem_id,
            execution_profile=problem.execution_profile,
            time_limit_s=problem.time_limit_s,
            memory_mb=problem.memory_mb,
        )

    @app.post("/submit", response_model=AcceptedResponse)
    def submit(request: SubmitRequest) -> AcceptedResponse:
        deps = _deps()
        try:
            queued = deps.submission.enqueue_submit(
                problem_id=request.problem_id,
                code=request.code,
            )
        except ProblemNotFoundError:
            raise HTTPException(status_code=404, detail="Problem not found")
        except InvalidProblemError:
            raise HTTPException(status_code=400, detail="Invalid problem id")
        except QueueFullError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except QueueUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        return AcceptedResponse(job_id=queued.job_id, status=queued.status)

    @app.post("/run", response_model=AcceptedResponse)
    def run(request: RunRequest) -> AcceptedResponse:
        deps = _deps()
        try:
            queued = deps.submission.enqueue_run(
                problem_id=request.problem_id,
                code=request.code,
                cases=[_to_domain_test_case(case) for case in request.cases],
            )
        except ProblemNotFoundError:
            raise HTTPException(status_code=404, detail="Problem not found")
        except InvalidProblemError:
            raise HTTPException(status_code=400, detail="Invalid problem id")
        except InvalidRunRequestError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        except QueueFullError as exc:
            raise HTTPException(status_code=503, detail=str(exc))
        except QueueUnavailableError as exc:
            raise HTTPException(status_code=503, detail=str(exc))

        return AcceptedResponse(job_id=queued.job_id, status=queued.status)

    @app.get("/result/{job_id}", response_model=JobResult)
    def get_result(job_id: str) -> JobResult:
        deps = _deps()
        job = deps.results.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobResult(**_sanitize_job(job))

    return app


app = create_app(register_metrics_exit_hook=True)
