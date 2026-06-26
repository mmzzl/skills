# Plan Evaluator — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

对 `writing-plans` 产出的实现计划（implementation plan）进行逐条检查和质量打分。**模式自适应**：自动检测计划的来源路径（Subsystem / System / Innovation），调整检查范围、红线和评分权重。

**被动评估器**：plan-evaluator 不做路由，只返回评估结果给 `writing-plans` 决定下一步。

## 五大硬约束（必须 100% 遵守）

| # | 约束 | 说明 |
|---|---|---|
| 1 | **逐条扫描** | 每个检查项独立检查，输出 `📍 Check [CHECK-ID]` + 结论。禁止批量跳过 |
| 2 | **模式适配** | 先检测模式，再应用对应的检查层和权重。禁止对 Innovation 模式做 REQ 覆盖检查 |
| 3 | **扣分要有依据** | 每个维度的扣分必须注明是哪个 ISSUE 扣的、扣了多少 |
| 4 | **只报真实问题** | 通过的检查项不写入报告。禁止写"已合规，继续保持" |
| 5 | **发现一类，扫描全部** | 发现一类问题的一个实例后，立即扫描全文找同类所有实例 |

## 配置（Extension Points）

启动前从 `cospowers.config.json` 读取模板路径：

| 配置项 | 用途 |
|---|---|
| `config.templates["overall-design"]` | System/Subsystem 模式定位系统设计输出 |
| `config.templates["module-design"]` | Subsystem 模式定位子系统设计输出 |
| `config.templates["openapi"]` | System/Subsystem 模式验证 API 引用 |

## 三种模式

| 模式 | 入口路径 | 上游文档 | Layer 2（溯源） | R1 红线 |
|---|---|---|---|---|
| **Subsystem** | module-design-spec → writing-plans | 系统需求 + 特性级总体设计 + 概要设计 + OpenAPI | 全部 9 项 | ✅ 触发 |
| **System** | overall-design-spec → writing-plans | 系统需求 + 特性级总体设计 + OpenAPI | 精简 6 项（TRC-04/06/07 跳过） | ✅ 触发 |
| **Innovation** | brainstorming → writing-plans | 无 | 整层跳过 | — 跳过 |

## 审查流程

```
Phase 0: 加载（模式检测 → 加载 plan → 按模式加载上游文档）
  → Phase 1: 逐条扫描（5 层，按模式裁剪）
  → Phase 1.3: 扫描完成统计（逐层通过/总数汇总）
  → Phase 1.4: 红线检查（按模式）
  → Phase 3: 加权打分（按模式自适应权重）
  → Phase 4: 生成评估报告
```

> Phase 2 跳过——设计文档的跨文档一致性由 `doc-quality-evaluator` 处理。

### Phase 0: 加载

**0.1 模式检测**：检查 `docs/agent-rules/4-module-design/output/` → `docs/agent-rules/3-overall-design/output/` → 都没有则为 Innovation。

**0.2 加载 Plan**：读取 plan 文件，识别 Header / Conventions / Domain Skills / Task 结构。如果是 Subsystem 模式的父 `index.md`，还需加载每个服务对应的 plan 文件。

**0.3 按模式加载上游文档**：

| 模式 | 加载内容 |
|---|---|
| Subsystem | 系统需求 `ch03-功能性需求.md` + 特性级总体设计 `ch05-DFX特性设计.md` + 概要设计 `ch03-对外接口.md` / `ch05-exceptions.md` / `ch07-dfx.md` / `ch04-内部设计.md §4.4.1` + OpenAPI spec |
| System | 系统需求 `ch03-功能性需求.md` + 特性级总体设计 `ch05-DFX特性设计.md` + OpenAPI spec |
| Innovation | 跳过——不加载上游文档 |

## 5 层检查项（38 项 + 3 红线 = 41 项）

### Layer 1: 结构完整性（PLAN-STR, 7 项）

所有模式均激活。

| ID | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| PLAN-STR-01 | Header 完整性：Goal（1 句）、Architecture（2-3 句）、Tech Stack 均非空、非泛化 | Plan header | Error |
| PLAN-STR-02 | Conventions 块：10 类规范（语言/命名/导入/错误处理/测试/日志/API/DB/配置/docstring）均有从代码库学习的实际约定 | Conventions 块 | Error |
| PLAN-STR-03 | Conventions 来源可信度：声明是从实际代码文件采样学习，而非凭空发明 | Conventions 块 | Warning |
| PLAN-STR-04 | Domain Skills 块：4 个类别齐全（单测编写/测试方法/排障调试/代码编写），缺失的显式标记"None" | Domain Skills 块 | Warning |
| PLAN-STR-05 | 每个 task 有 Files 表（Create/Modify/Test 列），路径精确。Modify 路径对应已有文件（Glob 验证） | 每个 task | Error |
| PLAN-STR-06 | 每个 task 在 checkbox steps 之前有 Test Cases 表 | 每个 task | Critical |
| PLAN-STR-07 | Subsystem 模式专属：父 index.md 存在，列出所有服务 plan 文件及代码状态（existing/new）。System/Innovation 模式跳过 | Plan index | Error |

### Layer 2: 上游信息无损传递（PLAN-TRC, 9 项，按模式裁剪）

**核心层**——对照上游设计文档检查 REQ/API/DFX/异常处理/数据模型是否全部映射到 plan task。

| ID | 检查项 | 严重级别 | Subsystem | System | Innovation |
|---|---|---|---|---|---|
| PLAN-TRC-01 | REQ 全覆盖：每个 REQ-XXX 映射到至少一个 task | Critical | ✅ | ✅ | — |
| PLAN-TRC-02 | API 全覆盖：OpenAPI 中该子系统拥有的每个端点映射到至少一个 task | Critical | ✅ | ✅ | — |
| PLAN-TRC-03 | DFX 实现：每个 DFX 维度有对应实现 task，或显式标"不在本次迭代" | Error | ✅ | ✅ | — |
| PLAN-TRC-04 | 异常处理覆盖：概要设计 §5 的每个异常场景有对应 test case | Error | ✅ | — | — |
| PLAN-TRC-05 | 设计决策保留：关键设计决策反映在 plan Architecture 或相关 task 中 | Error | ✅ | ✅ | — |
| PLAN-TRC-06 | 外部依赖处理：每个 DEP-XXX 有 mock/stub/integration test 策略 | Warning | ✅ | — | — |
| PLAN-TRC-07 | 数据模型覆盖：§4.4.1 的每个数据库表映射到至少一个 task | Error | ✅ | — | — |
| PLAN-TRC-08 | Task 溯源标注：每个 task 显式引用来源（REQ-XXX / design §X.X / API path） | Warning | ✅ | ✅ | — |
| PLAN-TRC-09 | API 路径准确：task 中引用的 API 端点与 OpenAPI 完全一致 | Error | ✅ | ✅ | — |

### Layer 3: 无占位符 + 可执行性（PLAN-EXE, 10 项）

所有模式均激活。

| ID | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| PLAN-EXE-01 | 全文无 TBD / TODO / "implement later" / "fill in details" | 全文 | Critical |
| PLAN-EXE-02 | 无"Add appropriate error handling"等模糊描述——必须指明具体错误和处理方式 | 全文 | Error |
| PLAN-EXE-03 | 无"Write tests for the above"等不包含实际 test code 的描述 | 全文 | Error |
| PLAN-EXE-04 | 无"Similar to Task N"引用——每个 task 自包含 | 全文 | Error |
| PLAN-EXE-05 | 每个代码步骤有实际代码块（```language ... ```），非纯文字描述 | 每个 task 步骤 | Error |
| PLAN-EXE-06 | 所有引用的类型/函数/方法在本 task 或前序 task 中有定义 | 跨 task 对照 | Error |
| PLAN-EXE-07 | 文件路径精确、可验证：create 路径在合理目录，modify 路径对应已有文件 | 每个 task Files 表 | Error |
| PLAN-EXE-08 | 每个 Test Case 行完整：TC-ID / 溯源 / 类型 / 前置条件 / 具体断言 / 自动化级别 / 测试目标路径 / 运行命令 | 每个 task Test Cases 表 | Error |
| PLAN-EXE-09 | 无弱断言：禁止"verify it works""assert result is not None"——必须验证具体行为 | 每个 task Test Cases 表 | Error |
| PLAN-EXE-10 | 测试命令匹配 Conventions：运行命令使用 Conventions 中声明的测试框架 | 每个 task Test Cases 表 | Warning |

### Layer 4: 跨 Task 一致性 + 规范（PLAN-CNS, 7 项）

所有模式均激活。CNS-05 仅在 Subsystem 模式适用。

| ID | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| PLAN-CNS-01 | 类型/函数名一致性：同一实体跨 task 名称一致 | 跨 task 对照 | Error |
| PLAN-CNS-02 | 代码风格一致性：所有代码示例符合 Conventions 声明的规范 | 全文代码块 | Error |
| PLAN-CNS-03 | Commit message 格式：遵循 conventional commits | 每个 task commit 步骤 | Warning |
| PLAN-CNS-04 | 测试场景覆盖：每个 task 覆盖 normal + boundary + exception 三类场景 | 每个 task Test Cases 表 | Error |
| PLAN-CNS-05 | 集成测试：多服务 plan 包含端到端集成验证 task（仅 Subsystem 模式） | Plan task 列表 | Warning |
| PLAN-CNS-06 | Task 排序：依赖 task 在被依赖者之前 | Plan task 列表 | Warning |
| PLAN-CNS-07 | Domain Skill 使用：Domain Skills 中列出的 skill 在 task 步骤中有对应内联引用 | 每个 task 步骤 | Warning |

### Layer 5: TDD 完备性（PLAN-TDD, 5 项）

所有模式均激活。

| ID | 检查项 | 位置 | 严重级别 |
|---|---|---|---|
| PLAN-TDD-01 | RED 阶段完整：每个 task 步骤 1-2 是"写失败测试"+"运行验证因功能未实现而失败" | 每个 task 步骤 1-2 | Error |
| PLAN-TDD-02 | GREEN 阶段完整：每个 task 有最小实现步骤使对应测试通过 | 每个 task 实现步骤 | Error |
| PLAN-TDD-03 | REFACTOR 阶段：复杂 task 有重构步骤。简单 CRUD task 可省略 | 每个 task（仅复杂 task） | Warning |
| PLAN-TDD-04 | 测试可溯源：每个 TC-ID 追溯到上游设计位置（design §X.X / REQ-XXX / API endpoint） | 每个 task Test Cases 表 | Warning |
| PLAN-TDD-05 | 测试隔离：单元测试不依赖外部服务。外部依赖显式标注 mock/fixture 策略 | 每个 task Test Cases 表 | Error |

### Phase 1.3: 扫描完成统计

所有检查项扫描完成后输出汇总，包含：扫描总数 / 通过数 / 各级违规数 / Issue 编号列表 / 逐层通过率。

### Phase 1.4: 红线检查（模式自适应，一票否决为 F）

| 红线 | Subsystem | System | Innovation |
|---|---|---|---|
| R1 — REQ 覆盖缺失 | ✅ 触发 F | ✅ 触发 F | — 跳过 |
| R2 — 占位符污染（TBD/TODO/等） | ✅ | ✅ | ✅ |
| R3 — Test Case 段缺失 | ✅ | ✅ | ✅ |

## 评分体系（按模式自适应权重）

### 扣分规则

| 严重级别 | 每项扣分 |
|---|---|
| Critical | -40 |
| Error | -20 |
| Warning | -8 |

每个维度最低 0 分。加权总分 = 各维度分数 × 权重之和。

### Subsystem 模式

| 维度 | 权重 | 说明 |
|---|---|---|
| 上游信息保真度 | 30% | REQ/API/DFX/异常/数据模型全覆盖 |
| 可执行性与精确度 | 25% | 无占位符、精确路径、具体代码 |
| TDD 完备性 | 20% | RED/GREEN/REFACTOR 完整 |
| 跨 Task 一致性与规范 | 15% | 类型一致、代码风格、task 排序 |
| 结构合规 | 10% | Header/Conventions/Domain Skills/Task 结构 |

### System 模式

| 维度 | 权重 | 说明 |
|---|---|---|
| 上游信息保真度 | 25% | 降权——无子系统文档 |
| 可执行性与精确度 | 30% | 提权——更看重 plan 自身质量 |
| TDD 完备性 | 20% | |
| 跨 Task 一致性与规范 | 15% | |
| 结构合规 | 10% | |

### Innovation 模式

| 维度 | 权重 | 说明 |
|---|---|---|
| 上游信息保真度 | 0% | 跳过——无上游文档 |
| 可执行性与精确度 | 40% | 最高权重——plan 是唯一产出物 |
| TDD 完备性 | 30% | |
| 跨 Task 一致性与规范 | 20% | |
| 结构合规 | 10% | |

### 等级对照

| 总分 | 等级 | 含义 |
|---|---|---|
| 95-100 | **A** | 优秀——可以进入执行交接 |
| 80-94 | **B** | 良好——可以进入执行交接 |
| 65-79 | **C** | 勉强——必须修复所有 Error + Critical 并重新评估 |
| <65 | **D** | 不合格——需要大幅返工 |
| 红线触发 | **F** | 直接失败，无论其他分数 |

## Phase 4: 生成评估报告

将结构化 Markdown 报告保存到 plan 文件旁边的 `quality-reports/` 子目录，文件名 `YYYY-MM-DD-plan-quality-report.md`。

报告结构包含五部分：
- **I. 红线结果** — R1/R2/R3 的通过/触发状态
- **II. 评分概览** — 评分表和逐层汇总
- **III. 问题清单（按严重级别）** — 每个问题的位置/引用/规则/修复建议
- **IV. 改进建议（按优先级）** — Critical → Error → Warning → Coverage
- **V. 下一步** — 根据等级给出行动指引

## 修复循环

- grade >= B (≥ 80) → 通过 → TRANSITION GATE → Execution Handoff
- grade < B → 修复问题 → 重新派遣 `plan-evaluator`（最多 2 轮）
- **修复原则**：先读完整报告了解哪些已通过，只修复报告列出的问题，不重写已通过的章节。若重新评估分数下降，说明修改引入了回退——撤销修改并更精准地修复
- 2 轮后仍 < B → 呈现剩余问题给用户，请求人工介入

## 集成方式

`plan-evaluator` 是**被动评估器**：
- 由 `writing-plans` 在 plan 写完后（Execution Handoff 之前）派遣
- 作为隔离子代理运行，使用 `skills/plan-evaluator/agents/evaluator-dispatch-prompt.md`
- 向 `writing-plans` 返回：等级（A/B/C/D/F）、分数、红线状态、Critical + Error 问题表、报告路径
- `writing-plans` 根据等级决定下一步

## 常见问题模式

| 问题 | 典型表现 | 检查项 | 严重级别 |
|---|---|---|---|
| 占位符污染 | "TBD"、"TODO"、"implement later"、"fill in details" | PLAN-EXE-01, R2 | Critical |
| 缺少 Test Cases | Task 有 checkbox steps 但无 Test Cases 表 | PLAN-STR-06, R3 | Critical |
| REQ 未被覆盖 | REQ-XXX 在系统需求中存在但无对应 plan task | PLAN-TRC-01, R1 | Critical |
| 弱断言 | "verify it works"、"assert result is not None" | PLAN-EXE-09 | Error |
| 模糊异常处理 | "Add appropriate error handling" 不指明错误类型和处理方式 | PLAN-EXE-02 | Error |
| 缺少 RED 阶段 | Task 步骤不以"先写失败测试"+"运行确认失败"开始 | PLAN-TDD-01 | Error |
| API 路径不匹配 | Plan 引用 `/api/v2/users` 但 OpenAPI 定义 `/api/v1/users` | PLAN-TRC-09 | Error |
| 孤立引用 | 代码引用未在任何前序 task 定义的类型/函数 | PLAN-EXE-06 | Error |
| 代码块缺失 | 代码步骤仅文字描述，无实际代码 | PLAN-EXE-05 | Error |
| Conventions 不一致 | 代码示例用 camelCase 但 Conventions 声明 snake_case | PLAN-CNS-02 | Error |
| 缺少边界测试 | Test cases 只覆盖正常路径，无 boundary 或 exception 场景 | PLAN-CNS-04 | Error |
| "Similar to Task N" | Task 通过引用其他 task 复用内容，非自包含 | PLAN-EXE-04 | Error |
| Domain Skill 未使用 | Domain Skills 中列出的 skill 从未在 task 步骤中引用 | PLAN-CNS-07 | Warning |
| 测试命令错误 | 测试命令用 `jest` 但 Conventions 声明 `pytest` | PLAN-EXE-10 | Warning |

## 检查项汇总

| Phase | 检查项 | 数量 | 映射维度 |
|---|---|---|---|
| Layer 1 (STR) | PLAN-STR-01 ~ PLAN-STR-07 | 7 | 结构合规 |
| Layer 2 (TRC) | PLAN-TRC-01 ~ PLAN-TRC-09 | 9 | 上游信息保真度 |
| Layer 3 (EXE) | PLAN-EXE-01 ~ PLAN-EXE-10 | 10 | 可执行性与精确度 |
| Layer 4 (CNS) | PLAN-CNS-01 ~ PLAN-CNS-07 | 7 | 跨 Task 一致性与规范 |
| Layer 5 (TDD) | PLAN-TDD-01 ~ PLAN-TDD-05 | 5 | TDD 完备性 |
| Phase 1.4 | R1, R2, R3 | 3 | 一票否决 → F |
| **总计** | | **41** | |

## 下一步

- 评级 A/B（≥ 80）→ TRANSITION GATE → Execution Handoff（`subagent-driven-development` 或 `executing-plans`）
- 评级 C/D/F → 修复后重新派遣 `plan-evaluator`，直至达到 B 级（最多 2 轮）
- 报告路径：plan 文件同目录下的 `quality-reports/YYYY-MM-DD-plan-quality-report.md`
