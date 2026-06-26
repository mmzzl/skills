# cospowers Plugin

适用于 Claude Code 及兼容 AI Agent 的通用 AI 原生端到端开发工作流插件。以 `brainstorming` 为中央路由器，自适应分流至三条工作流：小微项目、增量项目、排障。

## 工作流路由

| 路由 | 触发场景 | 管线 |
|------|---------|------|
| **小微项目** | 单模块、范围小，不涉及跨模块交互 | brainstorming → writing-plans-detail → [execution] → spec-commit |
| **增量项目 A**<br>（无用户需求文档） | 企业级、多服务项目，仅有原始想法/会议记录/口头需求 | brainstorming → **requirement-analysis** `⑤aireq-evaluator` → system-requirement-analysis `⑤sysreq-evaluator` → overall-design-spec `⑤sysdesign-evaluator` → module-design-spec `⑤subsystem-evaluator` `⑤doc-quality-evaluator` → writing-plans → [执行] → spec-commit |
| **增量项目 B**<br>（已有用户需求文档） | 产品团队已产出结构化需求文档（含编号章节、功能分类、验收条件等） | brainstorming → **system-requirement-analysis** `⑤sysreq-evaluator` → overall-design-spec `⑤sysdesign-evaluator` → module-design-spec `⑤subsystem-evaluator` `⑤doc-quality-evaluator` → writing-plans → [执行] → spec-commit |
| **排障** | Bug 报告、测试失败、异常行为 | brainstorming → systematic-debugging → test-driven-development → verification-before-completion → spec-commit |

> **增量项目路由判断**：`brainstorming` 会询问用户是否已有书面需求文档。
> - **没有** → 走路线 A，先由 `requirement-analysis` 生成 Epic/Feature/Story 结构化需求文档
> - **已有** → 走路线 B，直接进入 `system-requirement-analysis` 做系统需求细化，跳过重复分析

### 质量评估层（增量路线内嵌）

每个文档生成步骤完成后，都有内嵌的两级质量门控：

| 步骤 | 第一级（轻量 subagent review） | 第二级（质量 Gate，评分 ≥ B = 80） |
|------|-------------------------------|--------------------------------|
| `requirement-analysis` | 结构完整性快速自检（inline） | `aireq-evaluator`：33 条规则（REQ-AI-01~33）+ 4 红线 |
| `system-requirement-analysis` | `system-requirement-reviewer` 子 Agent：阻断级缺陷扫描 | `sysreq-evaluator`：75 条规则（REQ-01~38 + AIN-01~16 + FN-01~04 + IA-01~05 + SUP-01~09）+ 3 红线 |
| `overall-design-spec` | `design-document-reviewer` 子 Agent：完整性/一致性检查 | `sysdesign-evaluator`：M1/M2/M3/M5/M6 规范 + 12 SYS- 内置项 + 3 红线 |
| `module-design-spec`（每次） | `design-document-reviewer` 子 Agent | `subsystem-evaluator`：M1/M4/M5/M6 规范 + 9 SUB- 内置项 + FMEA + 3 红线 |
| `module-design-spec`（最后一个子系统） | — | `doc-quality-evaluator`：跨文档一致性（REQ追踪/方案一致/API契约/DFX数字/子系统边界） |

> `aireq-evaluator`、`sysreq-evaluator`、`sysdesign-evaluator`、`subsystem-evaluator`、`doc-quality-evaluator` 位于 `agent-rules` 共享仓库，不在本仓库 `skills/` 目录中。

## 流水线阶段明细

各阶段按顺序串联，每个阶段有明确的入口、产物和结束标识。

| # | 阶段 | 入口 | 核心产物 | 结束标识 |
|---|------|------|----------|----------|
| 1 | **需求分析** | `requirement-analysis` | `docs/agent-rules/1-ai-requirements/output/YYYY-MM-DD-<project>-requirements.md` | ① AI 提示 "质量评估通过（等级 X）"<br>② AI 提示 "请用户评审" |
| 2 | **系统需求** | `system-requirement-analysis` | `docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-<project>/`（9 章 + index.md）<br>`docs/agent-rules/2-system-requirements/output/ipd-story/YYYY-MM-DD-<project>/`（后台生成） | ① AI 提示 "系统需求质量关卡已通过（等级 X）"<br>② AI 提示 "IPD Epic/Feature/Story 文档生成已在后台启动"<br>③ AI 提示 "请用户评审" |
| 3 | **总体设计** | `overall-design-spec` | `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/`<br>├ `technical-requirements-design/`（TRD）<br>├ `index.md` + `ch02~ch11`（10 章 + index）<br>└ `<project>-openapi.yaml` | ① AI 提示 "质量评估通过（等级 X）"<br>② AI 提示 "请用户评审" |
| 4 | **模块设计** | `module-design`<br>（每模块独立执行；根据 `DESIGN_MODE` 路由到 `module-design-spec` 或 `module-design-brief`） | detail：`docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module>/`（方案选型 + 8 章 + database-design.md）<br>brief：`.../<module>/module-design-brief.md`（合并单文件） | ① AI 提示 "质量评估通过（等级 X）"<br>② AI 提示 "请用户评审" |
| 5 | **实现计划** | `writing-plans`<br>（根据 `DESIGN_MODE` 路由到 `writing-plans-detail` 或 `writing-plans-brief`） | detail 系统模式：`docs/agent-rules/plans/YYYY-MM-DD-<feature-name>.md`<br>detail 子系统模式：`docs/agent-rules/plans/YYYY-MM-DD-<project>/<name>-<service>-plan.md`<br>brief：`.cospowers/plans/YY-MM-DD-<project>/`（`index.md` + `dag.json` + `tasks/`） | ① AI 提示 "计划评估通过（等级 X）"<br>② 自动衔接执行阶段 |
| 6 | **执行** | 自动衔接 | `.cospowers/tasks/<task-id>/`（`manifest.json`、`results.md` 等 5 文件）<br>`.cospowers/execution/`（`run-state.json`、`final-review.md` 等） | ① 所有任务 `DONE`<br>② 最终审查 + 验证 PASS<br>③ 自动衔接 `finishing-a-development-branch` |
| 7 | **提交合入** | `spec-commit` | Git commit（含合规报告） + `git push` + GitLab MR | ① AI 输出 commit hash + 分支名<br>② AI 提示 "MR 创建成功" + MR 链接 |

## 安装

### Claude Code 插件方式

```bash
# 添加插件市场
/plugin marketplace add git@git.sangfor.com:ai-native/cospowers/cospowers.git

OR

/plugin marketplace add https://git.sangfor.com/ai-native/cospowers/cospowers.git

# 安装插件
/plugin install cospowers
```

### 手动安装

将 `hooks/hooks.json` 中的 hook 配置合并到项目的 `.claude/settings.json`。

## 配置

所有配置项均为**可选**。推荐使用 `cospowers-configure` skill 进行交互式配置，它会将结果写入插件根目录的 `cospowers.config.json`。

### `project.product`

**用途**：产品标识符，传入 Daedalus 查询接口的 `product` 参数，将知识库和合规检查结果限定到本产品范围。

**使用位置**：
- `skills/daedalus-knowledge/SKILL.md` — 查询时自动附带 product 参数
- `skills/code-compliance-check/SKILL.md` — 查询编码规范时限定产品范围
- `skills/spec-commit/SKILL.md` — 提交前合规检查时限定产品范围

**未设置时的行为**：Daedalus 查询不限产品范围，返回全库结果。

**示例**（在 `cospowers.config.json` 中）：
```json
"project": { "product": "SCP" }
```

---

### 环境变量

以下环境变量均通过 `cospowers.config.json` 的 `env` 节配置，配置文件中的值优先于系统环境变量。

### `SPEC_DEVELOPER_SERVER_URL`

**用途**：使用分析上报（hooks）的后端服务地址。

**使用位置**：
- `hooks/skill_usage_report.py` — 上报 Skill 工具调用事件（PostToolUse hook）
- `hooks/usage_report.py` — 上报用户提示词事件（UserPromptSubmit hook）

**未设置时的行为**：hooks 以退出码 0 静默退出。

**示例**：
```bash
export SPEC_DEVELOPER_SERVER_URL=http://your-server:9008
```

---

### `DAEDALUS_URL`

**用途**：Daedalus 平台服务地址，用于知识合规检查和代码规范查询。

**使用位置**：
- `skills/spec-commit/SKILL.md` — 从 Daedalus 拉取适用文档，对照 diff 检查代码规范
- `skills/code-compliance-check/SKILL.md` — 查询编码规范
- `skills/daedalus-knowledge/SKILL.md` — 通用知识库查询

**未设置时的行为**：相关 skill 的远程查询步骤跳过，降级使用本地规范文件。

**示例**：
```bash
export DAEDALUS_URL=http://your-daedalus-server:8080
```

---

### `DAEDALUS_API_KEY`

**用途**：Daedalus 平台的 API 鉴权密钥。

**使用位置**：
- 所有查询 `DAEDALUS_URL` 的 skill — 作为 `X-API-Key` 请求头发送

**未设置时的行为**：请求不携带鉴权头（仅在 `DAEDALUS_URL` 已设置时有意义）。

**示例**：
```bash
export DAEDALUS_API_KEY=sk-your-api-key
```

---

### `GITLAB_TOKEN`

**用途**：GitLab 访问令牌，用于创建 MR、查询 MR 状态等 GitLab API 操作。

**使用位置**：
- `skills/spec-commit/SKILL.md` — 提交后自动创建或更新 Merge Request

**未设置时的行为**：spec-commit 跳过 MR 创建步骤，仅完成本地提交和 push。

**示例**：
```bash
export GITLAB_TOKEN=glpat-your-token
```

---

### `GITLAB_TOKEN_PATH`

**用途**：从文件读取 GitLab Token，替代直接设置 `GITLAB_TOKEN` 环境变量（更安全）。

**未设置时的行为**：回退使用 `GITLAB_TOKEN` 环境变量；两者均未设置则跳过 MR 创建。

**示例**：
```bash
export GITLAB_TOKEN_PATH=/run/secrets/gitlab-token
```

---

## Skills 清单（23 个）

| Skill | 职责 |
|-------|------|
| `using-spec-developer` | 入口点：指导如何使用 skill |
| `session-context` | 跨 compact/重启的会话状态持久化 |
| `brainstorming` | 中央路由器：评估复杂度，分发至对应工作流 |
| `requirement-analysis` | 原始需求 → Epic/Feature/Story 结构化需求 |
| `system-requirement-analysis` | AI 需求 → 系统需求（Given-When-Then，5 场景类型） |
| `overall-design-spec` | 特性级总体设计 + OpenAPI 规范 |
| `module-design-spec` | 各子系统实现设计文档 |
| `systematic-debugging` | 证据驱动的排障流程 |
| `writing-plans` | 实现计划编写 + 执行方式选择 |
| `executing-plans` | 当前会话内联计划执行（含质量门禁） |
| `subagent-driven-development` | 并行子 Agent 分发执行（推荐执行方式） |
| `spec-commit` | Git 提交 / 推送 / MR 创建全流程 |
| `code-compliance-check` | 提交前 lint 及编码规范检查 |
| `finishing-a-development-branch` | 开发分支收尾流程 |
| `verification-before-completion` | 完成前验证门禁 |
| `test-driven-development` | TDD：先写测试，再写实现 |
| `test-code-generator` | 从测试用例文档生成测试代码 |
| `requesting-code-review` | 派发代码评审子 Agent |
| `using-git-worktrees` | 隔离的 git worktree 管理 |
| `daedalus-knowledge` | 团队知识轮毂搜索与沉淀 |
| `mcp-builder` | MCP 服务器创建指南 |

## 许可证

MIT

---

## 业务部门扩展

cospowers 的工作流骨架通用不可改，但各业务部门可以在此之上叠加自己的 AI-Native 能力：

- **A 类（流程型）**：开发 SOP Skill、排障 Skill、单测 Skill、测试方法 Skill 等可执行的工作流知识
- **B 类（知识型）**：编码规范目录、文档模板、DFX 基线、自定义评估器等配置替换内容

以上内容统一打包为业务部门 Plugin，通过 `cospowers.config.json` 的扩展点接入，不修改 cospowers 核心 Skill。

**参考实现**：[dept-cospowers-plugin](https://git.sangfor.com/65883/dept-cospowers-plugin) — 提供了业务部门 Plugin 的目录结构、评估器模板、规范目录格式及 `cospowers.config.patch.json` 示例，可 fork 后按本部门需求定制。

