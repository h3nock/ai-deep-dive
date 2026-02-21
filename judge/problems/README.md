# Problems

Each problem lives in a directory with:

- `manifest.json`
- `public_tests.json`
- `hidden_tests.json`

Example:

```
problems/
  build-gpt/01-from-text-to-bytes/01-encoder/
    manifest.json
    public_tests.json
    hidden_tests.json
```

## manifest.json

```json
{
  "id": "build-gpt/01-from-text-to-bytes/01-encoder",
  "version": "v1",
  "runner": "encode(text)",
  "requires_torch": false,
  "time_limit_s": 10,
  "memory_mb": 1024,
  "comparison": { "type": "exact" }
}
```

Fields:
- `runner`: expression evaluated after input setup.
- `requires_torch`: routes job to the torch worker.
- `time_limit_s` and `memory_mb`: per-job limits.
- `comparison`: `exact` or `allclose` with `rtol` and `atol`.

## public_tests.json / hidden_tests.json

```json
{
  "version": 1,
  "cases": [
    {
      "id": "case1",
      "input_code": "text = \"Hello\"\n",
      "expected": [72, 101, 108]
    }
  ]
}
```

Notes:
- `expected` should be valid JSON whenever possible.
- For Python literals (e.g., tuple keys), store as a string and set
  `expected_is_code: true`.
- Use `input_code` for all test setup.
- Hidden tests are not publicly served from `/judge-tests/`; nginx should return
  `404` for direct `hidden_tests.json` requests.
- The judge returns the first failing hidden test on submit for debugging.
- Public bundles can be cached by the frontend or CDN.

## Judge tests endpoint export

`judge/scripts/export_tests_endpoint.py` exports artifacts to one or both roots:

- Judge endpoint root (`--out-root`, defaults to `judge/tests`):
  - `public_manifest.json`
  - `public_bundle.<version>.json`
  - `hidden_tests.json` (for server-side execution; not publicly served)
- Web public root (`--web-out-root`):
  - `public_manifest.json`
  - `public_bundle.<version>.json`

## Hidden test generation

`judge/scripts/generate_hidden_tests.py` generates deterministic `public_tests.json`
and `hidden_tests.json` for the current build-gpt challenges.

Default behavior:
- writes both `public_tests.json` and `hidden_tests.json` for each supported build-gpt problem
- keeps curated public examples deterministic per problem (first generated cases are the public cases)
- computes public and hidden expected values from the same reference implementations
- excludes public cases from hidden output to avoid duplicate submit execution
- generates hidden coverage inside the 15-25 target range
- uses scenario buckets: boundary, adversarial, random, regression, stress
- emits IDs with bucket prefixes (`b`, `a`, `r`, `g`, `s`)

Generate files:

```bash
python judge/scripts/generate_hidden_tests.py
```

Check reproducibility in CI/local validation:

```bash
python judge/scripts/generate_hidden_tests.py --check
```

Generate one problem only:

```bash
python judge/scripts/generate_hidden_tests.py --only build-gpt/03-embeddings/01-most-similar
```
