"""API models."""

from typing import Literal

from pydantic import BaseModel, Field


class SubmitRequest(BaseModel):
    problem_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Problem identifier",
    )
    code: str = Field(
        ...,
        max_length=100_000,
        description="User Python code",
    )
    kind: Literal["submit", "run"] = Field("submit", description="submit or run")


class SubmitResponse(BaseModel):
    job_id: str
    status: str


class RunTestResult(BaseModel):
    id: str
    status: str
    input: str | None = None
    stdout: str | None = None
    output: str | None = None
    expected: str | None = None
    stderr: str | None = None
    hidden: bool | None = None


class RunSummary(BaseModel):
    total: int
    passed: int
    failed: int
    public_total: int | None = None
    public_passed: int | None = None
    hidden_total: int | None = None
    hidden_passed: int | None = None


class RunPayload(BaseModel):
    status: str
    summary: RunSummary
    tests: list[RunTestResult]
    error: str | None = None


class JobResult(BaseModel):
    job_id: str
    status: str
    problem_id: str
    profile: str
    created_at: int
    started_at: int | None = None
    finished_at: int | None = None
    attempts: int = 0
    result: RunPayload | None = None
    error: str | None = None
    error_kind: Literal["user", "internal"] | None = None


class ProblemInfo(BaseModel):
    id: str
    version: str
    requires_torch: bool
    time_limit_s: int
    memory_mb: int
