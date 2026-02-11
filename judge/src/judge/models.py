"""API models."""

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class SubmitRequest(BaseModel):
    problem_id: str = Field(..., description="Problem identifier")
    code: str = Field(..., description="User Python code")
    kind: Literal["submit", "run"] = Field("submit", description="submit or run")


class SubmitResponse(BaseModel):
    job_id: str
    status: str


class JobResult(BaseModel):
    job_id: str
    status: str
    problem_id: str
    profile: str
    created_at: int
    started_at: Optional[int] = None
    finished_at: Optional[int] = None
    attempts: int = 0
    result: Optional[Any] = None
    error: Optional[str] = None


class ProblemInfo(BaseModel):
    id: str
    version: str
    requires_torch: bool
    time_limit_s: int
    memory_mb: int
