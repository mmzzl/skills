---
name: task-evaluator
description: 评估 writing-plans-brief 生成的实现计划质量
---

## 概述

评估 `writing-plans-brief` 生成的实现计划，采用逐项检查扫描、加权评分和问题报告。

## 设计文件

- 总体设计：`docs/agent-rules/3-overall-design/output/YYYY-MM-DD-*/index.md`，重点关注 API接口设计、架构设计、DFX设计
- 模块设计：`docs/agent-rules/4-module-design/output/YYYY-MM-DD-*/`，每个子目录表示一个模块，重点关注每个模块的数据模型和业务流程设计

## 处理过程

逐个读取调度提示中提供的路径（`[PLAN_PATH]`）处的计划文件。识别其结构：
- 头部块（Goal, Architecture, Tech Stack）
- 任务 DAG（Mermaid 图）
- 任务块（每个包含：Source, Depends on, Depended by, Task spec, Interface contract, Deliverables, Acceptance criteria）

每个检查项独立扫描。

## 评估维度

### 维度 1: 结构完整性（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| PLAN-STR-01 | 头部完整性：Goal、Architecture、Tech Stack 均已列出，非空且非通用 | Error |
| PLAN-STR-02 | DAG 图已呈现：Mermaid 图存在，所有任务均出现在图中，依赖箭头有方向 | Error |
| PLAN-STR-03 | 每个任务有 Source 注解：引用设计文档章节 | Warning |
| PLAN-STR-04 | 每个任务有 Depends on / Depended by 声明（如无依赖则写"None"） | Error |
| PLAN-STR-05 | 每个任务有具体的 Deliverables 描述 | Error |
| PLAN-STR-06 | 每个任务有 Interface contract 部分，包含具体的类型/函数签名 | Error |
| PLAN-STR-07 | Domain Skills 表：4个类别均存在，缺失类别显式标注"None — use default approach" | Warning |

### 维度 2: 上游信息忠实度（权重 20%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| PLAN-TRC-01 | REQ 全覆盖：系统需求 ch03 中的每个 REQ-XXX 至少映射到一个任务 | Critical |
| PLAN-TRC-02 | API 全覆盖：OpenAPI 规格中每个端点至少映射到一个任务 | Critical |
| PLAN-TRC-03 | DFX 实现：每个 DFX 维度有对应任务，或显式标注"本次迭代不涉及" | Error |
| PLAN-TRC-04 | 异常处理覆盖率：概要设计 ch05 中的每个异常场景至少映射到一个任务的验收标准 | Error |
| PLAN-TRC-05 | 数据模型覆盖率：概要设计 4.4.1 中的每个数据库表至少映射到一个任务 | Error |
| PLAN-TRC-06 | 设计决策保留：关键设计决策反映在计划 Architecture 部分或相关任务描述中 | Error |

### 维度 3: 任务质量（权重 35%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| PLAN-TSK-01 | 无占位符：不得出现 TBD / TODO / "implement later" / "fill in details" | Critical |
| PLAN-TSK-02 | 无模糊描述：验收标准必须声明哪些场景、什么结果 | Error |
| PLAN-TSK-03 | 交付物具体明确：每个任务列出可识别的交付物 | Error |
| PLAN-TSK-04 | 接口契约具体：类型名称、方法签名、带类型的字段列表 | Error |
| PLAN-TSK-05 | 验收标准数量：每个任务有 3+ 个验收标准场景 | Error |
| PLAN-TSK-06 | 验收标准场景覆盖：覆盖正常 + 边界 + 异常类型 | Error |
| PLAN-TSK-07 | DAG 一致性：每个 Depends on 在 Mermaid DAG 中有对应箭头，反之亦然 | Error |
| PLAN-TSK-08 | 无循环依赖：DAG 是无环的 | Critical |

### 维度 4: 跨模块一致性（权重 25%）

| ID | 检查项 | 严重程度 |
|---|---|---|
| PLAN-CNS-01 | 接口契约类型一致性：同一概念跨任务引用时类型名保持一致 | Error |
| PLAN-CNS-02 | DAG 排序：任务按依赖顺序排列 | Warning |
| PLAN-CNS-03 | 交付物边界：无交付物重复出现在多个任务中（声明共享契约的除外） | Error |
| PLAN-CNS-04 | 集成任务：包含覆盖跨服务调用链的端到端集成验证模块 | Warning |

## 红线检查（一票否决 -> F）

| 红线 | 检查内容 |
|---|---|
| R1 REQ 覆盖率 | 任一 REQ-XXX 在计划中零对应任务 |
| R2 占位符 | 发现任何 TBD / TODO / "implement later" / "fill in details" |
| R3 验收标准 | 任一任务缺少验收标准部分，或该部分为空 |

## 评分权重

| 维度 | 权重 |
|---|---|
| 上游信息忠实度 | 20% |
| 任务质量 | 35% |
| 跨模块一致性 | 25% |
| 结构合规性 | 20% |

### 扣分规则

| 严重程度 | 每问题扣分 |
|---|---|
| Critical | -40 分 |
| Error | -20 分 |
| Warning | -8 分 |

每维度从 100 分起，最低 0 分。

### 总分计算

总分 = 上游忠实度×20% + 任务质量×35% + 一致性×25% + 结构×20%

| 总分 | 等级 | 含义 |
|---|---|---|
| 95-100 | A | 优秀 — 可进入执行交接 |
| 80-94 | B | 良好 — 可进入执行交接 |
| 65-79 | C | 勉强 — 必须修复所有 Error + Critical 后重新评估 |
| <65 | D | 不合格 — 需大幅返工 |
| 红线违规 | F | 直接失败 |

## 输出格式

返回以下信息给调用方：

- 等级（A/B/C/D/F）和总分
- 红线状态（R1/R2/R3）
- 质量报告路径

质量报告保存至 `.cospowers/plans/YYYY-MM-DD-plan-quality-report.md`。

```markdown
# 实现计划质量评估报告

**计划:** [计划文件路径]
**日期:** YYYY-MM-DD
**等级:** [A/B/C/D/F] - [分数]/100

---

## I. 红线结果

| 红线 | 状态 | 详情 |
|---|---|---|
| R1 REQ 覆盖率 |   /   | [详情] |
| R2 占位符 |   /   | [详情] |
| R3 验收标准 |   /   | [详情] |

---

## II. 评分概览

| 维度 | 权重 | 得分 | 扣分项 |
|---|---|---|---|
| 上游信息忠实度 | 20% | [N]/100 | [ISSUE-XXX(-N), ...] |
| 任务质量 | 35% | [N]/100 | [...] |
| 跨模块一致性 | 25% | [N]/100 | [...] |
| 结构合规性 | 20% | [N]/100 | [...] |
| **加权总分** | 100% | **[N]** | |

---

## III. 问题列表

### Critical
[ISSUE-XXX] 文档/位置/规则/引用/描述/修复方向

### Error
[...]

### Warning
[...]

---

## IV. 改进建议

1. **[最高]** 修复 Critical 问题
2. **[高]** 修复 Error 问题
3. **[中]** 修复 Warning 问题
4. **[覆盖率]** 为未覆盖的 REQ/API/DFX 补充任务

---

## V. 下一步

- A/B (>= 80): 进入执行交接
- C (65-79): 修复 Error+ 问题，重新评估（最多 2 轮）
- D (< 65) 或 F: 大幅返工后重新评估
- 2 轮修复后仍 < B: 向用户展示遗留问题，请求人工介入
```
