#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[fail] $1" >&2
  exit 1
}

pass() {
  echo "[pass] $1"
}

resolve_redis_service() {
  if systemctl list-unit-files --type=service --no-legend | awk '$1 == "redis-server.service" {found=1} END {exit(found ? 0 : 1)}'; then
    echo "redis-server.service"
    return
  fi
  if systemctl list-unit-files --type=service --no-legend | awk '$1 == "redis.service" && $2 != "alias" {found=1} END {exit(found ? 0 : 1)}'; then
    echo "redis.service"
    return
  fi
  fail "No usable Redis unit found (expected redis-server.service or redis.service)."
}

if [[ $(id -u) -ne 0 ]]; then
  fail "Please run as root (sudo)."
fi

for cmd in curl python3 systemctl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing required command: $cmd"
  fi
done

if ! id judge >/dev/null 2>&1; then
  fail "System user 'judge' does not exist."
fi
pass "judge user exists"

ENV_FILE=/etc/judge/judge.env
if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing environment file: $ENV_FILE"
fi
chown root:root "$ENV_FILE"
chmod 0640 "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
pass "environment file present and readable"

required_keys=(
  JUDGE_REDIS_URL
  JUDGE_RESULTS_DB
  JUDGE_PROBLEMS_ROOT
  JUDGE_API_WORKERS
  JUDGE_LIGHT_WORKERS
  JUDGE_TORCH_WORKERS
  JUDGE_ALLOWED_ORIGINS
  JUDGE_ISOLATE_BIN
)
for key in "${required_keys[@]}"; do
  value="${!key-}"
  if [[ -z "$value" ]]; then
    fail "Required env key is missing or empty: $key"
  fi
done
pass "required env keys are present"

for key in JUDGE_API_WORKERS JUDGE_LIGHT_WORKERS JUDGE_TORCH_WORKERS; do
  value="${!key}"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    fail "$key must be a non-negative integer (got: $value)"
  fi
done

redis_service=$(resolve_redis_service)
systemctl is-active --quiet "$redis_service" || fail "Redis service is not active: $redis_service"

if ! command -v redis-cli >/dev/null 2>&1; then
  fail "redis-cli is required for Redis readiness verification"
fi
redis_ping=$(redis-cli -u "$JUDGE_REDIS_URL" ping 2>/dev/null || true)
if [[ "$redis_ping" != "PONG" ]]; then
  fail "Redis ping failed for $JUDGE_REDIS_URL"
fi
pass "Redis service and ping are healthy"

systemctl is-active --quiet judge-api.service || fail "judge-api.service is not active"
systemctl is-enabled --quiet judge-api.service || fail "judge-api.service is not enabled"
pass "judge-api.service is active and enabled"

if systemctl is-active --quiet judge-worker-light.service; then
  fail "Legacy unit active: judge-worker-light.service"
fi
if systemctl is-active --quiet judge-worker-torch.service; then
  fail "Legacy unit active: judge-worker-torch.service"
fi
pass "legacy worker units are inactive"

check_worker_family() {
  local family="$1"
  local expected="$2"
  local prefix="judge-worker-${family}"
  local unit
  local index
  local seen=0
  local -a active_units=()

  if (( expected > 0 )); then
    for index in $(seq 1 "$expected"); do
      unit="${prefix}@${index}.service"
      systemctl is-active --quiet "$unit" || fail "$unit is not active"
      systemctl is-enabled --quiet "$unit" || fail "$unit is not enabled"
    done
  fi

  mapfile -t active_units < <(systemctl list-units --type=service --state=active --plain --no-legend "${prefix}@*.service" 2>/dev/null | awk '{print $1}')
  for unit in "${active_units[@]}"; do
    [[ -z "$unit" ]] && continue
    if [[ "$unit" =~ ^${prefix}@([0-9]+)\.service$ ]]; then
      index=${BASH_REMATCH[1]}
      ((seen += 1))
      if (( index > expected )); then
        fail "Unexpected active worker unit: $unit (expected max index $expected)"
      fi
    fi
  done

  if (( seen != expected )); then
    fail "Active ${family} worker count mismatch: expected=$expected actual=$seen"
  fi

  pass "${family} worker count matches expected=${expected}"
}

check_worker_family "light" "$JUDGE_LIGHT_WORKERS"
check_worker_family "torch" "$JUDGE_TORCH_WORKERS"

api_url=${JUDGE_VERIFY_API_URL:-http://127.0.0.1:8000}
smoke_problem_id=${JUDGE_VERIFY_SMOKE_PROBLEM_ID:-sample/01-basics/01-add}
default_smoke_code=$'def add(a, b):\n    return a + b\n'
smoke_code=${JUDGE_VERIFY_SMOKE_CODE:-$default_smoke_code}
smoke_expected_status=${JUDGE_VERIFY_SMOKE_EXPECTED_STATUS:-Accepted}

smoke_manifest="${JUDGE_PROBLEMS_ROOT%/}/${smoke_problem_id}/problem.json"
if [[ ! -f "$smoke_manifest" ]]; then
  fail "Smoke problem not found at ${smoke_manifest}. Set JUDGE_VERIFY_SMOKE_PROBLEM_ID/JUDGE_VERIFY_SMOKE_CODE for your corpus."
fi

health_json=$(curl -fsS "${api_url}/health") || fail "Failed to query ${api_url}/health"
health_status=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$health_json")
if [[ "$health_status" != "ok" ]]; then
  fail "Unexpected /health status: $health_status"
fi
pass "/health reports ok"

ready_json=$(curl -fsS "${api_url}/ready") || fail "Failed to query ${api_url}/ready"
ready_status=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$ready_json")
if [[ "$ready_status" != "ready" ]]; then
  fail "Unexpected /ready status: $ready_status"
fi
ready_checks_ok=$(python3 -c 'import json,sys; d=json.load(sys.stdin); checks=d.get("checks",{}); print("1" if all(v.get("ok") for v in checks.values()) else "0")' <<<"$ready_json")
if [[ "$ready_checks_ok" != "1" ]]; then
  fail "/ready checks contain non-healthy dependency"
fi
pass "/ready reports all dependencies healthy"

submit_payload=$(SMOKE_PROBLEM_ID="$smoke_problem_id" SMOKE_CODE="$smoke_code" python3 - <<'PY'
import json
import os
print(
    json.dumps(
        {
            "problem_id": os.environ["SMOKE_PROBLEM_ID"],
            "kind": "submit",
            "code": os.environ["SMOKE_CODE"],
        }
    )
)
PY
)

submit_json=$(curl -fsS -H "content-type: application/json" -d "$submit_payload" "${api_url}/submit") || fail "Smoke submit request failed"
job_id=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("job_id",""))' <<<"$submit_json")
if [[ -z "$job_id" ]]; then
  fail "Smoke submit did not return a job_id"
fi

timeout_s=${JUDGE_VERIFY_SMOKE_TIMEOUT_S:-30}
if [[ ! "$timeout_s" =~ ^[0-9]+$ ]] || (( timeout_s < 1 )); then
  fail "JUDGE_VERIFY_SMOKE_TIMEOUT_S must be a positive integer"
fi

deadline=$((SECONDS + timeout_s))
terminal_json=""
while (( SECONDS < deadline )); do
  result_json=$(curl -fsS "${api_url}/result/${job_id}") || fail "Smoke result polling failed for job ${job_id}"
  result_status=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$result_json")
  if [[ "$result_status" == "done" || "$result_status" == "error" ]]; then
    terminal_json="$result_json"
    break
  fi
  sleep 1
done

if [[ -z "$terminal_json" ]]; then
  fail "Smoke submit did not reach terminal status within ${timeout_s}s (job_id=${job_id})"
fi

terminal_status=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$terminal_json")
if [[ "$terminal_status" != "done" ]]; then
  terminal_error=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("error",""))' <<<"$terminal_json")
  fail "Smoke submit failed (status=${terminal_status}, job_id=${job_id}, error=${terminal_error})"
fi

judge_status=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print((d.get("result") or {}).get("status",""))' <<<"$terminal_json")
if [[ "$judge_status" != "$smoke_expected_status" ]]; then
  fail "Smoke submit result mismatch (job_id=${job_id}, expected=${smoke_expected_status}, actual=${judge_status})"
fi
pass "submit/result smoke test passed (job_id=${job_id}, problem_id=${smoke_problem_id})"

echo "[ok] verify completed successfully"
