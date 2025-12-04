# Challenge Architecture: The Hybrid Local-First Model

This document outlines the finalized architecture for the **AI Deep Dive Platform**. We use a **Hybrid Model** that combines the ease of browser-based learning with the power of local development.

---

## 1. The Strategy: Hybrid & Local-First

| Feature       | Intro Chapters (1-4)         | Advanced Chapters & Projects (5+)   |
| :------------ | :--------------------------- | :---------------------------------- |
| **Execution** | **Browser (Pyodide)**        | **Local (CLI + PyTorch)**           |
| **Goal**      | Low friction, instant "hook" | Real-world skills, GPU access       |
| **Storage**   | `localStorage` (Browser)     | `~/.ai-deep-dive/status.json`       |
| **Sync**      | Native                       | **URL-based sync** (user-initiated) |

### Why Keep Both?

| Browser Editor                   | CLI                                  |
| -------------------------------- | ------------------------------------ |
| Zero friction - instant start    | Requires `pip install`, Python setup |
| Great for beginners              | Better for experienced devs          |
| Works on any device (iPad, etc.) | Desktop only                         |
| Pyodide limitations - no GPU     | Full PyTorch, GPU access             |
| Quick exploration                | Serious project work                 |

**Recommendation:** Keep the browser editor for intro chapters. Add a gentle nudge in later chapters:

> "This chapter works best locally. [Set up CLI →]"

---

## 2. The CLI Experience: "Course Workspace"

We use a **Directory-as-Context** model. You initialize a course into a folder, and that folder becomes your workspace.

### A. The Workflow

1. **Init Course:** One command sets up the entire curriculum.

   ```bash
   $ ai-deep-dive init build-chatgpt

   Creating course workspace: Build ChatGPT from Scratch

   build-chatgpt/
   ├── .ai-deep-dive/
   │   └── config.json
   ├── 01-from-text-to-bytes/
   │   └── 01_encoder.py
   ├── 02-tokenization/
   │   ├── 01_pair_counter.py
   │   ├── 02_token_merger.py
   │   └── ...
   └── ...

   🚀 Ready! Run: cd build-chatgpt
   ```

2. **Code:** Edit files locally in VS Code (or any editor).

3. **Test:** Run tests with context-aware commands.

   ```bash
   $ ai-deep-dive test 02-01

   Running tests for: The Pair Counter
   Challenge 02-01 • Easy

   ┌──────┬──────────┬─────────┐
   │ Case │ Status   │ Details │
   ├──────┼──────────┼─────────┤
   │ case1│ ✓ Passed │         │
   │ case2│ ✓ Passed │         │
   └──────┴──────────┴─────────┘

   🎉 Accepted - All tests passed!

   Tip: Run 'ai-deep-dive sync' to update your web profile
   ```

4. **Sync:** Push progress to website when ready.

   ```bash
   $ ai-deep-dive sync

   Syncing: Build ChatGPT from Scratch
   Progress: 5 challenges completed

   ✓ Opening browser to sync progress
   ```

### B. Command Reference

| Command                      | Description                                  |
| :--------------------------- | :------------------------------------------- |
| `ai-deep-dive init <course>` | Create workspace and scaffold all challenges |
| `ai-deep-dive test <id>`     | Run tests for a challenge (e.g., `02-01`)    |
| `ai-deep-dive status`        | Show progress in current course              |
| `ai-deep-dive list`          | List available courses                       |
| `ai-deep-dive sync`          | Sync progress to website                     |

---

## 3. Deep Dive: Context & Testing

### A. Context Inference (Directory-Based)

The CLI determines which course you're working on by looking at your current directory.

1. **Mechanism:** Searches for `.ai-deep-dive/config.json` in current or parent directories.
2. **Content:** `{"course": "build-chatgpt", "version": "1.0.0"}`
3. **Benefit:** Multiple courses on one machine. Just `cd` to switch context.

### B. The `test` Command

The test command handles **Execution**, **Verification**, and **Local Status Updates**.

**Execution Flow:**

1. **Resolve Context:** Read `.ai-deep-dive/config.json` for course ID
2. **Resolve Target:** Map challenge ID (e.g., `02-01`) to filename (`01_pair_counter.py`)
3. **Smart Search:** Recursively scan workspace to find the user's file
4. **Run Tests:** Execute internal test suite against user's code
5. **Update Status:** If PASS, update `~/.ai-deep-dive/status.json`
6. **Show Sync Tip:** Remind user they can sync to website

---

## 4. Structure & Flexibility (Smart Search)

### The Contract

You can organize files however you want within the workspace:

1. **Keep the Filename:** Don't rename starter files (e.g., `01_pair_counter.py`)
2. **Keep the Function:** Don't rename the function signature

### Resolution Logic

When you run `test 02-01`:

1. **Target:** CLI looks for `01_pair_counter.py`
2. **Search:** Scans recursively from workspace root (skipping `.git`, `__pycache__`, etc.)
3. **Found:** Runs tests against that file

---

## 5. Progress Sync: URL-Based Approach

### Why Not WebSockets/Bridge?

We originally designed a WebSocket bridge for real-time sync. **This was removed** because:

| Issue                       | Problem                                                                   |
| --------------------------- | ------------------------------------------------------------------------- |
| **Hosted site → localhost** | Browsers block `https://aideep.dev` from connecting to `localhost:2137`   |
| **Token pairing**           | Added complexity with no real security benefit for a local-first platform |
| **Background process**      | Users don't want random processes running                                 |

### The URL-Based Solution

**Simple, works everywhere, zero background processes.**

```
User runs: ai-deep-dive sync

CLI does:
1. Read ~/.ai-deep-dive/status.json
2. Build URL: aideep.dev/sync#build-chatgpt:01-01,01-02,02-01
3. Open browser

Website does:
1. Read window.location.hash
2. Parse: course_id + challenge IDs
3. Merge with localStorage progress
4. Show "✓ 5 challenges synced!"
```

### URL Format

```
https://aideep.dev/sync#<course_id>:<challenge1>,<challenge2>,...

Example:
https://aideep.dev/sync#build-chatgpt:01-01,01-02,02-01,02-02,02-03
```

**Size estimate:**

- 50 completed challenges ≈ 350 characters
- Well under any URL length limit
- No compression needed

### Context-Aware Sync

The `sync` command is context-aware like `test`:

```bash
# In a course workspace - syncs that course
$ cd build-chatgpt
$ ai-deep-dive sync

# Explicit course
$ ai-deep-dive sync --course build-chatgpt

# All courses
$ ai-deep-dive sync --all
```

---

## 6. Data Storage

### Local (CLI)

```
~/.ai-deep-dive/
└── status.json      # Global progress across all courses
```

**status.json format:**

```json
{
  "courses": {
    "build-chatgpt": {
      "completed": ["01-01", "01-02", "02-01"],
      "current": "02-02",
      "last_updated": "2025-12-03T10:30:00"
    }
  }
}
```

### Browser (Website)

```javascript
// localStorage key: 'course-progress'
{
  "build-chatgpt": {
    "completedSteps": [1, 2],
    "lastVisited": "2025-12-03T10:30:00",
    "currentStep": 2
  }
}
```

### Sync Mapping

The website `/sync` page converts CLI format to browser format:

- CLI: `"02-01"` → Browser: step `2` with challenges array

---

## 7. Website Implementation Required

To complete the sync flow, the website needs a `/sync` page:

```tsx
// app/sync/page.tsx
"use client";

import { useEffect, useState } from "react";

export default function SyncPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [count, setCount] = useState(0);

  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    if (!hash) {
      setStatus("error");
      return;
    }

    // Parse: course_id:challenge1,challenge2,...
    const [courseId, challengesStr] = hash.split(":");
    const challenges = challengesStr?.split(",") || [];

    if (!courseId || challenges.length === 0) {
      setStatus("error");
      return;
    }

    // Merge with existing progress
    // ... localStorage logic here ...

    setCount(challenges.length);
    setStatus("success");
  }, []);

  if (status === "loading") return <div>Syncing...</div>;
  if (status === "error") return <div>Invalid sync link</div>;

  return <div>✓ Synced {count} challenges!</div>;
}
```

---

## 8. Future Considerations

### If User Accounts Are Added

The URL-based sync still works, but could be enhanced:

1. User logs in on website
2. CLI gets an API token: `ai-deep-dive login`
3. Sync pushes directly to server: `POST /api/progress`
4. Real-time sync becomes possible

### Cross-Device Sync

Currently not supported (would require accounts + server storage). The URL-based approach is intentionally device-specific to keep things simple.

---

## Summary

| Component          | Implementation                              |
| ------------------ | ------------------------------------------- |
| **CLI**            | Python package with Click, Rich             |
| **Context**        | Directory-based `.ai-deep-dive/config.json` |
| **Testing**        | Internal test harness, smart file search    |
| **Local Progress** | `~/.ai-deep-dive/status.json`               |
| **Sync**           | URL hash → browser → localStorage           |
| **Bridge**         | ❌ Removed (doesn't work with hosted sites) |
| **Pairing**        | ❌ Removed (unnecessary complexity)         |
