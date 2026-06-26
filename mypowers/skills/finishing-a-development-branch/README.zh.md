# Finishing a Development Branch — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

指导开发工作收尾：验证测试 -> 呈现选项 -> 执行选择 -> 清理。

## 流程

### 步骤 1：验证测试

```bash
npm test / cargo test / pytest / go test ./...
```

测试失败则停止，不进入下一步。

### 步骤 2：确定基准分支

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

### 步骤 3：呈现 4 个选项

1. **本地合并回基准分支** — checkout 基准分支 + pull + merge + 运行测试 + 删除特性分支
2. **推送并创建 MR** — push + 调用 `spec-commit` 第 7-8 步（GitLab API 创建 MR，复用上库规范模板描述）
3. **保持分支现状** — 用户稍后自行处理，保留 worktree
4. **丢弃工作** — 需用户键入"discard"确认

### 步骤 4：执行选择

按用户选择执行对应操作。

### 步骤 5：清理 Worktree

- 选项 1/2/4 — 清理 worktree
- 选项 3 — 保留 worktree

## 红旗

- 测试失败时继续操作
- 合并前不验证测试
- 不确认就删除工作
- 未经明确请求 force-push

## 关联 Skill

| Skill | 关系 |
|-------|------|
| `subagent-driven-development` | 所有任务完成后调用本 skill |
| `executing-plans` | 所有批次完成后调用本 skill |
| `using-git-worktrees` | 本 skill 清理由其创建的 worktree |
