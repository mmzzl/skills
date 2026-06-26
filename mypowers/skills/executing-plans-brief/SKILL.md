---
name: executing-plans-brief
description: 当你有已写好的实施计划需要在独立会话中执行（含评审检查点）时使用
---

# Executing Plans (Brief)

**Skill 标识**: `executing-plans-brief`

## 概述

加载计划产物，按 DAG ready set 并行派发 Sub Agent 执行任务。主 Agent 只做流程编排；实现、测试、评审、验证和修复全部由隔离 Sub Agent 完成，并通过文件产物流转上下文。

**启动时声明：** "我将使用 executing-plans-brief 技能来执行此计划。"

**执行模式：** 本技能必须使用子 Agent 模式。每个任务、评审、验证、修复都作为隔离 Sub Agent 派发；主 Agent 不直接执行任务级实现逻辑。

## HARD GATE: Orchestrator-only Main Agent

主 Agent 在本 skill 中只负责：读取 DAG、计算 ready set、派发 Sub Agent、读取 manifest 状态、更新 run-state、处理 blocker。

主 Agent 禁止：
- 写代码或测试
- 运行任务级实现命令
- 人工审查代码是否满足任务
- 将上游产物正文复制给下游 Sub Agent
- 把 Sub Agent 的 results.md、test-results.md 或大段 diff 粘贴进主上下文

任何实现、测试、评审、验证、修复都必须由独立 Sub Agent 执行。主 Agent 只传递 artifact path 和最小状态。

## 团队编码规范

- **Git 提交**：所有提交必须遵循 `spec-commit`（AI 标签、受保护分支检查、结构化消息）
- **知识中枢**：执行过程中遇到技术问题前，Sub Agent 先通过 `daedalus-knowledge` 搜索团队知识中枢
- **禁止 `git add -A`**：逐个暂存文件，排除 `agent-rules/` 目录
- **TDD开发范式**：Sub Agent 先写测试（RED），运行验证测试失败，写最小实现（GREEN），重构。计划描述要构建什么 —— 执行者决定如何构建。

## 核心产物契约

### 调度输入

执行阶段优先读取 `.cospowers/plans/YY-MM-DD-<project>/dag.json`：

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

如果旧计划缺少 `dag.json` 或 task cards，主 Agent 不自行解析大段计划正文；必须先派发 normalizer Sub Agent，根据旧计划生成 `dag.json` 与 `tasks/<task-id>.md`，再进入执行。

### 任务 manifest

每个任务 Sub Agent 必须写入 `.cospowers/tasks/<task-id>/manifest.json`。主 Agent 调度只读取该文件：

```json
{
  "task_id": "capability-a",
  "status": "DONE",
  "summary": "Implemented capability-a contract and tests.",
  "artifacts": {
    "results": ".cospowers/tasks/capability-a/results.md",
    "contract": ".cospowers/tasks/capability-a/contract.json",
    "changed_files": ".cospowers/tasks/capability-a/changed-files.txt",
    "test_results": ".cospowers/tasks/capability-a/test-results.md"
  },
  "contract_status": "STABLE",
  "ready_for_downstream": true,
  "blocking_reason": null,
  "next_action": "DISPATCH_REVIEW"
}
```

允许状态与主 Agent 行为：

| 状态 | 主 Agent 行为 |
|---|---|
| `DONE` | 进入评审 / 验证，或标记依赖完成。 |
| `DONE_WITH_CONCERNS` | 不读详细 results；派发 reviewer / verifier 读取产物判断是否阻断。 |
| `NEEDS_CONTEXT` | 读取 `blocking_reason`，只补充缺失路径或向用户询问必要信息。 |
| `BLOCKED` | 停止下游派发，按 blocker 升级策略处理。 |
| `FAILED` | 派发修复 Sub Agent 或重试；超过阈值升级用户。 |

### Sub Agent 最小回报格式

Sub Agent 返回给主 Agent 的消息只允许包含：

```markdown
Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | FAILED
Task: <task-id>
Manifest: .cospowers/tasks/<task-id>/manifest.json
Ready for downstream: true | false
Blocking reason: <one sentence or null>
```

禁止在回报中粘贴完整实现说明、完整测试输出、大段 diff、大段需求 / 设计摘录或多文件内容摘要。这些内容必须写入文件产物，由后续 Sub Agent 按路径读取。

## 流程

### 步骤 1：加载调度产物

1. 读取 `.cospowers/plans/YY-MM-DD-<project>/dag.json`。
2. 验证每个 task entry 都包含 `id`、`task_file`、`depends_on`、`produces`。
3. 验证每个 `task_file` 存在；主 Agent 只检查存在性，不阅读任务正文。
4. 初始化或读取 `.cospowers/execution/run-state.json`。
5. 如发现计划产物缺失，派发 normalizer Sub Agent 生成缺失产物。

### 时间统计日志（强制）

executing-plans-brief 启动后必须在两个关键时间点追加写入 `.cospowers/execution/time-stats.log`：

#### T_EXEC_START：加载 DAG 后、第一个 ready set 派发前

```bash
echo "T_EXEC_START: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospowers/execution/time-stats.log
```

#### T_FIRST_COMPLETE：所有任务完成后、COMPLETE 交接前

```bash
echo "T_FIRST_COMPLETE: $(date '+%Y-%m-%d %H:%M:%S')" >> .cospowers/execution/time-stats.log
```

> 此文件由 planner 创建（写入 T_TASK_START），executor 追加写入，最终由 committer 读取用于生成 `[TIME-STATS]` 块。三个角色通过此文件传递时间数据，**不可跳过任何打点**。

### 步骤 2：按 DAG ready set 并行派发任务

**第一个 ready set 前：** 记录 T_EXEC_START（见上方时间统计日志）。

#### DAG 调度

1. **计算 ready set**：未完成任务中，所有 `depends_on` 对应 manifest 均满足 `status == DONE` 且 `ready_for_downstream == true` 的任务。
2. **并行派发**：当多个任务同时满足依赖条件时，主 Agent 必须在同一轮工具调用中派发多个 Agent，而不是等待一个完成后再派发下一个。
3. **串行条件**：依赖未完成、task card 声明 `exclusive: true`、或 deliverables 明确重叠时，不得并行。
4. **契约门槛**：下游任务只能读取上游 manifest / contract paths；如果上游 contract_status 不是 STABLE，先派发 reviewer / fixer 判断是否阻断。
5. **状态更新**：Sub Agent 返回后，主 Agent 读取对应 manifest，更新 `.cospowers/execution/run-state.json`。

#### 子 Agent 派发格式

对每个就绪任务，使用 Agent 工具派发实现 Sub Agent。Prompt 只传路径，不粘贴任务正文：

```markdown
Agent 工具 (general-purpose):
  description: "实现 <task-id>"
  prompt: |
    你是任务执行 Sub Agent。只执行一个任务，不负责流程调度。

    ## Inputs
    - DAG: `.cospowers/plans/YY-MM-DD-<project>/dag.json`
    - Task card: `.cospowers/plans/YY-MM-DD-<project>/tasks/<task-id>.md`
    - Upstream manifests:
      - `.cospowers/tasks/<upstream-id>/manifest.json`
    - Work directory: `<worktree-path>`
    - Code index: `doc/kb/仓库概览.md`

    ## Required Behavior
    1. 自行读取 Task card 和上游 manifests。
    2. 自行探索代码库，理解实现位置。
    3. 按 TDD 完成实现、测试、验证。
    4. 将详细过程写入 `.cospowers/tasks/<task-id>/results.md`。
    5. 将测试输出写入 `.cospowers/tasks/<task-id>/test-results.md`。
    6. 将对下游稳定的接口写入 `.cospowers/tasks/<task-id>/contract.json`。
    7. 将 changed files 写入 `.cospowers/tasks/<task-id>/changed-files.txt`。
    8. 最后写入 `.cospowers/tasks/<task-id>/manifest.json`。
    9. 返回最小状态包，不要粘贴详细实现内容。

    ## Return Format
    Status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED | FAILED
    Task: <task-id>
    Manifest: `.cospowers/tasks/<task-id>/manifest.json`
    Ready for downstream: true | false
    Blocking reason: <one sentence or null>
```

#### 任务状态处理

子 Agent 报告回来后：

1. 读取且只读取 `.cospowers/tasks/<task-id>/manifest.json`。
2. 如果 manifest 缺失，视为 `FAILED`，重派一次实现 Sub Agent；重复缺失则升级用户。
3. `DONE`：派发评审 / 验证 Sub Agent。
4. `DONE_WITH_CONCERNS`：不读 detailed artifacts；派发 reviewer / verifier 读取产物判断是否阻断。
5. `NEEDS_CONTEXT`：只读取 blocking_reason，补充缺失路径或向用户询问必要信息。
6. `BLOCKED`：停止依赖该任务的下游派发，按 blocker 升级策略处理。
7. `FAILED`：派发修复 Sub Agent 或重试；超过 3 次升级用户。

### 步骤 3：任务评审与验证也通过产物读取

任务实现完成后，主 Agent 不阅读 `results.md` 细节，而是派发 reviewer / verifier Sub Agent：

```markdown
Agent 工具 (general-purpose):
  description: "评审 <task-id> 产物"
  prompt: |
    你是任务评审 Sub Agent。读取：
    - Task card: `.cospowers/plans/.../tasks/<task-id>.md`
    - Manifest: `.cospowers/tasks/<task-id>/manifest.json`
    - Results: manifest.artifacts.results
    - Changed files: manifest.artifacts.changed_files
    - Test results: manifest.artifacts.test_results

    独立验证实现是否满足任务规格和验收标准。
    将评审结果写入 `.cospowers/tasks/<task-id>/review-quality.md`。

    只返回：
    Gate: PASS | FAIL
    Report: `.cospowers/tasks/<task-id>/review-quality.md`
    Blocking reason: <one sentence or null>
```

评审 / 验证 FAIL 时，主 Agent 派发修复 Sub Agent，输入仍然只包含 task card、manifest、review report path 和 verification report path。

### 步骤 4：任务汇总与检视

所有任务 manifest 为 `DONE`、所有 per-task review / verification gate 为 PASS 后：

1. 记录 T_FIRST_COMPLETE 时间统计（见上方时间统计日志）。
2. 派发 final review Sub Agent，输入为 `dag.json`、所有 task manifest paths、`run-state.json`；输出 `.cospowers/execution/final-review.md`。
3. 派发 final verification Sub Agent，输入为 `dag.json`、所有 task manifest paths、final review report；输出 `.cospowers/execution/final-verification.md`。

### 步骤 5：E2E Verification

**E2E is the final verification gate.** It runs ONCE, after all subtasks, with the full requirement scope.

#### Toggle Check

Read `ENABLE_TDD_LOOP` from `<plugin-root>/cospowers.config.json` under the `env` section (default: `false`).

- **If `ENABLE_TDD_LOOP` is `true`** → Execute the E2E verification flow below.
- **If `ENABLE_TDD_LOOP` is `false`** or absent → Skip Step 5 entirely. Announce: "ENABLE_TDD_LOOP is false, skipping E2E verification." Proceed to Step 6.

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

### 步骤 6：完成执行

1. 执行 `spec-commit` 技能完成代码提交（AI tag, structured message, no `git add -A`）。
2. 执行 `finishing-a-development-branch` 技能。

## 何时停止并寻求帮助

遇到以下情况立即停止下游派发并寻求澄清：
- 计划产物缺失且 normalizer Sub Agent 无法生成
- manifest 缺失或损坏超过重试阈值
- 任务返回 `NEEDS_CONTEXT` 且 blocking_reason 需要用户决策
- 任务返回 `BLOCKED` 且 blocker 无法由修复 Sub Agent 解决
- 反复验证失败超过 3 轮

寻求澄清时只提供 blocker、相关 artifact path 和需要用户决策的问题，不粘贴详细实现内容。

## 集成

**必需的工作流技能：**
- **using-git-worktrees** - 必需：开始前设置隔离工作空间
- **writing-plans-brief** - 创建本技能执行的 `index.md`、`dag.json`、task cards
- **verification-before-completion** - Sub Agent 验证声称完成前提供证据
- **test-driven-development** - TDD 红-绿-重构循环（执行者负责）
- **code-compliance-check** - 编码规范检查 + lint 自动修复
- **requesting-code-review** - 评审 Sub Agent 的评审模板来源
- **finishing-a-development-branch** - 验证后完成开发
