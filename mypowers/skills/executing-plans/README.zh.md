# Executing Plans — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

加载计划、批判性审查、执行所有任务、完成后报告。适用于在独立会话中按计划逐步执行实施工作。

**建议：** 如果平台支持子代理（如 Claude Code、Codex），推荐使用 `subagent-driven-development` 代替本 skill，质量更高。

## 团队编码规范

- **Git 提交**：所有提交走 `spec-commit`
- **知识 Hub**：遇到技术问题先搜索 `daedalus-knowledge`
- **禁止 `git add -A`**：逐个添加文件，排除 `agent-rules/` 目录
- **分离关注点**：不同目的的变更分开提交

编码规范（E 规则、语言约定、格式化）由 `code-compliance-check`（Step 6）统一检查。DFX 约束和测试质量由 `code-reviewer`（Step 5）检查。不再单独自检。

## 执行流程

### 步骤 1：加载和审查计划

1. 读取计划文件
2. 批判性审查——有问题先与用户沟通
3. 无问题则创建 TodoWrite 并开始

### 步骤 2：执行任务

**执行前**：记录 `T_EXEC_START` 时间打点到 `time-stats.log`

每个任务：
1. 标记为进行中
2. 读取计划头部的代码约定（Conventions 章节）
3. 每个实现步骤严格遵循 TDD 循环（`test-driven-development`）
4. **verification-before-completion** — 跑测试（C1 新测试 + C2 关联模块），出示证据
5. **规格合规审查** — 对照 tasks.md 需求验证实现，参考 `spec-reviewer-prompt.md`（最多 3 轮）
6. **派发 code-reviewer 子代理** — 检查代码结构、测试质量、场景覆盖、容错降级、DFX 约束（最多 3 轮）
7. **code-compliance-check** — KB 语义 + lint 统一入口（仅 SCC/SCP/SKYOPS）
8. 按 `spec-commit` 提交
9. 标记为完成

### 步骤 3：完成执行

所有任务完成后：
1. 记录 `T_FIRST_COMPLETE` 时间打点
2. **派发最终代码审查** — 使用 `final-code-reviewer-prompt.md`，跨任务检查
3. **运行全量测试** + API 测试
4. 调用 `finishing-a-development-branch` 完成收尾

## 时间打点

| 打点 | 时机 | 文件 |
|------|------|------|
| `T_EXEC_START` | 加载计划后、首任务前 | `docs/agent-rules/spec_developer/output/time-stats.log` |
| `T_FIRST_COMPLETE` | 所有任务完成、输出 COMPLETE 前 | 同上 |

> 此文件由 planner 创建，executor 追加，committer 读取用于生成 `[TIME-STATS]` 块。

## 何时停下来求助

- 遇到阻塞（缺依赖、测试失败、指令不清）
- 计划有关键缺口
- 验证反复失败
- 不理解某个指令

**宁可问清楚，不要靠猜。**

## 关联 Skill

| Skill | 作用 |
|-------|------|
| `using-git-worktrees` | 开始前设置隔离工作区 |
| `writing-plans` | 创建本 skill 执行的计划 |
| `verification-before-completion` | 每任务完成后出示验证证据 |
| `requesting-code-review` | 每任务代码审查 |
| `finishing-a-development-branch` | 全部验证通过后的收尾 |

## 领域 Skill（实施过程中按需调用）

### 编码 Skill

| Skill | 使用场景 | 限制 |
|-------|---------|------|
| `python-backend-developer` | 编写 Python 后端代码 | 自动识别 Py2/Py3。只管代码质量，不管测试和 git |
| `go-backend-developer` | 编写 Go 后端代码 | 遵循 Go 编码规范。只管代码质量，不管测试和 git |
| `sf-apidesc-datamodels-design` | 设计 SCC/SCP Python 服务的 API 接口 | 使用 `sf_apidesc` 库。**SCC/SCP 平台专属** |
| `service-api-calling-design` | 调用其他服务 API 的需求分析和设计 | 分析远程 API 可行性、参数映射。**SCC 平台专属** |
| `scc-database-schema-query` | 查询数据库表结构 | 确定表名、数据源（MySQL/ES/MongoDB）。**SCC 平台专属** |

### 数据库迁移 Skill

| Skill | 使用场景 | 限制 |
|-------|---------|------|
| `python-db-migration` | Python 项目数据库迁移 | 遵循项目迁移框架约定 |
| `go-db-migration` | Go 项目数据库迁移 | 含探索结构→模型定义→MySQL 实现→迁移脚本→自验证 |

### 测试 Skill

| Skill | 使用场景 | 限制 |
|-------|---------|------|
| `test-driven-development` | **所有实现** — 先写测试再写代码 | 强制，所有功能和 Bug 修复必须遵循 |
| `unittest-mock-realdata` | 需要真实业务数据的单测 | 从 DB Schema 构造数据。**SCC 平台专属** |
| `unittest-for-api-call` | 远程服务调用的单测 | Mock HTTP 响应。**SCC 平台专属** |
| `test-code-generator` | 从测试用例文档生成测试代码 | 产出 go test / pytest 代码 |
| `acmp-api-testing` | 执行 SCP/SCC API 集成测试 | 需要测试环境和 config.json 凭据。**SCC/SCP 平台专属** |

### 选择逻辑

```
写代码 → Python: python-backend-developer / Go: go-backend-developer
查数据库 → scc-database-schema-query
调远程 API → service-api-calling-design
数据库迁移 → Python: python-db-migration / Go: go-db-migration
写单测 → 业务数据: unittest-mock-realdata / 远程调用: unittest-for-api-call
生成测试 → test-code-generator
API 集成测试 → acmp-api-testing
```

**平台限制：** SCC/SCP 标记的 skill 仅适用于深信服 SCC（托管云）或 SCP（超融合）产品。
