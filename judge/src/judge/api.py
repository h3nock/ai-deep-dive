"""FastAPI service for the judge."""

import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from judge.config import load_settings
from judge.models import JobResult, ProblemInfo, SubmitRequest, SubmitResponse
from judge.problems import load_problem
from judge.queue import RedisQueue
from judge.results import ResultsStore

settings = load_settings()
queue = RedisQueue(settings.redis_url)
results = ResultsStore(settings.results_db)

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


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/problems/{problem_id}", response_model=ProblemInfo)
async def get_problem(problem_id: str) -> ProblemInfo:
    try:
        problem = load_problem(problem_id, settings.problems_root)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
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
        problem = load_problem(request.problem_id, settings.problems_root)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")

    profile = "torch" if problem.requires_torch else "light"
    stream = STREAMS[profile]

    job_id = str(uuid.uuid4())
    results.create_job(job_id, problem.id, profile, request.kind)

    payload = {
        "job_id": job_id,
        "problem_id": request.problem_id,
        "profile": profile,
        "kind": request.kind,
        "code": request.code,
    }
    queue.enqueue(stream, payload)

    return SubmitResponse(job_id=job_id, status="queued")


@app.get("/result/{job_id}", response_model=JobResult)
async def get_result(job_id: str) -> JobResult:
    job = results.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResult(**job)
