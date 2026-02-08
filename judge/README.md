# Judge Service

Backend judge for AI Deep Dive.

- The browser runs public tests with Pyodide.
- The server runs hidden tests and torch-required problems.
- Jobs are queued in Redis Streams and handled by light and torch workers.
- Results are stored in SQLite on a single VM.

## Layout

```
judge/
  src/judge/
    api.py         FastAPI endpoints
    queue.py       Redis Streams wrapper
    worker.py      Worker loop
    runner.py      Test harness runner
    results.py     SQLite results store
    problems.py    Problem + tests loader
    models.py      Pydantic models
  problems/        Problem manifests + tests (server only)
  deploy/          VM deploy templates + scripts
```

## Quick start (local)

Install `uv` first if it is not already on your machine.

```bash
cd judge
uv venv .venv
source .venv/bin/activate
uv pip install -e .
```

Start Redis locally:

```bash
redis-server
```

Start the API:

```bash
uvicorn judge.api:app --reload
```

Frontend environment variable:

```
NEXT_PUBLIC_JUDGE_API_URL=http://localhost:8000
```

Set `JUDGE_ALLOWED_ORIGINS` when the web app runs on a different origin.
Use a comma-separated list.

Start workers:

```bash
python -m judge.worker --stream queue:light --group workers-light --consumer light-1
python -m judge.worker --stream queue:torch --group workers-torch --consumer torch-1
```

CPU-only PyTorch is required to run torch problems locally. Install it in the
same venv using the official PyTorch install selector.

## Export public tests for the frontend

```bash
python judge/scripts/export_public_tests.py
```

Bundles are written to `web/public/judge-tests/` and treated as build artifacts.
`web/scripts/export-judge-tests.mjs` runs automatically on `npm run build`.

To publish tests for the CLI from the judge VM:

```bash
python judge/scripts/export_tests_endpoint.py --out-root /opt/ai-deep-dive/judge/tests
```

## Submit a sample job

```bash
curl -X POST http://localhost:8000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "problem_id": "sample/01-basics/01-add",
    "kind": "submit",
    "code": "def add(a, b):\n    return a + b\n"
  }'
```

## Configuration

Environment variables:

- `JUDGE_REDIS_URL` (default: `redis://localhost:6379/0`)
- `JUDGE_RESULTS_DB` (default: `judge/data/judge.db`)
- `JUDGE_PROBLEMS_ROOT` (default: `judge/problems`)
- `JUDGE_MAX_OUTPUT_CHARS` (default: `2000`)
- `JUDGE_JOB_CLAIM_IDLE_MS` (default: `30000`)
- `JUDGE_JOB_CLAIM_COUNT` (default: `10`)
- `JUDGE_JOB_RETENTION_DAYS` (default: `7`)
- `JUDGE_QUEUE_MAXLEN` (default: `10000`)
- `JUDGE_QUEUE_STREAMS` (default: `queue:light,queue:torch`)
- `JUDGE_BACKUP_DIR` (default: `judge/data/backups`)
- `JUDGE_BACKUP_RETENTION_DAYS` (default: `7`)
- `JUDGE_ALLOWED_ORIGINS` (comma-separated)
- `JUDGE_SANDBOX_CMD_JSON` (optional sandbox wrapper)
- `PROMETHEUS_MULTIPROC_DIR` (optional, for API + worker metric aggregation)

Sandbox example (nsjail):

```bash
JUDGE_SANDBOX_CMD_JSON='["nsjail","--config","/etc/judge/nsjail.cfg","--"]'
```

## Notes

- OS-level sandboxing is optional. Enable it on the VM with `JUDGE_SANDBOX_CMD_JSON`.
- Hidden tests are not bundled for the browser. On submit, the first failing
  hidden test is returned for debugging.
- Production setup lives in `judge/deploy/`. See the deploy README for steps.
- Daily timers run on the VM to prune old jobs and save database backups.

## Metrics (Prometheus)

The API exposes Prometheus metrics at `http://127.0.0.1:8000/metrics`.
The deploy nginx templates do not expose `/metrics` on the public domain.
To aggregate worker + API metrics, set `PROMETHEUS_MULTIPROC_DIR` for all judge
services and ensure the directory exists and is writable by the `judge` user.
If Prometheus runs on a separate VM, expose metrics on a private-network
endpoint and scrape that private endpoint (instead of exposing metrics publicly).

Use a runtime path outside git, for example:

```bash
PROMETHEUS_MULTIPROC_DIR=/var/lib/judge/prometheus-multiproc
```

Deploy automation:

- `judge/deploy/apply.sh` prepares the multiprocess directory.
- `judge/deploy/judge-metrics-init.service` clears stale multiprocess shard
  files on startup.
- `judge/deploy/monitoring/apply-prometheus.sh` applies repo-managed
  Prometheus config + alert rules.
- `judge/deploy/monitoring/install-monitoring.sh` installs monitoring packages
  and enables services (Prometheus/Alertmanager/Grafana, Ubuntu-only).
- `judge/deploy/monitoring/apply-alertmanager.sh` applies Alertmanager routing
  for Telegram/email notifications and enforces single-node runtime flags for
  `prometheus-alertmanager`.
- `judge/deploy/monitoring/apply-grafana.sh` provisions Grafana datasource and
  dashboard.
- `judge/deploy/monitoring/send-test-alert.sh` injects a synthetic alert to
  test Telegram/email delivery through Alertmanager.

## Problem format

See `judge/problems/README.md` for manifest and test formats.

## Deploy

VM deploy templates and scripts live in `judge/deploy/`.
See `judge/deploy/README.md` for the full setup steps.
