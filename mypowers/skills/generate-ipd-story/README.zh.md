---
name: generate-ipd-story
description: 从已完成的系统需求文档生成 IPD 格式 Epic/Feature/Story 文档，供人工阅读参考
metadata:
  type: reference
---

# generate-ipd-story

从已完成的系统需求文档（9 章结构）生成 IPD 格式的 AI 需求文档（Epic → Feature → Story 层级），使用 `templates/ipd-story-template.md` 模板，内置 `aireq-evaluator` 质量门控。

## 触发时机

- `system-requirement-analysis` 的 Step 2.3 完成系统需求文档写作后，自动作为**后台并行 subagent** 被 dispatch（使用 `agents/dispatch-prompt.md`）
- 用户在对话中直接要求从已有系统需求文档生成 E/F/S 文档时，也可单独调用

## 与 requirement-analysis 的区别

| 维度 | requirement-analysis | generate-ipd-story |
|---|---|---|
| 输入 | 原始需求（XMind/PRD/用户描述） | 已完成的系统需求文档（REQ 条目） |
| 输出 | E/F/S 文档（用户视角） | E/F/S 文档（从 REQ 反向推导） |
| 触发方式 | 用户直接触发 | system-requirement-analysis 自动 dispatch |
| 执行模式 | 主线程交互式 | 后台 subagent（Step 2 跳过用户确认） |

## 输入路径

`docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-<project>/`（传入 `sysreq_dir` 参数，或自动取最新目录）

## 输出路径

`docs/agent-rules/1-ai-requirements/output/YYYY-MM-DD-<project>-requirements.md`

## 质量门控

内置调用 `aireq-evaluator`：
- Grade ≥ B（≥80）：直接完成
- Grade C：自动修复 Error+ 问题后重评，循环直至 ≥ B
- Grade D/F：停止重试，向调用方报告根因

## REQ → Story 映射逻辑

- 按 Ch.2 业务场景分组 → Feature
- 每条 REQ 条目 → 一个（或多个）Story
- Story 的【场景说明】末尾注明 `来源：REQ-XXX`
- REQ 优先级 P0/P1/P2 → 🔴/🟡/🟢 handoff 标记
