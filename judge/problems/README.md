# Problems

Each authored problem lives in a directory with three source files:

- `problem.json`
- `public_cases.json`
- `starter.py`

Example:

```text
problems/
  build-gpt/01-from-text-to-bytes/01-encoder/
    problem.json
    public_cases.json
    starter.py
```

## `problem.json`

```json
{
  "schema_version": 1,
  "arguments": [
    { "name": "text" }
  ],
  "runner": "encode(text)",
  "execution_profile": "light",
  "comparison": { "type": "exact" },
  "time_limit_s": 10,
  "memory_mb": 1024
}
```

Fields:
- `arguments`: runner argument names in execution order.
- `runner`: expression evaluated after testcase setup.
- `execution_profile`: `light` or `torch`; this is the queue/worker routing key.
- `comparison`: either `{"type":"exact"}` or `{"type":"allclose","rtol":...,"atol":...}`.
- `time_limit_s` and `memory_mb`: per-job execution limits.

## `public_cases.json`

```json
{
  "schema_version": 1,
  "cases": [
    {
      "id": "case1",
      "inputs": {
        "text": "\"Hello\""
      },
      "expected_literal": "[72, 101, 108, 108, 111]"
    }
  ]
}
```

Notes:
- Public cases are learner-facing and must be authored in terms of real function arguments only.
- `inputs` values are Python expression strings, not arbitrary setup code.
- The judge validates public-case expressions against the canonical whitelist before compiling them.
- `expected_literal` must parse with `ast.literal_eval`.

## Runtime `hidden_tests.json`

```json
{
  "schema_version": 1,
  "cases": [
    {
      "id": "h1",
      "input_code": "text = \"Hello\"\n",
      "expected_literal": "[72, 101, 108, 108, 111]"
    }
  ]
}
```

Notes:
- Hidden tests are execution-oriented and may use helper locals or multi-step setup.
- Hidden tests are not publicly served.
- The judge executes canonical public cases first, then hidden tests, in one ordered plan.
- `hidden_tests.json` is generated into the runtime corpus only. It is not an authored source file.

## `starter.py`

`starter.py` contains the editor starter code for the challenge.

Notes:
- `starter.py` is canonical problem corpus data.
- `starter.py` must exist for every problem directory.
- `starter.py` must be non-empty and syntactically valid Python.
- The judge runtime does not load `starter.py` into `ProblemSpec` or `ExecutionPlan`.
- `starter.py` is consumed by downstream challenge/content assembly, not by worker execution.

## Hidden test generation

`judge/scripts/build_runtime_problem_corpus.py` copies authored problems into a
runtime output directory and generates deterministic `hidden_tests.json` there
for the supported build-gpt problems.

Default behavior:
- copies authored source problems into a runtime output directory
- generates `hidden_tests.json` there only
- reads canonical `public_cases.json` so hidden output does not duplicate public cases
- generates hidden coverage inside the 15-25 target range
- uses scenario buckets: boundary, adversarial, random, regression, stress
- emits IDs with bucket prefixes (`b`, `a`, `r`, `g`, `s`)

Build the default local runtime corpus:

```bash
PYTHONPATH=src python scripts/build_runtime_problem_corpus.py
```

Validate authored source contracts:

```bash
PYTHONPATH=src python scripts/validate_problem_contracts.py --kind source
```

Validate a generated runtime corpus:

```bash
PYTHONPATH=src python scripts/validate_problem_contracts.py --kind runtime --problems-root /tmp/judge-runtime-problems
```
