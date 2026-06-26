---
name: plan-evaluator
description: Use when evaluating implementation plans produced by writing-plans — mode-adaptive evaluation (Subsystem/System/Innovation) with 38 check items across 5 layers, upstream traceability verification, red line checks, weighted scoring, and quality report generation
---

# Plan Evaluator

**Skill 标识**: `plan-evaluator`

其他 skill 通过 `plan-evaluator` 引用本 skill。

## Extension Points

Before starting, read `cospowers.config.json` from the plugin root (2 levels above this skill's base directory — the directory shown in "Base directory for this skill" at skill load time). No fallback needed — the config always has valid defaults.

| Config field | Used for |
|---|---|
| `config.templates["overall-design"]` | Overall design template path — used in System/Subsystem modes to locate design output |
| `config.templates["module-design"]` | Module overview design template path — used in Module mode to locate design output |
| `config.templates["openapi"]` | OpenAPI template path — used in System/Subsystem modes to verify API references |

## Overview

Evaluate implementation plans produced by `writing-plans` using **item-by-item check scanning** (one check item at a time, with real-time output), **weighted scoring**, and a **detailed issue report** that pinpoints exactly what is wrong, where, and why.

This skill is **mode-adaptive**: it detects the plan's source path (Subsystem / System / Innovation) and adjusts check scope, red lines, and scoring weights accordingly.

**Evaluation order (never skip or reorder):**

```
Phase 0: Load (mode detection → load plan → load upstream docs by mode)
  → Phase 1: Item-by-item scan (5 layers, mode-adaptive)
  → Phase 1.3: Scan completion statistics
  → Phase 1.4: Red line checks (mode-dependent)
  → Phase 3: Scoring (mode-adaptive weights)
  → Phase 4: Report generation
```

> Phase 2 is skipped — cross-document consistency for design documents is handled by `doc-quality-evaluator`.

## ⚠️ Five Hard Constraints (Must Follow 100%)

### 1. Item-by-Item Scanning: Every check item must be independently checked ⭐⭐⭐
- ✅ **MUST**: For each check item, output "📍 Check [CHECK-ID]: [description]", then execute, then output conclusion
- ❌ **FORBIDDEN**: Batch-skipping multiple items or outputting "overall compliant" without per-item checking
- ✅ **MUST**: When violations found, record document location, quote original text, cite violated rule
- ❌ **FORBIDDEN**: Reporting vague descriptions like "plan is not detailed enough" without specific locations

### 2. Mode-Adaptive Constraint: Check scope must match detected mode ⭐⭐⭐
- ✅ **MUST**: Detect mode first (Phase 0.1), then apply the correct check layer and scoring weights
- ❌ **FORBIDDEN**: Applying Subsystem-mode checks to an Innovation-mode plan (e.g., checking REQ coverage when no REQs exist)
- ✅ **MUST**: Skip Layer 2 (TRC) entirely in Innovation mode

### 3. Scoring Constraint: Scores must have justification ⭐⭐⭐
- ✅ **MUST**: Each dimension score accompanied by deduction detail (which item deducted how much)
- ❌ **FORBIDDEN**: Giving scores without explaining deductions
- ✅ **MUST**: Red line violation → total grade F regardless of other scores

### 4. Only Report Real Problems: Passed items are NOT written to report ⭐⭐⭐
- ✅ **MUST**: Only report items that actually violate rules or have issues
- ❌ **FORBIDDEN**: Writing "compliant, keep it up" for passed items
- ✅ **MUST**: Each issue has: location + quote + violated rule + severity + fix suggestion

### 5. Find-One-Scan-All: One class of problem found → scan entire document for same class ⭐⭐⭐
- ✅ **MUST**: Upon finding one instance of a problem class (e.g., placeholder text), immediately scan the full document for all other instances
- ❌ **FORBIDDEN**: Recording only the first found instance while missing others of the same class

## Phase 0: Load

### 0.1 Mode Detection

**Detect the plan's source path before loading anything else.** The mode determines which check layers are active.

```
1. Check if docs/agent-rules/4-module-design/output/ has YYYY-MM-DD- subdirectories
   → YES: Module Mode (full upstream chain)
2. Otherwise, check if docs/agent-rules/3-overall-design/output/ has YYYY-MM-DD- subdirectories
   → YES: System Mode (overall design only, no module overview docs)
3. Neither exists
   → Innovation Mode (standalone plan, design input from `docs/agent-rules/specs/YYYY-MM-DD-<topic>-design.md`)
```

Output the detected mode:

```
📂 Mode detected: [Subsystem / System / Innovation]
   Active layers: [Layer 1-5 (full) / Layer 1,3,4,5 + Layer 2 (reduced) / Layer 1,3,4,5 only]
   Red lines active: [R1,R2,R3 / R1,R2,R3 / R2,R3]
```

### 0.2 Load the Plan Document

Read the plan file at the path provided in the dispatch prompt (`[PLAN_PATH]`). Identify its structure:
- Header block (Goal, Architecture, Tech Stack)
- Conventions block
- Domain Skills block
- Task blocks (each with Files, Test Cases, checkbox steps)

If the plan is a parent `index.md` (Subsystem mode, multi-service), load each per-service plan file listed in the index.

### 0.3 Load Upstream Documents (by Mode)

**Module Mode** — Load all of:
- System requirements: newest `docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-*/`, read `ch03-功能性需求.md` for REQ list
- Overall design: newest `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-*/`, read `index.md` for module list and `ch06-系统DFX特性设计.md` for DFX targets
- Module overview design: newest `docs/agent-rules/4-module-design/output/YYYY-MM-DD-*/`, for each module read `ch02-模块职责和边界.md`, `ch03-对外接口.md`, `ch04-内部设计.md`, `ch05-DFX特性设计.md`, and `ch06-自测用例.md`
- OpenAPI spec: `<project>-openapi.yaml` from overall design output directory

**System Mode** — Load:
- System requirements: newest `docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-*/`, read `ch03-功能性需求.md`
- Overall design: newest `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-*/`, read `ch06-系统DFX特性设计.md`
- OpenAPI spec: `<project>-openapi.yaml` from overall design output directory

**Innovation Mode** — Skip upstream document loading. Only the plan itself is evaluated. (Design input from `docs/agent-rules/specs/YYYY-MM-DD-<topic>-design.md` is not loaded as upstream — the plan is evaluated as a standalone artifact.)

Output:
```
✅ Upstream documents loaded
   Mode: [Subsystem/System/Innovation]
   REQ items to trace: [N] (or N/A)
   API endpoints to trace: [N] (or N/A)
   DFX dimensions to verify: [N] (or N/A)
```

## Phase 1: Item-by-Item Scan

Each check item is scanned independently with the fixed format below.

### 1.1 Scan Output Format

For each check item, output:

```
📍 Check [CHECK-ID]: [description]
  ├─ Location: [plan section or "full plan"]
  ├─ Quote: "[exact text from plan, or N/A if looking for absence]"
  ├─ Requirement: [what the rule requires]
  ├─ Result: ✅ Pass / ❌ Violation / ⚠️ Warning / ⬜ Not Applicable (mode)
  └─ [violation only] Issue ID: [ISSUE-XXX] | Level: [Critical/Error/Warning] | Deduction: [-N] | Dimension: [name]
```

### 1.2 Violation Record Format

```
[ISSUE-XXX]
  Document: [plan file name]
  Location: [Task N / Header / Conventions block]
  Rule: [CHECK-ID] — [rule description]
  Quote: "[exact text from plan]"
  Description: [specifically what violates the rule]
  Severity: Critical / Error / Warning
  Fix Direction: [actionable fix suggestion]
  Deduction: [-N points] (Dimension: [name])
```

### Check Item Layers

#### Layer 1: Structure Completeness (PLAN-STR, 7 items)

Active in ALL modes.

| ID | Check Item | Location | Severity |
|---|---|---|---|
| PLAN-STR-01 | Header completeness: Goal (1 sentence), Architecture (2-3 sentences), Tech Stack listed — all non-empty, non-generic | Plan header | Error |
| PLAN-STR-02 | Conventions block: language, naming, imports, error handling, testing, logging, API patterns, DB, config, docstring — all documented with actual conventions learned from codebase | Conventions block | Error |
| PLAN-STR-03 | Conventions source credibility: declares it was learned from actual codebase files (lists sampled files), not invented | Conventions block | Warning |
| PLAN-STR-04 | Domain Skills block: all 4 categories present (单测编写, 测试方法, 排障调试, 代码编写). Missing categories explicitly marked "None — use default approach" | Domain Skills block | Warning |
| PLAN-STR-05 | Each task has Files section: Create/Modify/Test columns with exact paths. Modify paths correspond to existing files (verify with Glob) | Each task | Error |
| PLAN-STR-06 | Each task has Test Cases table section BEFORE checkbox steps | Each task | Critical |
| PLAN-STR-07 | Subsystem mode only: parent index.md exists, lists all service plan files, code status (existing/new) annotated. Skip in System/Innovation modes | Plan index | Error |

#### Layer 2: Upstream Information Fidelity (PLAN-TRC, 9 items)

**Subsystem Mode**: All 9 items active.
**System Mode**: TRC-01, TRC-02, TRC-03, TRC-05, TRC-08, TRC-09 active. TRC-04, TRC-06, TRC-07 skipped (⬜ N/A — no module overview docs).
**Innovation Mode**: Entire layer skipped (⬜ N/A — no upstream docs).

| ID | Check Item | Location | Severity | Mode |
|---|---|---|---|---|
| PLAN-TRC-01 | REQ full coverage: every REQ-XXX in system requirements ch03 maps to at least one task | Cross-reference: sysreq ch03 ↔ plan tasks | Critical | Sub, Sys |
| PLAN-TRC-02 | API full coverage: every endpoint in OpenAPI spec owned by this module maps to at least one task | Cross-reference: OpenAPI paths ↔ plan tasks | Critical | Sub, Sys |
| PLAN-TRC-03 | DFX implementation: each applicable DFX dimension from overall design Ch.6 or module overview design Ch.5 has a corresponding implementation task, or explicit "not in this iteration" notation | Cross-reference: design DFX ↔ plan tasks | Error | Sub, Sys |
| PLAN-TRC-04 | Exception handling coverage: each exception scenario in module overview design Ch.4 §4.6 or Ch.3 §3.5.3 maps to at least one task test case (exception/boundary type) | Cross-reference: module Ch.4/Ch.3 ↔ plan Test Cases | Error | Sub |
| PLAN-TRC-05 | Design decisions preserved: key design decisions (approach selection, architecture constraints) from design docs reflected in plan Architecture section or relevant tasks | Cross-reference: design §4.1 ↔ plan | Error | Sub, Sys |
| PLAN-TRC-06 | External dependency handling: each DEP-XXX in module overview design Ch.3 §3.5 has a handling strategy in plan (mock/stub/integration test) | Cross-reference: module Ch.3 §3.5 ↔ plan | Warning | Sub |
| PLAN-TRC-07 | Data model coverage: each database table in module overview design Ch.4 §4.5.1 maps to at least one task (migration/DAO/model) | Cross-reference: module Ch.4 §4.5.1 ↔ plan tasks | Error | Sub |
| PLAN-TRC-08 | Task source annotation: each task explicitly references its source (REQ-XXX / design §X.X / API path), traceability chain auditable | Each task header/description | Warning | Sub, Sys |
| PLAN-TRC-09 | API path accuracy: API endpoints referenced in tasks (method + path) match the OpenAPI spec exactly, no invented paths | Cross-reference: plan tasks ↔ OpenAPI | Error | Sub, Sys |

#### Layer 3: No Placeholders + Executability (PLAN-EXE, 10 items)

Active in ALL modes.

| ID | Check Item | Location | Severity |
|---|---|---|---|
| PLAN-EXE-01 | No TBD / TODO / "implement later" / "fill in details" anywhere in plan | Full plan | Critical |
| PLAN-EXE-02 | No vague "Add appropriate error handling" / "add validation" / "handle edge cases" without specifics (must state which error, how to handle) | Full plan | Error |
| PLAN-EXE-03 | No "Write tests for the above" without actual test code and assertions | Full plan | Error |
| PLAN-EXE-04 | No "Similar to Task N" references — each task is self-contained | Full plan | Error |
| PLAN-EXE-05 | Every code step includes actual code blocks (```language ... ```), not just text descriptions | Each task checkbox step | Error |
| PLAN-EXE-06 | All referenced types/functions/methods are defined in this task or a prior task — no orphan references | Cross-reference within plan | Error |
| PLAN-EXE-07 | File paths are exact and verifiable: create paths in reasonable directories, modify paths correspond to existing files (Glob verify) | Each task Files section | Error |
| PLAN-EXE-08 | Each Test Case row complete: TC-ID, source trace, type, preconditions/input, expected assertions (concrete assert statements), automation level, test target path, run command | Each task Test Cases table | Error |
| PLAN-EXE-09 | No weak assertions: no "verify it works", "assert result is not None", "assert True" — assertions must verify specific behavior | Each task Test Cases table | Error |
| PLAN-EXE-10 | Test commands match conventions: each test case run command uses the test framework declared in Conventions block (pytest / go test / jest), target file/function paths correct | Each task Test Cases table | Warning |

#### Layer 4: Cross-Task Consistency + Standards (PLAN-CNS, 7 items)

Active in ALL modes. (CNS-05 is N/A in System and Innovation modes — no cross-service plans exist.)

| ID | Check Item | Location | Severity |
|---|---|---|---|
| PLAN-CNS-01 | Type/function name consistency: same function/type/variable referenced consistently across tasks (e.g., not `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7) | Cross-reference across tasks | Error |
| PLAN-CNS-02 | Code style consistency: all code examples follow conventions declared in Conventions block (naming, imports, error handling, logging) | Full plan code blocks | Error |
| PLAN-CNS-03 | Commit message format: follows conventional commits (feat/fix/test/chore/etc.) | Each task commit step | Warning |
| PLAN-CNS-04 | Test case scenario coverage: each task's test cases cover normal + boundary + exception scenario types. Missing one type is a defect | Each task Test Cases table | Error |
| PLAN-CNS-05 | Integration test tasks: multi-service plans include end-to-end integration verification tasks covering cross-service call chains | Plan task list (Subsystem mode) | Warning |
| PLAN-CNS-06 | Task ordering: dependent tasks ordered correctly (dependency before dependent). Tasks that produce types used by later tasks must come first | Plan task list | Warning |
| PLAN-CNS-07 | Domain Skill usage: skills listed in Domain Skills block have corresponding inline references (`> **调用 \`skill-name\`** ...`) in task steps where applicable | Each task checkbox step | Warning |

#### Layer 5: TDD Completeness (PLAN-TDD, 5 items)

Active in ALL modes.

| ID | Check Item | Location | Severity |
|---|---|---|---|
| PLAN-TDD-01 | RED phase complete: each task's steps 1-2 are "write failing test" + "run test, verify it fails for the expected reason (feature not implemented, not syntax error)" | Each task steps 1-2 | Error |
| PLAN-TDD-02 | GREEN phase complete: each task has minimal implementation step that makes the corresponding test pass, implementation code matches test scope | Each task implementation step | Error |
| PLAN-TDD-03 | REFACTOR phase: complex tasks (algorithms, data structures, multi-branch logic) have a refactor step. Simple CRUD tasks may omit | Each task (complex tasks only) | Warning |
| PLAN-TDD-04 | Test case traceability: each TC-ID traces to a specific upstream design location (design §X.X / REQ-XXX / API endpoint), source column is not empty | Each task Test Cases table | Warning |
| PLAN-TDD-05 | Test isolation: unit tests do not depend on external services (DB/network/filesystem). External dependencies explicitly annotated with mock/fixture strategy in test case preconditions | Each task Test Cases table | Error |

### 1.3 Scan Completion Statistics

After all 38 check items across all active layers are scanned, output a completion summary before proceeding to red line checks:

```
📊 [plan file name] scan complete
  - Total items scanned: [N] (mode-adapted, skipped items counted as N/A)
  - Pass: [n]
  - Violations (Critical): [n]
  - Violations (Error): [n]
  - Warnings: [n]
  - Issues found: [ISSUE-001 through ISSUE-XXX]
  - Layer breakdown:
    Layer 1 STR: [passed]/[total] | Layer 2 TRC: [passed]/[total] | Layer 3 EXE: [passed]/[total]
    Layer 4 CNS: [passed]/[total] | Layer 5 TDD: [passed]/[total]
```

### 1.4 Red Line Checks (Mode-Dependent, One-Vote Veto to F)

These MUST be checked early. Any violation → total grade F regardless of other scores.

**R1 — REQ Coverage Gap** (Subsystem and System modes only. Innovation mode: ⬜ N/A)

A single REQ-XXX in system requirements ch03 has zero corresponding tasks in the plan → R1 violated.

```
🚨 R1 REQ Coverage: ❌ VIOLATED
   Uncovered REQs: REQ-003, REQ-007, REQ-012
   Total uncovered: 3 / 15 REQ items
```

**R2 — Placeholder Contamination** (All modes)

Any TBD / TODO / "implement later" / "fill in details" found in plan → R2 violated.

```
🚨 R2 Placeholder: ❌ VIOLATED
   Found instances:
   - Task 3 step 4: "TODO: add error handling"
   - Task 5 Test Cases: "TBD"
   Total instances: 2
```

**R3 — Test Case Section Missing** (All modes)

Any task lacks a Test Cases section before checkbox steps → R3 violated.

```
🚨 R3 Test Case Missing: ❌ VIOLATED
   Tasks without Test Cases: Task 4, Task 7
   Total: 2 / 8 tasks
```

Red line output format:

```
🚨 Red Line Check Results:
  R1 REQ Coverage: ✅ Pass / ❌ Violated — [details]
  R2 Placeholder:  ✅ Pass / ❌ Violated — [details]
  R3 Test Case:    ✅ Pass / ❌ Violated — [details]
```

## Phase 2: Cross-Document Consistency

> **Skipped in this skill.** Cross-document consistency for design documents (system requirements ↔ overall design ↔ module overview design) is handled by `doc-quality-evaluator`. This skill's Layer 2 (TRC) checks plan-to-upstream traceability, which is a different concern.

## Phase 3: Scoring

### 3.1 Scoring Dimensions and Weights (Mode-Adaptive)

**Subsystem Mode:**

| Dimension | Weight | Description |
|---|---|---|
| **Upstream Information Fidelity** | 30% | REQ/API/DFX/exception/data model coverage — is the plan carrying ALL information from upstream design docs? |
| **Executability & Precision** | 25% | No placeholders, exact paths, concrete code, specific test commands — can an engineer execute this without asking questions? |
| **TDD Completeness** | 20% | RED/GREEN/REFACTOR cycle complete per task, test isolation, test traceability |
| **Cross-Task Consistency & Standards** | 15% | Type consistency, code style, task ordering, scenario coverage |
| **Structure Compliance** | 10% | Header, conventions, domain skills, task structure completeness |

**System Mode:**

| Dimension | Weight | Description |
|---|---|---|
| **Upstream Information Fidelity** | 25% | REQ/API/DFX/design decisions covered (reduced scope — no module overview docs) |
| **Executability & Precision** | 30% | (increased — more weight on self-contained plan quality) |
| **TDD Completeness** | 20% | |
| **Cross-Task Consistency & Standards** | 15% | |
| **Structure Compliance** | 10% | |

**Innovation Mode:**

| Dimension | Weight | Description |
|---|---|---|
| **Upstream Information Fidelity** | 0% | Skipped — no upstream docs exist |
| **Executability & Precision** | 40% | (maximum weight — plan is the sole artifact) |
| **TDD Completeness** | 30% | |
| **Cross-Task Consistency & Standards** | 20% | |
| **Structure Compliance** | 10% | |

### 3.2 Per-Dimension Deduction Rules

Each dimension starts at 100 points. Deductions by severity:

| Severity | Deduction per Issue |
|---|---|
| **Critical** | -40 points |
| **Error** | -20 points |
| **Warning** | -8 points |

Each dimension floors at 0 (no negative scores).

**Impact examples:**
- 1 Critical → dimension drops to 60 or below (D zone)
- 2 Errors → dimension drops to 60 (D zone)
- 3 Warnings → dimension loses 24 points

### 3.3 Total Score Calculation

```
Total = UpstreamFidelity×W1 + Executability×W2 + TDD×W3 + Consistency×W4 + Structure×W5
```

Where W1-W5 are the mode-adaptive weights from §3.1. In Innovation mode, UpstreamFidelity is skipped and its weight redistributed.

| Total Score | Grade | Meaning |
|---|---|---|
| 95-100 | **A** | Excellent — ready for execution handoff |
| 80-94 | **B** | Good — ready for execution handoff |
| 65-79 | **C** | Marginal — must fix all Error + Critical issues and re-evaluate |
| <65 | **D** | Failing — major rework needed, re-evaluate after fixes |
| Red line violation | **F** | Immediate failure, regardless of other scores |

### 3.4 Scoring Output Format

```
📊 Scoring Detail:

┌──────────────────────────┬────────┬───────────┬──────────────────────────┐
│ Dimension                │ Weight │ Score     │ Deductions               │
├──────────────────────────┼────────┼───────────┼──────────────────────────┤
│ Upstream Info Fidelity   │  [W1]%  │ [N]/100   │ ISSUE-003(-20), ...      │
│ Executability & Precision│  [W2]%  │ [N]/100   │ ISSUE-007(-20), ...      │
│ TDD Completeness         │  [W3]%  │ [N]/100   │ ISSUE-012(-20), ...      │
│ Consistency & Standards  │  [W4]%  │ [N]/100   │ ISSUE-015(-8), ...       │
│ Structure Compliance     │  [W5]%  │ [N]/100   │ —                        │
├──────────────────────────┼────────┼───────────┼──────────────────────────┤
│ **Weighted Total**       │  100%  │ **[N]**   │                          │
└──────────────────────────┴────────┴───────────┴──────────────────────────┘

Mode: [Subsystem / System / Innovation]
Red Line Status: R1 [✅/❌] | R2 [✅/❌] | R3 [✅/❌]

Grade: [A/B/C/D/F] — [conclusion]
```

## Phase 4: Report Generation

Save structured Markdown report to a `quality-reports/` subdirectory next to the plan file. If the plan is a parent `index.md`, save alongside it. File name: `YYYY-MM-DD-plan-quality-report.md`.

### Report Structure

```markdown
# Implementation Plan Quality Evaluation Report

**Plan:** [plan file path]
**Date:** YYYY-MM-DD
**Mode:** [Subsystem / System / Innovation]
**Grade:** [A/B/C/D/F] — [score]/100

---

## I. Red Line Results

| Red Line | Status | Details |
|---|---|---|
| R1 REQ Coverage | ✅ / ❌ / ⬜ N/A | [details] |
| R2 Placeholder | ✅ / ❌ | [details] |
| R3 Test Case | ✅ / ❌ | [details] |

> Any red line violation → Grade F, must fix root cause and re-evaluate.

---

## II. Scoring Overview

[Scoring table from Phase 3.4]

**Layer Summary:**

| Layer | Total Items | Pass | Violations | N/A (mode) | Pass Rate |
|---|---|---|---|---|---|
| Layer 1: Structure (STR) | 7 | - | - | - | -% |
| Layer 2: Traceability (TRC) | 9 | - | - | - | -% |
| Layer 3: Executability (EXE) | 10 | - | - | - | -% |
| Layer 4: Consistency (CNS) | 7 | - | - | - | -% |
| Layer 5: TDD (TDD) | 5 | - | - | - | -% |
| **Total** | 38 | - | - | - | -% |

---

## III. Issue List (by Severity)

### 🚨 Critical

[ISSUE-XXX details: document/location/rule/quote/description/fix direction]

### ❌ Error

[...]

### ⚠️ Warning

[...]

---

## IV. Improvement Suggestions (Prioritized)

1. **[Highest]** [Fix Critical issues — specific steps]
2. **[High]** [Fix Error issues — specific steps]
3. **[Medium]** [Fix Warning issues — suggestions]
4. **[Coverage]** [Add missing task coverage for uncovered REQs/APIs/DFX dimensions]

---

## V. Next Steps

- Grade A/B (≥ 80) → Plan is ready for execution handoff (`subagent-driven-development` or `executing-plans`)
- Grade C (65–79) → Fix all Error+ issues, re-dispatch `plan-evaluator` (max 2 repair rounds)
- Grade D (< 65) or F → Major rework needed. Fix root issues, re-dispatch `plan-evaluator`
- After 2 repair rounds still < B → Present remaining issues to user, request manual intervention
```

## Integration

`plan-evaluator` is a **passive evaluator** — it does not route to the next step.

- Dispatched by `writing-plans-detail` (or `writing-plans-brief`) after the plan is written, before Execution Handoff. Note: `writing-plans` is a router that dispatches to detail/brief and exits — it never directly calls plan-evaluator.
- Runs as an isolated subagent via `skills/plan-evaluator/agents/evaluator-dispatch-prompt.md`
- Returns to the calling plan-writing skill: grade (A/B/C/D/F), score, red line status, Critical + Error issues table, report path
- The calling skill decides next action based on grade:
  - A/B (≥ 80): Proceed to TRANSITION GATE → Execution Handoff
  - C/D/F: Fix issues, re-dispatch (max 2 repair rounds, then escalate to user)
- Report path: same directory as plan file, `quality-reports/YYYY-MM-DD-plan-quality-report.md`

## Common Problem Patterns

| Problem | Typical Manifestation | Check Item | Severity |
|---|---|---|---|
| Placeholder contamination | "TBD", "TODO", "implement later", "fill in details" anywhere in plan | PLAN-EXE-01, R2 | Critical |
| Test Case section missing | A task has checkbox steps but no Test Cases table | PLAN-STR-06, R3 | Critical |
| REQ uncovered | A REQ-XXX in system requirements has zero corresponding plan tasks | PLAN-TRC-01, R1 | Critical |
| Weak assertions | "verify it works", "assert result is not None" instead of concrete assertions | PLAN-EXE-09 | Error |
| Vague error handling | "Add appropriate error handling" without stating which error, how to handle | PLAN-EXE-02 | Error |
| Missing RED phase | Task steps don't start with "write failing test" + "run to verify it fails" | PLAN-TDD-01 | Error |
| API path mismatch | Plan references `/api/v2/users` but OpenAPI defines `/api/v1/users` | PLAN-TRC-09 | Error |
| Orphan references | Code references a function/type not defined in any prior task | PLAN-EXE-06 | Error |
| No code blocks | A code step describes what to do in text without showing actual code | PLAN-EXE-05 | Error |
| Conventions mismatch | Code examples use camelCase but Conventions block says snake_case | PLAN-CNS-02 | Error |
| Missing boundary tests | Test cases only cover normal path, no boundary or exception scenarios | PLAN-CNS-04 | Error |
| "Similar to Task N" | Task reuses another task's content by reference instead of being self-contained | PLAN-EXE-04 | Error |
| Domain Skill unused | Skill listed in Domain Skills block but never referenced in task steps | PLAN-CNS-07 | Warning |
| Test command wrong | Test command uses `jest` but Conventions says `pytest` | PLAN-EXE-10 | Warning |

## Check Item Overview

| Phase | Check Items | Count | Maps to Dimension |
|---|---|---|---|
| Layer 1 (STR) | PLAN-STR-01 ~ PLAN-STR-07 | 7 | Structure Compliance |
| Layer 2 (TRC) | PLAN-TRC-01 ~ PLAN-TRC-09 | 9 | Upstream Information Fidelity |
| Layer 3 (EXE) | PLAN-EXE-01 ~ PLAN-EXE-10 | 10 | Executability & Precision |
| Layer 4 (CNS) | PLAN-CNS-01 ~ PLAN-CNS-07 | 7 | Cross-Task Consistency & Standards |
| Layer 5 (TDD) | PLAN-TDD-01 ~ PLAN-TDD-05 | 5 | TDD Completeness |
| Phase 1.4 | R1, R2, R3 | 3 | One-vote veto → F |
| **Total** | | **41** | |
