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
- Use `input_code` for arbitrary setup.
- Prefer `inputs` (object of name to value) for better browser rendering.
- Hidden tests are served from the judge VM tests endpoint (not the web UI).
  The judge returns the first failing hidden test on submit for debugging.
  Public bundles can be cached by the frontend or CDN.

## Public bundle export

`judge/scripts/export_public_tests.py` writes to `web/public/judge-tests/...`:

- `public_manifest.json` (version + bundle name)
- `public_bundle.<version>.json` (public tests + runner)

Fetch `public_manifest.json` first to learn the bundle filename for cache-friendly URLs.

## Judge tests endpoint export

`judge/scripts/export_tests_endpoint.py` writes to `judge/tests/...` for serving
from the judge VM at `/judge-tests/`. It exports:

- `public_manifest.json`
- `public_bundle.<version>.json`
- `hidden_tests.json` (copied as-is)

## Hidden test generation

`judge/scripts/generate_hidden_tests.py` generates deterministic hidden tests for
the current build-gpt challenges.

Default behavior:
- writes `hidden_tests.json` for each supported build-gpt problem
- generates 20 hidden cases per problem (inside the 15-25 target range)
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
