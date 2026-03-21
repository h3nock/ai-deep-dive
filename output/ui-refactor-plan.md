# UI Refactor Plan

Frontend refactoring to adopt the new judge backend contracts. Branches from
`worktree-judge-backend-refactor` so all new backend models and endpoints are
available.

---

## Problems Being Fixed

1. **Frontmatter spread leaks stale technical fields.** `posts.ts:333` does
   `...challengeData`, passing every frontmatter key into the `Challenge` object.
   Fields like `executionSnippet`, `dependencies`, `visibleTestCases` leak through
   uncontrolled.
2. **UI uses execution IR as display data.** `TestCase.input_code` (assignment
   statements) is rendered directly in the Test Cases tab and ExampleCards instead
   of structured per-parameter values.
3. **`kind` overloading on a single endpoint.** `judge-client.ts` sends
   `kind: "run" | "submit"` to `POST /submit`. The backend now has separate
   `POST /run` and `POST /submit` endpoints.
4. **Browser/judge comparison defaults diverge.** `pyodide.ts:248` hardcodes
   `rtol=1e-6, atol=1e-6`. The judge uses `rtol=1e-5, atol=1e-8`. Both should
   read from `problem.json` comparison config.
5. **Result model carries public/hidden distinction.** `TestResult.hidden`,
   `TestSummary.public_total`, `hidden_total`, etc. exist in `test-results.ts`
   but the UI has no reason to distinguish public from hidden test results.
6. **Execution mode determined by heuristic.** Code checks
   `dependencies?.includes("torch")` in scattered locations. The backend now
   provides `execution_profile: "light" | "torch"` as the canonical source.
7. **Public bundle pipeline is obsolete.** `export-judge-tests.mjs` generates
   bundles into `web/public/judge-tests/`, fetched at runtime by
   `judge-public-tests.ts`. The new backend serves public cases from
   `public_cases.json` directly; the web loads them at build time.
8. **handleRun ignores user edits.** `ChallengeEditor.tsx:785-795` fetches
   bundled public tests when `problemId` exists and `mode === "run"`, completely
   discarding any changes the user made to test case inputs. The Test Cases tab
   is a false affordance for 13/20 challenges (torch/server path). The new
   `POST /run` endpoint fixes this by accepting caller-supplied cases.

---

## Design Principles

1. One `TestCase` shape for canonical data and editor state. No separate
   `WorkingCase` type.
2. Public cases are visible by definition. No `visible_case_limit` or visibility
   concept.
3. Frontmatter contains only prose/display fields: `title`, `difficulty`,
   `hint`. Starter code is not frontmatter.
4. Editor starter code lives in `judge/problems/{problemId}/starter.py`.
   `description.md` owns prose; `starter.py` owns the editor seed code.
5. `problemId` is path-derived from `collection/chapterSlug/challengeSlug`, not
   hardcoded and not read from frontmatter.
6. `execution_profile` is the single source of truth for browser vs server
   routing. `"light"` = browser-eligible, `"torch"` = server-only.

---

## Data Model Changes

### `web/src/lib/challenge-types.ts` — shared challenge and testcase contracts

```typescript
export interface TestCase {
  id: string;
  inputs: Record<string, string>;   // per-argument Python expressions
  expected_literal: string;          // always ast.literal_eval parseable
  explanation?: string;
}

export interface Challenge {
  // Display (from frontmatter + starter.py)
  id: string;                  // auto-derived "09-01" from directory names
  title: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  hint?: string;
  description: string;         // markdown body from description.md
  initialCode: string;         // from starter.py
  chapterNumber?: string;
  problemNumber?: string;

  // Technical (from problem.json)
  problemId: string;           // path-derived: collection/chapterSlug/challengeSlug
  arguments: { name: string; type?: string }[];
  runner: string;
  executionProfile: "light" | "torch";
  comparison: { type: "exact" } | { type: "allclose"; rtol: number; atol: number };
  timeLimitS: number;
  memoryMb: number;

  // Test data (from public_cases.json)
  publicCases: TestCase[];
}
```

Removed fields: `executionSnippet`, `dependencies`, `visibleTestCases`.

`TestCase` is a shared frontend contract, not an editor-only type. It is used
by canonical `publicCases`, `posts.ts` build-time loading, editor state, and
`POST /run` request payloads.

### `web/src/types/challenge-editor.ts` — editor-only types

This file should keep only Monaco/editor-instance types. Remove the old
UI-specific testcase shape from here.

The old `input_code` was raw Python assignment statements (`x = torch.tensor(...)
\ngamma1 = torch.ones(4)\n`). The new `inputs` is structured per-argument
(`{ "x": "torch.tensor(...)", "gamma1": "torch.ones(4)" }`). This eliminates
the need to parse `input_code` strings into fields for UI display. The data
arrives structured from `public_cases.json`.

For the Pyodide browser execution path, a compilation step converts `inputs`
back to assignment statements. See "Compilation: inputs to input_code" below.

### `web/src/lib/test-results.ts` — result model cleanup

```typescript
export interface TestResult {
  id: string;
  status: TestStatus;
  input?: string;
  stdout?: string;
  output?: string;
  expected?: string;
  stderr?: string;
  // REMOVED: hidden?: boolean
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  // REMOVED: public_total, public_passed, hidden_total, hidden_passed
}
```

### Why `TestCase` and `TestResult` are separate types

These represent different lifecycle stages, not two views of the same object:

- `TestCase` is pre-execution: structured `inputs: Record<string, string>`,
  `expected_literal` as assertion state. Lives in the Test Cases tab.
- `TestResult` is post-execution: flat `input` string (compiled), `output`
  (what the code produced), `expected`, `status`, `stdout`, `stderr`. Lives
  in the Result tab.

`TestCase` feeds into execution; execution produces `TestResult`. One flows
into the other. Merging them into a single type would create a union with many
optional fields where the only way to know which mode you're in is to check
which fields are populated. Keep them separate: the type tells you the
lifecycle stage.

The `/run` endpoint returns only caller-supplied cases. The `/submit` endpoint
returns a flat list. The UI shows pass/fail counts without distinguishing
public from hidden.

---

## Challenge Assembly (`web/src/lib/posts.ts`)

### Current (broken)

```typescript
return {
  ...challengeData,  // spreads ALL frontmatter
  id: autoId,
  description: challengeBody,
} as Challenge;
```

### New

```typescript
// 1. Whitelist frontmatter fields
const { title, difficulty, hint } = challengeData;

// 2. Derive problemId from path
const problemId = `${collection}/${chapterSlug}/${bundleName}`;

// 3. Load technical data from judge/problems/{problemId}/
const spec = loadProblemSpec(problemId);       // problem.json
const publicCases = loadPublicCases(problemId); // public_cases.json
const initialCode = loadStarterCode(problemId); // starter.py

// 4. Assemble with explicit fields only
return {
  id: autoId,
  title,
  difficulty,
  hint,
  initialCode,
  description: challengeBody,
  chapterNumber,
  problemNumber,
  problemId,
  arguments: spec.arguments,
  runner: spec.runner,
  executionProfile: spec.execution_profile,
  comparison: spec.comparison,
  timeLimitS: spec.time_limit_s,
  memoryMb: spec.memory_mb,
  publicCases,
} satisfies Challenge;
```

`loadProblemSpec`, `loadPublicCases`, and `loadStarterCode` are new helper
functions that read from `judge/problems/{problemId}/problem.json`,
`public_cases.json`, and `starter.py` respectively at build time. The judge
problems directory path is resolved relative to the repo root.

### `problemId` derivation

Uses the `collection` parameter already threaded through `posts.ts`, not a
hardcoded `"build-gpt"` string:

```
collection = "build-gpt"  (from the route/caller)
chapterSlug = "09-the-transformer-block"  (parent directory name)
bundleName = "01-transformer-block"  (challenge directory name)
-> problemId = "build-gpt/09-the-transformer-block/01-transformer-block"
```

This matches how the backend `ProblemRepository` resolves problem directories
and works for any future course, not just `build-gpt`.

---

## Judge Client (`web/src/lib/judge-client.ts`)

### Current

```typescript
type JudgeSubmitRequest = {
  problemId: string;
  code: string;
  kind: "run" | "submit";  // overloaded
};

// Single function sends to POST /submit with kind field
```

### New -- two separate functions for two endpoints

```typescript
// POST /run -- caller-supplied structured test cases
export type JudgeRunRequest = {
  problem_id: string;
  code: string;
  cases: Array<{
    id: string;
    inputs: Record<string, string>;
    expected_literal: string;
  }>;
};

export async function runOnJudge(
  request: JudgeRunRequest
): Promise<JudgeSubmitResponse> {
  const base = requireBaseUrl();
  return fetchJson(`${base}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

// POST /submit -- no cases, server uses canonical public + hidden
export type JudgeSubmitRequest = {
  problem_id: string;
  code: string;
};

export async function submitToJudge(
  request: JudgeSubmitRequest
): Promise<JudgeSubmitResponse> {
  const base = requireBaseUrl();
  return fetchJson(`${base}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}
```

`kind` field is gone. `waitForJudgeResult` and `fetchJudgeResult` stay
unchanged (polling is endpoint-agnostic).

---

## Execution Mode Contract

One function, one place. Replaces all `dependencies?.includes("torch")` checks.

```typescript
function requiresServer(challenge: Challenge): boolean {
  return challenge.executionProfile === "torch";
}
```

Used for:
- **Run**: Pyodide (browser) for light, `POST /run` for torch
- **Submit**: always `POST /submit`, but timeout/polling config may differ
- **UI affordances**: both paths get per-parameter editable fields

This eliminates the old false affordance: previously, the 13 torch challenges
showed editable test case fields but silently ignored edits on Run because the
server path discarded them. Now `POST /run` accepts caller-supplied cases, so
editable inputs work for ALL 20 challenges.

---

## Test Cases Tab Redesign

### Design Reference (LeetCode)

The redesign follows the LeetCode two-tab model, adapted for our three-tab
layout. Key observations from the LeetCode UX analysis:

| LeetCode | Our System (current) | Our System (new) |
|---|---|---|
| Testcase tab (inputs only, editable) | Test Cases tab (input_code + expected) | Test Cases tab (inputs only, per-parameter, editable) |
| Test Result tab (input + output + expected + pass/fail) | Result tab (same) | Result tab (unchanged) |
| -- | Console tab (stdout) | Console tab (unchanged) |

LeetCode details we adopt:
- Test Cases tab shows only inputs, per-parameter editable fields
- No expected output shown in the Test Cases tab
- Case tabs with `+` button for adding cases
- "Reset Testcases" button appears when user modifies defaults
- Result tab initial state: "You must run your code first"
- Expected values in results come from pre-stored expected (we don't have
  official solutions like LeetCode; we use `expected_literal` from
  `public_cases.json`)

### Clone-with-expected strategy

Since we have no official solutions to dynamically generate expected values for
user-created cases, we use **clone-based case creation**:

- `+` clones the rightmost case, copying both `inputs` and `expected_literal`
- The cloned `expected_literal` is kept as hidden assertion state
- User edits the cloned inputs to explore behavior
- The Result tab shows both output and expected so the user can interpret:
  - Unmodified inputs: output vs stored expected = correct pass/fail
  - Modified inputs: output vs original expected = likely "Wrong Answer" but
    user sees both values to debug
  - This is sufficient because the Result tab is the authoritative comparison
    surface

### Tab layout

```
+-------------------------------------------------------+
| Case 1 | Case 2 | Case 3 | [+]                       |
+-------------------------------------------------------+
|                                                       |
|  x =                                    (torch.Tensor)|
|  +---------------------------------------------------+
|  | torch.tensor([1.0, 2.0, 3.0])                     |
|  +---------------------------------------------------+
|                                                       |
|  dim =                                           (int)|
|  +---------------------------------------------------+
|  | 0                                                  |
|  +---------------------------------------------------+
|                                                       |
|  ---------------------------------------------------  |
|  Reset Testcases                                      |
+-------------------------------------------------------+
```

### Per-variable field

- **Label**: `{name} =` in `text-secondary text-xs font-mono`
- **Type hint**: from `challenge.arguments` metadata, shown after the label in
  `text-muted text-xs` (e.g. `(torch.Tensor)`, `(int)`). Only shown for
  variables that match a declared argument name. If `arguments` doesn't carry
  type info (just `{ name }` with no type), no hint shown.
- **Value**: `<textarea>` with auto-resize (not Monaco -- lightweight, important
  for Ch09 which can have 14 argument fields per test case). Styled:
  `bg-surface rounded-lg p-3 font-mono text-[13px] text-secondary border
  border-transparent focus:border-border focus:outline-none`
- **onChange**: update that key in the case's `inputs` record, then call
  `setWorkingCases` to update state

### State management

```typescript
// Mutable working copies, initialized from challenge.publicCases
const [workingCases, setWorkingCases] = useState<TestCase[]>([]);
const originalCasesRef = useRef<TestCase[]>([]);

// Track modification for Reset button
const hasModifiedCases = useMemo(() => {
  const orig = originalCasesRef.current;
  if (workingCases.length !== orig.length) return true;
  return workingCases.some((wc, i) => {
    const oc = orig[i];
    if (!oc) return true;
    return JSON.stringify(wc.inputs) !== JSON.stringify(oc.inputs);
  });
}, [workingCases]);
```

On challenge load: deep-clone `challenge.publicCases` into both
`workingCases` state and `originalCasesRef.current`.

### Case tabs row

- Case buttons styled like the current test case tabs
- Each case button shows `Case {n}` with optional X delete icon (hidden when
  only 1 case remains)
- `+` button after the last case tab: clones the rightmost case
  - Generates new id: `clone-{timestamp}` or `case-{n+1}`
  - Deep copies both `inputs` and `expected_literal` from the rightmost case
  - Appends to `workingCases`
  - Switches active tab to the new case

### Footer

- "Reset Testcases" button visible only when `hasModifiedCases` is true
- Styled subtle: `text-xs text-muted hover:text-secondary`
- onClick: restores `workingCases` to deep clone of `originalCasesRef.current`

### Auto-resizing textarea

Lightweight inline helper (not a separate component file):

```typescript
function AutoResizeTextarea({ value, onChange, className }: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      rows={1}
    />
  );
}
```

Important: no Monaco overhead. Ch09 has 14 arguments per case; 14 Monaco
instances per case tab would be a performance problem.

### Result tab initial state

Before any Run: show "You must run your code first" (matching LeetCode). This
replaces whatever the current empty/initial state is.

### Result tab after Run

- Case tab labels: `Case {idx + 1}` (no public/hidden distinction)
- Per-case detail: Input + Output + Expected + pass/fail status badge
- The `r.hidden ? "Hidden Test" : ...` ternary at line 1525 is removed
- For submit results: flat list from judge, same `Case {idx + 1}` labeling

---

## Compilation: inputs to input_code

The new `TestCase.inputs` is a structured `Record<string, string>`. Two
execution paths need `input_code` strings:

### Pyodide (browser) path

Needs `input_code` for `exec()` in the sandbox. Compile from `inputs`:

```typescript
function compileInputCode(
  inputs: Record<string, string>,
  argOrder: { name: string }[]
): string {
  return argOrder
    .map(arg => `${arg.name} = ${inputs[arg.name]}`)
    .join('\n') + '\n';
}
```

Always emits one `{name} = {value}\n` assignment per argument, in the order
declared by `challenge.arguments`. No skipping, no filtering. This function
assumes all inputs are present and non-empty — the UI validates before
calling it. This matches the backend's `TestCaseCompiler` contract which
requires all declared arguments to be present in `inputs`.

### Judge (server) path

Does NOT need client-side compilation. `POST /run` accepts structured
`TestCase[]` with `inputs` directly. The judge compiles server-side via
`TestCaseCompiler.compile_cases()`.

---

## ExampleCards (left panel)

The description panel's example cards currently render `input_code` via
`cleanInputDisplay()` which only strips `dtype=torch.float32`. With structured
`inputs` from `publicCases`, examples can render per-parameter cleanly:

```
Example 1:
  x = torch.tensor([1.0, 2.0, 3.0])
  dim = 0
  Expected: [1.5]
```

Build from `publicCases[n].inputs` (ordered by `challenge.arguments`) +
`publicCases[n].expected_literal`. The `explanation` field, if present,
renders below.

---

## Run/Submit Execution Flows

### Run (light -- browser path)

1. Take `workingCases` from editor state
2. Compile each case's `inputs` to `input_code` via `compileInputCode()`
3. Build `TestConfig`:
   ```typescript
   const config: TestConfig = {
     runner: challenge.runner,
     cases: workingCases.map(tc => ({
       id: tc.id,
       input: compileInputCode(tc.inputs, challenge.arguments),
       expected: tc.expected_literal,
     })),
     comparison: challenge.comparison,
   };
   ```
4. Execute in Pyodide via `runTestsWithPyodide(code, config)`
5. Show results in Result tab

Key change: runner and comparison come from `challenge` (loaded from
`problem.json` at build time), not from a runtime bundle fetch. Cases come from
`workingCases` (respects user edits), not from the public bundle.

### Run (torch -- server path)

1. Call `runOnJudge({ problem_id: challenge.problemId, code, cases: workingCases })`
2. Poll with `waitForJudgeResult`
3. Show results in Result tab

This is the fix for the old false affordance. Previously, the server path
sent only `problemId` and the judge used its stored public tests, ignoring
user edits. Now `POST /run` accepts the edited cases.

### Submit (both paths)

1. Call `submitToJudge({ problem_id: challenge.problemId, code })`
2. Poll with `waitForJudgeResult`
3. Show results in Result tab

Submit always uses canonical public + hidden tests server-side. No cases sent
from the client.

---

## Pyodide Updates (`web/src/lib/pyodide.ts`)

The shared/user-facing `TestCase` name is owned by
`web/src/lib/challenge-types.ts`. The Pyodide-internal testcase type should be
renamed from `TestCase` to `CompiledTestCase` so the codebase does not use the
same name for both the authored testcase contract and the compiled runtime IR.

1. **Comparison config from challenge, not hardcoded.** Replace:
   ```typescript
   const comparisonRtol = config.comparison?.rtol ?? 1e-6;  // wrong default
   const comparisonAtol = config.comparison?.atol ?? 1e-6;  // wrong default
   ```
   With comparison always passed through from `challenge.comparison`. No local
   fallback defaults. If comparison config is missing, the challenge assembly is
   broken.

2. **`expected_literal` only.** The `expected` field in `TestConfig.cases` is
   always a string parsed by `ast.literal_eval`. Remove any `expected_is_code`
   conditional paths. The old dual encoding (`expected` + `expected_is_code`
   flag) is gone -- `expected_literal` replaced it.

3. **`TestConfig.cases` shape update.** Each case has `{ id, input, expected }`
   where `input` is compiled `input_code` and `expected` is the literal string.
   The `bundleToTestConfig()` transformation is gone since the config is built
   directly from challenge data.

---

## Cleanup (Deletions)

| File / directory | Reason |
|---|---|
| `web/src/lib/judge-public-tests.ts` | No more client-side public bundle fetch |
| `web/scripts/export-judge-tests.mjs` | No more export pipeline |
| `web/public/judge-tests/` | Generated bundles obsolete |
| Technical frontmatter in each `description.md` | Remove stale fields: `arguments`, `executionSnippet`, `dependencies`, `problemId`, `visibleTestCases` |

Note: `initialCode` and `starter.py` migration is already done on the backend
branch. This branch inherits that work via rebase.

**Not in scope for this plan:**
- `judge/scripts/generate_manifests.py` -- backend-owned, already gone on the
  backend branch.
- `web/src/lib/challenge-storage.ts` -- stores only user code and solved status,
  not test cases. No shape migration needed.
- `judge/problems/**/starter.py` -- already created on the backend branch.

---

## Files Touched (Complete List)

| File | Change type |
|---|---|
| `web/src/lib/challenge-types.ts` | Rewrite `Challenge` interface and add shared `TestCase` |
| `web/src/types/challenge-editor.ts` | Remove editor-local `TestCase`; keep editor-only Monaco types |
| `web/src/lib/test-results.ts` | Remove `hidden` field, remove public/hidden counters |
| `web/src/lib/posts.ts` | Whitelist frontmatter, load problem.json + public_cases.json + starter.py, derive problemId |
| `web/src/lib/judge-client.ts` | Split into `runOnJudge` + `submitToJudge`, drop `kind` |
| `web/src/lib/pyodide.ts` | Rename internal testcase type to `CompiledTestCase`, read comparison from config, drop hardcoded defaults, expected_literal only |
| `web/src/components/ChallengeEditor.tsx` | Test Cases tab redesign, execution flows, ExampleCards, remove hidden ternary |
| `web/src/lib/judge-public-tests.ts` | Delete |
| `web/scripts/export-judge-tests.mjs` | Delete |
| `web/public/judge-tests/**` | Delete directory |
| `web/next.config.ts` | Remove `/judge-tests/` cache header rules |
| `web/content/build-gpt/*/challenges/*/description.md` | Strip stale technical frontmatter fields |

---

## Implementation Order

### Step 1 -- Data types
`challenge-types.ts`, `challenge-editor.ts`, `test-results.ts`

Foundational. Everything else depends on these type definitions compiling.

### Step 2 -- Challenge assembly
`posts.ts`

Whitelist frontmatter. Add `loadProblemSpec` / `loadPublicCases` /
`loadStarterCode` helpers. Derive `problemId` from
`collection + chapterSlug + bundleName`. Wire up new `Challenge` shape.

### Step 3 -- Judge client
`judge-client.ts`

Two functions (`runOnJudge`, `submitToJudge`), two endpoints, no `kind`. Keep
polling utilities unchanged.

### Step 4 -- Execution flows + compilation utility
`ChallengeEditor.tsx` (run/submit handlers)

Add `compileInputCode()`. Wire `requiresServer()` check. Light path compiles
cases and runs in Pyodide. Torch path calls `runOnJudge` with structured cases.
Submit path calls `submitToJudge`.

### Step 5 -- Test Cases tab UI
`ChallengeEditor.tsx` (rendering)

The core UX work:
- `workingCases` state + `originalCasesRef` for modification tracking
- Per-parameter `AutoResizeTextarea` fields with argument labels + type hints
- Case tabs with `+` clone and `x` delete
- "Reset Testcases" footer when modified
- "You must run your code first" initial state in Result tab
- Remove `r.hidden` ternary, use `Case {idx + 1}` labels

### Step 6 -- ExampleCards update
`ChallengeEditor.tsx` (left panel)

Render examples from `challenge.publicCases[].inputs` (structured) instead of
`cleanInputDisplay(input_code)` (raw string cleanup). Show per-parameter values
ordered by `challenge.arguments`, plus `expected_literal` and `explanation`.

### Step 7 -- Pyodide
`pyodide.ts`

Comparison from config. `expected_literal` only. Remove `expected_is_code`
handling. Remove `bundleToTestConfig()` usage.

### Step 8 -- Frontend cleanup
Delete obsolete frontend files (`judge-public-tests.ts`, `export-judge-tests.mjs`,
`web/public/judge-tests/`). Strip stale technical frontmatter from all
`description.md` files (`arguments`, `executionSnippet`, `dependencies`,
`problemId`, `visibleTestCases`). Remove `/judge-tests/` cache header rules
from `next.config.ts`. Starter code and `initialCode` migration is already
done on the backend branch.

Steps 1-3 can be one commit. Steps 4-6 are the core UI work. Steps 7-8 are
finalization.

---

## Edge Cases

- **Ch09 (14 arguments per case)**: All 14 fields render as lightweight
  textareas. No Monaco overhead. Auto-resize handles multi-line tensor values.
- **Multi-line values**: e.g. `torch.tensor([[1.0, 0.0], [0.0, 1.0]])` spans
  multiple lines. `AutoResizeTextarea` expands to fit.
- **Missing arguments metadata**: If `challenge.arguments` is missing, that is
  broken challenge assembly, not a runtime case to handle. `compileInputCode`
  requires `challenge.arguments` -- no `Object.keys(inputs)` fallback.
- **Empty inputs**: If user clears a field to empty, the Run button validates
  and shows an inline error on the empty field (e.g. "x is required"). The
  compilation step is never reached with missing values.
- **Cloned case with stale expected**: User clones Case 2, edits inputs. The
  expected is still from Case 2. Running shows "Wrong Answer" in Result tab with
  both output and expected visible. User interprets the diff.

---

## Verification Checklist

1. Open Ch01 (simple, light profile) -> Test Cases tab -> should show
   `text =` with editable value field. No expected shown.
2. Open Ch09 (complex, torch profile) -> Test Cases tab -> should show
   all 14 argument fields. Type hints on function args if available.
3. Edit a parameter value -> Run -> Result tab should show comparison using
   the edited input (not the original).
4. Edit a parameter on a torch challenge -> Run -> should call `POST /run`
   with edited cases (not silently ignored).
5. Add a new case (+) -> clones the rightmost case with inputs pre-filled.
6. Delete a case (X) -> case removed. Cannot delete last remaining case.
7. Edit a default case -> "Reset Testcases" appears at bottom.
8. Click "Reset Testcases" -> inputs revert to original public cases.
9. Ch09 with 14 fields -> renders without performance issues (textareas, not
   Monaco).
10. Submit -> uses canonical server-side tests, not working cases. Result tab
    shows flat pass/fail list.
11. ExampleCards in left panel -> render structured per-parameter values, not
    raw `input_code`.
12. Comparison tolerances -> Pyodide uses `challenge.comparison` values, not
    hardcoded `1e-6`.
13. Before first Run -> Result tab shows "You must run your code first".

---

## Out of Scope

- Test case persistence in localStorage (not currently stored, no reason to add)
- Harness code deduplication between Pyodide and server runner (contract
  alignment via shared comparison config is sufficient for now)
- New course support (plan is course-agnostic by design, but only `build-gpt`
  content exists to test against)
- Per-case comparison support in browser path (backend supports it, no challenge
  uses it yet)
- Official solution storage for dynamic expected generation (clone-with-expected
  is sufficient for now)
