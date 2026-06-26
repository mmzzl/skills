---
name: module-design-evaluator
description: Use when evaluating module overview design directories produced by module-design-spec — loads checklist rules with module-level adaptations, item-by-item scanning, red line checks, weighted scoring, and quality report. Cross-document consistency is handled by doc-quality-evaluator separately.
---

# Module Design Evaluator

**Skill 标识**: `module-design-evaluator`

其他 skill 通过 `module-design-evaluator` 引用本 skill。

## Extension Points

Before starting, read `cospowers.config.json` from the plugin root (2 levels above this skill's base directory — the directory shown in "Base directory for this skill" at skill load time). No fallback needed — the config always has valid defaults.

| Config field | Used for |
|---|---|
| `config.rules["design-review"]` | Design review rules directory (default: `rules/design-review/`) |
| `config.rules["dfx"]` | DFX rules directory (default: `rules/dfx/`) |
| `config.templates["module-design"]` | Module overview design template path |

## Overview

Evaluate module overview design directories produced by `module-design-spec` using **item-by-item rule scanning** (one rule clause at a time, with real-time output), **weighted scoring**, and a **detailed issue report** that pinpoints exactly what is wrong, where, and why.

This skill focuses exclusively on a single module overview design directory (`index.md` + `ch*.md`). **Cross-document consistency** (system requirements ↔ overall design ↔ module overview design) is handled by `doc-quality-evaluator` separately and is not performed here.

**Evaluation order (never skip or reorder):**

```
Phase 0: 加载 → Phase 1: 逐条规范扫描 → Phase 3: 打分 → Phase 4: 生成报告
```

> Phase 2 (跨文档一致性核查) is handled by `doc-quality-evaluator` — skipped in this skill.

## ⚠️ 五大强约束（必须100%严格遵守）

**违反任何一条强约束都是严重错误！**

### 1. 逐条扫描约束：每条规则必须独立检查 ⭐⭐⭐
- ✅ **必须**：对每条规则/检查项，先输出"📍 检查规则 [ID]: [规则内容]"，再执行检查，再输出结论
- ❌ **禁止**：批量跳过多条规则，或只输出"整体符合规范"而不逐条检查
- ✅ **必须**：有问题时，记录文档章节、引用原文、违反的具体规则条款
- ❌ **禁止**：报告模糊描述如"设计不够详细"而不指向具体位置

### 2. 单对象评估约束：本 skill 不做跨文档一致性核查 ⭐⭐⭐
- ✅ **必须**：仅评估当前模块概要设计目录本身的质量
- ❌ **禁止**：在本 skill 内执行跨文档追踪（REQ追踪、方案漂移检查、DFX数字对比）
- ✅ **说明**：跨文档一致性由 `doc-quality-evaluator` 在全套评估时承担

### 3. 打分约束：分数必须有依据 ⭐⭐⭐
- ✅ **必须**：每个维度的得分附有扣分明细（哪条规则扣了几分）
- ❌ **禁止**：直接给出分数而不说明扣分原因
- ✅ **必须**：红线违反时，总评直接为 F（不论其他维度分数）

### 4. 只报告真实问题：通过的规则不写入报告 ⭐⭐⭐
- ✅ **必须**：只报告真正违反规范或存在问题的项
- ❌ **禁止**：写入"符合规范，请保持"等无问题内容
- ✅ **必须**：每个问题都有：位置 + 引用原文 + 违反规则 + 严重级别 + 修改建议

### 5. 一问题一类问题约束：发现一个错误就扫描全文同类 ⭐⭐⭐
- ✅ **必须**：发现某类问题（如"DFX章节空内容"）后，立刻扫描全文所有同类实例
- ❌ **禁止**：只记录第一个发现的问题，漏掉同一文档中的其他同类问题

## Phase 0: 加载阶段

### 0.1 自动发现文档（Document Discovery）

**不等待用户提供路径。** 搜索模块概要设计目录：目录中必须包含 `index.md`，并包含 `ch02-模块职责和边界.md` 至 `ch09-附录.md` 的章节文件。找到候选目录后展示给用户确认。

#### 搜索策略（按优先级依次执行）

**Step A — 搜索标准输出目录**

使用 Glob 在以下路径搜索 `index.md`，并将其父目录作为候选模块设计目录：
```
docs/agent-rules/4-module-design/output/**/index.md
```

**Step B — 搜索用户指定的上下文路径**

如果用户在对话中提到了某个目录或文件名：
- 若是目录：检查该目录下是否存在 `index.md` 与 `ch*.md`
- 若是章节文件：使用其父目录作为候选模块设计目录

**Step C — 向上递归搜索（兜底）**

如果 Step A/B 均未找到任何文档，从当前工作目录向上最多 3 层执行搜索：
```
./**/index.md
```

#### 发现结果处理：单目录 vs 多目录分支

搜索完成后，根据发现的模块设计目录数量决定走哪条路径：

---

##### 🟢 单目录路径（发现模块设计目录 = 1 个）

**直接开始评估，不询问用户。** 立即输出声明并进入 Phase 1：

```
📄 发现 1 个模块设计目录，开始评估：
  🔧 模块设计目录: docs/agent-rules/4-module-design/output/2026-04-10-xxx/<module>/
  📄 章节文件: index.md, ch02-..., ch03-..., ch04-..., ch05-..., ch06-..., ch07-..., ch08-..., ch09-...

📂 评估模式: 单目录（模块概要设计）
⚠️ 说明: 本 skill 不执行跨文档一致性核查（由 doc-quality-evaluator 承担）

开始评估...
```

直接读取该目录下 `index.md` 与 `ch*.md`，按章节顺序拼接为评估语料，进入 Phase 1 逐条规范扫描。

---

##### 🔵 多目录路径（发现模块设计目录 ≥ 2 个）

展示所有发现的模块设计目录，并等待用户选择要评估哪个：

```
🔍 发现多个模块设计目录:

🔧 模块设计目录 (N 个):
  [1] docs/agent-rules/4-module-design/output/2026-04-10-xxx/auth/      (修改时间: YYYY-MM-DD)
  [2] docs/agent-rules/4-module-design/output/2026-04-10-xxx/api/       (修改时间: YYYY-MM-DD)
  [3] docs/agent-rules/4-module-design/output/2026-04-10-xxx/storage/   (修改时间: YYYY-MM-DD)

请选择要评估的模块设计目录（回复编号，如"1"或"2"）：
  A) 选择其中一个（本 skill 每次评估单个模块设计目录）
  B) 手动提供路径
```

**⚠️ 多目录情况下必须等待用户选择后才能进入 Phase 1。**

用户选择后输出：

```
✅ 评估目标已确认

📄 待评估目录: [path]
📂 评估模式: 单目录（模块概要设计）

开始评估...
```

---

#### 其他处理规则

| 情况 | 处理方式 |
|---|---|
| 未找到任何模块设计目录 | 提示"未找到模块设计目录（需包含 index.md 与 ch*.md），请提供目录路径" |
| 用户对话中已直接提供路径 | 跳过 Glob 搜索；若为目录则使用该目录，若为章节文件则使用其父目录；若为总体设计目录或 `*-overall-design.md` 则拒绝并提示使用 `doc-quality-evaluator` |

### 0.2 加载评审规范

**读取**以下规范文件（必须实际读取，不可跳过），并构建检查清单：

```
<design-review-dir>/design-04-high-level-design-checklist.md ← M4 概要设计规范
  ※ 模块概要设计裁剪适配（以下 5 项特殊处理）：
     - 项 1.2（对手分析）：模块方案选型已单独处理；正文只核对 Ch.2.4 是否引用方案结论
     - 项 4.2（可调试性）：对应 Ch.5 §5.4 可调试性设计
     - 项 4.6（业务长时间中断处理）：对应 Ch.4 §4.6 异常场景处理与 Ch.3 §3.5.3 依赖接口异常处理策略
     - 项 6.2（启动和退出流程）：模块级不单独设计启动退出，跳过
     - 项 9.1/9.2（数据规范）：转化为"接口规范遵从"（对应 Ch.3 对外接口）

<design-review-dir>/模块设计规范.md
<design-review-dir>/design-01-doc-writing-standards-checklist.md ← M1 文档书写规范
<design-review-dir>/design-05-i18n-design-checklist.md           ← M5 国际化i18n设计
<design-review-dir>/design-06-never-again-principles-checklist.md ← M6 不贰过设计准则
<dfx-dir>/安全.md

skills/fmea-analysis/rules/fmea_fields.md        ← FMEA 字段定义与填写规则（17 列）
skills/fmea-analysis/rules/s_scoring.md          ← S 严重程度 1-10 评分准则
skills/fmea-analysis/rules/o_scoring.md          ← O 发生概率 1-10 评分准则
skills/fmea-analysis/rules/d_scoring.md          ← D 检测度 1-10 评分准则
skills/fmea-analysis/rules/ap_priority.md        ← AP 范围规则（S/O/D→H/M/L 精确查表）
```

（路径前缀：`<design-review-dir>` = `config.rules["design-review"]`，默认 `rules/design-review/`；`<dfx-dir>` = `config.rules["dfx"]`，默认 `rules/dfx/`）

**M1/M4/M5/M6 模块定义（适用于模块概要设计文档）：**

| 模块 | 全称 | 模块概要设计适用范围 |
|---|---|---|
| M1 | 文档书写规范 | 格式、术语、图表、编号、引用等文档级规范 — 全文档适用 |
| M4 | 概要设计规范 | 函数定义、接口设计、数据结构、模块内部流程 — 对应 Ch.3/Ch.4/Ch.5/Ch.6 |
| M5 | 国际化i18n设计 | 多语言支持、时区处理、字符编码、本地化策略 — 触发条件：子系统涉及用户可见字符串或时间显示 |
| M6 | 不贰过设计准则 | 历史故障经验、已知陷阱规避、团队教训应用 — 全文档适用，特别是 Ch.4 内部设计与 Ch.5 DFX |

读取完成后，从规范文件中**提取所有检查项**，构建检查清单（每条规范条款 = 一个检查项，带编号如 SUB-01、DOC-01、DFX-01）。M1/M4/M5/M6 的检查项计入各自所属的规范文件分组中。

输出：
```
✅ 规范加载完成
📋 检查清单共 [N] 项:
  - 模块概要设计规范 (M4 高级设计checklist): [n1] 项（已应用5项裁剪适配）
  - 模块设计规范: [n2] 项
  - M1 文档书写规范: [n3] 项
  - M4 概要设计规范: [n4] 项
  - M5 国际化i18n设计: [n5] 项
  - M6 不贰过准则: [n6] 项
  - DFX安全规范: [n7] 项
  - FMEA审查: [n8] 项（见 §0.3）
```

### 0.3 FMEA 分析表检查（可靠性章节专项）

在 Phase 1 扫描中，当检查到 Ch.5 §5.2 可靠性设计时，**必须额外执行 FMEA 分析表专项检查**。FMEA 内容位于 §5.2.5 业务流程可靠性（FMEA），通常以 Markdown 表格形式呈现。

#### FMEA 表格标准格式

```
| 功能分析 | | 失效分析 | | | 风险分析 | | | | 技术改进 | | | | 改进落地 | | | |
| 功能点/业务 | 功能要求 | 失效模式 | 失效影响 | 失效原因 | 严重程度(S) | 发生概率(O) | 检测度(D) | AP | 改进措施 | 改进效果 | 责任部门/人 | 完成时间 | 完成状态 | 重要程度 | 开发自检 | 用例ID |
```

#### FMEA 检查项（逐条执行）

**一、功能分析完整性**
- [ ] 功能点是否覆盖完整（无遗漏重要功能）
- [ ] 功能要求是否清晰、可验证
- [ ] 功能点与功能要求的对应关系是否明确

**二、失效分析完整性**
- [ ] 每个功能点是否识别了失效模式
- [ ] 失效模式是否描述清晰（系统层面的不希望现象）
- [ ] 失效影响是否分析到位（对上一层业务的影响）
- [ ] 失效原因是否完整识别（每个失效模式可能有多个原因）
- [ ] 失效原因是否追溯到根因（而非表面现象）

**三、SOD评分准确性**

| 检查项 | 判断标准 | 严重级别 |
|---|---|---|
| S评分值域 | S评分为1-10的整数（来源：`skills/fmea-analysis/rules/s_scoring.md`） | Error |
| S评分合理性 | 对照 `s_scoring.md` 评价准则逐条验证：S=10 全局性业务中断/数据丢失、S=9 大范围业务中断、S=7-8 局部/关键功能中断、S=4-6 非关键功能中断、S=1-3 轻微影响 | Error |
| O评分值域 | O评分为1-10的整数（来源：`skills/fmea-analysis/rules/o_scoring.md`） | Warning |
| O评分合理性 | 对照 `o_scoring.md` 评价准则逐条验证：含频度+历史经验+开发质量+测试质量+自然属性 6 维度 | Warning |
| D评分值域 | D评分为1-10的整数（来源：`skills/fmea-analysis/rules/d_scoring.md`） | Warning |
| D评分合理性 | 对照 `d_scoring.md` 评价准则逐条验证：D=1 几乎肯定能检测、D=7-10 很难检测 | Warning |

**四、AP优先级检查**

| 检查项 | 判断标准 | 严重级别 |
|---|---|---|
| AP来源 | AP必须由 S/O/D 从 `skills/fmea-analysis/rules/ap_priority.md` 的 S/O/D 范围表精确查表得到，禁止主观填写、禁止使用 RPN | Error |
| AP正确性 | 对每个失效原因，逐行用 `ap_priority.md` 范围表验证 AP 标注是否正确；S=9,O=8,D=8→应标 H 但标为 L→Error | Error |
| 高风险评审 | 高风险项（S≥9且AP为H/M）是否有管理层评审计划（来源：`skills/fmea-analysis/rules/ap_priority.md`） | Warning |

**五、改进措施有效性审查**
- [ ] 改进措施是否针对失效原因（而非失效模式本身）
- [ ] 改进措施是否可行（技术实现、资源、时间）
- [ ] 改进效果是否可量化/可验证
- [ ] 责任人是否明确
- [ ] 完成时间是否合理
- [ ] 完成状态是否及时更新

**六、改进落地跟踪审查**
- [ ] 开发自检是否完成
- [ ] 测试用例是否覆盖
- [ ] 用例ID是否正确填写
- [ ] 重要程度是否合理（BVT/Level1加入可靠性基线，Level2/Level3有覆盖但不加入基线）

#### FMEA 检查输出格式

FMEA 检查结果嵌入到 Phase 1 正常扫描流程中，输出格式：

```
📍 检查 FMEA-01: FMEA分析表完整性
  ├─ 检查位置: Ch.5 §5.2.5（可靠性设计 → 业务流程可靠性）
  ├─ 引用原文: "[FMEA表格片段或位置描述]"
  ├─ 规范要求: 可靠性设计的业务流程可靠性部分必须包含FMEA分析表，且表格列完整
  ├─ 检查结果: ✅ 通过 / ❌ 违规 / ⚠️ 警告
  └─ [仅违规时] 问题ID: [ISSUE-XXX] | 级别: [Critical/Error/Warning] | 扣分: [-N分]
```

> 若模块概要设计文档明确不涉及FMEA（如纯内部工具、无业务流程可靠性需求），标记为 ⬜ 不适用并说明原因。

## Phase 1: 逐条规范扫描

对加载的每条检查项，执行以下固定流程：

### 1.1 实时扫描输出格式

对每一条检查项，必须输出：

```
📍 检查 [CHECK-ID]: [规则摘要（来自规范文件的原始描述）]
  ├─ 检查位置: [文档章节 § X.X 或 "全文"]
  ├─ 引用原文: "[被检查内容的直接引用，如果不适用写 N/A]"
  ├─ 规范要求: [该规则的具体要求]
  ├─ 检查结果: ✅ 通过 / ❌ 违规 / ⚠️ 警告
  └─ [仅违规时] 问题ID: [ISSUE-XXX] | 级别: [Critical/Error/Warning] | 扣分: [-N分]
```

### 1.2 违规记录格式

每个发现的问题记录到问题列表：

```
[ISSUE-XXX]
  文档: [文档名]
  位置: § [章节编号] [章节名]
  规则: [CHECK-ID] — [规则描述]
  引用原文: "[实际文档中的原文，精确到句子级]"
  问题描述: [具体说明哪里违反了规则]
  严重级别: Critical / Error / Warning
  修改建议: [具体可操作的修改方向]
  扣分: [-N分] (维度: [维度名])
```

### 1.3 扫描完成统计

文档扫描完成后输出：

```
📊 [文档名] 扫描完成
  - 扫描规则数: [N] 条
  - 通过: [n] 条
  - 违规(Critical): [n] 条
  - 违规(Error): [n] 条
  - 警告(Warning): [n] 条
  - 发现问题: [ISSUE-001 至 ISSUE-XXX]
```

### 1.4 三条设计红线检查（一票否决）

在规范扫描中，以下三条红线**必须优先检查**，任一违反立刻标记红线，继续扫描但最终总评直接为 F：

**红线 R1 — 章节完整性**

按以下模板逐章核对（仅计一、二级章节，三级及以下不计入缺失数）；缺失章节数 ≥ 3 → 红线违反：

- **模块概要设计目录**（对照 `templates/design/module-design/`，`index.md` + 8 个章节文件）：
  `index.md`（§1 介绍与设计任务书）/
  `ch02-模块职责和边界.md`（§2 模块职责和边界）/
  `ch03-对外接口.md`（§3 对外接口）/
  `ch04-内部设计.md`（§4 内部设计）/
  `ch05-DFX特性设计.md`（§5 DFX 特性设计）/
  `ch06-自测用例.md`（§6 自测用例）/
  `ch07-部署与发布.md`（§7 部署与发布）/
  `ch08-总结与变更控制.md`（§8 总结与变更控制）/
  `ch09-附录.md`（§9 附录）

记录：缺失了哪些章节（具体章节号和名称）

**红线 R2 — 可靠性章节**
- 必须存在且有实质内容（不能只写"不涉及"或"参见平台"）
- 记录：可靠性章节内容是否覆盖：故障容错分析 / 资源使用分析 / 业务流程可靠性
- **FMEA 专项**：若业务流程可靠性中包含 FMEA 分析表，额外检查：表格格式完整性、SOD 评分合理性、AP 优先级正确性（详见 §0.3）

**红线 R3 — 安全性章节**
- 必须存在且有实质内容
- 记录：安全章节内容是否覆盖：安全基线 / 威胁建模 / 数据保护

红线检查输出格式：
```
🚨 红线检查结果:
  R1 章节完整性: ✅ 通过 / ❌ 违反 — 缺失章节: [§X, §Y]
  R2 可靠性章节: ✅ 通过 / ❌ 违反 — 原因: [...]
  R3 安全性章节: ✅ 通过 / ❌ 违反 — 原因: [...]
```

### 1.5 内置检查项（SUB- 系列，来源：概要设计评审标准 V2.0.2）

以下检查项为内置补充规范，在 Phase 1 逐条扫描阶段与从规范文件加载的检查项一并执行，编号以 `SUB-` 前缀标识。

| 编号 | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| SUB-INTERFACE-01 | 对外接口完整性 — Ch.3 中每个接口定义必须包含：参数名+类型+取值范围+约束条件+错误处理说明；缺少任一要素视为接口定义不完整 | Ch.3 | Error |
| SUB-EXCEPTION-01 | 异常场景三要素 — Ch.4 §4.6 与 Ch.3 §3.5.3 中每个异常场景必须包含"触发条件+应对机制+对用户的影响"三要素；纯列表式异常列举不可接受 | Ch.4 §4.6 / Ch.3 §3.5.3 | Error |
| SUB-OBSERVABILITY-01 | 日志设计规范性 — Ch.5 §5.5.1 日志设计必须包含：日志级别定义、关键业务事件记录清单、敏感信息脱敏规则、日志保留期限；缺少任一视为不完整 | Ch.5 §5.5.1 | Error |
| SUB-RELIABILITY-01 | 缓存一致性设计 — 若内部设计涉及缓存，Ch.4 必须明确说明：失效策略、更新触发时机、TTL、可能的不一致窗口期；无说明视为设计缺失 | Ch.4 | Error |
| SUB-PERF-01 | N+1 查询检测 — Ch.4 数据访问逻辑必须说明批量查询策略；凡出现"循环查询"或"逐条处理"的描述，需说明性能合理性或改进方案 | Ch.4 | Warning |
| SUB-CONCURRENCY-01 | 并发控制策略 — 涉及并发访问的模块必须在 Ch.4 中明确说明并发控制策略（互斥锁/乐观锁/无锁）及假设的并发度上限；无说明视为并发风险未分析 | Ch.4 | Warning |
| SUB-TESTABILITY-01 | 测试隔离设计 — Ch.5 §5.3 必须说明如何支持单元测试隔离（依赖注入/Mock 接口/测试桩等）；无隔离机制说明视为可测试性不足 | Ch.5 §5.3 | Warning |
| SUB-EXTENSIBILITY-01 | 扩展点规范性 — 若设计预留了扩展点（插件/策略模式等），Ch.5 §5.6 必须明确说明：扩展点接口签名、预期扩展场景、扩展约束；无说明视为扩展设计不完整 | Ch.5 §5.6 | Warning |
| SUB-COVERAGE-01 | 需求覆盖完整性 — index.md §1.5 声明的所有功能职责，在 Ch.3（对外接口）、Ch.4（内部设计）、Ch.6（自测用例）中均有对应设计说明，无遗漏功能点；各设计章节中包含边界值/临界条件说明（如输入参数上下限、最大处理条数、超时阈值、重试次数上限等），不得只描述正常路径 | index.md / Ch.3 / Ch.4 / Ch.6 | Error |

## Phase 2: 跨文档一致性核查

> **本 skill 跳过此阶段。** 跨文档一致性（系统需求 ↔ 总体设计 ↔ 模块概要设计）由 `doc-quality-evaluator` 在全套文档评估时承担。

## Phase 3: 打分

### 3.1 评分维度与权重

| 维度 | 权重 | 说明 |
|---|---|---|
| **技术可行性** | 35% | 组件真实可用，逻辑无漏洞，性能无明显瓶颈，方案设计合理 |
| **可测试性** | 25% | 每个功能流程覆盖正常路径、异常路径、边界条件三类场景；可注入依赖，有测试接口，支持隔离测试 — 场景缺失按 Error 级扣分 |
| **需求完整性** | 20% | 所有设计场景都被覆盖，无遗漏的功能点或异常处理 |
| **规范符合性** | 15% | 文档格式、命名、章节完整性等符合团队规范 |
| **架构合理性** | 5% | 设计模式与现有架构一致，依赖合理，边界清晰 |

### 3.2 每维度扣分规则

每个维度满分 100 分，按问题严重级别扣分：

| 问题级别 | 说明 | 每个问题扣分 |
|---|---|---|
| **Critical** | 红线违反、方案根本性错误、安全漏洞 | -40 分 |
| **Error** | 逻辑错误、空章节、数字无依据、接口定义缺失 | -20 分 |
| **Warning** | 命名不规范、建议性问题、描述不够清晰 | -8 分 |

每个维度最低 0 分（不出现负数）。

**严格扣分示意：**
- 1 个 Critical → 维度直接跌至 60 分以下（D 区）
- 2 个 Error → 维度跌至 60 分（勉强及格线）
- 3 个 Warning → 维度扣 24 分

### 3.3 总分计算

```
总分 = 技术可行性×0.35 + 可测试性×0.25 + 需求完整性×0.20
       + 规范符合性×0.15 + 架构合理性×0.05
```

| 总分 | 等级 | 含义 |
|---|---|---|
| 95-100 | **A** | 优秀，可进入实施规划 |
| 80-94 | **B** | 良好，必须修复所有 Error 级问题后才能进入实施 |
| 65-79 | **C** | 勉强，必须修复所有 Error 及 Critical 问题并重新评估 |
| <65 | **D** | 不及格，需大幅返工后重新评估 |
| 红线违反 | **F** | 直接失败，不论其他分数 |

### 3.4 打分输出格式

```
📊 评分明细:

┌─────────────────────┬──────┬──────────┬────────────────────────┐
│ 评分维度            │ 权重 │ 维度得分 │ 扣分明细               │
├─────────────────────┼──────┼──────────┼────────────────────────┤
│ 技术可行性          │ 35%  │ [N]/100  │ ISSUE-003(-20), ...    │
│ 可测试性            │ 25%  │ [N]/100  │ ISSUE-007(-20), ...    │
│ 需求完整性          │ 20%  │ [N]/100  │ ISSUE-012(-20), ...    │
│ 规范符合性          │ 15%  │ [N]/100  │ ISSUE-015(-8), ...     │
│ 架构合理性          │  5%  │ [N]/100  │ -                      │
├─────────────────────┼──────┼──────────┼────────────────────────┤
│ **加权总分**        │ 100% │ **[N]**  │                        │
└─────────────────────┴──────┴──────────┴────────────────────────┘

红线状态: R1 ✅ / R2 ✅ / R3 ❌ 违反

总评: [A/B/C/D/F] — [结论描述]
```

## Phase 4: 生成评估报告

将全部结果整理为结构化 Markdown 报告，保存到被评估模块设计目录的 `quality-reports/` 子目录（如不存在则创建）。文件名：`YYYY-MM-DD-<模块目录名>-quality-report.md`。

### 报告结构

```markdown
# 模块概要设计文档质量评估报告

**评估对象**: [模块设计目录名]
**评估日期**: YYYY-MM-DD
**评估模式**: 单目录（模块概要设计）
**审查模块**: M1+M4+M5+M6（全部适用）
**总评**: [A/B/C/D/F] — [N分] / 100

---

## 一、红线检查结果

| 红线 | 状态 | 说明 |
|---|---|---|
| R1 章节完整性 | ✅ 通过 / ❌ 违反 | [details] |
| R2 可靠性章节 | ✅ 通过 / ❌ 违反 | [details] |
| R3 安全性章节 | ✅ 通过 / ❌ 违反 | [details] |

> 任一红线违反 → 总评 F，必须大幅返工后重新提交评估

---

## 二、评分总览

[评分表格，同 Phase 3.4 格式]

**模块级汇总**：

| 审查模块 | 总项数 | 通过 | 不通过 | 不适用 | 通过率 |
|---|---|---|---|---|---|
| M1 文档书写规范 | - | - | - | - | -% |
| M4 概要设计规范 | - | - | - | - | -% |
| M5 国际化i18n设计 | - | - | - | - | -% |
| M6 不贰过准则 | - | - | - | - | -% |
| 其他规范 | - | - | - | - | -% |
| **合计** | - | - | - | - | -% |

**FMEA 专项检查结果**（若有）：

| FMEA 维度 | 通过项 | 问题项 | 通过率 |
|---|---|---|---|
| 功能分析完整性 | x | x | xx% |
| 失效分析完整性 | x | x | xx% |
| SOD评分准确性 | x | x | xx% |
| AP优先级正确性 | x | x | xx% |
| 改进措施有效性 | x | x | xx% |
| 改进落地跟踪 | x | x | xx% |

---

## 三、问题清单（按严重级别排序）

### 🚨 Critical 级问题（必须修复才能继续）

[ISSUE-XXX 详情，格式：文档/章节/规则/原文/描述/建议]

### ❌ Error 级问题（建议修复后继续）

[...]

### ⚠️ Warning 级问题（可酌情处理）

[...]

---

## 四、FMEA 问题详情（若有）

### FMEA-1. 功能分析问题

| 序号 | 功能点 | 问题描述 | 建议 |
|---|---|---|---|
| 1 | xxx | xxx | xxx |

### FMEA-2. 失效分析问题

| 序号 | 功能点/失效模式 | 问题描述 | 建议 |
|---|---|---|---|
| 1 | xxx | xxx | xxx |

### FMEA-3. SOD评分问题

| 序号 | 失效原因 | 当前评分 | 问题 | 建议评分 |
|---|---|---|---|---|
| 1 | xxx | S=8 | xxx | S=9 |

### FMEA-4. AP优先级问题

| 序号 | 失效原因 | SOD | 当前AP | 问题 | 建议AP |
|---|---|---|---|---|
| 1 | xxx | S=9,O=6,D=3 | L | xxx | H |

### FMEA-5. 改进措施问题

| 序号 | 失效原因 | 当前措施 | 问题 | 建议措施 |
|---|---|---|---|---|
| 1 | xxx | xxx | xxx | xxx |

### FMEA-6. 改进落地问题

| 序号 | 改进措施 | 问题 | 建议 |
|---|---|---|---|
| 1 | xxx | xxx | xxx |

### FMEA 高风险项汇总

| 序号 | 失效原因 | SOD | AP | 风险说明 |
|---|---|---|---|---|
| 1 | xxx | S=9,O=6,D=3 | H | xxx |

---

## 五、改进建议（优先级排序）

1. **[最高优先级]** [修复 Critical 问题的具体步骤]
2. **[高优先级]** [修复 Error 问题的具体步骤]
3. **[中优先级]** [修复 Warning 问题的建议]
4. **[FMEA专项]** [若FMEA存在高风险项，建议提交管理层评审]

---

## 六、下一步

- 总评 A/B → 可通知 `module-design-spec` 继续下一个模块概要设计或进入 `writing-plans`
- 总评 C → 修复所有 Error 及以上问题后，重新运行 `module-design-evaluator`
- 总评 D → 需要较大修改，建议回到 `module-design-spec` 修订模块概要设计
- 总评 F → 红线违反，必须大幅返工，重新生成模块概要设计文档

> 注：跨文档一致性核查（REQ追踪、方案漂移、DFX数字对比）需运行 `doc-quality-evaluator` 全套评估。
```

## 常见问题类型参考

评估中最常见的问题模式，供识别时参考（不是代替逐条扫描）：

| 问题类型 | 典型表现 | 严重级别 |
|---|---|---|
| 空DFX章节 | 安全章节只写了"参见平台安全机制" | Error |
| 接口定义缺失 | Ch.3（对外接口）无具体方法签名、参数说明 | Error |
| 异常场景空缺 | Ch.4 §4.6 或 Ch.3 §3.5.3 异常场景只列标题未写内容 | Error |
| 内部设计无图 | Ch.4（内部设计）无 Mermaid 序列图或流程图 | Error |
| 测试点不可验证 | Ch.6（自测用例）测试点描述模糊，无可操作的测试步骤 | Error |
| 边界职责模糊 | Ch.2（模块职责和边界）职责未说明明确不包含的排除项 | Error |
| N+1查询 | 内部设计在循环中逐条查询DB | Error |
| 命名不一致 | 字段在同一文档不同章节分别叫 `userId`、`user_id`、`uid` | Warning |
| 数字无来源 | 性能目标"TPS > 10000"无ADR或历史数据支撑 | Warning |
| 缺Mermaid图 | 必填章节只有文字描述无图 | Error |
| 需求覆盖不完整 | index.md §1.5 声明的功能职责在 Ch.3/Ch.4/Ch.6 中无对应设计章节，存在遗漏 | Error |
| 缺少边界值 | 设计章节只描述正常路径，无参数上下限/最大处理条数/超时阈值/重试上限等边界条件 | Error |
| FMEA表格格式不完整 | FMEA分析表缺少必填列（17列，对照 `skills/fmea-analysis/rules/fmea_fields.md`） | Error |
| FMEA-SOD评分异常 | S/O/D评分不在1-10范围，或评分与 `skills/fmea-analysis/rules/s_scoring.md` / `o_scoring.md` / `d_scoring.md` 评价准则不匹配 | Error |
| FMEA-AP未查表 | AP 未从 `skills/fmea-analysis/rules/ap_priority.md` 的范围表查表得到，而是主观填写或使用 RPN | Error |
| FMEA-AP优先级错误 | 从 `ap_priority.md` 范围表查表得到的 AP 与实际标注不一致（如 S=9,O=8,D=8→H，但标为 L） | Error |
| FMEA改进措施无效 | 改进措施针对失效模式而非失效原因，或改进效果无法量化验证（来源：`skills/fmea-analysis/rules/fmea_fields.md` 字段规则） | Warning |
| FMEA无高风险管理 | S≥9且AP为H/M的高风险项无管理层评审计划或跟踪机制（来源：`skills/fmea-analysis/rules/ap_priority.md`） | Warning |

## 与其他 Skills 的集成

`module-design-evaluator` 是一个**被动评估器**，不主动路由下一步。

- 由 `module-design-spec` 步骤 7（**每个模块概要设计完成后**）以隔离子代理方式派遣
- 评估完成后，将以下内容返回给**调用方 skill**：
  - 评级（A/B/C/D/F）和总分
  - 红线状态（R1/R2/R3）
  - Critical + Error 问题表格（位置、问题描述、修改建议）
  - 质量报告保存路径
- **不触发任何下一步**；由调用方（`module-design-spec`）根据评级决定：
  - A/B（≥ 80）：调用方继续其自身的下一步（由调用方 skill 的 Checklist 决定，与本 skill 无关）
  - C/D/F：调用方修复问题后重新派遣本 skill，直到评级达到 B 或以上
- 评估报告路径：`docs/agent-rules/4-module-design/output/YYYY-MM-DD-xxx/<module>/quality-reports/YYYY-MM-DD-xxx-<module>-quality-report.md`
