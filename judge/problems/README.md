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
  "time_limit_s": 5,
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
- Hidden tests stay on the server. Public bundles can be cached by the frontend or CDN.

## Public bundle export

`judge/scripts/export_public_tests.py` writes to `web/public/judge-tests/...`:

- `public_manifest.json` (version + bundle name)
- `public_bundle.<version>.json` (public tests + runner)

Fetch `public_manifest.json` first to learn the bundle filename for cache-friendly URLs.
