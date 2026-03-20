"""API models."""

from __future__ import annotations

import json
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_CODE_CHARS = 100_000
MAX_RUN_CASES = 10
MAX_RUN_CASES_PAYLOAD_BYTES = 256 * 1024
JobOperation = Literal["submit", "run"]


class SubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Problem identifier",
    )
    code: str = Field(
        ...,
        min_length=1,
        max_length=MAX_CODE_CHARS,
        description="User Python code",
    )


class ApiTestCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1)
    inputs: dict[str, str]
    expected_literal: str = Field(..., min_length=1)
    explanation: str | None = None

    @model_validator(mode="after")
    def validate_strings(self) -> "ApiTestCase":
        if not self.inputs:
            raise ValueError("inputs must contain at least one argument")
        for name, value in self.inputs.items():
            if not isinstance(name, str) or not name:
                raise ValueError("inputs keys must be non-empty strings")
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"inputs[{name}] must be a non-empty string")
        return self


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    problem_id: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Problem identifier",
    )
    code: str = Field(
        ...,
        min_length=1,
        max_length=MAX_CODE_CHARS,
        description="User Python code",
    )
    cases: list[ApiTestCase]

    @model_validator(mode="after")
    def validate_cases_payload(self) -> "RunRequest":
        case_count = len(self.cases)
        if case_count < 1 or case_count > MAX_RUN_CASES:
            raise ValueError(f"cases must contain between 1 and {MAX_RUN_CASES} items")

        serialized = json.dumps(
            [case.model_dump(exclude_none=True) for case in self.cases],
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode("utf-8")
        if len(serialized) > MAX_RUN_CASES_PAYLOAD_BYTES:
            raise ValueError(
                f"serialized cases payload must be <= {MAX_RUN_CASES_PAYLOAD_BYTES} bytes"
            )
        return self


class AcceptedResponse(BaseModel):
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


class RunSummary(BaseModel):
    total: int
    passed: int
    failed: int


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
    operation: JobOperation
    created_at: int
    started_at: int | None = None
    finished_at: int | None = None
    attempts: int = 0
    result: RunPayload | None = None
    error: str | None = None
    error_kind: Literal["user", "internal"] | None = None


class ReadinessCheck(BaseModel):
    ok: bool
    detail: str


class ReadinessChecks(BaseModel):
    redis: ReadinessCheck
    db: ReadinessCheck
    problems: ReadinessCheck


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: ReadinessChecks


class ProblemInfo(BaseModel):
    id: str
    execution_profile: Literal["light", "torch"]
    time_limit_s: int
    memory_mb: int
