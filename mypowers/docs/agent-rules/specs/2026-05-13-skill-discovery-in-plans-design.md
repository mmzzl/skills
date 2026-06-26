---
name: skill-discovery-in-plans-design
description: 在 writing-plans 和 executing-plans 中加入 session 已注册 skill 发现机制，编写任务时自动引用相关 skill
phase: design
type: micro-design
status: approved
updated: 2026-05-13
---

# cospowers v0.1.x writing-plans / executing-plans Skill Discovery 微型设计说明书

> **[AI读取引导]** 本文档描述对 `writing-plans` 和 `executing-plans` 两个 skill 的小范围增量改动。改动目的：让计划编写和执行阶段能发现当前 session 已注册的相关 skill，并在任务步骤中显式引用。

---

## 高密度摘要

**改动类型：** ☑ 功能型（现有功能调整）

**改动一句话描述：** 在计划编写和执行阶段扫描 session 已加载的 skill，发现单测编写、测试方法、排障、代码编写类 skill，在计划 header 列出并在任务步骤中显式引用。

**涉及模块/文件：**
- `skills/writing-plans/SKILL.md`
- `skills/executing-plans/SKILL.md`

**全局强约束：**
- 所有章节已填写或注明原因
- 关联分析不省略
- 测试点可执行

---

# 1. 介绍

## 1.1 目的

`writing-plans` 当前的 Codebase Style Analysis 只分析代码风格，不感知 session 中已注册的 skill。`executing-plans` 的 Domain Skills 表格是硬编码的静态列表。

当用户注册了项目专属的单测编写 skill、排障 skill 或代码规范 skill 时，AI 在编写和执行计划时不会自动使用它们，导致 skill 生态的能力无法被计划流程利用。

本文档设计"Skill Discovery"机制，使计划编写和执行阶段能动态发现并引用 session 中相关的 skill。

## 1.2 定义和缩写

| 缩写/术语 | 定义 |
|---|---|
| session 已加载 skill | 当前对话 session 的 system-reminder 中列出的所有可用 skill |
| Domain Skills | 按功能类别归类后、与当前计划相关的 skill 子集 |
| 内联引用 | 在计划 task 步骤中以 "> **调用 `[skill]`**" 形式显式标注要使用的 skill |

## 1.3 参考和引用

1. `skills/writing-plans/SKILL.md` — 当前计划编写 skill
2. `skills/executing-plans/SKILL.md` — 当前计划执行 skill

---

# 2. 模块方案概述

## 2.1 改动背景与目标

**问题描述：** writing-plans 和 executing-plans 对 session 中的可用 skill 是不感知的，导致用户注册的专属 skill（单测、排障等）在计划流程中被忽略。

**改动目标：**

| 目标项 | 描述 |
|---|---|
| 功能目标 | writing-plans 扫描 session skill，将相关 skill 写入计划 header 并在 task 步骤内联引用 |
| 功能目标 | executing-plans 读取计划 header 的 Domain Skills，执行时 invoke 对应 skill |
| 质量目标 | 不破坏现有计划结构和执行流程 |

## 2.2 方案设计

**方案描述：**

1. **writing-plans** — 在 Codebase Style Analysis 之后新增 "Step 5: Domain Skill Discovery" 步骤。AI 扫描当前 session 已加载的 skill 列表，按四类归类（单测编写、测试方法、排障、代码编写），结果写入计划 header 的 `Domain Skills` 区块。编写各 task 步骤时，在需要调用 skill 的步骤处插入内联引用。

2. **executing-plans** — 在 Step 1（Load and Review Plan）新增子步骤 1.5，读取计划 header 的 Domain Skills 区块，与当前 session 可用 skill 交叉比对；将静态 Domain Skills 表格替换为动态 Skill Selection Logic，执行 task 时遇到内联引用直接 invoke。

## 2.3 方案对现有设计的影响概述

- 计划文件 header 新增 `Domain Skills` 区块，与现有 `Conventions` 区块并列，不影响 task 结构
- executing-plans 的 `Skill Selection Logic` 替换静态表格，逻辑更灵活，向后兼容（无 Domain Skills 区块时 fallback 到默认 skill）
- 不涉及接口变更、数据库变更、配置文件变更

---

# 3. 模块详细设计

## 3.1 补丁/移植型修改明细

不涉及（功能型改动）

---

## 3.2 功能型改动设计

### 3.2.1 接口变更

不涉及（skill 文件为提示词文本，无 API 接口）

---

### 3.2.2 内部流程设计

#### writing-plans — Domain Skill Discovery 步骤

在现有 "Codebase Style Analysis（Step 1-4）" 之后、"Scope Check" 之前，插入以下内容：

```
## Domain Skill Discovery（Step 5）

扫描当前 session 已加载的可用 skill（来自 system-reminder），按以下类别归类：

| 类别       | 关注 skill 的特征                         | 用于哪些 task 步骤           |
|------------|------------------------------------------|------------------------------|
| 单测编写   | 生成或编写单元测试代码的 skill             | 编写测试代码步骤              |
| 测试方法   | 定义测试策略、执行 TDD 流程的 skill        | 所有实现 task 的测试阶段      |
| 排障调试   | 故障诊断、错误分析、调试流程的 skill       | 遇到失败或阻塞时              |
| 代码编写   | 编码规范、代码生成、代码质量检查的 skill   | 所有代码实现步骤              |

发现结果写入计划 header 的 **Domain Skills** 区块（位于 Conventions 区块之后）：

**Domain Skills（from session context）：**
- 单测编写：`[skill-name]` — [一句话说明用途]
- 测试方法：`[skill-name]` — [一句话说明用途]
- 排障调试：`[skill-name]` — [一句话说明用途]
- 代码编写：`[skill-name]` — [一句话说明用途]
- （若某类别无匹配 skill，填写"无（使用默认方式）"）

若 session 中同一类别有多个 skill，均列出，并标注推荐优先级（recommended）。

编写各 task 步骤时，在需要调用 skill 的步骤处加内联引用：

> **调用 `[skill-name]`** 执行 [具体操作，如：TDD RED 阶段 / 单测代码生成 / 编码规范检查]
```

计划 header 格式更新：

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** ...（保持原有内容）

**Goal:** ...
**Architecture:** ...
**Tech Stack:** ...

**Conventions（learned from codebase）：**
- Language: ...
- Naming: ...
- ...

**Domain Skills（from session context）：**
- 单测编写：`test-code-generator` — 从测试用例文档生成 go test / pytest 代码
- 测试方法：`test-driven-development` — TDD 红绿循环，强制先写失败测试
- 排障调试：`systematic-debugging` — 证据优先的故障排查流程
- 代码编写：`code-compliance-check` — 编码规范语义检查 + lint 自动修复

---
```

#### executing-plans — Step 1.5 和 Skill Selection Logic 替换

**Step 1 新增子步骤 1.5：**

```
1.5 发现并映射 Domain Skills
   a. 读取计划 header 的 Domain Skills 区块
   b. 与当前 session 已加载 skill 交叉比对：
      - 计划中列出但当前不可用 → 告知用户，fallback 到默认方式
      - 当前有新增相关 skill 未在计划中列出 → 补充进映射
   c. 构建执行期 skill 映射表（四类 → skill 名称）
```

**替换原静态 Domain Skills 表格为：**

```
### Skill Selection Logic（动态）

执行 task 前，优先使用计划 header Domain Skills 区块中的 skill。
执行 task 步骤时，遇到"调用 `[skill-name]`"内联引用，立即 invoke 对应 skill。

无 Domain Skills 区块时（旧计划兼容），fallback 到：
- 测试方法：test-driven-development（MANDATORY）
- 单测生成：test-code-generator
```

---

### 3.2.3 数据结构变更

不涉及（无数据库、配置文件变更）

---

### 3.2.4 异常处理设计

| 异常场景 | 触发条件 | 处理策略 |
|---|---|---|
| 某类别无匹配 skill | session 中无对应类别的 skill | 在 Domain Skills 区块填"无（使用默认方式）"，执行时使用 fallback |
| 计划中 skill 执行时不可用 | skill 在执行期不在 session | 告知用户，继续使用 fallback，不阻断执行 |
| 旧计划无 Domain Skills 区块 | 计划由旧版 writing-plans 生成 | executing-plans fallback 到静态默认 skill，向后兼容 |

---

# 4. 关联分析

## 4.1 功能影响分析

| 影响类型 | 受影响模块/功能 | 影响描述 | 处理方式 | 需回归 |
|---|---|---|---|---|
| 计划文件结构扩展 | 所有使用 writing-plans 生成的计划 | header 新增 Domain Skills 区块 | 区块可选，executing-plans 兼容无此区块的旧计划 | 否 |
| executing-plans 流程调整 | Step 1 子步骤增加，静态表格替换 | 新增 1.5 步骤，不影响 Step 2-3 执行逻辑 | 无 | 否 |
| subagent-driven-development | subagent 读取计划执行 task | subagent 可读到 Domain Skills 区块中的内联引用 | 无需修改，内联引用是文本指令 | 否 |

## 4.2 DFX 影响评估

| DFX 维度 | 是否受影响 | 影响说明 | 处理方式 |
|---|---|---|---|
| 安全性 | ☑ 否 | 纯文本提示词变更，无安全影响 | 无 |
| 可靠性 | ☑ 否 | fallback 机制确保无匹配 skill 时不阻断 | 已在 §3.2.4 定义 |
| 性能 | ☑ 否 | 扫描 skill 列表为 AI 内部推理，无外部调用 | 无 |
| 可运维性 | ☑ 否 | 无配置项变更 | 无 |
| 可测试性 | ☑ 是 | 测试需验证 Domain Skills 区块生成正确、内联引用位置合理 | 见 §5 测试点 |
| 兼容性 | ☑ 是 | 旧计划无 Domain Skills 区块，需 fallback | 已在 §3.2.4 说明向后兼容策略 |
| 隐私/数据安全 | ☑ 否 | 无数据采集变更 | 无 |

---

# 5. 关键测试点

## 5.1 功能测试点

| 编号 | 测试点 | 测试步骤 | 预期结果 |
|---|---|---|---|
| TC-001 | Skill Discovery 写入 header | 在有 test-driven-development 和 test-code-generator 的 session 中调用 writing-plans | 计划 header 包含 Domain Skills 区块，测试方法列出 test-driven-development，单测编写列出 test-code-generator |
| TC-002 | 内联引用出现在正确步骤 | 检查生成计划的 task 步骤 | 编写测试步骤处出现 `> 调用 test-driven-development`，代码步骤处出现 `> 调用 code-compliance-check` |
| TC-003 | executing-plans 读取并使用 Domain Skills | 有 Domain Skills 区块的计划执行时 | Step 1.5 正确映射，执行 task 时 invoke 计划中指定的 skill |
| TC-004 | 无匹配 skill 时 fallback | session 中无排障类 skill | Domain Skills 区块排障调试行填"无（使用默认方式）"，不报错 |

## 5.2 回归测试点

| 编号 | 测试场景 | 通过标准 |
|---|---|---|
| RT-001 | 旧计划（无 Domain Skills 区块）用 executing-plans 执行 | 正常执行，不因缺少区块报错，fallback 到 test-driven-development |
| RT-002 | writing-plans 生成的计划结构完整性 | header、Conventions、task 结构与现有格式一致，Domain Skills 作为新增区块不破坏原有结构 |

## 5.3 异常/边界测试点

| 编号 | 异常场景 | 预期结果 |
|---|---|---|
| ET-001 | session 中同类别有多个 skill | Domain Skills 区块均列出，并标注 recommended |
| ET-002 | 计划中 skill 执行时不在 session | executing-plans 提示用户，继续 fallback，不中断执行 |

---

# 6. 变更控制

## 6.1 变更列表

| 变更章节 | 变更内容 | 变更原因 | 确认人/日期 |
|---|---|---|---|
| — | 初版 | 新增 Skill Discovery 功能 | 2026-05-13 |

---

## 附录：文档完成自检清单

- [x] ⭐ 所有章节已填写，或已注明"不涉及"及原因
- [x] ⭐ §高密度摘要：改动类型已选择（功能型）
- [x] ⭐ §4.1 关联分析：已逐项分析影响
- [x] ⭐ §4.2 DFX 影响：已逐项评估
- [x] ⭐ §5 所有测试点可执行
- [x] §3.2.4 新增异常处理：包含 fallback 策略
- [x] §3.2.1 接口变更：已注明不涉及
- [x] §3.2.3 数据结构变更：已注明不涉及
