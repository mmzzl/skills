---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

**Skill 标识**: `executing-plans`

其他 skill 通过 `executing-plans` 引用本 skill。

## Overview

Load plan, review critically, execute all tasks, report when complete.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

**Note on execution mode:** This skill is the fallback execution path. Prefer artifact-driven subagent orchestration whenever the Agent tool and plan artifacts are available:
- **Subagent mode** (`subagent-driven-development` or `executing-plans-brief`): Main Agent only orchestrates DAG ready sets, passes artifact paths, and dispatches isolated Sub Agents for implementation, review, verification, and fixes. **Default for plans with DAG/task-card artifacts, 4+ tasks, or independent tasks.**
- **Inline mode** (this skill directly): Fallback only for small plans (≤ 3 tasks), platforms without subagent support, or emergency cases where artifact-driven orchestration cannot run.

If running in subagent mode, the steps below apply only as the quality-gate framework — task execution itself remains inside Sub Agents, and handoff must use artifact paths instead of pasted task bodies.

## Team Coding Standards

- **Git commits**: All commits must follow `spec-commit` (AI tags, protected branch checks, structured messages)
- **Knowledge Hub**: Before solving technical problems encountered during execution, search the team knowledge Hub via `daedalus-knowledge`
- **No `git add -A`**: Stage files individually, exclude `agent-rules/` directory
- **Separate concerns**: Different purposes go in separate commits

- Code + tests must be generated together (follow `test-driven-development`)
- Tests must cover normal, boundary, and exception scenarios

Coding standards (E-rules, language conventions, security, logging) and format tools are enforced by `code-compliance-check` (Step 6). DFX constraints and test quality are checked by `code-reviewer` (Step 5). Do NOT duplicate these checks inline.

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with the user before starting
4. If no concerns: Create TodoWrite and proceed
5. **Discover and map Domain Skills:**
   - Read the plan header's `Domain Skills` block (written by writing-plans)
   - Cross-check against current session's loaded skills (system-reminder):
     - Skill listed in plan but not currently loaded → warn user, fall back to default
     - New relevant skill loaded now but absent from plan → add to execution mapping
   - Build a mental execution map: for each task category (test writing, code impl, debugging), know which skill to invoke
   - If plan has no `Domain Skills` block (older plan): scan session skills now and build the map from scratch using the same four categories (单测编写 / 测试方法 / 排障调试 / 代码编写)

## ⏱️ Time-Stats Logging (MANDATORY)

executing-plans 启动后必须在两个关键时间点追加写入 `time-stats.log`：

### T_EXEC_START: After loading plan, before first task

```bash
echo "T_EXEC_START: $(date '+%Y-%m-%d %H:%M:%S')" >> docs/agent-rules/spec_developer/output/time-stats.log
```

### T_FIRST_COMPLETE: After all tasks complete, before COMPLETE handoff

```bash
echo "T_FIRST_COMPLETE: $(date '+%Y-%m-%d %H:%M:%S')" >> docs/agent-rules/spec_developer/output/time-stats.log
```

> ⚠️ 此文件由 planner 创建（写入 T_TASK_START），executor 追加写入，最终由 committer 读取用于生成 `[TIME-STATS]` 块。三个角色通过此文件传递时间数据，**不可跳过任何打点**。

### Step 2: Execute Tasks

**Before first task:** Record T_EXEC_START (see Time-Stats Logging above).

For each task:
1. Mark as in_progress
2. Read the task's code conventions from the plan header (Conventions section written by writing-plans)
3. For each implementation step, follow TDD cycle strictly:
   - **RED**: Write the failing test first (invoke `test-driven-development`)
   - **Run**: Verify the test fails for the expected reason (not a typo or import error)
   - **GREEN**: Write the minimal code to make the test pass
   - **Run**: Verify the test passes AND all other tests still pass
   - **REFACTOR**: Clean up if needed, keep tests green
4. **invoke `verification-before-completion`** — run tests (C1: new test file + C2: linked modules), show evidence
5. **Spec compliance review** — verify implementation matches task requirements:
   - Read the task's full requirements from `tasks.md`
   - Compare actual implementation against requirements line by line
   - Check for: missing requirements, extra/unneeded work, misunderstandings
   - Reference `./skills/subagent-driven-development/agents/spec-reviewer-prompt.md` for review methodology
   - **Gate**: PASS → proceed to step 6. FAIL → fix → re-verify (max 3 rounds)
6. **Dispatch code-reviewer subagent** using `requesting-code-review` skill — independent review of per-task changes:
   - Scope: `git diff HEAD~1..HEAD` (this task's commit)
   - Checks: code structure, test quality, scenario coverage, fault tolerance, DFX constraints
   - **Gate**: PASS → proceed to step 7. FAIL → fix → re-dispatch (max 3 rounds)
7. Run `code-compliance-check` skill (KB semantic check → lint auto-fix). Violations block commit. On pass, writes `compliance-cache.json` so `spec-commit` Step 0 can skip re-checking already-verified documents.
8. Commit following `spec-commit` (AI tag, structured message, no `git add -A`)
9. Mark as completed

After 3 FAIL rounds on any gate: `AskUserQuestion` for human intervention.

### Step 3: Complete Execution

After all tasks complete:
1. Record T_FIRST_COMPLETE time-stat (see Time-Stats Logging above)
2. **Dispatch final code-reviewer subagent** using `./skills/subagent-driven-development/agents/final-code-reviewer-prompt.md` — cross-task review of the entire implementation (scope: `git diff <plan-start-commit>..HEAD`)
3. **Run full test suite**: `pytest tests/ -v` (Python) or `go test ./... -v` (Go); API tests if applicable
4. **Knowledge archival** -- Scan the entire execution for reusable knowledge and present candidates to user:

   ```
   📦 知识归档候选项（执行完成）

   扫描到以下内容值得归档：
   1. [技术方案] xxx 问题通过 yyy 解决（非显而易见，预期方案 zzz 不可行）
   2. [约束] xxx 场景下不可使用 yyy（原因：zzz）
   3. [Workaround] xxx 库版本问题，通过 yyy 规避

   请选择要归档的序号（如 1 2 3），或输入"跳过"不归档。
   ```

   若未发现值得归档的内容，仍需告知用户：

   ```
   📦 知识归档候选项（执行完成）

   本次执行按计划推进，未发现非预期的技术方案、约束或 Workaround。

   如有需要补充归档的内容，请现在告知；否则输入"继续"进入收尾阶段。
   ```

   用户确认后，对选中条目调用 `daedalus-knowledge` 执行归档。

5. **REQUIRED SUB-SKILL:** Use finishing-a-development-branch
6. E2E Verification

**E2E is the final verification gate.** It runs ONCE, after all subtasks, with the full requirement scope.

#### Toggle Check

Read `ENABLE_TDD_LOOP` from `<plugin-root>/cospowers.config.json` under the `env` section (default: `false`).

- **If `ENABLE_TDD_LOOP` is `true`** → Execute the E2E verification flow below.
- **If `ENABLE_TDD_LOOP` is `false`** or absent → Skip Step 6 entirely. Announce: "ENABLE_TDD_LOOP is false, skipping E2E verification."

#### E2E Execution (when enabled)

**Invoke `tdd-loop`** to run the E2E test and fix all failed testcases(compile → deploy → E2E verify → fix → loop).

```
"Execute the CI/CD pipeline via tdd-loop for the implementation in this worktree. 
Compile the code, deploy artifacts, run E2E tests via auto-test, 
fix B类 failures via auto-fix, loop until all E2E pass or max rounds reached."
```

**When `tdd-loop` reports success (status: passed)**, proceed to next Phase.

**If `tdd-loop` reports failure (status: failed after max rounds):**
- Present the failure report to the user.
- Ask: "tdd-loop reached max rounds without all E2E tests passing. Remaining failures: {list}. How would you like to proceed? (continue fixing / commit with known failures / abandon)"
- Do NOT proceed to Phase 5 without user decision.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## Integration

**Required workflow skills:**
- **using-git-worktrees** - REQUIRED: Set up isolated workspace before starting
- **writing-plans** - Creates the plan this skill executes
- **verification-before-completion** - REQUIRED: Evidence before claiming task complete
- **requesting-code-review** - Per-task code review via code-reviewer agent
- **finishing-a-development-branch** - Complete development after verification

## Domain Skills (Dynamic Selection)

**Use the skills discovered in Step 1 (Domain Skill map), not a hardcoded list.**

When executing task steps:
- Steps with an inline skill reference (`> **调用 \`[skill-name]\`**`) → **invoke that skill immediately**
- Steps that involve writing tests but have no inline reference → invoke the mapped 测试方法 skill (fallback: `test-driven-development`)
- Steps that involve generating test code → invoke mapped 单测编写 skill (fallback: `test-code-generator`)
- Steps where you hit a blocker, test unexpectedly fails, or behavior is unclear → invoke mapped 排障调试 skill (fallback: `systematic-debugging`)
- Steps that write implementation code → invoke mapped 代码编写 skill for compliance check (fallback: `code-compliance-check`)

**Fallback defaults** (used when no matching skill found in session or plan):

| Category | Fallback Skill |
|---|---|
| 测试方法 | `test-driven-development` (MANDATORY for all features) |
| 单测编写 | `test-code-generator` |
| 排障调试 | `systematic-debugging` |
| 代码编写 | `code-compliance-check` |
