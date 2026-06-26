# cospowers 通用化设计文档

> **版本：** 2026-05-13 | 定位：插件化架构设计指南，面向需要在 cospowers 标准流程之上叠加本部门 AI-Native 能力的业务团队

---

## Ch.1 现状：cospowers 提供什么，业务部门已沉淀什么

### 1.1 cospowers 核心能力

cospowers 是运行在 Claude Code 上的**通用 AI 原生端到端开发工作流插件**，提供三类能力：

**① 工作流骨架（不可替换）**

| 能力域 | 核心 Skill | 作用 |
|--------|-----------|------|
| 任务路由 | `brainstorming` | 识别项目类型，分发至四条路线 |
| 需求结构化 | `system-requirement-analysis` | 需求文档 → REQ-XXX + Given-When-Then |
| 设计生成 | `overall-design-spec` → `module-design-spec` | 系统架构 + OpenAPI + 概要设计 |
| 规划执行 | `writing-plans` → `subagent-driven-development / executing-plans` | 实施计划 + 双轨执行 |
| 质量守卫 | `test-driven-development` → `verification-before-completion` → `code-compliance-check` | 测试先行 + 证据验证 + 规范合规 |
| 提交标准化 | `spec-commit` | AI 标签 + 14 段 commit message + 保护分支检测 |

**② 叶子扩展点（可按部门替换）**

```
cospowers.config.json
  ├── env.*          → 服务端点与凭据
  ├── kb.*           → 知识库 skill 名 / 本地路径
  ├── templates.*    → 文档模板（ai-requirement / system-requirement / system-design / module-design / openapi）
  ├── rules.*        → 规范目录（design-review / coding-standards / dfx）
  └── evaluators.*   → 质量门控 skill（aireq / sysreq / sysdesign / subsystem / doc-quality；false = 禁用）
```

**③ 知识轮毂（可接入部门知识库）**

`evo-knowledge-wheel` 通过 `SPEC_DEVELOPER_SERVER_URL` 接入知识平台；未配置时自动降级到本地 `memory/kb/`。

---

### 1.2 不同业务部门可能已沉淀的 AI-Native 能力

各业务部门的沉淀分为两类，集成方式不同：

**A 类：流程型沉淀**（可执行的工作流 Skill）→ 以部门 Plugin Skill 形式与 cospowers 协同工作

| Skill 类型 | 典型场景 | 举例 |
|-----------|---------|------|
| **开发 Skill** | 特定框架/中间件的开发 SOP | Go gRPC 服务开发模式（proto 定义→生成→接口实现），内部 ORM 框架使用约定，消息队列生产/消费脚手架 |
| **排障 Skill** | 特定系统 / 链路的专项排查流程 | DB 死锁排查步骤、消息积压根因树、分布式链路超时定位 SOP |
| **单测 Skill** | 本团队测试框架约定和 mock 规范 | Go testify + sqlmock 写法规范、pytest fixtures 组织约定、Mock 边界定义（哪些必须 mock / 哪些禁止 mock） |
| **测试方法 Skill** | 特定业务场景的测试策略 | 支付链路端到端测试方法、性能测试基准脚本（k6/Locust 模板）、混沌工程注入规则 |
| **领域建模 Skill** | 复杂业务域的建模指导 | DDD 聚合根/领域事件设计方法、数据建模规范（字段命名/软删除/多租户） |

**B 类：知识型沉淀**（规范文档、模板、基线数字）→ 通过 cospowers 配置扩展点加载

| 业务部门 | 典型已有沉淀 | 当前形态 |
|---------|------------|---------|
| **后端开发（Go / Java / Python）** | 框架特定编码规范（日志格式、错误码、DB 命名）、内部 SDK 使用约定 | Wiki / 代码注释 |
| **前端开发** | 组件库用法规范、BFF 接口约定、CSS-in-JS 规范 | 内部文档站 |
| **安全合规** | 安全编码检查清单、隐私数据处理规范、合规准入条件 | 安全部门内部知识库 |
| **测试 / QA** | 测试分层策略、特定业务场景用例模板、测试数据生成规则 | TestRail / 手工文档 |
| **SRE / 运维** | DFX 基线数字（可用性 99.9%、RT P99 < 100ms）、监控告警规范 | 内部 Runbook |
| **架构委员会** | 跨团队技术选型约束、服务间通信规范、数据库分表规则 | ADR 文档 |

两类沉淀的**共同问题**：AI 在执行任务时无法自动感知和应用它们——A 类流程知识停留在专家脑中，B 类规范文档与开发流程断层，都需要人工事后介入纠偏。

---

## Ch.2 目的：统一骨架 + 部门专属沉淀同时生效

**核心诉求：** 不同业务部门在使用 cospowers 标准 SOP（需求→设计→规划→执行→提交）的同时，能够加载并应用本部门已沉淀的 **A 类（流程型）** 和 **B 类（知识型）** 内容——无需修改 cospowers 核心 Skill。

```
                     cospowers 核心骨架（通用，不可改）
                                │
            ┌───────────────────┼──────────────────────────┐
            │                   │                          │
      ┌─────▼──────┐     ┌──────▼──────┐           ┌──────▼──────┐
      │   部门 A   │     │   部门 B    │           │   部门 C    │
      │  后端研发  │     │  安全合规   │           │  SRE / 运维 │
      │            │     │             │           │             │
      │ B类（知识）│     │ B类（知识） │           │ B类（知识） │
      │ • 编码规范 │     │ • 安全评估器│           │ • DFX基线   │
      │ • DFX基线  │     │ • 合规检查  │           │ • 监控规范  │
      │ • 知识库   │     │   清单      │           │             │
      │            │     │             │           │             │
      │ A类（流程）│     │ A类（流程） │           │ A类（流程） │
      │ • 开发SOP  │     │ • 安全排障  │           │ • 部署排障  │
      │ • 排障Skill│     │   Skill     │           │   Skill     │
      │ • 单测Skill│     │             │           │ • 混沌测试  │
      └────────────┘     └─────────────┘           └─────────────┘
```

**设计约束（Plugin Isolation 原则）：**
- cospowers 骨架 Skill（`brainstorming`、`writing-plans`、`spec-commit`、`test-driven-development`、`systematic-debugging` 等）的 SOP **不可被业务部门覆盖或替换**
- **A 类**流程型 Skill 以**协同调用**模式与 cospowers 配合——在 cospowers 骨架 Skill 的特定衔接点被用户或流程显式触发，而不是替换它
- **B 类**知识型沉淀通过 `cospowers.config.json` 的叶子扩展点注入，AI 在生成文档和检查代码时自动应用

---

## Ch.3 当前实现方式

### 3.1 配置加载机制

每个 cospowers Skill 在启动时读取插件根目录的 `cospowers.config.json`，用其中的值替换内置默认值。

**读取优先级（每个字段独立判断）：**

```
cospowers.config.json 中非 null 值
    ↓（null 则回退）
OS 环境变量（env 块向后兼容）
    ↓（未设置则回退）
cospowers 内置默认值
```

**无需修改任何 Skill 文件**——这是扩展 cospowers 行为的唯一入口。

---

### 3.2 五个扩展点的当前行为

#### 3.2.1 `env` — 服务端点与凭据

| 字段 | 使用的 Skill | 作用 |
|------|------------|------|
| `SPEC_DEVELOPER_SERVER_URL` | `evo-knowledge-wheel`、`code-compliance-check`、`spec-commit` | 知识轮毂 API 地址 |
| `DAEDALUS_URL` | `requirement-analysis`、`system-requirement-analysis`、`overall-design-spec` | 产品知识库查询地址 |
| `DAEDALUS_API_KEY` | 同上 | API 鉴权 Key |
| `GITLAB_TOKEN` / `GITLAB_TOKEN_PATH` | `spec-commit` Step 8 | 创建 MR 时的 GitLab token |

业务部门**替换场景**：将 `SPEC_DEVELOPER_SERVER_URL` 指向本部门部署的知识轮毂实例，使 `evo-knowledge-wheel` 搜索并贡献部门内部知识。

---

#### 3.2.2 `kb` — 知识库 Skill 与本地路径

```json
"kb": {
  "skill": "kb-query",        // 替换 kb-query 为本部门产品知识查询 skill
  "localPath": "doc/kb/"      // 降级时使用的本地知识目录
}
```

`requirement-analysis` 和 `system-requirement-analysis` 在分析需求时会调用 `kb.skill` 查询产品知识。如果部门已有自己封装的知识查询 skill（如接入内部 Confluence、Notion 或知识平台的 MCP tool），可直接替换。

---

#### 3.2.3 `templates` — 文档模板

cospowers 内置 6 个模板：

| 模板键 | 内置路径 | 使用的 Skill |
|-------|---------|------------|
| `ai-requirement` | `templates/ipd-story-template.md` | `requirement-analysis` |
| `system-requirement` | `templates/system-requirement-template.md` | `system-requirement-analysis` |
| `system-design` | `templates/system-design-template.md` | `design-spec` |
| `module-design` | `templates/module-design-template.md` | `module-design-spec` |
| `micro-design` | `templates/micro-design-template.md` | 未来扩展 |
| `openapi` | `templates/openapi-template.yaml` | `overall-design-spec` |

业务部门可提供**基于内置模板扩展的版本**（添加本部门专属章节，如特定 DFX 指标章节、业务特有的术语表节），并在 `cospowers.config.json` 中指向自定义路径。

---

#### 3.2.4 `rules` — 规范目录

| 规范键 | 使用的 Skill | 内容 |
|-------|------------|------|
| `design-review` | `sysdesign-evaluator`、`subsystem-evaluator` | 设计评审 checklist（M1~M6） |
| `coding-standards` | `code-compliance-check` | 编码规范文档（KB 语义检查的数据源） |
| `dfx` | `overall-design-spec`、`module-design-spec` | DFX（可靠性/安全/性能/可维护性/可观测性/容量/国际化）指标基线 |

业务部门可提供**本部门的规范目录**，AI 在生成和评审文档时会读取这些规范并强制应用。

---

#### 3.2.5 `evaluators` — 质量门控 Skill

| 评估器键 | 触发位置 | 内置 Skill |
|---------|---------|-----------|
| `aireq` | `requirement-analysis` step 13 | `aireq-evaluator` |
| `sysreq` | `system-requirement-analysis` step 4.2 | `sysreq-evaluator` |
| `sysdesign` | `overall-design-spec` step 12 | `sysdesign-evaluator` |
| `subsystem` | `module-design-spec` step 6 | `subsystem-evaluator` |
| `doc-quality` | `module-design-spec` 最后子系统 | `doc-quality-evaluator` |

三种替换策略：
1. **替换为部门自定义评估器**：提供包含额外业务规则的评估器 Skill 名称
2. **叠加检查**：部门评估器在内置评估器基础上追加业务专项规则
3. **禁用特定门控**：`false` 关闭某个质量 Gate（谨慎使用，会降低文档质量基线）

---

### 3.3 交互式配置方式

运行 `cospowers-configure` skill 进行交互式向导配置：

1. 向导读取当前 `cospowers.config.json`，展示已配置项 vs. 默认项
2. 引导用户逐类别填写（env / kb / templates / rules / evaluators）
3. 每项填写后立即验证（路径存在性 / skill 已安装）
4. 将变更 merge 写入 `cospowers.config.json`，**立即生效，无需重启**

---

## Ch.4 建议：业务部门应构建什么，以及如何归档

### 4.1 建议各业务部门构建的 Skill 内容

部门沉淀分两类，构建方式不同。

---

#### 类型 A：流程型 Skill（协同调用，不替换 cospowers 骨架）

这类 Skill 是部门自己的工作流知识，与 cospowers 的骨架 Skill **并列工作**，在流程的特定衔接点被触发。

**核心原则：协同，不覆盖。** cospowers 的 `systematic-debugging` 处理通用排障五步法，部门排障 Skill 处理"当遇到 MySQL 死锁时具体怎么查"——两者共同作用，不互相替代。

##### 4.1.1 开发 Skill

封装团队特定技术栈/框架的开发 SOP，AI 在实现功能时主动遵循。

**触发时机**：`writing-plans` 生成实施计划后、`executing-plans` / `subagent-driven-development` 开始实现前，由用户或流程显式调用。

**Skill 内容应包含：**
- 本框架/语言的项目结构约定（目录分层、文件命名）
- 核心框架的使用模式（ORM 写法、中间件接入方式、配置加载顺序）
- 内部 SDK / 公共组件的正确用法（不应绕过的封装层）
- 禁止模式清单（明确列出"不要这样写"的反例，附理由）

**示例结构：**
```markdown
# <dept>-go-service-dev

## 项目结构约定
...

## Repository Pattern 写法
✅ 正确：通过 repo 层访问 DB，禁止在 handler 层直接调 DB
❌ 禁止：handler 层直接 `db.Query(...)`

## 内部 SDK 使用
...

## 禁止模式
- 禁止 goroutine 泄露（每个 goroutine 必须有退出路径）
- 禁止裸 panic（必须 recover 并转换为业务错误码）
```

---

##### 4.1.2 排障 Skill

封装本领域的专项排查流程，作为 cospowers `systematic-debugging` 的**领域深化层**。

**触发时机**：`systematic-debugging` Phase 2（假设生成）或 Phase 3（假设验证）中，识别到特定系统/场景时，用户或 AI 显式调用。

**与 `systematic-debugging` 的关系：**

```
systematic-debugging（通用五步法：5W1H → 假设 → 验证 → 根因 → 修复）
         │
         ├─ Phase 2 识别到"DB 相关"症状
         │         ↓
         └─ 用户调用 <dept>-db-debugging
                   │
                   ├─ Step 1: 查 slow_query_log
                   ├─ Step 2: 检查 InnoDB lock wait
                   ├─ Step 3: SHOW ENGINE INNODB STATUS
                   └─ Step 4: 分析事务隔离级别
```

**Skill 内容应包含：**
- 症状识别特征（什么现象触发这个排障流程）
- 专项排查步骤（具体命令 / 查询 / 工具）
- 关键指标及正常阈值
- 常见根因清单（按出现频率排序）
- 对应修复方向（指向 evo-knowledge-wheel 中的 Capsule）

**典型开发：**

| 排障 Skill | 覆盖场景 |
|-----------|---------|
| `<dept>-db-debugging` | DB 死锁、慢查询、连接池耗尽 |
| `<dept>-mq-debugging` | 消息积压、消费停滞、重复消费 |
| `<dept>-cache-debugging` | 缓存穿透/雪崩/击穿、一致性问题 |
| `<dept>-rpc-debugging` | 超时/熔断/重试风暴、服务发现异常 |
| `<dept>-deploy-debugging` | 灰度发布回滚流程、配置热更新排查 |

---

##### 4.1.3 单测 Skill

封装本团队的测试框架约定、mock 边界规则和测试数据规范，指导 AI 生成符合团队标准的测试代码。

**触发时机**：`test-driven-development` RED 阶段（写失败测试）开始前，由用户或流程显式调用。

**与 `test-driven-development` 的关系：**

```
test-driven-development（RED → GREEN → REFACTOR 铁律不变）
         │
         └─ RED 阶段开始前
                   ↓
         用户调用 <dept>-unit-test-skill
                   │
                   ├─ 确定测试框架（testify / pytest / JUnit）
                   ├─ 确定 Mock 边界（哪些必须 mock / 哪些禁止 mock）
                   ├─ 确定测试数据格式（真实 UUID / 业务命名规范）
                   └─ 确定分组约定（TestXxx_scenario_expectation）
```

**Skill 内容应包含：**
- 测试框架选型及版本（不允许混用多个框架）
- Mock 边界规则（例：禁止 mock 领域层、必须 mock 外部 HTTP 调用）
- 测试命名约定（`Test<Func>_<scenario>_<expected>`）
- 测试数据生成规则（禁止 `"test_xxx"` 类占位符，必须使用业务真实格式）
- 必须覆盖的场景类型（正常路径 / 边界值 / 并发 / 资源不足）
- 禁止的测试反模式（测试相互依赖、共享全局状态、依赖执行顺序）

---

##### 4.1.4 测试方法 Skill

封装特定业务场景或测试类型的测试策略，超出 cospowers 内置 `test-code-generator` 的通用能力。

**触发时机**：`writing-plans` 阶段规划测试策略时，或专项测试任务开始前。

**典型开发：**

| 测试方法 Skill | 覆盖场景 |
|--------------|---------|
| `<dept>-e2e-test` | 核心业务链路的端到端测试框架（Playwright / Cypress / 自研测试平台）、测试账号管理、环境隔离方案 |
| `<dept>-performance-test` | 性能测试基准脚本（k6 / Locust 模板）、流量模型（正常 / 峰值 / 压测倍数）、通过/失败判定标准 |
| `<dept>-contract-test` | API 契约测试方案（Pact / Spring Cloud Contract）、消费者驱动契约发布流程 |
| `<dept>-chaos-test` | 混沌工程注入规则（故障类型 / 注入范围 / 观测指标）、回滚判定条件 |
| `<dept>-data-test` | 数据质量测试方法（一致性校验 SQL / 幂等性测试脚本）|

**Skill 内容应包含：**
- 适用场景（什么情况触发）
- 工具链和依赖
- 测试用例模板（包含真实参数格式）
- 通过/失败判定标准（具体数字，非模糊描述）
- 与 CI/CD 流水线的集成点

---

#### 类型 B：知识型内容（通过配置扩展点注入）

这类内容通过 `cospowers.config.json` 的叶子扩展点加载，AI 在生成文档、检查代码时自动读取并应用。包含四种子类型：

##### B1：自定义评估器 Skill

这是**价值最高、复用最广**的知识型沉淀。评估器 Skill 在工作流的质量门控点自动触发，将部门规范编码为可执行的检查规则。

| 评估器类型 | 适合哪类部门 | 编写要点 |
|-----------|------------|---------|
| `<dept>-aireq-evaluator` | 产品/业务分析团队 | 在 33 条通用规则基础上，追加本产品的用户故事格式要求、业务术语约定、AC 完整性规则 |
| `<dept>-sysreq-evaluator` | 各研发团队 | 追加本产品的 REQ 编号规范、特定功能域的场景覆盖要求（如支付系统的对账场景） |
| `<dept>-sysdesign-evaluator` | 架构 / 研发团队 | 追加本团队的架构约束检查（禁用的中间件、强制的服务通信方式、数据库分表规则） |
| `<dept>-subsystem-evaluator` | 子系统负责人 | 追加本语言/框架的设计规范（Go 的 repository pattern、Java 的 DDD 分层检查） |
| `<dept>-security-evaluator` | 安全合规团队 | 独立安全评估 Skill，检查隐私数据处理、鉴权设计、加密算法选型合规性 |

**评估器 Skill 编写格式参考：**

```markdown
# <部门>-<类型>-evaluator

**Skill 标识**：`<dept>-<type>-evaluator`

## 前置条件
- 内置评估器（`<type>-evaluator`）已完成评审，评分 ≥ B (80)
- 或：本评估器完全替换内置评估器（配置 `evaluators.<type>: "<dept>-<type>-evaluator"`）

## 追加规则清单（<DEPT>-01 ~ <DEPT>-NN）

| 规则编号 | 检查内容 | 严重级别 | 扣分权重 |
|---------|---------|---------|---------|
| <DEPT>-01 | <具体检查项> | 阻断/警告/建议 | 10/5/2 |
...

## 评分方式
继承内置评估器的基础分，<部门>规则追加扣分，最终综合分 ≥ B 才通过。

## 输出格式
与内置评估器相同：按规则逐项输出（✅/⚠️/❌），加权评分，红线判定。
```

---

##### B2：自定义规范目录

将团队已有的规范文档整理到统一目录，供 `code-compliance-check` 和设计评审 Skill 读取。

**推荐目录结构：**

```
<dept>-rules/
  ├── coding-standards/
  │   ├── go-standards.md          # Go 编码规范（日志格式、错误处理、命名约定）
  │   ├── java-standards.md        # Java 编码规范
  │   └── sql-standards.md         # SQL 编写规范
  ├── design-review/
  │   ├── M1-doc-standards.md      # 扩展通用 M1
  │   ├── M2-tech-requirements.md  # 扩展通用 M2
  │   └── <dept>-checklist.md      # 部门专属检查项
  └── dfx/
      ├── availability-baseline.md # 可用性基线（如：核心链路 99.95%）
      ├── performance-baseline.md  # 性能基线（RT P99 / TPS / 错误率）
      └── security-baseline.md     # 安全基线（加密要求、鉴权规范）
```

**编写原则：**
- 规范文档以 Markdown 编写，结构清晰，每条规则独立成行，便于 AI 逐条理解
- 包含反例（❌ 错误示例）和正例（✅ 正确示例），帮助 AI 准确判断
- DFX 基线必须包含**具体数字**（避免"高性能"这类模糊描述），如：`P99 < 100ms（正常流量），P99 < 300ms（峰值 2x 流量）`

---

##### B3：自定义文档模板

在内置模板基础上扩展，添加本部门的专属章节。

**模板扩展原则：**
- **不删除**内置模板的任何必填章节（删除会导致评估器扣分）
- **追加**部门专属章节（如安全团队追加"威胁建模"章节，支付团队追加"对账设计"章节）
- 新增章节使用独立编号（如 `§10. 部门专属：对账设计`）避免与内置编号冲突

---

##### B4：知识库查询 Skill（可选）

如果部门已有结构化的内部知识平台（Confluence、内部 Wiki、向量知识库），可封装为 `kb-query` 接口兼容的 Skill，供 `requirement-analysis` 和 `system-requirement-analysis` 查询产品领域知识。

**接口约定（参考 `kb-query` 设计）：**
- 输入：产品标识符 + 查询关键词
- 输出：结构化的模块信息（名称、技术栈、业务描述、负责人、关联 API）
- 无匹配时返回空结果，不阻断流程

---

### 4.2 业务部门内容的归档格式（Plugin）

#### 4.2.1 为什么要打包成 Plugin

将部门沉淀打包为 Claude Code Plugin，有以下优势：
- **版本管理**：Plugin 有独立版本号，团队成员安装后保持一致
- **一键配置**：Plugin 可携带预配置的 `cospowers.config.json` 覆盖片段，安装后自动生效
- **独立演进**：部门 Plugin 独立于 cospowers 核心仓库，可按部门节奏迭代
- **可审计**：通过 Git 历史追踪规范演进过程

---

#### 4.2.2 Plugin 目录结构

```
<dept>-cospowers-plugin/
  ├── .claude-plugin/
  │   └── plugin.json                    # Plugin 元数据（必须）
  ├── skills/
  │   │
  │   │  # ── A 类：流程型 Skill（协同调用）──────────────────────────
  │   ├── <dept>-go-service-dev/
  │   │   └── SKILL.md                   # 开发 Skill：Go 服务开发 SOP
  │   ├── <dept>-db-debugging/
  │   │   └── SKILL.md                   # 排障 Skill：DB 死锁/慢查询排查
  │   ├── <dept>-mq-debugging/
  │   │   └── SKILL.md                   # 排障 Skill：消息积压排查
  │   ├── <dept>-unit-test/
  │   │   └── SKILL.md                   # 单测 Skill：测试框架约定 + mock 规则
  │   ├── <dept>-e2e-test/
  │   │   └── SKILL.md                   # 测试方法 Skill：端到端测试策略
  │   │
  │   │  # ── B 类：知识型（评估器 Skill）───────────────────────────
  │   ├── <dept>-aireq-evaluator/
  │   │   └── SKILL.md                   # AI 需求评估器
  │   ├── <dept>-sysreq-evaluator/
  │   │   └── SKILL.md                   # 系统需求评估器
  │   ├── <dept>-sysdesign-evaluator/
  │   │   └── SKILL.md                   # 系统设计评估器
  │   └── <dept>-kb-query/
  │       └── SKILL.md                   # 知识库查询 Skill（可选）
  │
  ├── templates/                         # B 类：文档模板
  │   ├── system-requirement-template.md
  │   └── system-design-template.md
  │
  ├── rules/                             # B 类：规范目录
  │   ├── coding-standards/
  │   │   └── <lang>-standards.md
  │   ├── design-review/
  │   │   └── <dept>-checklist.md
  │   └── dfx/
  │       └── <dept>-baseline.md
  │
  └── cospowers.config.patch.json          # B 类配置覆盖片段（templates/rules/evaluators/kb）
---

#### 4.2.3 Plugin 元数据格式（`plugin.json`）

```json
{
  "name": "<dept>-cospowers",
  "description": "<部门名> 的 cospowers 扩展包：包含 <部门> 专属评估器、编码规范和 DFX 基线",
  "version": "1.0.0",
  "author": { "name": "<部门名>", "team": "<团队名>" },
  "cospowers": {
    "extends": "cospowers",
    "cospowersVersion": ">=0.1.3"
  },
  "keywords": ["cospowers-extension", "<dept>", "evaluator", "coding-standards"]
}
```

**关键字段说明：**
- `cospowers.extends: "cospowers"` — 声明这是 cospowers 的扩展 Plugin，工具链可以识别并处理配置合并
- `cospowers.cospowersVersion` — 声明兼容的 cospowers 最低版本，防止部门 Plugin 在旧版 cospowers 上产生兼容问题

---

#### 4.2.4 配置覆盖文件格式（`cospowers.config.patch.json`）

业务部门 Plugin 携带一个**配置片段文件**，描述需要覆盖的 cospowers.config.json 字段。安装 Plugin 后，由用户手动执行 `cospowers-configure` 或工具链自动将此片段 merge 到项目的 `cospowers.config.json`。

```json
{
  "_comment": "<部门名> cospowers 配置覆盖片段。安装 Plugin 后运行 cospowers-configure 或手动 merge 到 cospowers.config.json。",
  "_dept": "<dept>",
  "_version": "1.0.0",

  "templates": {
    "system-requirement": "{{PLUGIN_ROOT}}/templates/system-requirement-template.md",
    "system-design":      "{{PLUGIN_ROOT}}/templates/system-design-template.md"
  },

  "rules": {
    "coding-standards": "{{PLUGIN_ROOT}}/rules/coding-standards/",
    "design-review":    "{{PLUGIN_ROOT}}/rules/design-review/",
    "dfx":              "{{PLUGIN_ROOT}}/rules/dfx/"
  },

  "evaluators": {
    "aireq":     "<dept>-aireq-evaluator",
    "sysreq":    "<dept>-sysreq-evaluator",
    "sysdesign": "<dept>-sysdesign-evaluator"
  },

  "kb": {
    "skill": "<dept>-kb-query"
  }
}
```

**占位符约定：**
- `{{PLUGIN_ROOT}}` — 运行时替换为 Plugin 在本地的实际安装路径（由 cospowers-configure 或工具链处理）
- 未覆盖的字段保持 cospowers 默认值，不需要在 patch 文件中声明

---

#### 4.2.5 Plugin 安装与激活流程

```
1. 发布 Plugin 到 Git 仓库（或内部 Plugin Registry）
   git@git.sangfor.com:ai-native/<dept>-cospowers-plugin.git

2. 项目成员安装 Plugin（Claude Code）
   /plugin install git@git.sangfor.com:ai-native/<dept>-cospowers-plugin.git

3. 应用配置覆盖
   运行 cospowers-configure skill，选择"导入部门 Plugin 配置"
   或手动将 cospowers.config.patch.json 内容 merge 到项目 cospowers.config.json

4. 验证
   运行 env-conflict-checker skill，确认部门 Plugin 与 cospowers 无冲突
```

---

## Ch.5 扩展点边界说明

### 5.1 可以做的

| 操作 | 类型 | 方式 |
|------|------|------|
| 构建开发/排障/单测/测试方法 Skill，在流程衔接点协同调用 | A 类 | Plugin 中的独立 SKILL.md，用户显式触发 |
| 替换文档模板，增加部门专属章节 | B 类 | 修改 `cospowers.config.json` → `templates.*` |
| 替换编码规范目录，加入语言特定规范 | B 类 | 修改 `cospowers.config.json` → `rules.coding-standards` |
| 替换质量评估器，追加业务专项规则 | B 类 | 修改 `cospowers.config.json` → `evaluators.*` |
| 接入部门内部知识库 | B 类 | 替换 `kb.skill` 为部门 Skill 名 |
| 接入部门 GitLab 实例 | 环境配置 | 配置 `env.GITLAB_TOKEN` / `env.GITLAB_TOKEN_PATH` |
| 禁用某个质量 Gate | B 类 | 将对应 evaluator 设为 `false` |

### 5.2 不能做的（Plugin Isolation 边界）

| 操作 | 原因 |
|------|------|
| 替换 `brainstorming`、`spec-commit`、`writing-plans` 等骨架 Skill | 骨架 Skill 的 SOP 是跨团队工作流一致性的基础；替换会破坏下游 Skill 的期望 |
| 向 cospowers Skill 文件中直接添加内容 | 修改核心 Skill 会与后续 cospowers 版本升级冲突 |
| 在 CLAUDE.md 中添加覆盖 cospowers 流程的指令 | 配置文件指令可能绕过 cospowers 的 HARD GATE，应通过 `env-conflict-checker` 检测并清理 |
| 注入自动触发的 PostToolUse hook 来拦截 cospowers Skill 执行 | Hook 拦截会破坏 cospowers 的状态机，导致流程卡死或跳步 |

---

## 附录：快速上手检查清单

业务部门接入 cospowers 扩展的推荐顺序：

```
# ── B 类：知识型内容 ─────────────────────────────────────────
□ Step 1  确认 cospowers >= 0.1.3 已安装，/plugin list 可见
□ Step 2  运行 env-conflict-checker，确认当前环境无冲突
□ Step 3  整理部门编码规范为 Markdown，放入 rules/coding-standards/
□ Step 4  整理 DFX 基线数字，放入 rules/dfx/（含具体数值，禁止模糊描述）
□ Step 5  基于内置模板扩展文档模板，追加专属章节（不删除原有必填章节）
□ Step 6  编写部门评估器 Skill（至少 sysreq 和 sysdesign 两个）
□ Step 7  运行 cospowers-configure，将路径/skill名填入 cospowers.config.json

# ── A 类：流程型 Skill ─────────────────────────────────────────
□ Step 8  梳理本团队的隐性开发 SOP，编写开发 Skill（至少一个核心语言/框架）
□ Step 9  梳理高频排障场景（DB/MQ/缓存/RPC 等），各编写一个排障 Skill
□ Step 10 编写单测 Skill：明确测试框架、mock 边界、命名约定、禁止反模式
□ Step 11 识别特殊测试需求（e2e/性能/合约），按需编写测试方法 Skill

# ── 发布 ────────────────────────────────────────────────────────
□ Step 12 用一个真实小项目跑完整流程，验证 A 类 + B 类协同效果
□ Step 13 将所有内容打包为 Plugin，发布到内部 Git 仓库
□ Step 14 通过 Plugin 安装方式分发给团队其他成员
```
