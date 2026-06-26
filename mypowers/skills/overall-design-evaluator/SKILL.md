---
name: overall-design-evaluator
description: Use when evaluating overall design directories (index.md + ch02~ch11) and OpenAPI specs (*-openapi.yaml) — loads design review rules, item-by-item scanning, red line checks, weighted scoring, and quality report. Cross-document consistency is handled by doc-quality-evaluator separately.
---

# Overall Design Evaluator

**Skill 标识**: `overall-design-evaluator`

其他 skill 通过 `overall-design-evaluator` 引用本 skill。

## Extension Points

Before starting, read `cospowers.config.json` from the plugin root (2 levels above this skill's base directory — the directory shown in "Base directory for this skill" at skill load time). No fallback needed — the config always has valid defaults.

| Config field | Used for |
|---|---|
| `config.rules["design-review"]` | Design review rules directory (default: `rules/design-review/`) |
| `config.rules["dfx"]` | DFX rules directory (default: `rules/dfx/`) |
| `config.templates["overall-design"]` | Overall design template path (default: `templates/overall-design-template.md`) |

## Overview

Evaluate overall design directories (`index.md` + `ch02`~`ch11`) and OpenAPI specs (`*-openapi.yaml`) produced by the agent-rules-plugin workflow using **item-by-item rule scanning** (one rule clause at a time, with real-time output), **weighted scoring**, and a **detailed issue report** that pinpoints exactly what is wrong, where, and why.

This skill focuses exclusively on single-document quality for overall design and OpenAPI artifacts. **Cross-document consistency** (system requirements ↔ technical requirements design ↔ overall design ↔ module overview design) is **not handled here** — it is the responsibility of `doc-quality-evaluator`.

**Supported document types:**

| Document | Produced By | File Pattern | Design Subtype |
|---|---|---|---|
| 总体设计文档 | `overall-design-spec` | `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/index.md` + chapter files | 总体设计 |
| OpenAPI 接口规范 | `overall-design-spec` | `*-openapi.yaml` | -- |

**Design type identification（文档子类型识别，仅总体设计目录中的 `index.md`/章节文件）：**

当评估总体设计文档时，按以下三级策略识别其设计子类型：

| 优先级 | 策略 | 方法 |
|---|---|---|
| 1 | 文件名匹配 | `*总体设计*`/`*overall*design*`/`*architecture*design*` → 总体设计； `*概要设计*`/`*HLD*`/`*high*level*design*`/`*summary*design*` → 概要设计； `*技术需求设计*`/`*technical*requirement*design*` → 技术需求设计 |
| 2 | 内容关键词 | 在前200行搜索：概要设计说明书/HLD → 概要设计；总体设计说明书/软件总体架构 → 总体设计；技术需求设计 → 技术需求设计 |
| 3 | 结构特征 | 含"函数定义"章节 → 概要设计；含"软件总体架构""模块结构图""系统流程"章节 → 总体设计；含"架构需求分析""方案选型"章节 → 技术需求设计 |

> 三级都无法识别时：提示用户确认文档类型（当前仅支持总体设计/概要设计/技术需求设计）。

**M1-M6 审查模块映射：**

识别出设计子类型后，确定对应的审查模块（每个模块对应 `rules/design-review/` 下的 checklist 文件）：

| 设计子类型 | 审查模块 |
|---|---|
| **总体设计** | M1(`design-01-doc-writing-standards-checklist.md`) + M2(`design-02-tech-requirements-design-checklist.md`) + M3(`design-03-overall-design-checklist.md`) + M5(`design-05-i18n-design-checklist.md`) + M6(`design-06-never-again-principles-checklist.md`) |
| **概要设计** | M1 + M4(`design-04-high-level-design-checklist.md`) + M5 + M6 |
| **技术需求设计** | M1 + M2 + M5 + M6 |

> M1（文档书写规范）、M5（国际化i18n设计）、M6（不贰过设计准则）为所有子类型**必选模块**。各模块的 checklist 文件路径为 `rules/design-review/<filename>`。

**模块定义：**

| 模块 | 全称 | 检查内容 |
|---|---|---|
| M1 | 文档书写规范 | 格式、术语、图表、编号、引用等文档级规范 |
| M2 | 技术需求设计 | 需求来源追溯、需求与设计映射、技术选型依据 |
| M3 | 总体设计 | 架构方案、模块划分、技术栈选择、系统流程 |
| M4 | 概要设计 | 函数定义、接口设计、数据结构、模块内部流程 |
| M5 | 国际化i18n设计 | 多语言支持、时区处理、字符编码、本地化策略 |
| M6 | 不贰过设计准则 | 历史故障经验、已知陷阱规避、团队教训应用 |

**3-Stage review workflow（与 Phase 1 并行可选）：**

除逐条扫描外，可采用以下模块化审查流程（适用于复杂文档、多人并行审查场景）：

- **Stage 1 — 识别类型**：确定设计子类型（总体设计/概要设计/技术需求设计）
- **Stage 2 — 确定模块**：根据子类型确定审查模块列表（M1-M6）
- **Stage 3 — 并行审查**：为每个模块启动子代理，按模块 checklist 逐项审查；所有子代理返回后汇总结果

> 日常评估仍以 Phase 0→1→3→4 主线为主；3-Stage 流程作为复杂场景下的补充选项。

**Evaluation order (never skip or reorder):**

```
Phase 0: 加载 → Phase 1: 逐条规范扫描 → Phase 3: 打分 → Phase 4: 生成报告
```

> Phase 2（跨文档一致性核查）由 `doc-quality-evaluator` 承担，本 skill 跳过。

## ⚠️ 五大强约束（必须100%严格遵守）

**违反任何一条强约束都是严重错误！**

### 1. 逐条扫描约束：每条规则必须独立检查 ⭐⭐⭐
- ✅ **必须**：对每条规则/检查项，先输出"📍 检查规则 [ID]: [规则内容]"，再执行检查，再输出结论
- ❌ **禁止**：批量跳过多条规则，或只输出"整体符合规范"而不逐条检查
- ✅ **必须**：有问题时，记录文档章节、引用原文、违反的具体规则条款
- ❌ **禁止**：报告模糊描述如"设计不够详细"而不指向具体位置

### 2. 打分约束：分数必须有依据 ⭐⭐⭐
- ✅ **必须**：每个维度的得分附有扣分明细（哪条规则扣了几分）
- ❌ **禁止**：直接给出分数而不说明扣分原因
- ✅ **必须**：红线违反时，总评直接为 F（不论其他维度分数）

### 3. 只报告真实问题：通过的规则不写入报告 ⭐⭐⭐
- ✅ **必须**：只报告真正违反规范或存在不一致的问题
- ❌ **禁止**：写入"符合规范，请保持"等无问题内容
- ✅ **必须**：每个问题都有：位置 + 引用原文 + 违反规则 + 严重级别 + 修改建议

### 4. 一问题一类问题约束：发现一个错误就扫描全文同类 ⭐⭐⭐
- ✅ **必须**：发现某类问题（如"DFX数字缺失"）后，立刻扫描全文所有同类实例
- ❌ **禁止**：只记录第一个发现的问题，漏掉同一文档中的其他同类问题

### 5. 范围约束：只评估本 skill 负责的文档类型 ⭐⭐⭐
- ✅ **必须**：只处理总体设计目录（`index.md` + `ch02`~`ch11`）和 `*-openapi.yaml`
- ❌ **禁止**：评估系统需求文档或模块概要设计文档（这些由其他 evaluator skill 负责）

## Phase 0: 加载阶段

### 0.1 自动发现文档（Document Discovery）

**不等待用户提供路径。** 按以下顺序自动搜索，找到候选文档后展示确认信息。

#### 搜索策略（按优先级依次执行）

**Step A — 搜索标准输出目录**

使用 Glob 在以下路径搜索：
```
docs/agent-rules/3-overall-design/output/**/*.md    → 总体设计文档（含章节文件）
docs/agent-rules/3-overall-design/output/**/*.yaml  → OpenAPI 规范
```

**Step B — 搜索用户指定的上下文路径**

如果用户在对话中提到了某个目录或文件名，也在该路径下执行上述 Glob 搜索。

**Step C — 向上递归搜索（兜底）**

如果 Step A/B 均未找到任何文档，从当前工作目录向上最多 3 层执行搜索：
```
./**/index.md
./**/*-openapi.yaml
```

#### 发现结果处理

搜索完成后，根据发现的文档数量决定评估范围：

---

##### 🟢 单文档路径（发现 1 份文档）

**直接开始评估，不询问用户。** 立即输出声明并进入 Phase 1：

```
📄 发现 1 份文档，开始单文档评估：
  🏗️ 总体设计文档: docs/agent-rules/3-overall-design/output/2026-04-10-xxx/index.md
  （或对应文档类型）

📂 评估模式: 单文档
开始评估...
```

---

##### 🔵 多文档路径（发现 2 份文档，即同时存在总体设计和 OpenAPI）

两份文档可一起评估（分别独立扫描，共享评分报告）。展示发现结果后直接开始，不等待确认：

```
🔍 文档发现结果:

🏗️ 总体设计文档 (N 个):
  [1] docs/agent-rules/3-overall-design/output/2026-04-10-xxx/index.md  (修改时间: YYYY-MM-DD)

📡 OpenAPI 规范 (N 个):
  [2] docs/agent-rules/3-overall-design/output/2026-04-10-xxx/xxx-openapi.yaml      (修改时间: YYYY-MM-DD)

📂 评估模式: 双文档（总体设计 + OpenAPI）
开始评估...
```

如果同类型有多个文档目录（如多个总体设计输出目录），按修改时间降序排列并等待用户确认选择哪个。

---

#### 其他处理规则

| 情况 | 处理方式 |
|---|---|
| 同类型有多个文档 | 按修改时间降序排列，建议选最新，等待用户确认 |
| 某类型文档未找到 | 在发现结果中注明"未找到"，继续评估已找到的文档 |
| 所有路径均未找到 | 提示"未找到任何文档，请提供文件路径或目录"，等待用户输入 |
| 用户对话中已直接提供路径 | 跳过 Glob 搜索；直接使用提供的路径 |

### 0.2 加载评审规范

根据输入文档类型，**读取**以下规范文件（必须实际读取，不可跳过）：

```
总体设计文档评估 → 读取 (路径前缀 = config.rules["design-review"]，默认 rules/design-review/):
  <design-review-dir>/design-01-doc-writing-standards-checklist.md   ← M1
  <design-review-dir>/design-02-tech-requirements-design-checklist.md ← M2
  <design-review-dir>/design-03-overall-design-checklist.md           ← M3
  <design-review-dir>/design-05-i18n-design-checklist.md              ← M5
  <design-review-dir>/design-06-never-again-principles-checklist.md   ← M6
  <design-review-dir>/模块设计规范.md
  <dfx-dir>/安全.md      (路径前缀 = config.rules["dfx"]，默认 rules/dfx/)
  <dfx-dir>/性能.md

OpenAPI规范评估 → 读取:
  rules/design-methods/RESTful_API格式规范v3.0.md
  rules/business/01-OPENAPI开发规范.md
  rules/business/API开发规范.md
  rules/business/错误码规范.md
```

读取完成后，从规范文件中**提取所有检查项**，构建检查清单（每条规范条款 = 一个检查项，带编号如 SYS-01、API-01）。

输出：
```
✅ 规范加载完成
📋 检查清单共 [N] 项:
  - 文档写作规范: [n1] 项        （仅总体设计文档）
  - 总体设计规范: [n2] 项        （仅总体设计文档）
  - 模块设计规范: [n3] 项        （仅总体设计文档）
  - 不贰过准则: [n4] 项          （仅总体设计文档）
  - DFX规范: [n5] 项             （仅总体设计文档）
  - API规范: [n6] 项             （仅OpenAPI规范）
```

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

每份文档扫描完成后输出：

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

- **总体设计文档**（对照 `templates/overall-design-template.md`，主入口 + 10 个章节文件）：
  §1 介绍 / §2 系统总体架构 / §3 硬件方案 / §4 系统工作原理 /
  §5 模块设计说明 / §6 系统DFX特性设计 / §7 对软件总体架构的影响 /
  §8 方案风险分析 / §9 部署视图 / §10 总结 / §11 变更控制与修订记录

记录：缺失了哪些章节（具体章节号和名称）

**红线 R2 — 可靠性章节**
- 必须存在且有实质内容（不能只写"不涉及"或"参见平台"）
- 记录：可靠性章节内容是否覆盖：故障容错分析 / 资源使用分析 / 业务流程可靠性

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

> OpenAPI 规范不做 R1/R2/R3 红线检查（章节结构不适用）。

### 1.5 内置检查项（SYS- 系列，来源：技术需求设计评审标准 V2.0）

以下检查项在完成规范文件扫描后**必须逐条执行**，与从规范文件提取的检查项享有同等地位：

| 编号 | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| SYS-ARCH-01 | 架构差距定量化 — 若设计涉及性能演进，必须用具体数字说明"当前指标 vs 目标指标"的差距；"需要提升"式定性说法不可接受 | §2/§7 | Warning |
| SYS-PERFTEST-01 | 性能测试计划完整性 — 性能测试点必须明确包含：测试场景、数据量规模、持续时间、通过判定标准；缺少任一要素不完整 | §6 | Error |
| SYS-CAPACITY-01 | 系统容量边界定义 — DFX 设计必须明确定义系统容量边界：最大并发数、最大数据量、消息队列堆积上限及超限行为（降级/拒绝/排队） | §6 | Error |
| SYS-CONSISTENCY-01 | 分布式一致性策略 — 若涉及跨模块/跨服务数据操作，§4 或 §5 中必须明确说明一致性模式（强一致/最终一致）及其约束边界和时间窗口 | §4/§5 | Error |
| SYS-DR-01 | 灾难恢复计划细节 — 可靠性设计必须包含：RTO/RPO 指标、详细恢复步骤、数据一致性验证方法、故障演练频率；仅写"有 DR 方案"不可接受 | §6 | Error |
| SYS-UPGRADE-01 | 版本升级兼容性 — 若涉及版本升级，部署部分必须说明：数据迁移策略、API 版本兼容性策略、灰度升级方案 | §9 | Warning |
| SYS-CRITICALPAT-01 | 关键路径性能目标 — §4 中主要业务流程必须为关键路径定义具体响应时间目标（如：提交操作 ≤ 200ms）；无数字不可接受 | §4 | Error |
| SYS-RESILIENCE-01 | 限流熔断策略 — 高并发系统 DFX 设计必须明确说明：限流阈值、熔断判定条件、对应降级策略、配置管理方式 | §6 | Error |
| SYS-INTEGRATION-01 | 跨域集成安全设计 — 若涉及与外部系统集成，§2/§5/§6 必须明确说明：数据边界、权限隔离机制、加密传输方案 | §2/§5/§6 | Error |
| SYS-DEBUGGABILITY-01 | 可调试性设计 — 若系统含跨3个以上服务的业务链路、异步消息流程或多步骤状态机，§6 可调试性设计必须有独立验证方案（dry-run/mock模式）、增量验证方案（contract test/smoke test）、TraceID全链路透传说明；缺任一为 Error | §6 | Error |
| SYS-MONITORING-01 | 可监控性设计 — §6 中可运维性部分必须包含具体的业务监控指标定义（指标名称+采集方式+告警阈值），不得只写"接入平台监控"或"参见运维规范"；无具体指标定义视为不完整 | §6 | Error |
| SYS-COVERAGE-01 | 需求覆盖完整性 — §1.5（技术需求设计）引用或总结的所有系统功能模块和场景，在 §4（系统工作原理）、§5（模块设计说明）和 §6（系统DFX特性设计）中均有对应设计说明，无遗漏模块；各模块设计章节中包含边界值/临界条件说明（如最大并发数、数据量上限、超时阈值、输入限制等），不得只描述正常路径 | §1.5/§4/§5/§6 | Error |

> 以上 12 条内置检查项仅适用于总体设计目录，OpenAPI 规范不适用。

## Phase 2: 跨文档一致性核查（跳过）

> 本 skill 不执行跨文档一致性核查。跨文档一致性（系统需求 ↔ 技术需求设计 ↔ 总体设计 ↔ 模块概要设计的方案一致性、DFX 数字一致性、REQ 追踪覆盖率）由 `doc-quality-evaluator` 承担。

## Phase 3: 打分

### 3.1 评分维度与权重

| 维度 | 权重 | 说明 |
|---|---|---|
| **技术可行性** | 30% | 组件真实可用，逻辑无漏洞，性能无明显瓶颈，方案有依据 — 权重最高因为方案本身的可行性是最核心的质量指标 |
| **需求完整性** | 25% | 所有关键场景被覆盖，DFX 要求有实质内容，无空章节或"不涉及"敷衍 |
| **可测试性** | 20% | 每个功能流程覆盖正常路径、异常路径、边界条件三类场景；可注入依赖，有测试接口，支持隔离测试 |
| **规范符合性** | 15% | 文档格式、命名、章节完整性等符合团队规范 |
| **架构合理性** | 10% | 设计模式与现有架构一致，依赖合理，无循环依赖，边界清晰 |

### 3.2 每维度扣分规则

每个维度满分 100 分，按问题严重级别扣分：

| 问题级别 | 说明 | 每个问题扣分 |
|---|---|---|
| **Critical** | 红线违反、方案根本性缺陷、安全漏洞 | -40 分 |
| **Error** | 逻辑错误、空章节、数字无依据、接口设计缺陷 | -20 分 |
| **Warning** | 命名不规范、建议性问题、数字无来源 | -8 分 |

每个维度最低 0 分（不出现负数）。

**严格扣分示意：**
- 1 个 Critical → 维度直接跌至 60 分以下（D 区）
- 2 个 Error → 维度跌至 60 分（勉强及格线）
- 3 个 Warning → 维度扣 24 分

### 3.3 总分计算

```
总分 = 技术可行性×0.30 + 需求完整性×0.25 + 可测试性×0.20
       + 规范符合性×0.15 + 架构合理性×0.10
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
│ 技术可行性          │ 30%  │ [N]/100  │ ISSUE-003(-20), ...    │
│ 需求完整性          │ 25%  │ [N]/100  │ ISSUE-007(-20), ...    │
│ 可测试性            │ 20%  │ [N]/100  │ ISSUE-012(-8), ...     │
│ 规范符合性          │ 15%  │ [N]/100  │ ISSUE-015(-8), ...     │
│ 架构合理性          │ 10%  │ [N]/100  │ -                      │
├─────────────────────┼──────┼──────────┼────────────────────────┤
│ **加权总分**        │ 100% │ **[N]**  │                        │
└─────────────────────┴──────┴──────────┴────────────────────────┘

红线状态: R1 ✅ / R2 ✅ / R3 ❌ 违反

总评: [A/B/C/D/F] — [结论描述]
```

## Phase 4: 生成评估报告

将全部结果整理为结构化 Markdown 报告，保存到与被评估文档同目录的 `quality-reports/` 子目录（如不存在则创建）。文件名：`YYYY-MM-DD-<文档名>-quality-report.md`。

### 报告结构

```markdown
# 总体设计文档质量评估报告

**评估对象**: [文档名列表]
**评估日期**: YYYY-MM-DD
**评估模式**: 单文档 / 双文档（总体设计 + OpenAPI）
**设计子类型**: [仅总体设计文档] 总体设计 / 概要设计 / 技术需求设计
**审查模块**: [M1+M2+M3+M5+M6]（根据子类型确定）
**总评**: [A/B/C/D/F] — [N分] / 100

---

## 零、总体结论

（用 3-5 句话概括：文档类型、整体质量评价、主要问题方向、是否建议通过审查）

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

**模块级汇总**（仅总体设计文档）：

| 审查模块 | 总项数 | 通过 | 不通过 | 不适用 | 通过率 |
|---|---|---|---|---|---|
| M1 文档书写规范 | - | - | - | - | -% |
| [其他适用模块] | - | - | - | - | -% |
| **合计** | - | - | - | - | -% |

---

## 三、问题清单（按严重级别排序）

### 🚨 Critical 级问题（必须修复才能继续）

[ISSUE-XXX 详情，格式：文档/章节/规则/原文/描述/建议]

### ❌ Error 级问题（建议修复后继续）

[...]

### ⚠️ Warning 级问题（可酌情处理）

[...]

---

## 四、每份文档单独评分

| 文档 | 规范扫描 | 文档得分 |
|---|---|---|
| 总体设计文档 | [N]/100 | [N]/100 |
| OpenAPI规范 | [N]/100 | [N]/100 |

---

## 五、改进建议（优先级排序）

1. **[最高优先级]** [修复 Critical 问题的具体步骤]
2. **[高优先级]** [修复 Error 问题的具体步骤]
3. **[中优先级]** [修复 Warning 问题的建议]

---

## 六、最终判断与下一步

### 最终判断

- **是否建议通过**：[通过 / 有条件通过 / 不通过]
- **建议后续步骤**：[如：修改后重新审查 / 补充 XX 内容后进入模块概要设计]

### 下一步

- 总评 A/B → 可调用 `writing-plans` 进入实施规划
- 总评 C → 修复所有 Error 及以上问题后，重新运行 `overall-design-evaluator`
- 总评 D → 需要较大修改，建议回到 `overall-design-spec` 修订总体设计
- 总评 F → 红线违反，必须大幅返工，重新生成设计文档
```

## 常见问题类型参考

评估中最常见的问题模式，供识别时参考（不是代替逐条扫描）：

| 问题类型 | 典型表现 | 严重级别 |
|---|---|---|
| 空DFX章节 | 安全章节只写了"参见平台安全机制" | Error |
| 未验证假设 | 设计假设"用户已登录"但无说明前置条件 | Error |
| N+1查询 | 列表接口在循环中逐条查询DB | Error |
| 缺Mermaid图 | 必填章节只有文字描述无图 | Error |
| 数字无来源 | 性能目标"TPS > 10000"无ADR或历史数据支撑 | Warning |
| API契约不完整 | OpenAPI 接口缺少错误码定义或响应 schema | Error |
| 命名不一致 | 字段在不同章节里分别叫 `userId`、`user_id`、`uid` | Warning |
| 可靠性方案模糊 | 可靠性章节只写"采用高可用方案"无具体机制 | Error |
| 缺少边界值 | 设计章节只描述正常路径，无并发上限/数据量上限/超时阈值/输入限制等边界条件 | Error |

## 与其他 Skills 的集成

`overall-design-evaluator` 是一个**被动评估器**，不主动路由下一步。

- 由 `overall-design-spec` **步骤 13**（技术需求设计、总体设计和 OpenAPI 规范完成后）以隔离子代理方式派遣
- 评估完成后，将以下内容返回给**调用方 skill**：
  - 评级（A/B/C/D/F）和总分
  - 红线状态（R1/R2/R3）
  - Critical + Error 问题表格（位置、问题描述、修改建议）
  - 质量报告保存路径
- **不触发任何下一步**；由调用方（`overall-design-spec`）根据评级决定：
  - A/B（≥ 80）：调用方继续其自身的下一步（由调用方 skill 的 Checklist 决定，与本 skill 无关）
  - C/D/F：调用方修复问题后重新派遣本 skill，直到评级达到 B 或以上
- 评估报告路径：`docs/agent-rules/3-overall-design/output/YYYY-MM-DD-xxx/quality-reports/YYYY-MM-DD-xxx-quality-report.md`
