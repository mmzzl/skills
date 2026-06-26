# Final Code Reviewer Prompt Template

Use this template when dispatching a final code-reviewer subagent after ALL tasks are complete.

**Purpose:** Review the entire implementation for cross-task concerns that per-task reviewers cannot see. This is a **hard gate** — cannot proceed to final test verification until this passes.

**Scope:** `dag.json`, all task manifests, `run-state.json`, and `git diff <plan-start-commit>..HEAD` — all tasks combined.

## Gate Rules

| Outcome | Criteria | Action |
|---------|----------|--------|
| **PASS** | No cross-task issues found | Proceed to final verification |
| **FAIL** | Cross-task issues found | Fix issues → re-dispatch final reviewer (max 3 rounds) |

**Max 3 retry rounds.** After 3 FAIL rounds, escalate to user via `AskUserQuestion`.

## Dispatch Template

```
Task tool (code-reviewer):
  Use template at requesting-code-review/code-reviewer.md

  INPUT_ARTIFACTS:
  - DAG file: [DAG_FILE_PATH]
  - Run state: `.cospowers/execution/run-state.json`
  - Task manifests:
    - `.cospowers/tasks/[task-id]/manifest.json`
  - Task contracts:
    - manifest.artifacts.contract
  - Per-task review reports:
    - `.cospowers/tasks/[task-id]/review-spec.md`
    - `.cospowers/tasks/[task-id]/review-quality.md`

  BASE_SHA: [plan-start-commit]
  HEAD_SHA: [current commit]
  DESCRIPTION: Final review of complete implementation across all tasks

  ## Cross-Task Review Checklist

  1. **Architecture consistency across tasks** — Do modules built in different tasks follow the same architectural patterns? Are there conflicts in module boundaries or dependency directions?

  2. **Cross-task data flow and interface alignment** — Do contracts written by one task and consumed in another match correctly? Are data transformations consistent across task boundaries?

  3. **Code style and pattern uniformity** — Do different tasks use consistent naming, error handling patterns, and coding idioms? (e.g., one task uses sync and another async for the same type of operation)

  4. **Overall code health** — Did the aggregate changes introduce large files, tight coupling, or duplication across tasks?

  5. **Requirements-design coherence (cross-task)** — Looking at the full implementation, does the end-to-end flow match what requirements.md and design.md describe? Are there gaps between tasks?

  6. **DFX constraint compliance (cross-task)** — If design.md declares DFX constraints, are they satisfied end-to-end? (e.g., is the debuggability chain complete across all tasks?)

  Read artifact files yourself. Do not ask the main agent to summarize task details or implementation results.
  Write the detailed review to `.cospowers/execution/final-review.md`.

  ## Report Format

  Gate: PASS | FAIL
  Report: `.cospowers/execution/final-review.md`
  Blocking reason: [one sentence or null]
```
