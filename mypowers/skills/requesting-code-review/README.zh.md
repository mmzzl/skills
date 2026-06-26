# Requesting Code Review — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

派发 code-reviewer 子代理在问题扩散前发现问题。审查者获得精心构造的上下文，而非你的会话历史——保持审查者聚焦于工作产出，同时保留你自己的上下文。

**核心原则：** 早审查，勤审查。

## 何时请求审查

### 强制

- subagent-driven-development 中每个任务完成后
- 完成重大功能后
- 合并到 main 之前

### 可选但有价值

- 卡住时（换个视角）
- 重构前（基线检查）
- 修复复杂 bug 后

## 请求方式

### 1. 获取 git SHA

```bash
BASE_SHA=$(git rev-parse HEAD~1)  # 或 origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

### 2. 派发 code-reviewer 子代理

使用 Task 工具，填充 `code-reviewer.md` 模板。

**审查者必须读取并应用以下团队规范：**

| 规范文件 | 用途 |
|---------|------|
| `rules/coding-standards/code-review-error-rules.md` | E 规则检查（安全/异常/资源/命名/并发/API/DFX） |
| `rules/coding-standards/code-review-checklist.md` | 11 类审查清单 |
| 语言专属 checklist（Python/Go/Shell） | 语言特定规范 |
| `rules/testing-standards/单元测试规范.md` | 测试规范（三高优先级） |

| 占位符 | 内容 |
|--------|------|
| `{WHAT_WAS_IMPLEMENTED}` | 刚构建了什么 |
| `{PLAN_OR_REQUIREMENTS}` | 应该做什么 |
| `{BASE_SHA}` | 起始 commit |
| `{HEAD_SHA}` | 结束 commit |
| `{DESCRIPTION}` | 简要摘要 |

### 3. 处理反馈

| 严重级别 | 处理方式 |
|---------|---------|
| Critical | 立即修复 |
| Important | 继续前修复 |
| Minor | 记录稍后处理 |
| 审查者有误 | 用技术理由反驳 |

## 与工作流的集成

- **Subagent-Driven Development**：每个任务后审查
- **Executing Plans**：每批（3 个任务）后审查

## 红旗

- 因为"很简单"跳过审查
- 忽略 Critical 问题
- 带着未修复的 Important 问题继续
- 对合理的技术反馈争辩

## 模板

参见 `requesting-code-review/code-reviewer.md`
