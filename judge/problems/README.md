# Problems

Each problem is a directory with:

- `manifest.json`
- `public_tests.json`
- `hidden_tests.json`

Example structure:

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
- `expected` should be valid JSON (numbers, strings, arrays, objects).
- If the expected value is a Python literal that is not JSON-friendly (e.g., tuple keys),
  store it as a string and set `expected_is_code: true`.
- If you need arbitrary Python setup per test, use `input_code`.
- Hidden tests stay on the server; public tests can be copied to the frontend.
- For best browser UX, prefer `inputs` over `input_code` so inputs can be rendered.

## Public bundle export

`judge/scripts/export_public_tests.py` writes to `web/public/judge-tests/...`:

- `public_manifest.json` (small file with version + bundle name)
- `public_bundle.<version>.json` (public tests + runner)

Fetch `public_manifest.json` first to learn the bundle file name for cache-friendly URLs.
