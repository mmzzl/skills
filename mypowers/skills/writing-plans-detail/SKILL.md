---
name: writing-plans-detail
description: Use when you have a spec or requirements for a multi-step task, before touching code — detailed planning mode with full code examples, test cases, and TDD step-by-step
allowed-tools: Bash(node *)
allowedCommands:
  - "node **/read-domain-skills.mjs*"
allowedPaths:
  - "**"
---

# Writing Plans (Detail)

**Skill 标识**: `writing-plans-detail`

其他 skill 通过 `writing-plans-detail` 引用本 skill。

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans-detail skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:**
- **System mode** (single plan): `docs/agent-rules/plans/YYYY-MM-DD-<feature-name>.md`
- **Subsystem mode** (one plan per service): `docs/agent-rules/plans/YYYY-MM-DD-<project>/<feature-name>-<service-name>-plan.md`
- **Innovation mode** (standalone plan): `docs/agent-rules/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

**Team Phase Workflow:** In end-to-end team projects, writing-plans-detail receives input from the design phase. Two entry points exist:

- **From `overall-design-spec`**: Input is the system-level design document. Plan covers system-wide architecture implementation.
- **From `module-design-spec`**: Input is per-subsystem design document(s). Plan covers per-service implementation with service-level task splitting.

**Innovation Workflow:** For 小微项目 (single-module, small-scope projects with no cross-module interaction), writing-plans-detail receives input directly from brainstorming's Phase 3 design output at `docs/agent-rules/specs/YYYY-MM-DD-<topic>-design.md`. No upstream evaluators to verify.

## Workflow

You MUST create TodoWrite tasks for each major phase and complete them in order. Do NOT skip any phase.

1. **Upstream Quality Gate** — verify all upstream evaluators passed (or dispatch them if unconfirmed)
2. **Write Plan** — codebase style analysis, domain skill discovery, write the plan with all tasks
3. **⛔ Post-Plan Quality Gates** — dispatch plan-evaluator, loop until grade ≥ B, then execution handoff

## Execution Approach (Ask Before Writing Plan)

Before writing ANY plan content, ask the user this question once and record their choice:

**"Which execution approach after planning?"**

**1. Subagent-Driven (recommended)** - Dispatches a fresh subagent per task with review between tasks

**2. Inline Execution** - Executes tasks in this session with checkpoints

Record the user's choice. It will be used in Phase 3.3 after the plan passes evaluation.

## Source Detection and Input Loading

Before writing the plan, detect which design phase produced the input:

1. Scan `docs/agent-rules/4-module-design/output/` for subdirectories with `YYYY-MM-DD-` prefix; take the newest one (sort descending). If found, you are in **subsystem mode**.
2. Otherwise, scan `docs/agent-rules/3-overall-design/output/`; if found, you are in **system mode**.
3. If neither directory exists: you are in **innovation mode** (design input from `docs/agent-rules/specs/YYYY-MM-DD-<topic>-design.md`). Skip the upstream quality gate and proceed directly to plan writing.

## ⛔ UPSTREAM QUALITY GATE — Verify Evaluator Completion

Before writing ANY plan, verify all upstream evaluators have passed. **Do NOT ask the user to confirm — verify autonomously. If you cannot confirm an evaluator passed, dispatch it yourself.**

**For Subsystem Mode** (input from `docs/agent-rules/4-module-design/output/`):

1. **Per-module evaluators**: For each module, verify `module-design-evaluator` passed with grade >= B (or was config-disabled).
   - **If you cannot confirm for any module**: DO NOT ask the user. Dispatch `module-design-evaluator` via `skills/module-design-evaluator/agents/evaluator-dispatch-prompt.md` for each unconfirmed module. Proceed only when all return >= B.

2. **Cross-document evaluator**: Compare the subsystem list from overall design `ch02-系统总体架构.md` §2.3.1 against the actual subdirectories under `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/`. If all are present, verify `doc-quality-evaluator` completed.
   - **If you cannot confirm and `config.evaluators["doc-quality"]` is not `false`**: DO NOT ask the user. Dispatch `doc-quality-evaluator` via `skills/doc-quality-evaluator/agents/evaluator-dispatch-prompt.md`. Review results, fix issues, re-evaluate if needed.
   - If some subsystems are still missing: skip cross-document evaluation and proceed with the available subsystems.
   - If `config.evaluators["doc-quality"]` is `false`: note skip and proceed.

**For System Mode** (input from `docs/agent-rules/3-overall-design/output/`):

1. **Overall design evaluator**: Verify `overall-design-evaluator` passed with grade >= B (or is config-disabled).
   - **If you cannot confirm and `config.evaluators["overall-design"]` is not `false`**: DO NOT ask the user. Dispatch `overall-design-evaluator` via `skills/overall-design-evaluator/agents/evaluator-dispatch-prompt.md` with the overall design document. Proceed only when >= B.
   - If `config.evaluators["overall-design"]` is `false`: note skip and proceed.

**For Innovation Mode**: No upstream evaluators to verify — skip this gate and proceed directly to plan writing.

**When all evaluators return grade >= B** (or are config-disabled, or skipped in Innovation mode), announce and proceed. **If any returns < B**: fix issues and re-evaluate. Do NOT proceed to plan writing until all pass.

## Subsystem Mode: Service-Aware Task Splitting

When input comes from subsystem design, the plan must be split by service. Follow this procedure:

**Step A: Load subsystem design documents.** For each subsystem subdirectory under the newest `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/`:

- Read `index.md` — identify subsystem name, responsibilities overview, code repo, and chapter TOC
- Read `ch02-模块职责和边界.md` — extract module responsibilities, module boundaries, and code repository paths (from init template §1)
- Read `ch03-对外接口.md` — extract API interfaces this module owns (from OpenAPI refs) and external dependencies (DEP-XXX)

**Step B: Load and verify the OpenAPI spec.** Read `<project>-openapi.yaml` from `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/` (matching the project date prefix). Extract:

- All endpoint definitions (method, path, request/response schemas) for each subsystem
- Error code definitions that implementation must handle
- Type constraints and validation rules for request validation

**⛔ HARD GATE — Step B check: OpenAPI must be valid before writing ANY plan.**

| Check | How to Verify | Blocking? |
|-------|---------------|-----------|
| File exists | `ls` the exact path `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/<project>-openapi.yaml` | **YES** — STOP if missing |
| Valid YAML | Parse the file; confirm it loads without error | **YES** — STOP if invalid |
| Has endpoints | At least one `paths:` entry with a method defined | **YES** — STOP if empty |

**If any check fails: DO NOT proceed.** Tell the user:

> "OpenAPI 规范文件缺失或无效：`docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/<project>-openapi.yaml`
> [具体问题]
> 请回到 `overall-design-spec` 修正 OpenAPI 后再调用 `writing-plans`。"

Present a pass summary before continuing:

```
🔍 OpenAPI 就绪检查
✅ 文件存在: docs/agent-rules/3-overall-design/output/2026-05-06-xxx/xxx-openapi.yaml
✅ YAML 合法
✅ 包含 N 个端点
```

**Step C: Discover local service code.** For each subsystem, check if service code exists locally:

- Read `ch02-模块职责和边界.md` for code repository paths (from the module init template §1)
- For each repo path listed, verify the directory exists on disk (`ls` or `Glob`)
- If code exists: read representative files (entry point, router, existing API handlers, models) to understand existing patterns — the plan must extend existing code, not rewrite
- If code does NOT exist: plan starts from scaffold; note that the engineer must create the project first

**Step D: Split tasks by service — one plan file per service.** Each service gets its own plan document. Create a parent `index.md` listing all service plans, then write each service plan as a separate file.

**Parent index:** `docs/agent-rules/plans/YYYY-MM-DD-<project>/index.md`

```markdown
# <Project> Implementation Plans

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement each plan task-by-task.

**Source:** module-design-spec → `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/`
**OpenAPI:** `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/<project>-openapi.yaml`

## Service Plans

| Service | Plan File | Code Status |
|---------|-----------|-------------|
| <service-1> | [<feature-name>-<service-1>-plan.md](<feature-name>-<service-1>-plan.md) | ✅ existing / ❌ new |
| <service-2> | [<feature-name>-<service-2>-plan.md](<feature-name>-<service-2>-plan.md) | ✅ existing / ❌ new |
```

**Per-service plan:** `docs/agent-rules/plans/YYYY-MM-DD-<project>/<feature-name>-<service-name>-plan.md`

Each service plan starts with its own header and follows the standard plan structure:

```markdown
# [Service Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task.

**Goal:** [What this service implements]

**Code:** <repo-path>  ✅ existing / ❌ new service

**APIs owned:** [list endpoints from OpenAPI spec this service implements]

**Dependencies:** DEP-XXX: <service> — <purpose>

---
## Conventions
...

### Task 1: ...
```

Each service plan is self-contained — one service's tasks do not depend on another service's implementation (only on API contracts defined in the OpenAPI spec).

**Step E: Cross-service integration tasks.** After all service groups, add integration tasks to the parent `index.md` as a new `## Integration Tasks` section after the Service Plans table:

- End-to-end flow validation across services
- Contract testing against the OpenAPI spec
- Deployment coordination (if multiple services deploy together)

## System Mode: Standard Plan

When input comes from system-level design, the plan follows the standard structure below (no per-service splitting required). Ensure every requirement from the design task book has corresponding implementation tasks.

## Innovation Mode: Standard Plan

When input comes from brainstorming Phase 3 micro-design (`docs/agent-rules/specs/YYYY-MM-DD-<topic>-design.md`), the plan follows the standard structure below (no per-service splitting required). Ensure every requirement from the micro-design document has corresponding implementation tasks.

## Codebase Style Analysis (MUST Do Before Writing Plan)

Before writing any implementation task, you MUST analyze the current project's code style and conventions. The plan's code examples must match the existing codebase — not your default style preferences.

### Step 1: Identify Project Language and Framework

```bash
# Check project files
ls *.py *.go *.js *.ts pyproject.toml go.mod package.json Makefile 2>/dev/null

# Check existing structure
find . -maxdepth 3 -type f -name "*.py" -o -name "*.go" -o -name "*.js" | head -20
```

### Step 2: Learn Code Conventions

Read 3-5 representative files from the project to learn:

| Convention | What to Look For | Example |
|---|---|---|
| **Naming** | snake_case vs camelCase, prefix patterns, abbreviation style | `get_user_info()` vs `getUserInfo()` |
| **File organization** | One class per file? Module structure? Barrel exports? | `models/user.py` vs `models.py` |
| **Import style** | Absolute vs relative, grouping, order | `from app.models import User` vs `from .models import User` |
| **Error handling** | Custom exceptions? Error codes? Result types? | `raise ServiceError(code=...)` vs `return None` |
| **Logging** | Logger pattern, format, levels | `logger = logging.getLogger(__name__)` |
| **Testing** | Framework, fixture patterns, mock approach, file naming | `test_*.py` vs `*_test.go`, pytest vs unittest |
| **API patterns** | Router registration, serialization, middleware | Django views vs FastAPI routes |
| **Database** | ORM vs raw SQL, migration framework, model definition | SQLAlchemy vs Django ORM vs GORM |
| **Configuration** | env vars, config files, settings pattern | `settings.py` vs `config.yaml` |
| **Comments/Docstrings** | Style, language (Chinese/English), detail level | Google-style vs Sphinx vs no docstrings |

### Step 3: Check for Project-Specific Standards

```bash
# Check if project has its own coding standards
ls .editorconfig .pylintrc .flake8 .golangci.yml .eslintrc* pyproject.toml 2>/dev/null
cat pyproject.toml 2>/dev/null | head -30  # Check tool configs
```

Also check `doc/kb/` or project README for any documented conventions.

### Step 4: Document Conventions in Plan Header

Add a **Conventions** section to the plan header:

```markdown
**Conventions (learned from codebase):**
- Language: Python 3, Django 4.x
- Naming: snake_case for functions/variables, PascalCase for classes
- Imports: absolute imports, grouped (stdlib → third-party → local)
- Error handling: custom ServiceError with error codes
- Testing: pytest, fixtures in conftest.py, mock with unittest.mock
- Logging: structlog, logger per module
- API: Django REST Framework, ViewSet pattern
- DB: Django ORM, migrations via manage.py
```

**All code examples in the plan MUST follow these conventions.** Do not write Go-style code in a Python project, do not use camelCase in a snake_case codebase, do not use raw SQL in an ORM project.

## Domain Skill Discovery (MUST Do Before Writing Tasks)

### Extension Domain Skills
```!
node ${CLAUDE_SKILL_DIR}/scripts/read-domain-skills.mjs ${CLAUDE_PLUGIN_ROOT}
```

### Finding Domain Skills for This Plan

After analyzing codebase conventions, discover domain skills using a **two-tier discovery (ALWAYS prefer Tier 1)**:

1. **Tier 1 — Extension Domain Skills (script output, PRIMARY):** The output above  is already the executed result. **Always start here — this is the only authoritative source.** Its output provides direct mapping: each `[section]`'s `name` field matches one of the 4 categories (`单测编写`, `测试方法`, `排障调试`, `代码编写`), the `skill` field gives the exact skill identifier to use in the plan, and `description` explains what it does. Map each category directly from this output — no guessing needed.
2. **Tier 2 — Session context (FALLBACK — only if Tier 1 has gaps):** Use this **only** when a category is **not** found in Tier 1's output. Scan the current session's loaded skills (from the system-reminder skill list) and pick the best match for the missing category.

| Category | Look for skills that... | Applied at |
|---|---|---|
| 单测编写 | Generate or write unit test code | Steps that write test code |
| 测试方法 | Define testing strategy or TDD cycle | All implementation task test phases |
| 排障调试 | Diagnose failures, debug errors, investigate faults | Blocker handling, failure investigation |
| 代码编写 | Enforce coding standards, generate code, check quality | All code implementation steps |

If multiple skills match one category, list all and mark the recommended one.

**Write results into the plan header as a `Domain Skills` block** (after the `Conventions` block):

```markdown
**Domain Skills (from session context):**
- 单测编写: `test-code-generator` — generate go test / pytest code from test docs (recommended)
- 测试方法: `test-driven-development` — TDD red-green cycle, write failing test first
- 排障调试: `systematic-debugging` — evidence-first fault investigation
- 代码编写: `code-compliance-check` — coding standards check + lint auto-fix
- (If no skill found for a category, write: "None — use default approach")
```

**When writing each task's steps**, at steps where a domain skill applies, add an inline reference immediately after the step description:

```markdown
- [ ] **Step 1: Write the failing test**

  > **调用 `test-driven-development`** 执行 RED 阶段 — 先写失败测试，确认测试因"功能未实现"而失败，而非语法错误

- [ ] **Step 3: Write minimal implementation**

  > **调用 `code-compliance-check`** 检查代码规范
```

The inline reference format is: `> **调用 \`[skill-name]\`** [purpose in this specific step]`

## Test Case Closure (HARD GATE)

Every implementation task MUST carry its own executable test-case design before any code steps.

For each task, add a `Test Cases` section before the checkbox steps. It must include:
- Test case ID(s) traced to the source design or requirement (`TC-XXX`, `REQ-XXX`, design section, or API path)
- Scenario type: normal, boundary, exception, regression, contract, or E2E
- Preconditions and test data/input
- Expected result and meaningful assertions
- Automation level: unit, integration, API/contract, E2E, or manual with reason
- Exact test file/function name to create or modify
- Exact command to run and expected RED/GREEN result

**No task may be implementation-only.** If a code change truly cannot be automated, the task must state why, provide a manual verification case, and still include regression coverage where possible.

These are plan failures and must be fixed before handoff:
- A task has implementation steps but no `Test Cases` section
- A test case says only "verify it works" or "write tests"
- Test steps lack input, expected result, assertions, or command
- A source design test case is not mapped to any implementation task

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans -- one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Conventions (learned from codebase):**
- Language: [e.g., Python 3, Django 4.x]
- Naming: [e.g., snake_case for functions, PascalCase for classes]
- Testing: [e.g., pytest, fixtures in conftest.py]
- ...

**Domain Skills (from session context):**
- 单测编写: `[skill-name]` — [purpose] (or "None — use default approach")
- 测试方法: `[skill-name]` — [purpose]
- 排障调试: `[skill-name]` — [purpose]
- 代码编写: `[skill-name]` — [purpose]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Test Cases:**

| ID | Source | Type | Preconditions/Input | Expected Assertions | Automation | Test Target | Command |
|---|---|---|---|---|---|---|---|
| TC-001 | REQ-001 / §3.2 | normal | `input = ...` | return value equals ...; side effect ... | unit | `tests/path/test_file.py::test_specific_behavior` | `pytest tests/path/test_file.py::test_specific_behavior -v` |
| TC-002 | §5.3 ET-001 | exception | invalid `input = ...` | raises `ValidationError`; no data persisted | unit | `tests/path/test_file.py::test_rejects_invalid_input` | `pytest tests/path/test_file.py::test_rejects_invalid_input -v` |

- [ ] **Step 1: Write the failing test for TC-001**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** -- never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code -- the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## ⛔ Post-Plan Quality Gates → Execution Handoff

You MUST complete each sub-step in order. Do NOT skip any sub-step.

### Pre-Flight Self-Check (before dispatching plan-evaluator)

Before the expensive evaluator subagent, do a fast structural scan to catch red-line-level blockers cheaply. Fix any found inline — don't spend time on quality nuances, leave those to plan-evaluator.

| Check | What to Scan | Fix if Found |
|---|---|---|
| **R2 Placeholder** | Grep plan for `TBD`, `TODO`, `implement later`, `fill in details` | Replace with actual content or remove the step |
| **R3 Test Case Missing** | Verify every task has a `Test Cases` table before checkbox steps | Add a Test Cases table with TC-ID, source, type, preconditions, expected assertions, automation level, test target, command |
| **Header completeness** | Goal (1 sentence), Architecture (2-3 sentences), Tech Stack, Conventions, Domain Skills all present and non-empty | Fill missing header fields |
| **Task structure** | Each task has Files section + Test Cases table + checkbox steps | Add missing sections |

### ⛔ Quality Evaluation — dispatch plan-evaluator

**Dispatch:** `plan-evaluator` as an isolated subagent via `skills/plan-evaluator/agents/evaluator-dispatch-prompt.md` with the plan file path. **In Subsystem mode, pass the parent `index.md` path** (the evaluator will load all per-service plans listed in it). The evaluator auto-detects the mode (Subsystem/System/Innovation) and adapts its check scope accordingly.

**Returns:** `plan-evaluator` is a passive evaluator — it does not route to the next step. It returns:
- Grade (A/B/C/D/F) and total score
- Red line status (R1/R2/R3)
- Critical + Error + Warning issues table (location, description, fix direction)
- Quality report path

**Grade-based decision** (you, `writing-plans-detail`, decide the next action):

| Grade | Action | Rework Target |
|---|---|---|
| **A or B (>= 80)** | ✅ Plan is ready. Proceed to TRANSITION GATE. | — |
| **C (65–79)** | ❌ Apply all Error+Critical fixes from the report. Re-dispatch `plan-evaluator`. **Max 2 repair rounds.** If still < B after round 2: present remaining issues to user, ask them to help fix. | Fix the specific tasks/test cases/header sections reported. Stay in this phase — surgical fixes only. |
| **D (< 65) or F** | ❌ Return to Write Plan phase. Revisit task decomposition, test case design, or conventions analysis depending on which dimensions scored lowest (see report's scoring table). Re-dispatch after rework. Same max-2-rounds rule. | **Return to Write Plan phase.** Red line violation (F): fix root cause — placeholder contamination → rewrite affected tasks; test case missing → add Test Cases tables; REQ coverage gap → add missing tasks. |

**Fix rules:**
- Read the full quality report first. Fix ONLY the reported issues — do not rewrite sections that already passed.
- If the re-evaluated score drops, your changes introduced regressions; revert and fix more surgically.
- After each re-dispatch, check the returned grade. If still < B, fix and re-dispatch again.
- Reference `plan-evaluator`'s Common Problem Patterns table for fix directions per issue type.

**Skip gate:** If `config.evaluators["plan"]` is `false`, skip this sub-step and proceed directly to TRANSITION GATE.

### ⛔ TRANSITION GATE — confirm evaluator passed

- **If grade >= B (or evaluator skipped)**: proceed to Execution Handoff.
- **If grade < B**: return to Quality Evaluation rework loop.
- **If you cannot confirm**: DO NOT ask the user. Re-dispatch `plan-evaluator` via `skills/plan-evaluator/agents/evaluator-dispatch-prompt.md` with the plan file.

### Execution Handoff (only after TRANSITION GATE confirms grade >= B)

Use the execution approach choice the user made earlier (see **Execution Approach** section at the top). After the plan is saved AND TRANSITION GATE confirms grade >= B, **immediately invoke without asking again**:

**If Subagent-Driven chosen:**
- Invoke prompt:
  `"Execute the next uncompleted task (- [ ]) in docs/agent-rules/plans/<filename>.md using the subagent-driven-development skill. Mark completed steps (- [x]). Stop when all tasks are done."`

**If Inline Execution chosen:**
- Invoke prompt:
  `"Execute the next uncompleted task (- [ ]) in docs/agent-rules/plans/<filename>.md using the executing-plans skill. Mark completed steps (- [x]). Stop when all tasks are done."`

## Next Steps

**⛔ TRANSITION GATE — Verify before execution handoff:**

1. **Plan quality gate check**: Did `plan-evaluator` pass with grade >= B? Or is `config.evaluators["plan"]` `false`?
   - If evaluator ran and grade < B: DO NOT proceed. Return to Quality Evaluation rework loop (max 2 repair rounds, then escalate to user).
   - If evaluator was skipped via config: explicitly note the skip before proceeding.
   - **If you cannot confirm**: DO NOT ask the user. Re-dispatch `plan-evaluator` via `skills/plan-evaluator/agents/evaluator-dispatch-prompt.md` with the plan file. Proceed if >= B, rework if < B.

**When the gate is satisfied**, immediately invoke as described in Execution Handoff above.

**If the gate fails**: tell the user the grade and remaining issues. Do NOT invoke .

## Remember
- Exact file paths always
- Complete code in every step -- if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits
