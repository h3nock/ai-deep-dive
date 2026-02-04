# AI Deep Dive CLI

Learn AI/ML by building from scratch. This CLI tool helps you work through challenges locally with full editor support and automatic progress syncing.

## Installation

```bash
pip install ai-deep-dive
```

Or install from source:

```bash
cd cli
pip install -e .
```

## Quick Start

### 1. Initialize a Course

```bash
ai-deep-dive init build-chatgpt
cd build-chatgpt
```

This creates a workspace with all course challenges scaffolded:

```
build-chatgpt/
├── 01-tokenization/
│   ├── 01_pair_counter.py
│   ├── 02_token_merger.py
│   └── ...
├── 02-embeddings/
│   └── ...
└── .ai-deep-dive/
    └── config.json
```

### 2. Code in Your Editor

Open the folder in VS Code (or any editor). Edit the challenge files to implement your solutions.

### 3. Test Your Solution (Public Tests)

```bash
ai-deep-dive test 02-01
```

The test command will:

- Find your solution file (even if you reorganized the folder)
- Run the test suite
- Show detailed results
- Validate against public tests only

To run public + hidden tests and record completion:

```bash
ai-deep-dive submit 02-01
```

## Commands

| Command                      | Description                              |
| ---------------------------- | ---------------------------------------- |
| `ai-deep-dive init <course>` | Initialize a new course workspace        |
| `ai-deep-dive test <id>`     | Run tests for a specific challenge       |
| `ai-deep-dive submit <id>`   | Run public + hidden tests                |
| `ai-deep-dive status`        | Show your progress in the current course |
| `ai-deep-dive list`          | List available courses                   |

## How It Works

### Directory-Based Context

The CLI uses your current directory to determine which course you're working on. It looks for `.ai-deep-dive/config.json` in the current or parent directories.

### Smart File Search

You can reorganize your files however you like within the workspace. The CLI will find your solution by filename:

- Keep the original filename (e.g., `01_pair_counter.py`)
- The function signature must match what's expected

### Progress Sync

Your progress is stored locally in `~/.ai-deep-dive/status.json`. Use `ai-deep-dive submit` to record completion, then `ai-deep-dive sync` to sync your progress to the website.

### Tests and Bundles

Public tests are fetched from the tests endpoint (config `tests_url`, defaults to `https://judge.h3nok.dev`) and cached locally under `~/.ai-deep-dive/cache/judge-tests`.

Hidden tests are fetched from the same tests endpoint and cached locally under the same cache directory. This enables GPU-heavy challenges to be validated locally via `ai-deep-dive submit`.

You can set the endpoint with:

```bash
ai-deep-dive config set-tests-url https://tests.example.com
```

## Development

```bash
# Install in development mode
pip install -e ".[dev]"

# Run tests
pytest

# Format code
black src/
ruff check src/ --fix
```

## License

MIT
