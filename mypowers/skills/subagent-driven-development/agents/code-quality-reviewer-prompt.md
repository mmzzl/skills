# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent (Gate 2).

**Purpose:** Verify implementation is well-built — clean architecture, well-tested, maintainable, resilient. This is a **hard gate** — the task is NOT complete until this passes.

**Precondition:** Gate 1 (spec-reviewer) must PASS before dispatching this reviewer.

> **Note**: Coding standards (E-rules, language conventions, naming, formatting, security, logging, error handling) are enforced by `code-compliance-check` (KB semantic check + lint auto-fix) which runs after Gate 2 passes. Gate 2 does NOT re-check these — it focuses on what automated KB checks cannot cover.

## Gate Rules

| Outcome | Criteria | Action |
|---------|----------|--------|
| **PASS** | No Critical issues found | Proceed to code-compliance-check |
| **FAIL** | Critical issues found | Fix issues → re-dispatch implementer → re-dispatch this reviewer |

**Max 3 retry rounds per task.** After 3 FAIL rounds, escalate to user via `AskUserQuestion`.

## Review Scope

The reviewer checks domains that automated KB scanning cannot cover:

### 1. Code Structure & Architecture
- Module boundaries and dependency direction (does it follow the project's layered architecture?)
- File sizes and coupling (are new files reasonably sized? are there circular dependencies?)
- Interface/API design consistency (do new interfaces match existing patterns?)
- Abstraction level appropriateness (over-engineered vs. under-engineered)

### 2. Test Quality
Reference `rules/testing-standards/单元测试规范.md`:
- Test coverage: normal path + boundary + exception scenarios all covered?
- Assertion quality: do assertions actually verify correctness, or just check non-null?
- Mock appropriateness: are mocks at the right abstraction level? too many mocks = design smell
- Test isolation: can tests run independently? shared state issues?

### 3. Scenario Coverage (容易被遗漏的)
- Cross-module synchronization: does this change need coordination with other modules?
- Concurrency risks: shared mutable state, race conditions, missing locks
- Ordering dependencies: does the code assume a specific execution order that isn't guaranteed?
- Multi-tenancy: does the change work correctly across tenants?
- Version compatibility: does the change handle old/new data formats?

### 4. Fault Tolerance & Degradation
- What happens when an external dependency fails? (timeout, connection refused, partial response)
- Are fallback/retry/degradation strategies in place where needed?
- Is the failure mode visible (logged, alerted) or silent?

### 5. Comment Quality
- Do comments explain WHY, not WHAT? (code already says WHAT)
- Are non-obvious constraints, workarounds, or business rules documented?
- No stale or misleading comments from copy-paste

## Dispatch Template

```
Task tool (code-reviewer):
  Use template at requesting-code-review/code-reviewer.md

  INPUT_ARTIFACTS:
  - DAG file: [DAG_FILE_PATH]
  - Task card: [TASK_FILE_PATH]
  - Manifest: [TASK_MANIFEST_PATH]
  - Spec review report: [REVIEW_SPEC_REPORT_PATH]
  - Results: manifest.artifacts.results
  - Changed files: manifest.artifacts.changed_files
  - Test results: manifest.artifacts.test_results

  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: Gate 2 code quality review for [task-id]

  Review scope (Gate 2 — code quality, NOT coding standards):
  1. Code structure & architecture (module boundaries, coupling, interface consistency)
  2. Test quality (coverage, assertion quality, mock appropriateness, isolation)
  3. Scenario coverage (cross-module sync, concurrency, ordering, multi-tenancy, compatibility)
  4. Fault tolerance & degradation (external dependency failures, fallback strategies)
  5. Comment quality (why-not-what, non-obvious constraints)

  Coding standards (E-rules, language conventions, naming, formatting, security, logging, error handling)
  are enforced by code-compliance-check which runs after this gate passes — do NOT re-check these here.

  Read artifact files yourself. Do not ask the main agent to summarize task details or implementation results.
  Write the detailed review to `.cospowers/tasks/[task-id]/review-quality.md`.

  Return only:
  Gate: PASS | FAIL
  Report: `.cospowers/tasks/[task-id]/review-quality.md`
  Blocking reason: [one sentence or null]
```
