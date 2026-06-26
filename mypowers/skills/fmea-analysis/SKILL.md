---
name: fmea-analysis
description: Use this skill when generating, reviewing, or improving FMEA/sFMEA/DFMEA analyses, including failure mode discovery, S/O/D scoring, AP priority lookup, improvement measure generation, and pre-test review.
---

# FMEA 分析

**Skill 标识**: `fmea-analysis`

其他 skill 通过 `fmea-analysis` 引用本 skill。

## 角色定位

本 skill 是一个**被调用型 tool skill**（类比 `design-master-perspective`），非独立入口。由 `module-design-spec` 在撰写 Ch.5 §5.2.5 FMEA 表时调用，由 `module-design-evaluator` 在 §0.3 FMEA 检查时引用规则文件。

本 skill 将原 Excel《FMEA分析表模板》中的表头字段、S/O/D 评价准则、AP 措施优先级矩阵和审核要求转换为 AI 可读取、可检索、可执行的规则。

## 什么时候使用

当用户提出以下任务时，必须使用本 skill：

- 生成 FMEA、sFMEA、DFMEA 分析表。
- 根据功能点/需求/设计文档识别失效模式、失效影响、失效原因。
- 评估严重程度 S、发生概率 O、检测度 D。
- 根据 S/O/D 推导 AP 措施优先级。
- 审核 FMEA 表是否完整、评分是否合理、改进措施是否充分。
- 从 FMEA 生成开发自检项、测试用例点、可靠性基线建议。

## 必读规则文件

按顺序读取：

1. `rules/fmea_fields.md`：字段定义与填写规则。
2. `rules/s_scoring.md`：严重程度 S 评分规则。
3. `rules/o_scoring.md`：发生概率 O 评分规则。
4. `rules/d_scoring.md`：检测度 D 评分规则。
5. `rules/ap_priority.md`：AP 范围规则与处理要求（含完整 S/O/D→AP 查表）。
6. `templates/review_checklist.md`：输出前自检。

## 工作流程

### 1. 识别功能和要求

先把输入内容拆成独立功能点/业务。每个功能点至少要明确：

- 功能要求。
- 成功判定。
- 客户业务影响边界。
- 已有检测、告警、隔离、恢复机制。

### 2. 生成失效分析

对每个功能点识别：

- 失效模式：系统层面不希望出现的现象。
- 失效影响：对上一层业务或最终客户业务的影响。
- 失效原因：直接原因/故障模式；一个原因一行。

### 3. 评估 S/O/D

评分必须引用规则：

- S：看客户业务影响程度，越严重分数越高。
- O：看失效原因发生概率，越容易发生分数越高。
- D：看现有机制能否发现原因，越难检测分数越高。

不要只给分数，要给一句评分理由。

### 4. 计算 AP

AP 不允许主观填写。必须使用 `rules/ap_priority.md` 中的 S/O/D 范围表查表得出。

### 5. 生成改进措施

- AP=H：需要（Shall）确定改进措施。
- AP=M：应当（Should）确定改进措施。
- AP=L：可以（Could）确定改进措施。
- S=9~10 且 AP=H/M：提示建议管理层评审。

改进措施优先级：

1. 消除失效原因。
2. 若无法消除，增加检测定位与上报。
3. 增加故障隔离、恢复、降级、重试、人工修复路径。
4. 补充开发自检和测试用例覆盖。

## 输出格式

将生成的 FMEA 分析表填入模块概要设计文档 Ch.5 §5.2.5 的 17 列表格中（格式见 `templates/design/module-design/ch05-DFX特性设计.md`）。

输出后必须按 `templates/review_checklist.md` 逐项自检并附结论。

## 重要约束

- 不要把 Excel 正文 sheet 的示例行当成规则。
- AP 以 `ap_priority.md` 的 S/O/D 范围表为准，逐行查表。
- 不要用 RPN 分数替代 AP。
- 不要把"失效模式"和"失效原因"混写。
- 不要只写技术故障，要写客户业务影响。
