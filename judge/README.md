# Judge Service

Backend judge for AI Deep Dive.

- Browser runs public tests (Pyodide).
- Server runs hidden tests and PyTorch-required problems.
- Redis Streams queue with light + torch worker pools.
- SQLite results store (single VM).

## Layout

```
judge/
  src/judge/
    api.py         FastAPI endpoints
    queue.py       Redis Streams wrapper
    worker.py      Worker loop
    runner.py      Test harness runner
    results.py     SQLite result store
    problems.py    Problem + tests loader
    models.py      Pydantic models
  problems/        Problem manifests + tests (kept on the server)
```

## Quick start (local)

```bash
cd judge
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Run Redis locally:

```bash
redis-server
```

Start API:

```bash
uvicorn judge.api:app --reload
```

Frontend env:

```
NEXT_PUBLIC_JUDGE_API_URL=http://localhost:8000
```
If the web app runs on a different origin, set `JUDGE_ALLOWED_ORIGINS`
in the judge environment (comma-separated list).

Start workers:

```bash
python -m judge.worker --stream queue:light --group workers-light --consumer light-1
python -m judge.worker --stream queue:torch --group workers-torch --consumer torch-1
```

If you plan to run torch problems on this machine, install CPU-only PyTorch in the
same venv (use the official PyTorch install selector for the exact command).

Export public tests for the frontend:

```bash
python judge/scripts/export_public_tests.py
```

Generated bundles are written to `web/public/judge-tests/` and treated as build artifacts.

When building the web app, `web/scripts/export-judge-tests.mjs` runs automatically
via `npm run build`.

Submit a sample job:

```bash
curl -X POST http://localhost:8000/submit \\
  -H "Content-Type: application/json" \\
  -d '{
    "problem_id": "sample/01-basics/01-add",
    "kind": "submit",
    "code": "def add(a, b):\\n    return a + b\\n"
  }'
```

## Problem format (server side)

Each problem lives under `judge/problems/` with:

- `manifest.json`
- `public_tests.json`
- `hidden_tests.json`

Public tests are copied to the frontend (static) and cached.
Hidden tests stay on the server.

## Operational notes

- This runner does not yet apply OS-level sandboxing. Add nsjail/isolate on the VM.
- Hidden tests are never served to the browser.
- VM deploy templates live in `judge/deploy/`.

## Sandbox integration

`JUDGE_SANDBOX_CMD_JSON` lets you wrap executions in a sandbox command. The JSON
array is prepended to the Python harness command.

Example (nsjail):

```bash
JUDGE_SANDBOX_CMD_JSON='["nsjail","--config","/etc/judge/nsjail.cfg","--"]'
```
