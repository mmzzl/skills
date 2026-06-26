---
name: doc-quality-evaluator
description: Use when comparing system requirements ↔ technical requirements/overall design ↔ module overview designs for solution/number consistency — checks REQ traceability, technical solution alignment, API contracts, DFX number consistency, and module boundary alignment. Called after individual document evaluations by sysreq-evaluator/overall-design-evaluator/module-design-evaluator are complete.
---

# Doc Quality Evaluator

**Skill 标识**: `doc-quality-evaluator`

其他 skill 通过 `doc-quality-evaluator` 引用本 skill。

## Overview

This skill performs cross-document consistency checking across the core design artifacts: system requirements, technical requirements design / overall design, OpenAPI, and module overview designs. It is called after individual document evaluations by `sysreq-evaluator`, `overall-design-evaluator`, and `module-design-evaluator` are complete. It checks whether the documents describe the same solutions, use the same numbers, and respect defined module boundaries. It does not re-evaluate individual document quality — that is the responsibility of each dedicated evaluator.

## 强约束

1. **接收调用方传入的文档路径，不自动发现文档。** 所有文档路径必须由调用方显式传入，本 skill 不执行任何 Glob 搜索或自动发现逻辑。
2. **只检查跨文档不一致问题，不重复检查单文档规范合规性。** 单文档的格式、章节完整性、规范条款已由各 evaluator 处理；本 skill 仅关注三份文档之间的方案/数字/边界一致性。

## Phase 1: 接收文档路径

### 传入参数格式

调用方必须传入以下路径参数：

```
系统需求文档目录:   docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-<project>/
总体设计文档目录:   docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/
OpenAPI 规格路径:   docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/<project>-openapi.yaml
模块概要设计目录列表:
  - docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module1>/
  - docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module2>/
  - ...（可有多个）
```

### 缺少某类文档时跳过的检查

| 缺少的文档 | 跳过的检查 |
|---|---|
| 系统需求文档目录 | §2.1 REQ 追踪、§2.2C DFX 指标一致性 |
| 总体设计文档目录 | §2.1 REQ 追踪、§2.2A 技术方案一致性、§2.2D 模块边界一致性 |
| OpenAPI 规格 | §2.2B API 契约一致性 |
| 所有模块概要设计目录 | §2.2A 技术方案一致性、§2.2B API 契约一致性、§2.2C DFX 指标一致性、§2.2D 模块边界一致性 |

缺少某类文档时，在对应检查项处输出：`⏭️ 跳过（[文档类型]未提供）`

## Phase 2: 跨文档一致性核查

### 2.1 需求 → 设计 追踪（REQ Traceability）

**前提**：已有系统需求文档目录 + 总体设计文档目录

逐条扫描系统需求文档中的每个 REQ-XXX：

```
📍 追踪 REQ-[XXX]: [需求名称]
  ├─ 需求描述: [需求文档中的描述摘要]
  ├─ 总体设计 index.md §1.4 追踪表: ✅ 有记录 / ❌ 缺失
  ├─ 对应设计元素: [章节 § X.X 或 "未找到对应设计"]
  ├─ 方案一致性: ✅ 一致 / ❌ 不一致 / ⚠️ 部分覆盖
  └─ [不一致时] 问题: 需求说 "[...]"，设计做了 "[...]"
```

### 2.2 总体设计 → 模块概要设计 一致性

**前提**：已有总体设计文档目录 + 模块概要设计目录

检查以下关键一致性项（逐条输出）：

**A. 技术方案选型一致性**

技术需求设计、总体设计 §2/§5 中选定的方案（技术栈、架构模式、数据库、中间件等）必须在对应模块概要设计中得到体现：

```
📍 方案一致性检查: [方案名称/技术选型]
  ├─ 总体设计/TRD选型: "[technical-requirements-design 或 总体设计§2/§5中的选型结论]"
  ├─ 模块概要设计体现: "[模块 Ch.2/Ch.4/Ch.5 中对应的描述]" / "未找到对应描述"
  ├─ 一致性: ✅ 一致 / ❌ 矛盾 / ⚠️ 模块用了不同方案但未说明原因
  └─ [矛盾时] 具体差异: [...]
```

**B. API 契约一致性**

OpenAPI 规范中定义的每个接口，在模块概要设计 Ch.3 中引用必须一致（方法、路径、参数）：

```
📍 接口契约检查: [HTTP方法] [路径]
  ├─ OpenAPI 规范定义: [method path, 关键参数]
  ├─ 模块概要设计引用: "[Ch.3 中的引用内容]"
  ├─ 一致性: ✅ 一致 / ❌ 不一致
  └─ [不一致时] 差异: [...]
```

**C. DFX 指标一致性**

系统需求 Ch.4（非功能性需求（DFX））的所有量化指标，必须与总体设计 Ch.6、模块概要设计 Ch.5 数字一致；若模块级目标有差异，必须明确说明继承来源或偏差理由：

```
📍 DFX指标检查: [指标名称]
  ├─ 系统需求 §4 值: [value + 单位]
  ├─ 总体设计 Ch.6 值: [value + 单位] / "未找到"
  ├─ 模块概要设计 Ch.5 值: [value + 单位] / "未找到"
  ├─ 一致性: ✅ 三份一致 / ❌ 不一致
  └─ [不一致时] 具体数字差异: [...]
```

**D. 模块边界一致性**

总体设计 §5.2/§5.4 中定义的模块列表和边界，在模块概要设计 Ch.2 中必须匹配：

```
📍 模块边界检查: [模块名称]
  ├─ 总体设计中的职责定义: "[...]"
  ├─ 模块概要设计 Ch.2 中的职责描述: "[...]"
  ├─ 一致性: ✅ 一致 / ❌ 职责描述有矛盾 / ⚠️ 模块概要设计扩大/缩小了职责范围
  └─ [不一致时] 差异: [...]
```

### 2.3 跨文档一致性统计

```
📊 跨文档一致性核查完成
  - REQ 追踪: [N]条需求，[n]条一致，[m]条缺失/不一致
  - 技术方案: [N]项选型，[n]项一致，[m]项矛盾
  - API契约: [N]个接口，[n]个一致，[m]个不一致
  - DFX指标: [N]项，[n]项一致，[m]项数值不一致
  - 模块边界: [N]个，[n]个一致，[m]个有矛盾
  - 发现不一致问题: [ISSUE-XXX 至 ISSUE-YYY]
```

## Phase 3: 一致性报告

输出跨文档一致性检查统计（不做加权维度打分）：

```
📋 一致性检查结果

  REQ 追踪覆盖率:    [N]/[N]（已覆盖/总需求数）
  技术方案一致性:    ✅ 全部一致 / ❌ [m] 项矛盾
  API 契约一致性:    ✅ 全部一致 / ❌ [m] 个不一致
  DFX 指标一致性:    ✅ 全部一致 / ❌ [m] 项数值不一致
  模块边界一致性:    ✅ 全部一致 / ❌ [m] 个有矛盾

结论: ✅ 一致性通过 / ❌ 发现不一致问题（[ISSUE-XXX, ISSUE-YYY, ...]）
```

## 与其他 Skills 的集成

`doc-quality-evaluator` 由 `module-design-spec` 在所有模块概要设计完成、且 `sysreq-evaluator`、`overall-design-evaluator`、`module-design-evaluator` 各自评估完毕后调用。

评估完成后，将以下内容返回给调用方 skill：

- 一致性结论：pass / fail
- 不一致问题列表：每项包含（位置、差异描述、修改建议）

**不触发任何下一步**；由调用方（`module-design-spec`）根据一致性结论决定后续流程：
- pass：继续后续步骤
- fail：修复不一致问题后重新调用本 skill，直到一致性通过
