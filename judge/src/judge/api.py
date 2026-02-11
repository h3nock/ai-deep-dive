"""FastAPI service for the judge."""

import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from judge.config import load_settings
from judge.metrics import (
    record_http_request,
    register_process_exit,
    render_metrics,
    update_runtime_metrics,
)
from judge.models import JobResult, ProblemInfo, SubmitRequest, SubmitResponse
from judge.problems import ProblemRepository
from judge.queue import RedisQueue
from judge.results import ResultsStore

settings = load_settings()
register_process_exit()
queue = RedisQueue(settings.redis_url)
results = ResultsStore(settings.results_db)
problems = ProblemRepository(settings.problems_root)

STREAMS = {
    "light": "queue:light",
    "torch": "queue:torch",
}

app = FastAPI(title="AI Deep Dive Judge")
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


def _sanitize_job(job: dict[str, Any]) -> dict[str, Any]:
    sanitized = dict(job)
    error_kind = sanitized.pop("error_kind", None)
    if error_kind == "internal":
        if sanitized.get("error"):
            sanitized["error"] = "Internal judge error. Please retry."
        result = sanitized.get("result")
        if isinstance(result, dict) and result.get("error"):
            result = dict(result)
            result["error"] = "Internal judge error. Please retry."
            sanitized["result"] = result
    return sanitized


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics")
async def metrics() -> Response:
    update_runtime_metrics(queue.client, results, STREAMS.values())
    data, content_type = render_metrics()
    return Response(content=data, media_type=content_type)


@app.get("/problems/{problem_id:path}", response_model=ProblemInfo)
async def get_problem(problem_id: str) -> ProblemInfo:
    try:
        problem = problems.get_route_info(problem_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid problem id")
    return ProblemInfo(
        id=problem.id,
        version=problem.version,
        requires_torch=problem.requires_torch,
        time_limit_s=problem.time_limit_s,
        memory_mb=problem.memory_mb,
    )


@app.post("/submit", response_model=SubmitResponse)
async def submit(request: SubmitRequest) -> SubmitResponse:
    try:
        problem = problems.get_route_info(request.problem_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid problem id")

    profile = "torch" if problem.requires_torch else "light"
    stream = STREAMS[profile]

    job_id = str(uuid.uuid4())
    created_at = int(time.time())
    results.create_job(job_id, problem.id, profile, request.kind, created_at=created_at)

    payload = {
        "job_id": job_id,
        "problem_id": problem.id,
        "problem_key": request.problem_id,
        "profile": profile,
        "kind": request.kind,
        "code": request.code,
        "created_at": created_at,
    }
    try:
        queue.enqueue(stream, payload)
    except Exception as exc:
        try:
            results.mark_error(
                job_id,
                "Failed to enqueue job",
                error_kind="internal",
            )
        except Exception:
            pass
        raise HTTPException(status_code=503, detail="Judge queue unavailable") from exc

    return SubmitResponse(job_id=job_id, status="queued")


@app.get("/result/{job_id}", response_model=JobResult)
async def get_result(job_id: str) -> JobResult:
    job = results.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResult(**_sanitize_job(job))
