# AI Deep Dive CLI

The CLI is temporarily frozen.

We are redesigning it as a project-focused local workflow tool (starting with
Build GPT project work). Challenge-oriented chapter commands are intentionally
not exposed right now.

## Installation

```bash
pip install ai-deep-dive
```

Or install from source:

```bash
cd cli
pip install -e .
```

## Current behavior

```bash
ai-deep-dive
```

Prints a temporary status message indicating the CLI is frozen.

```bash
ai-deep-dive --version
```

Prints the installed CLI version.

## Temporarily unavailable commands

The following command surface is intentionally unavailable during the freeze:

- `ai-deep-dive init`
- `ai-deep-dive test`
- `ai-deep-dive submit`
- `ai-deep-dive status`
- `ai-deep-dive list`
- `ai-deep-dive sync`
- `ai-deep-dive config`

## Next scope

The next CLI release will target project-local implementation workflows rather
than chapter challenge orchestration.

## License

MIT
