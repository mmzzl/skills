# Brainstorming — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

将想法转化为完整的设计和规格说明。通过自然对话，先理解项目上下文，逐个提问细化想法，呈现设计并获得用户批准后才进入实施。

## 核心机制

### 硬门禁（HARD-GATE）

设计没通过之前，**禁止写任何代码**。防止 AI "手快"——AI 的本能是看到需求就开始写代码，这个门禁强制它先想清楚再动手。

### 反模式

即使是 todo 应用、单函数工具、配置修改，也要走 brainstorming。设计可以很短（几句话就够），但必须呈现给用户并获得批准。

## 检查清单

前 4 步适用于所有项目类型；**第 4 步完成后根据项目类型分叉**：

1. **探索项目上下文** — 读文件、文档、最近提交
2. **提供可视化伴侣**（可选） — 如果后面的问题涉及 UI/图表
3. **逐个提问** — 一次一个问题，理解目的/约束/成功标准
4. **评估复杂度并路由** — 决定项目类型，按下方路由表分叉

**企业项目：在第 4 步后直接调用 `requirement-analysis` 并停止。步骤 5-10 不适用。**

5. **提出 2-3 个方案**（仅创新/简单项目）— 带权衡和推荐；考虑 DFX 6 维度。涉及架构决策时调用 `daedalus-knowledge` 搜索知识库文档中的规范约束
6. **呈现设计** — 按章节呈现，每节后确认。**必须遵循团队模板**
7. **写设计文档** — 保存到 `docs/agent-rules/specs/`
8. **自审** — 检查占位符、矛盾、歧义
9. **用户审查** — 等用户确认
10. **转入实施** — 调用 `writing-plans`

## 复杂度路由

| 项目类型 | 判断条件 | 流程 |
|---------|---------|------|
| **简单项目** | 原型、单服务、< 3 模块 | brainstorming → writing-plans → executing-plans |
| **企业项目** | 多服务、团队协作、需正式文档 | brainstorming 第4步后直接调用 requirement-analysis，brainstorming 结束。下游流水线：requirement-analysis → system-requirement-analysis → 设计阶段 brainstorming → overall-design → writing-plans |
| **Bug 修复 / 调试** | 用户报告 Bug、错误、测试失败、异常行为 | 调用 `systematic-debugging`，修复验证后询问用户是否通过 `daedalus-knowledge` 贡献方案到知识 Hub |

## DFX 6 维度

评估方案时要考虑：

| 维度 | 关键问题 |
|------|---------|
| 可调试性 | 出问题能快速定位吗？ |
| 可测试性 | 能独立高效测试吗？ |
| 可靠性 | 故障时还能工作吗？ |
| 可运维性 | 生产环境好维护吗？ |
| 可扩展性 | 扩展时不会破坏吗？ |
| 可复用性 | 组件能跨项目共享吗？ |

## 设计文档模板

设计文档**必须**遵循团队标准模板，不得自由发挥章节结构。

| 模板 | 路径 | 适用场景 |
|------|------|---------|
| AI 需求模板 | `templates/ai-requirement-template.md` | 需求分析（`requirement-analysis`） |
| 系统需求文档模板 | `templates/system-requirement-template.md` | 系统需求（`system-requirement-analysis`） |
| 系统级设计文档模板 | `templates/overall-design-template.md` | 系统级设计（复杂项目） |
| 子系统级设计文档模板 | `templates/module-design-template.md` | 子系统级设计（简单项目） |
| OpenAPI 规范模板 | `templates/openapi-template.yaml` | API 接口定义 |

**关键规则：**
1. 所有章节不得为空（不涉及写"不涉及 & 原因"）
2. ⭐必填章节必须包含 Mermaid 图 + 文字说明
3. 数据库表结构用 SQL DDL，不用 Markdown 表格
4. 遵循模板中 `[AI可读性要求]` 标注的格式

## 规格文档评审

写完规格文档后，自审分两步：

1. **内联自查** — 检查占位符、矛盾、歧义、范围是否聚焦
2. **派遣子代理评审** — 使用 `skills/brainstorming/agents/spec-document-reviewer-prompt.md` 模板派遣独立子代理。评审只标记会真正影响计划的问题，返回 `Approved` 或 `Issues Found`

独立评审视角能发现内联自审遗漏的矛盾和歧义。

## 可视化伴侣

`scripts/` 目录提供本地 HTTP + WebSocket 服务器，用于在头脑风暴中展示 UI 原型、架构图、选项对比。

```bash
# 启动（Windows 需在 Bash tool 设置 run_in_background: true）
scripts/start-server.sh --project-dir /path/to/project

# 返回 JSON，包含 URL、screen_dir、state_dir
# 告知用户打开返回的 URL

# 停止
scripts/stop-server.sh $SESSION_DIR
```

- **每个问题单独决定**是否使用浏览器 — UI布局/架构图比较用浏览器，文字选项/权衡讨论用终端
- 详细使用说明见 `skills/brainstorming/references/visual-companion.md`



- 一次一个问题，不要淹没用户
- 优先多选题
- 严格 YAGNI — 去掉不必要的功能
- 总是提 2-3 个方案再做决定
- 渐进验证 — 每节设计获得批准后再继续

## 三种项目类型的终态

| 项目类型 | brainstorming 终态 |
|---------|------------------|
| 创新/单服务项目 | 调用 `writing-plans` |
| 企业项目 | 调用 `requirement-analysis` 后结束 |
| Bug 修复 | 调用 `systematic-debugging`修复验证后结束（可选贡献知识 Hub） |
