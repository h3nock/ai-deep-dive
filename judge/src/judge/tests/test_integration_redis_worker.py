"""Integration test for API submit -> Redis stream -> one worker iteration."""

from __future__ import annotations

import importlib.util
import os
import tempfile
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

HAS_FASTAPI = importlib.util.find_spec("fastapi") is not None
HAS_HTTPX = importlib.util.find_spec("httpx") is not None
HAS_REDIS = importlib.util.find_spec("redis") is not None


class RedisWorkerIntegrationTests(TestCase):
    def setUp(self) -> None:
        if not HAS_FASTAPI or not HAS_HTTPX or not HAS_REDIS:
            self.skipTest("fastapi/httpx/redis dependencies not installed")

        from fastapi.testclient import TestClient

        from judge.api import ApiDependencies, create_app
        from judge.problems import ProblemRepository
        from judge.queue import RedisQueue
        from judge.results import ResultsStore
        from judge.runner import IsolateConfig
        from judge.services import (
            StreamRouting,
            SubmissionService,
            WorkerExecutionService,
        )
        from judge.worker import _process_queue_entry

        self.TestClient = TestClient
        self.ApiDependencies = ApiDependencies
        self.create_app = create_app
        self.ProblemRepository = ProblemRepository
        self.RedisQueue = RedisQueue
        self.ResultsStore = ResultsStore
        self.IsolateConfig = IsolateConfig
        self.StreamRouting = StreamRouting
        self.SubmissionService = SubmissionService
        self.WorkerExecutionService = WorkerExecutionService
        self.process_queue_entry = _process_queue_entry

    def _pending_count(self, pending_info: object) -> int:
        if isinstance(pending_info, dict):
            return int(pending_info.get("pending", 0))
        if isinstance(pending_info, tuple) and pending_info:
            return int(pending_info[0])
        if isinstance(pending_info, list) and pending_info:
            return int(pending_info[0])
        return 0

    def _redis_url(self) -> str:
        return os.getenv("JUDGE_TEST_REDIS_URL", "redis://localhost:6379/15")

    def test_submit_process_once_and_result_done(self) -> None:
        redis_url = self._redis_url()
        queue = self.RedisQueue(redis_url)
        try:
            queue.client.ping()
        except Exception:
            self.skipTest("redis server not reachable at JUDGE_TEST_REDIS_URL")
        db_index = int(queue.client.connection_pool.connection_kwargs.get("db", 0))
        if db_index == 0:
            self.skipTest("set JUDGE_TEST_REDIS_URL to a dedicated non-zero Redis DB index")
        queue.client.flushdb()
        self.addCleanup(queue.client.flushdb)

        suffix = uuid.uuid4().hex[:10]
        stream_light = f"queue:itest-light:{suffix}"
        stream_torch = f"queue:itest-torch:{suffix}"
        group_light = f"workers-itest-light-{suffix}"
        group_torch = f"workers-itest-torch-{suffix}"
        routing = self.StreamRouting(
            by_profile={
                "light": stream_light,
                "torch": stream_torch,
            },
            by_stream_group={
                stream_light: group_light,
                stream_torch: group_torch,
            },
        )

        problems_root = Path(__file__).resolve().parents[3] / "problems"
        problems = self.ProblemRepository(problems_root)

        with tempfile.TemporaryDirectory() as tmp_dir:
            store = self.ResultsStore(Path(tmp_dir) / "judge.db")
            submission = self.SubmissionService(
                queue=queue,
                results=store,
                problems=problems,
                queue_maxlen=100,
                stream_routing=routing,
            )
            dependencies = self.ApiDependencies(
                settings=SimpleNamespace(allowed_origins=[], queue_maxlen=100),
                queue=queue,
                results=store,
                problems=problems,
                submission=submission,
                stream_routing=routing,
            )
            app = self.create_app(dependencies)
            client = self.TestClient(app)

            queue.ensure_group(stream_light, group_light)

            submit_response = client.post(
                "/submit",
                json={
                    "problem_id": "sample/01-basics/01-add",
                    "kind": "submit",
                    "code": "def add(a, b):\n    return a + b\n",
                },
            )
            self.assertEqual(submit_response.status_code, 200)
            job_id = submit_response.json().get("job_id")
            self.assertTrue(job_id)

            queued_result = client.get(f"/result/{job_id}")
            self.assertEqual(queued_result.status_code, 200)
            self.assertEqual(queued_result.json().get("status"), "queued")

            entry = queue.read(stream_light, group_light, "itest-1", block_ms=200)
            self.assertIsNotNone(entry)
            assert entry is not None
            msg_id, fields = entry
            self.assertEqual(int(queue.client.xlen(stream_light)), 1)
            self.assertEqual(
                self._pending_count(queue.client.xpending(stream_light, group_light)),
                1,
            )

            def _run_problem_ok(*_args, **_kwargs):
                return {
                    "status": "Accepted",
                    "summary": {
                        "total": 1,
                        "passed": 1,
                        "failed": 0,
                        "public_total": 0,
                        "public_passed": 0,
                        "hidden_total": 1,
                        "hidden_passed": 1,
                    },
                    "tests": [],
                    "error": None,
                }

            execution = self.WorkerExecutionService(
                results=store,
                problems=problems,
                isolate=self.IsolateConfig(executable="/usr/bin/isolate", box_id=1),
                max_output_chars=2000,
                run_problem_fn=_run_problem_ok,
                log=Mock(),
            )

            self.process_queue_entry(
                stream=stream_light,
                group=group_light,
                consumer="itest-1",
                worker_profile="light",
                msg_id=msg_id,
                fields=fields,
                queue=queue,
                results=store,
                execution=execution,
            )

            result_response = client.get(f"/result/{job_id}")
            self.assertEqual(result_response.status_code, 200)
            payload = result_response.json()
            self.assertEqual(payload.get("status"), "done")
            self.assertEqual(payload.get("error_kind"), None)
            self.assertEqual(payload.get("result", {}).get("status"), "Accepted")

            # Processed message must be acked and removed from stream.
            self.assertEqual(int(queue.client.xlen(stream_light)), 0)
            self.assertEqual(
                self._pending_count(queue.client.xpending(stream_light, group_light)),
                0,
            )

    def test_reclaim_then_process_results_in_single_terminal_completion(self) -> None:
        redis_url = self._redis_url()
        queue = self.RedisQueue(redis_url)
        try:
            queue.client.ping()
        except Exception:
            self.skipTest("redis server not reachable at JUDGE_TEST_REDIS_URL")
        db_index = int(queue.client.connection_pool.connection_kwargs.get("db", 0))
        if db_index == 0:
            self.skipTest("set JUDGE_TEST_REDIS_URL to a dedicated non-zero Redis DB index")
        queue.client.flushdb()
        self.addCleanup(queue.client.flushdb)

        suffix = uuid.uuid4().hex[:10]
        stream_light = f"queue:itest-light:{suffix}"
        stream_torch = f"queue:itest-torch:{suffix}"
        group_light = f"workers-itest-light-{suffix}"
        group_torch = f"workers-itest-torch-{suffix}"
        routing = self.StreamRouting(
            by_profile={
                "light": stream_light,
                "torch": stream_torch,
            },
            by_stream_group={
                stream_light: group_light,
                stream_torch: group_torch,
            },
        )

        problems_root = Path(__file__).resolve().parents[3] / "problems"
        problems = self.ProblemRepository(problems_root)

        with tempfile.TemporaryDirectory() as tmp_dir:
            store = self.ResultsStore(Path(tmp_dir) / "judge.db")
            submission = self.SubmissionService(
                queue=queue,
                results=store,
                problems=problems,
                queue_maxlen=100,
                stream_routing=routing,
            )
            dependencies = self.ApiDependencies(
                settings=SimpleNamespace(allowed_origins=[], queue_maxlen=100),
                queue=queue,
                results=store,
                problems=problems,
                submission=submission,
                stream_routing=routing,
            )
            app = self.create_app(dependencies)
            client = self.TestClient(app)

            queue.ensure_group(stream_light, group_light)

            submit_response = client.post(
                "/submit",
                json={
                    "problem_id": "sample/01-basics/01-add",
                    "kind": "submit",
                    "code": "def add(a, b):\n    return a + b\n",
                },
            )
            self.assertEqual(submit_response.status_code, 200)
            job_id = submit_response.json().get("job_id")
            self.assertTrue(job_id)

            first_read = queue.read(stream_light, group_light, "itest-crashed", block_ms=200)
            self.assertIsNotNone(first_read)
            assert first_read is not None
            first_msg_id, _ = first_read
            self.assertEqual(int(queue.client.xlen(stream_light)), 1)
            self.assertEqual(
                self._pending_count(queue.client.xpending(stream_light, group_light)),
                1,
            )

            reclaimed = queue.autoclaim(
                stream_light,
                group_light,
                "itest-reclaimer",
                min_idle_ms=0,
                count=10,
            )
            self.assertEqual(len(reclaimed), 1)
            reclaimed_msg_id, reclaimed_fields = reclaimed[0]
            self.assertEqual(reclaimed_msg_id, first_msg_id)

            def _run_problem_ok(*_args, **_kwargs):
                return {
                    "status": "Accepted",
                    "summary": {
                        "total": 1,
                        "passed": 1,
                        "failed": 0,
                        "public_total": 0,
                        "public_passed": 0,
                        "hidden_total": 1,
                        "hidden_passed": 1,
                    },
                    "tests": [],
                    "error": None,
                }

            execution = self.WorkerExecutionService(
                results=store,
                problems=problems,
                isolate=self.IsolateConfig(executable="/usr/bin/isolate", box_id=1),
                max_output_chars=2000,
                run_problem_fn=_run_problem_ok,
                log=Mock(),
            )

            self.process_queue_entry(
                stream=stream_light,
                group=group_light,
                consumer="itest-reclaimer",
                worker_profile="light",
                msg_id=reclaimed_msg_id,
                fields=reclaimed_fields,
                queue=queue,
                results=store,
                execution=execution,
            )

            result_response = client.get(f"/result/{job_id}")
            self.assertEqual(result_response.status_code, 200)
            payload = result_response.json()
            self.assertEqual(payload.get("status"), "done")
            self.assertEqual(payload.get("error_kind"), None)
            self.assertEqual(payload.get("result", {}).get("status"), "Accepted")

            job_row = store.get_job(job_id)
            assert job_row is not None
            self.assertEqual(job_row.get("attempts"), 1)

            self.assertEqual(int(queue.client.xlen(stream_light)), 0)
            self.assertEqual(
                self._pending_count(queue.client.xpending(stream_light, group_light)),
                0,
            )
