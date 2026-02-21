"""Run warm-fork sandbox security probes and optional perf comparison."""

from __future__ import annotations

import argparse
import json
import statistics
import time
from pathlib import Path

from judge.problems import Comparison, Problem, ProblemRepository
from judge.problems import TestCase as ProblemTestCase
from judge.runner import IsolateConfig, run_problem
from judge.warm_executor import WarmForkExecutor


def _probe_problem(*, runner: str, expected: str) -> Problem:
    return Problem(
        id="security/probe",
        version="v1",
        runner=runner,
        requires_torch=True,
        time_limit_s=3,
        memory_mb=256,
        comparison=Comparison(type="exact", rtol=1e-5, atol=1e-8),
        public_tests=[ProblemTestCase(id="probe", input_code="", expected=expected, hidden=False)],
        hidden_tests=[],
    )


def _run_probe(
    *,
    executor: WarmForkExecutor,
    isolate: IsolateConfig,
    name: str,
    runner: str,
    code: str,
) -> dict[str, str]:
    result = executor.run_problem(
        _probe_problem(runner=runner, expected="blocked"),
        code,
        max_output_chars=2000,
        include_hidden=False,
        detail_mode="all",
        isolate=isolate,
    )
    tests = result.get("tests") or []
    output = tests[0].get("output") if tests else None
    ok = result.get("status") == "Accepted" and output == "'blocked'"
    return {
        "name": name,
        "ok": "true" if ok else "false",
        "status": str(result.get("status")),
        "output": str(output),
        "error": str(result.get("error")),
    }


def _perf_summary(values: list[float]) -> dict[str, float]:
    xs = sorted(values)
    p95 = xs[min(len(xs) - 1, int(round(0.95 * (len(xs) - 1))))]
    return {
        "mean": round(statistics.mean(values), 4),
        "min": round(min(values), 4),
        "max": round(max(values), 4),
        "p95": round(p95, 4),
    }


def _accepted_solution() -> str:
    return """\
import math
import torch

def multi_head_causal_attention(X, W_Q, W_K, W_V, W_O, num_heads):
    Q = X @ W_Q
    K = X @ W_K
    V = X @ W_V
    T, C = Q.shape
    head_size = C // num_heads
    Q = Q.view(T, num_heads, head_size).transpose(0, 1)
    K = K.view(T, num_heads, head_size).transpose(0, 1)
    V = V.view(T, num_heads, head_size).transpose(0, 1)
    scores = (Q @ K.transpose(-2, -1)) / math.sqrt(head_size)
    mask = torch.triu(torch.ones((T, T), dtype=torch.bool, device=scores.device), diagonal=1)
    scores = scores.masked_fill(mask, float('-inf'))
    weights = torch.softmax(scores, dim=-1)
    out = weights @ V
    out = out.transpose(0, 1).contiguous().view(T, C)
    return out @ W_O
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Warm fork security probe")
    parser.add_argument("--problems-root", default="problems")
    parser.add_argument(
        "--problem-id",
        default="build-gpt/06-multi-head-attention/01-multi-head-causal-attention",
    )
    parser.add_argument("--isolate-bin", default="/usr/local/bin/isolate")
    parser.add_argument("--python-bin", default="/opt/ai-deep-dive/judge/.venv/bin/python")
    parser.add_argument("--box-id", type=int, default=93)
    parser.add_argument("--runs", type=int, default=8)
    parser.add_argument("--skip-bench", action="store_true")
    args = parser.parse_args()

    isolate = IsolateConfig(
        executable=args.isolate_bin,
        box_id=args.box_id,
        use_cgroups=True,
        process_limit=64,
        wall_time_extra_s=2,
        timeout_grace_s=5,
        fsize_kb=1024,
        python_bin=args.python_bin,
    )

    executor = WarmForkExecutor(
        enable_no_new_privs=True,
        enable_seccomp=True,
        seccomp_fail_closed=True,
        clear_env=True,
        deny_filesystem=True,
        allow_root=True,
        preload_torch=True,
    )

    probes = [
        (
            "env_var_leak",
            "probe()",
            "import os\n"
            "def probe():\n"
            "    return 'blocked' if os.getenv('JUDGE_SUPER_SECRET') is None else 'leaked'\n",
        ),
        (
            "parent_environ_read",
            "probe()",
            "import os\n"
            "def probe():\n"
            "    p=os.getppid(); path=f'/proc/{p}/environ'\n"
            "    try:\n"
            "        open(path,'rb').read(64)\n"
            "        return 'leaked'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "hidden_tests_read",
            "probe()",
            "def probe():\n"
            "    try:\n"
            "        open('/opt/ai-deep-dive/judge/problems/"
            "build-gpt/06-multi-head-attention/01-multi-head-causal-attention/hidden_tests.json','r').read()\n"
            "        return 'leaked'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "metadata_exists_hidden_tests",
            "probe()",
            "import os\n"
            "def probe():\n"
            "    p='/opt/ai-deep-dive/judge/problems/"
            "build-gpt/06-multi-head-attention/01-multi-head-causal-attention/hidden_tests.json'\n"
            "    try:\n"
            "        return 'leaked' if os.path.exists(p) else 'blocked'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "judge_db_write",
            "probe()",
            "def probe():\n"
            "    try:\n"
            "        with open('/opt/ai-deep-dive/judge/data/judge.db','ab') as f:\n"
            "            f.write(b'X')\n"
            "        return 'tampered'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "socket_connect",
            "probe()",
            "import socket\n"
            "def probe():\n"
            "    try:\n"
            "        s=socket.socket(socket.AF_INET, socket.SOCK_STREAM)\n"
            "        s.connect(('1.1.1.1',53))\n"
            "        return 'connected'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "subprocess_exec",
            "probe()",
            "import subprocess\n"
            "def probe():\n"
            "    try:\n"
            "        subprocess.run(['id'], check=True)\n"
            "        return 'executed'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
        (
            "prlimit_parent",
            "probe()",
            "import os\n"
            "import resource\n"
            "def probe():\n"
            "    try:\n"
            "        resource.prlimit(os.getppid(), resource.RLIMIT_NOFILE)\n"
            "        return 'leaked'\n"
            "    except Exception:\n"
            "        return 'blocked'\n",
        ),
    ]

    rows = []
    for name, runner, code in probes:
        rows.append(
            _run_probe(
                executor=executor,
                isolate=isolate,
                name=name,
                runner=runner,
                code=code,
            )
        )

    all_ok = all(row["ok"] == "true" for row in rows)
    output: dict[str, object] = {
        "security_ok": all_ok,
        "probes": rows,
    }

    if not args.skip_bench:
        repo = ProblemRepository(Path(args.problems_root))
        problem = repo.get_for_submit(args.problem_id)
        solution = _accepted_solution()

        isolate_times: list[float] = []
        isolate_statuses: list[str] = []
        for _ in range(args.runs):
            t0 = time.perf_counter()
            result = run_problem(problem, solution, 2000, True, "all", isolate)
            isolate_times.append(time.perf_counter() - t0)
            isolate_statuses.append(result["status"])

        warm_times: list[float] = []
        warm_statuses: list[str] = []
        for _ in range(args.runs):
            t0 = time.perf_counter()
            result = executor.run_problem(problem, solution, 2000, True, "all", isolate)
            warm_times.append(time.perf_counter() - t0)
            warm_statuses.append(result["status"])

        output["benchmark"] = {
            "problem_id": args.problem_id,
            "runs": args.runs,
            "isolate": _perf_summary(isolate_times),
            "warm_fork": _perf_summary(warm_times),
            "isolate_statuses": sorted(set(isolate_statuses)),
            "warm_statuses": sorted(set(warm_statuses)),
            "speedup_mean_x": round(statistics.mean(isolate_times) / statistics.mean(warm_times), 2),
        }

    print(json.dumps(output, indent=2))
    if not all_ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
