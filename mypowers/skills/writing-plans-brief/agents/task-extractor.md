# Task Extractor Dispatch Prompt Template

Use this template when dispatching a task-extractor subagent from `writing-plans-brief` after design documents are loaded and upstream quality gates pass.

**Purpose:** Run task extraction in an isolated context. The subagent reads all design documents, discovers domain skills, clusters business capabilities, and produces a complete task plan, DAG, and per-task cards without filling the main conversation context with document parsing.

**Dispatch after:** Upstream quality gates pass (Step 1 complete). Design document directory is confirmed.

```
Agent:
  subagent_type: "general-purpose"
  description: "Task extraction: [feature name]"
  prompt: |
    You are a task extraction specialist. Your job is to read design documents and extract implementation tasks as vertical business capability slices.

    **Output directory:** `.cospowers/plans/YY-MM-DD-[project]/`
    **Repo Index:** `doc/kb/仓库概览.md`

    ## Input Documents

    Read ALL of the following from the design directory:
    1. `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/` — architect design, DFX design and all endpoint groups
    2. `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module>/module-design-brief.md` — all data entities and business processes

    If any document is missing: note it but continue with what's available.

    ## Phase 1: Domain Skill Discovery

    Before extracting tasks, discover available domain skills from the current session's loaded skills list.

    1. Scan the system-reminder for loaded skills
    2. Map each discovered skill to one of four categories:
       - **单测编写** (test code generation): skills that generate test code from test case docs
       - **测试方法** (testing methodology): skills that define TDD or testing methodology
       - **排障调试** (debugging & troubleshooting): skills for systematic debugging
       - **代码编写** (code implementation): skills for code compliance and standards checking
    3. For each category where project-specific skills are found, record them. If no match, use the fallback default.

    **Fallback defaults** (used when no matching skill found):

    | Category | Fallback Skill |
    |----------|---------------|
    | 测试方法 | `test-driven-development` |
    | 单测编写 | `test-code-generator` |
    | 排障调试 | `systematic-debugging` |
    | 代码编写 | `code-compliance-check` |

    ## Phase 2: Identify Business Capability Clusters

    Cross-reference all design documents to find which entities, APIs, and processes belong together:

    1. From `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/` — list architect design, DFX design and all endpoint groups
    2. From `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module>/module-design-brief.md` — list all data entities and business processes
    3. **Cluster**: Group entities, endpoints, and processes that serve the same business capability (e.g., "User Management" = User entity + /users/* endpoints + registration/auth processes)
    4. **DFX concerns** from `ch06-系统DFX特性设计.md` are noted for merging into each capability task's acceptance criteria

    ## Phase 3: Extract Tasks (Vertical Slicing)

    **Core principle:** Extract tasks as **vertical slices** — each task contains its complete stack (data + API + business logic) for one business capability. This eliminates cross-layer dependencies and enables parallel execution. Horizontal layering (all data models first, then all APIs, then all business logic) creates unnecessary serial chains — **do NOT use it.**

    Extract tasks in this order:

    | Priority | Task Type | Extraction Rule |
    |----------|-----------|----------------|
    | 1st | **Foundation** | Shared infrastructure used by ALL capabilities: DB setup, common middleware, shared types/constants. Extract as a single prerequisite task. |
    | 2nd | **Capability Slices** | Each business capability cluster → one self-contained task (its data model + its API handlers + its business logic). These tasks have NO dependencies on each other — they all run in parallel. |
    | 3rd | **Integration** | Cross-capability orchestration, integration flows, or shared workflows that span multiple capabilities. Extract as a single final task that depends on all capability slices. |

    ## Phase 4: Apply Dependency Minimization Rules

    The goal is maximum parallelism. Apply these rules when assigning dependencies:

    | Situation | Rule |
    |-----------|------|
    | Capability B uses Capability A's **data at runtime only** | Define A's interface contract in the **Foundation task** as a shared contract. Both A and B implement against it. No dependency between A and B. |
    | Capability B needs Capability A's **types at compile time** | Extract the shared types into the **Foundation task**. No dependency between A and B. |
    | Capability B **orchestrates** Capability A's behavior | This is an integration concern — belongs in the Integration task, not a dependency from B on A. |
    | Two capabilities are **tightly coupled** (can't separate) | Merge them into a single capability task rather than creating a dependency between two tasks. |

    **Resulting DAG shape:**

    ```
    Foundation ──→ Capability A ──→ Integration
                ├─ Capability B ──┤
                ├─ Capability C ──┤
                └─ Capability N ──┘
    ```

    All capability tasks run in parallel after Foundation completes. Integration runs after all capabilities complete.

    ## Phase 5: Define Each Task

    For each extracted task, define ALL of the following:

    - **ID**: concise kebab-case identifier (e.g., `user-management`, `order-management`)
    - **Source**: which design document section(s) it comes from
    - **Depends on**: task ids this one depends on, or none
    - **Input artifacts**: upstream manifest paths derived from dependencies
    - **Task spec**: what this task builds and its scope — the goal in 1-2 sentences
    - **Interface contract**: the types, function signatures, or API contracts this module exposes to downstream modules
    - **Deliverables**: what artifacts this task produces (e.g., "User model + repository + migration + API handlers + business logic"). Describe the outputs, not the file paths.
    - **Acceptance criteria**: 3-5 scenarios (normal, boundary, exception) in plain language, NOT code
    - **Required output artifacts**: manifest, results, contract, changed-files, and test-results paths under `.cospowers/tasks/<task-id>/`

    ## Phase 6: DAG Construction & Validation

    ### Dependency Types

    ```
    Compile dependency: Task B imports task A's types/interfaces -> A must complete first
    Runtime dependency: Task B calls task A's API -> A's interface contract must be defined first
    Data dependency: Task B reads/writes task A's data tables -> A's migration must execute first
    ```

    ### Dependency Audit

    Review every dependency and ask: "Can this be resolved by extracting a shared contract into the Foundation task instead?" If yes, remove the cross-capability dependency — capability tasks should be parallel.

    ### Cycle Detection

    Check for cycles in the dependency graph. If a cycle exists, resolve it by:
    1. Merging the cyclically-dependent modules into one task, OR
    2. Extracting a shared interface/contract into a new task that both depend on

    ### Task Completion Standard

    A task is "complete" when:
    - All unit tests pass (coverage meets module requirements)
    - Interface contract tests pass (if the module exposes external interfaces)
    - Code compiles successfully
    - Downstream-facing interfaces are stable (signatures won't change arbitrarily)

    ## Phase 7: Self-Check Before Writing

    Run these checks on your output before writing files:

    | Check | What to Scan | Fix if Found |
    |---|---|---|
    | **Placeholder** | Grep for `TBD`, `TODO`, `implement later`, `fill in details` | Replace with actual content or remove |
    | **AC completeness** | Every task has 3+ acceptance criteria (normal, boundary, exception) | Add missing scenarios |
    | **Task structure** | Every task card has: Source, Depends on, Input Artifacts, Task spec, Interface contract, Deliverables, Acceptance criteria, Required Output Artifacts | Add missing sections |
    | **DAG parallelism** | Capability tasks have NO cross-dependencies on each other. DAG follows Foundation → [parallel slices] → Integration shape. | Move shared types to Foundation, merge tightly-coupled tasks, or move orchestration to Integration |
    | **Contract completeness** | Every capability task has an Interface contract section | Add contract definitions |
    | **Artifact contract** | `dag.json` references every task card and every expected manifest path | Add missing entries |

    ## Phase 8: Write Plan Artifacts

    Write the following files under `.cospowers/plans/YY-MM-DD-[project]/`:

    ```text
    index.md              # human-readable total plan
    dag.json              # machine-readable scheduling input
    tasks/<task-id>.md    # one task card per Sub Agent
    ```

    ### `index.md` structure

    Write `index.md` using this exact structure:

    ```markdown
    # [Feature Name] Implementation Plan

    > **For agentic workers:** REQUIRED EXECUTION MODE: Use `executing-plans-brief` or `subagent-driven-development` as an orchestrator-only workflow. Dispatch each task as an isolated subagent using DAG/task-card/manifest artifact paths. Do not paste task bodies between agents.

    **Goal:** [One sentence describing what this builds]

    **Architecture:** [2-3 sentences about approach]

    **Tech Stack:** [Key technologies/libraries]

    **Scheduling artifacts:**
    - DAG: `.cospowers/plans/YY-MM-DD-[project]/dag.json`
    - Task cards: `.cospowers/plans/YY-MM-DD-[project]/tasks/`

    ---

    ## Task DAG

    ```mermaid
    graph TD
        [mermaid DAG with Foundation → parallel capabilities → Integration]
    ```

    ## Tasks

    ### Module 1: [task-id]

    **Task card:** `.cospowers/plans/YY-MM-DD-[project]/tasks/[task-id].md`
    **Depends on:** [deps or "(none)"]
    **Produces manifest:** `.cospowers/tasks/[task-id]/manifest.json`

    [Repeat ### Module N for all tasks]
    ```

    ### `dag.json` structure

    Write `dag.json` using this structure:

    ```json
    {
      "project": "<project>",
      "plan_file": ".cospowers/plans/YY-MM-DD-<project>/index.md",
      "tasks": [
        {
          "id": "foundation",
          "task_file": ".cospowers/plans/YY-MM-DD-<project>/tasks/foundation.md",
          "depends_on": [],
          "produces": [".cospowers/tasks/foundation/manifest.json"]
        }
      ]
    }
    ```

    ### Task card structure

    Each `tasks/<task-id>.md` must use this structure:

    ```markdown
    # Task: <task-id>

    ## Source
    [design document section paths]

    ## Depends on
    [task ids, or none]

    ## Input Artifacts
    - [upstream task manifest path, or none]

    ## Task Spec
    [what this task builds]

    ## Interface Contract
    [stable downstream-facing contract]

    ## Deliverables
    [required code/test/runtime deliverables]

    ## Acceptance Criteria
    - Scenario 1 (normal): [description]
    - Scenario 2 (exception): [description]
    - Scenario 3 (boundary): [description]

    ## Required Output Artifacts
    - `.cospowers/tasks/<task-id>/manifest.json`
    - `.cospowers/tasks/<task-id>/results.md`
    - `.cospowers/tasks/<task-id>/contract.json`
    - `.cospowers/tasks/<task-id>/changed-files.txt`
    - `.cospowers/tasks/<task-id>/test-results.md`
    ```

    ## Phase 9: Report Status

    Return to parent agent in this exact format (status only — files have already been written):

    ---
    ## Task Extraction Status

    Status: DONE | FAILED
    Plan index: `.cospowers/plans/YY-MM-DD-[project]/index.md`
    DAG: `.cospowers/plans/YY-MM-DD-[project]/dag.json`
    Task cards: `.cospowers/plans/YY-MM-DD-[project]/tasks/`
    Design directory: `[design_dir]`
    Quality self-check: PASS | FAIL
    Blocking reason: [one sentence or null]

    ## Self-Check Results

    | Check | Status |
    |---|---|
    | Placeholder | PASS / FAIL — [details] |
    | AC completeness | PASS / FAIL — [details] |
    | Task structure | PASS / FAIL — [details] |
    | DAG parallelism | PASS / FAIL — [details] |
    | Contract completeness | PASS / FAIL — [details] |
    | Artifact contract | PASS / FAIL — [details] |
    ---
```
