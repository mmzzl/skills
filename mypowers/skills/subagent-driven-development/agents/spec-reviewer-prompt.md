# Spec Compliance Reviewer Prompt Template

Use this template when dispatching a spec compliance reviewer subagent (Gate 1).

**Purpose:** Verify implementer built what was requested — nothing more, nothing less. This is a **hard gate** — the task cannot proceed to code quality review until this passes.

## Gate Rules

| Outcome | Criteria | Action |
|---------|----------|--------|
| **PASS** | All task-card requirements implemented, no extras, no misunderstandings | Proceed to Gate 2 (code-quality-reviewer) |
| **FAIL** | Missing requirements, extra/unneeded work, or misinterpretations | Fix issues → re-dispatch implementer → re-dispatch this reviewer |

**Max 3 retry rounds per task.** After 3 FAIL rounds, escalate to user via `AskUserQuestion`.

## Dispatch Template

```
Agent (general-purpose):
  description: "Review spec compliance for [task-id]"
  prompt: |
    You are reviewing whether an implementation matches its task specification.
    This is a HARD GATE — the task cannot proceed until you pass it.

    ## Input Artifacts

    - DAG file: [DAG_FILE_PATH]
    - Task card: [TASK_FILE_PATH]
    - Manifest: [TASK_MANIFEST_PATH]
    - Results: manifest.artifacts.results
    - Changed files: manifest.artifacts.changed_files
    - Test results: manifest.artifacts.test_results
    - Upstream manifests:
      - [UPSTREAM_MANIFEST_PATH]

    ## Your Job

    Read the task card, manifest, changed files, and implementation code. Verify independently. Do NOT trust the implementer's report.

    **DO NOT:**
    - Ask the main agent to summarize artifacts that exist on disk
    - Take the implementer's word for what they implemented
    - Trust claims about completeness
    - Accept the implementer's interpretation of requirements without checking the task card
    - Paste detailed implementation summaries back to the main agent

    **DO:**
    - Read the actual task card
    - Read the actual code changed by the task
    - Compare actual implementation to requirements line by line
    - Check for missing pieces the implementer claimed to implement
    - Look for extra features not requested by the task card
    - Write your detailed review to `.cospowers/tasks/[task-id]/review-spec.md`

    ## Gate Criteria

    **PASS** — ALL of:
    - Every task-card requirement has corresponding implementation code
    - Every acceptance criterion is addressed by implementation and tests
    - No code exists that doesn't trace to a task-card requirement
    - Requirements are interpreted correctly (not misunderstood)

    **FAIL** — ANY of:
    - Missing requirement: task card says X, code doesn't do X
    - Missing acceptance coverage: acceptance criterion has no implementation or test evidence
    - Extra/unneeded work: code does Y, task card doesn't ask for Y
    - Misunderstanding: task card says X, code does Z thinking it's X

    ## Report Format

    Gate: PASS | FAIL
    Report: `.cospowers/tasks/[task-id]/review-spec.md`
    Blocking reason: [one sentence or null]
```
