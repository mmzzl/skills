# Using Spec-Developer — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

每次会话启动时加载的基础 skill，规定了如何发现和使用其他 skill。核心要求：**在任何响应（包括澄清问题）之前，必须先调用 Skill 工具检查是否有适用的 skill。**

子代理（subagent）模式下可跳过本 skill。

## 为什么 SKILL.md 必须保持在 5.5KB 以下

SessionStart hook 将 SKILL.md 全文注入为 `additionalContext`。Claude Code 对 hook 输出有截断阈值（约 8KB），超过后 AI 只看到 2KB 的 preview，核心指令完全丢失。**SKILL.md 必须保持在 5.5KB 以下**，确保内容完整呈现不被截断。

## 指令优先级

| 优先级 | 来源 |
|--------|------|
| 最高 | 用户显式指令（CLAUDE.md / GEMINI.md / AGENTS.md / 直接请求） |
| 中等 | Spec-developer skills |
| 最低 | 默认系统提示 |

用户指令与 skill 冲突时，以用户为准。

## 技能调用方式

| 平台 | 方式 |
|------|------|
| Claude Code | `Skill` 工具 |
| Copilot CLI | `skill` 工具（与 Claude Code 的 Skill 工具相同） |
| Gemini CLI | `activate_skill` 工具 |
| 其他平台 | 参考各平台文档 |

非 Claude Code 平台的工具映射见 `references/copilot-tools.md`（Copilot CLI）和 `references/codex-tools.md`（Codex）。

## 核心规则

**哪怕只有 1% 的可能性某个 skill 适用，就必须调用它。** 调用后发现不适用可以不用，但不能跳过调用。

调用流程：
1. 收到用户消息 → 判断是否有适用 skill
2. 有则调用 Skill 工具 → 声明 "Using [skill] to [purpose]"
3. skill 有 checklist → 创建 TodoWrite → 严格遵循 skill 内容

EnterPlanMode 前：先检查是否已 brainstorm，没有则先调用 brainstorming skill。

## 红旗思维（合理化陷阱）

以下想法说明 AI 在合理化跳过 skill：

| 想法 | 现实 |
|------|------|
| "这只是个简单问题" | 问题也是任务，检查 skill |
| "我需要先了解上下文" | skill 检查在澄清问题之前 |
| "让我先看看代码" | skill 会告诉你怎么看 |
| "这不需要正式流程" | 有 skill 就用 |
| "我记得这个 skill" | skill 会迭代，读最新版 |
| "这个 skill 太重了" | 简单的事会变复杂，用它 |
| "先做这一件事" | 检查在任何动作之前 |
| "这不算一个任务" | 任何动作 = 任务，检查 skill |
| "这样做很有效率" | 无纪律的行动浪费时间，skill 防止这一点 |
| "我知道是什么意思了" | 知道概念 ≠ 调用 skill |

## Skill 优先级

1. **流程类 skill 优先**（brainstorming、debugging）— 决定如何处理任务
2. **实施类 skill 其次**（frontend-design、mcp-builder）— 指导具体执行

- "Let's build X" → 先 brainstorming，再实施 skill
- "Fix this bug" → 先 debugging，再领域 skill

**刚性 skill**（TDD、debugging）：严格遵循，不可变通。**柔性 skill**（模式类）：原则适配上下文，skill 本身会说明属于哪种。

## 团队强制规则

> 这部分规则在 CLAUDE.md 中有完整定义，此处仅为参考摘要。

### Git 提交规则
所有 git commit 必须遵循 `spec-commit`：AI 标签前缀、保护分支检测、提交类型标识、结构化消息、推送规则（不自动 push，不 push 到保护分支）。

### 知识滚轮规则
解决技术问题前必须调用 `daedalus-knowledge` 搜索团队知识 Hub。7 个触发条件见 CLAUDE.md。搜索关键词**必须使用中文**。

### 知识归档规则
任何阶段，如果用户提供了 AI 独立无法发现的隐式领域知识（纠正假设、未文档化变通方案、历史决策说明，或经过 ≥3 轮澄清才找到方向），必须询问用户是否归档到知识 Hub。**快速判断：** "下次 AI 能自己搞定吗？" — 不能则询问归档。

## 复杂度路由

| 项目类型 | 判断条件 | 流程 |
|---------|---------|------|
| **创新/单服务** | 原型、单服务、< 3 模块 | `brainstorming → writing-plans → executing-plans` |
| **端到端团队项目** | 多服务、团队协作、需正式文档 | `requirement-analysis → system-requirement-analysis → overall-design-spec → module-design-spec → writing-plans → executing-plans` |
| **Bug 修复/调试** | 报错、测试失败、异常行为 | `systematic-debugging → (验证修复) → daedalus-knowledge` |

不确定时，询问用户偏好。

## 用户指令原则

指令说的是 WHAT（做什么），不是 HOW（怎么做）。"Add X" 或 "Fix Y" 不意味着跳过工作流。
