# Using Git Worktrees — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

Git worktree 创建共享同一仓库的隔离工作区，允许同时在多个分支上工作而无需切换。

**核心原则：** 系统化目录选择 + 安全验证 = 可靠隔离。

## 目录选择流程（优先级）

1. **检查已有目录**：`.worktrees`（首选，隐藏） 或 `worktrees`
2. **检查 CLAUDE.md**：查找 worktree 目录偏好
3. **询问用户**：无已有目录且无偏好时

## 安全验证（强制）

创建 worktree 前**必须**验证目录已被 git 忽略：

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

未忽略则：添加到 `.gitignore` 并提交，再继续。

## 创建步骤

1. **检测项目名称** — `basename "$(git rev-parse --show-toplevel)"`
2. **创建 Worktree** — `git worktree add "$path" -b "$BRANCH_NAME"`
3. **运行项目安装** — 自动检测：package.json -> npm install, Cargo.toml -> cargo build, 等
4. **验证干净基线** — 运行测试确保 worktree 起点正常
5. **报告位置** — 输出完整路径、测试结果、就绪状态

## 红旗

- 创建 worktree 前不验证已被忽略
- 跳过基线测试验证
- 测试失败不问用户就继续
- 目录位置不明确时自行假设

## 关联 Skill

| Skill | 关系 |
|-------|------|
| `brainstorming` | 设计通过后实施时调用本 skill |
| `subagent-driven-development` | 执行任务前调用本 skill |
| `executing-plans` | 执行任务前调用本 skill |
| `finishing-a-development-branch` | 工作完成后清理 worktree |
