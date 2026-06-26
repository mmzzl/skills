---
name: writing-plans-brief
description: 当你有需求文档或规格说明、需要执行多步骤任务时使用——轻量规划模式，聚焦任务拆分和关键决策，不包含完整代码细节
---

# Writing Plans (Brief)

**Skill 标识**: `writing-plans-brief`

其他 skill 通过 `writing-plans-brief` 引用本 skill。

## 概述

轻量级实施计划编写——聚焦任务拆分、关键架构决策和执行策略。本模式**不**在计划中包含完整代码示例和详细测试用例。计划阶段必须产出执行阶段可读取的文件产物：人类可读总计划、机器可读 DAG、每任务独立 task card。执行阶段只把这些 artifact paths 交给 Sub Agent，不由主 Agent 粘贴任务正文。

## 工作流

你必须为每个主要阶段创建 TodoWrite 任务并依次完成。不可跳过任何阶段。

1. **上游质量关卡** — 验证所有上游评估器已通过（或未确认时主动调度）
2. **编写计划** — 领域技能发现、任务提取、编写计划产物
3. **⛔ 计划后质量关卡** — 调度 task-evaluator，循环直到评分 ≥ B，然后执行交接

## 输入检测与加载

编写计划前，检测设计阶段产出了哪种输入：

1. 总体设计：扫描 `docs/agent-rules/3-overall-design/output/` 下以 `YYYY-MM-DD-` 为前缀的子目录，取最新（降序排列）。
2. 模块设计：扫描 `docs/agent-rules/4-module-design/output/` 下以 `YYYY-MM-DD-` 为前缀的子目录，取最新（降序排列），该目录下的每个子目录均为一个模块。
3. 如果两个目录有任意一个不存在，则提示用户提供设计文档路径，未确认有效路径前不得继续。

## 任务提取（调度 task-extractor 子代理）

创建 task-extractor 子代理执行实际的任务提取工作。使用 `skills/writing-plans-brief/agents/task-extractor.md` 中的调度提示模板。

task-extractor 子代理将在隔离上下文中完成:
1. 读取所有设计文档
2. 发现领域技能
3. 聚类业务能力
4. 提取垂直切片任务
5. 构建 DAG
6. 写入计划产物
7. 返回最小状态报告

## 计划产物契约

task-extractor 必须写入：

```text
.cospowers/plans/YY-MM-DD-<project>/
  index.md              # 人类可读总计划
  dag.json              # 主 Agent 调度输入
  tasks/<task-id>.md    # 每个 Sub Agent 的任务输入
```

### `dag.json`

`dag.json` 是执行阶段唯一的任务调度输入，必须包含每个任务的 id、task card path、依赖和 manifest 输出路径：

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

### Task card

每个 `tasks/<task-id>.md` 必须包含：

```markdown
# Task: <task-id>

## Source
[设计文档章节路径]

## Depends on
[task ids, or none]

## Input Artifacts
- [上游任务 manifest 路径，或 none]

## Task Spec
[本任务构建什么]

## Interface Contract
[本任务对下游稳定暴露的契约]

## Deliverables
[本任务必须生成的文件 / 模块 / 测试 / 产物]

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

## 子代理返回后的验证

task-extractor 返回状态报告后，必须验证:

1. **依赖审计验证** — 确认能力任务之间没有交叉依赖，除非 task card 明确说明不可拆分。
2. **自检结果检查** — 如有 FAIL，发回修复。
3. **计划索引验证** — 确认 `index.md` 已写入预期路径。
4. **DAG 验证** — 确认 `dag.json` 存在，包含所有任务，并且每个任务都有 `id`、`task_file`、`depends_on`、`produces`。
5. **Task card 验证** — 确认 `dag.json` 中所有 `task_file` 都存在。主 Agent 只检查存在性，不读取大段任务正文。
6. 全部 PASS 后，进入计划后质量关卡。

## 无占位符规则

计划产物中不允许出现以下内容:
- "TBD"、"TODO"、"稍后实现"、"补充细节"
- "添加适当的错误处理" / "添加验证" / "处理边界情况"
- "同上类似"（重复描述 — 执行 agent 可能乱序阅读任务）
- 引用未在任何任务中定义的类型、函数或方法

### ⛔ 质量评估 — 调度 task-evaluator

**调度:** `task-evaluator` 作为隔离子代理，通过 `skills/writing-plans-brief/agents/task-evaluator.md` 并传入计划索引路径；如 evaluator 需要任务细节，必须从 `index.md` 中的 DAG / task card paths 自行读取。

**返回:** `task-evaluator` 是被动评估器 — 不负责路由到下一步。返回:
- 等级（A/B/C/D/F）和总分
- 红线状态（R1/R2/R3）
- 质量报告路径

**基于等级决策** 下一步:

| 等级 | 操作 | 返工目标 |
|------|------|---------|
| **A 或 B (≥ 80)** | ✅ 计划就绪。进入 TRANSITION GATE。 | — |
| **C (65–79)** | ❌ 应用报告中所有 Error+Critical 修复。重新调度 `task-evaluator`。**最多 3 轮修复。** 3 轮后仍 < B 则向用户展示剩余问题，请用户协助修复。 | 修复报告中指出的具体任务/验收标准/头部章节。停留在本阶段 — 仅精准修复。 |
| **D (< 65) 或 F** | ❌ 返回编写计划阶段。根据得分最低的维度重新审视任务拆分、验收标准设计或领域技能分析。重写后重新调度。同样最多 3 轮规则。 | **返回编写计划阶段。** 红线违规（F）：修复根因 — 占位符污染 → 重写受影响任务；验收标准缺失 → 补充验收标准；需求覆盖率缺口 → 添加缺失任务。 |

**修复规则:**
- 先通读完整质量报告。仅修复报告中指出的问题 — 不要重写已通过的部分。
- 如果重新评估后分数下降，说明你的变更引入了退化；回退并更精准地修复。
- 每次重新调度后检查返回的等级。

### ⛔ TRANSITION GATE — 确认评估器通过

- **如果等级 ≥ B**: 进入执行交接。
- **如果等级 < B**: 返回质量评估返工循环。
- **如果无法确认**: 不要询问用户。通过 `skills/writing-plans-brief/agents/task-evaluator.md` 重新调度 `task-evaluator`。

### 执行交接（仅 TRANSITION GATE 确认等级 ≥ B 后）

使用 `executing-plans-brief` skill 执行 `.cospowers/plans/YY-MM-DD-<project>/` 中的任务。

- 无需询问用户，直接开始
- 交接参数只包含 plan directory、`index.md`、`dag.json` 和 task cards directory 路径
- 不粘贴任务正文给执行阶段
- 交接前自动压缩上下文

## 记住
- 始终使用精确文件路径
- 每个任务必须有 3+ 验收标准（正常、边界、异常）
- DRY、YAGNI、TDD、频繁提交
- 计划是结构指南和调度产物，不是代码脚本 — 实施细节在执行阶段由 Sub Agent 动态决策
