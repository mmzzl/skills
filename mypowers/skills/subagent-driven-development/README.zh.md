# Subagent-Driven Development — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

通过为每个任务派发独立子代理来执行计划，每个任务完成后经过两级审查门禁（规格合规 → 代码质量），全部任务完成后执行最终代码审查和测试验证确保质量达标。

**核心原则：** 每个任务独立子代理 + 每任务两级审查门禁 + 最终代码审查 + 测试验证 = 高质量、快迭代

## 适用场景

- 有实施计划
- 任务大部分独立
- 在当前会话中执行

不满足则考虑 `executing-plans`（独立会话）或先做 brainstorming。

## 执行流程

### 准备阶段

读取计划、提取所有任务全文、记录上下文、创建 TodoWrite。记录 `T_EXEC_START` 时间打点。

### 每个任务循环

1. **派发实施子代理**（`./implementer-prompt.md`）
2. 子代理有问题？-> 回答后重新派发
3. 子代理实施、测试、提交、自审
4. **Gate 1 — 规格合规审查**（`./spec-reviewer-prompt.md`）
   - 派发 spec-reviewer 子代理，验证实现是否符合需求
   - **PASS** → 进入 Gate 2
   - **FAIL** → 修复问题 → 重新派发 implementer → 重新派发 spec-reviewer（最多 3 轮）
5. **Gate 2 — 代码质量审查**（`./code-quality-reviewer-prompt.md`）
   - 仅 Gate 1 通过后派发，检查代码结构/架构、测试质量、场景覆盖、容错降级、注释质量
   - **编码规范（E 规则、语言约定）由 code-compliance-check 统一检查，Gate 2 不重复**
   - **PASS** → 进入 code-compliance-check
   - **FAIL** → 修复问题 → 重新派发 implementer → 重新派发 code-quality-reviewer（最多 3 轮）
6. **Code Compliance Check** — KB 语义检查 + lint 自动修复
   - 通过时写入 `compliance-cache.json`，供 `spec-commit` Step 0 跳过已检查文档
   - （仅 SCC / SCP / SKYOPS 项目）
7. **verification-before-completion** — 出示验证证据 → 标记任务完成
8. 任一审查超过 3 轮未通过 → `AskUserQuestion` 请求人工介入

### 每个任务门禁流程

```
implementer → spec-reviewer → PASS? ──yes→ code-quality-reviewer → PASS? ──yes→ code-compliance-check → PASS? ──yes→ verification-before-completion → mark complete
                  │no                            │no                              │no
                  ↓                              ↓                                ↓
              fix issues                    fix issues                      fix issues
                  │                              │                                │
                  └── retry (max 3) ────────→ retry (max 3) ──────────────→ retry (max 3)
```

### 全部任务完成后 — 最终审查 + 测试验证

记录 `T_FIRST_COMPLETE` 时间打点，输出 `COMPLETE`：

1. **派发最终代码审查子代理**（使用 `./final-code-reviewer-prompt.md`）：
   - 范围：`git diff <plan-start-commit>..HEAD`（所有任务累计变更）
   - 关注跨任务问题：架构一致性、数据流对齐、风格统一、整体代码健康度、需求-设计一致性、DFX
   - 通过 → 进入测试验证；不通过 → 修复 → 重新审查（最多 3 轮）
2. 执行测试验证：
   - 运行全部单测：`pytest tests/ -v` 或 `go test ./... -v`
   - 运行 API 测试（如适用）
   - 验证正常/边界/异常场景覆盖度
   - 测试结果记录到 tasks.md（`## 测试验证记录`）

### 最终审查 + 测试验证重试循环

- 全部通过 → 调用 `finishing-a-development-branch`
- 任一失败 → 修复 → 从受影响任务的 Gate 1 重走 → 最多 3 轮
- 超过 3 轮仍未通过：`AskUserQuestion` 请求人工介入

## 时间打点

| 打点 | 时机 | 文件 |
|------|------|------|
| `T_EXEC_START` | 加载计划后、首任务前 | `docs/agent-rules/spec_developer/output/time-stats.log` |
| `T_FIRST_COMPLETE` | 所有任务完成、输出 COMPLETE 前 | 同上 |

## 模型选择

用能胜任的最低功耗模型：

| 角色 | 模型选择 |
|------|---------|
| 实施（1-2 文件，规格完整） | 便宜模型 |
| 实施（多文件，有集成关注点） | 标准模型 |
| 实施（需要设计判断或全局代码库理解） | 最强模型 |
| 规格审查 | 标准模型 |
| 代码质量审查 | 标准模型 |
| 最终代码审查 | 标准模型 |

## 实施子代理状态处理

| 状态 | 处理方式 |
|------|---------|
| DONE | 进入 Gate 1（规格审查） |
| DONE_WITH_CONCERNS | 读关注点，正确性问题修复后再审查，观察性问题记录后进 Gate 1 |
| NEEDS_CONTEXT | 提供缺失上下文，重新派发 |
| BLOCKED | 评估阻塞原因：提供上下文 / 用更强模型 / 拆分任务 / 升级给用户 |

## 提示模板

- `./implementer-prompt.md` — 实施子代理（不负责编码规范自检，由 code-compliance-check 统一检查）
- `./spec-reviewer-prompt.md` — 规格合规审查子代理（Gate 1）
- `./code-quality-reviewer-prompt.md` — 代码质量审查子代理（Gate 2，检查结构/测试/场景/容错，不重复检查编码规范）
- `code-compliance-check` — 统一编码规范检查（KB 语义 + lint 自动修复 + 合规缓存写入）
- `./final-code-reviewer-prompt.md` — 最终代码审查子代理（全部任务完成后，跨任务审查）

## 红旗

- 在 main/master 分支上开始实施（未经用户同意）
- **跳过审查门禁**（Gate 1 + Gate 2 + code-compliance-check 均为强制）
- **跳过全部任务完成后的最终代码审查**
- Gate 1 未通过就派发 Gate 2
- 审查 FAIL 后不修复就标记完成
- Gate 2 PASS 后跳过 code-compliance-check
- code-compliance-check PASS 后跳过 verification-before-completion
- 超过 3 轮重试不升级给用户
- 并行派发多个实施子代理（会冲突）
- 让子代理读取计划文件（应提供全文）
- 审查发现问题后不重新审查
- 全部检查未通过就进入 `finishing-a-development-branch`

## 关联 Skill

| Skill | 作用 |
|-------|------|
| `using-git-worktrees` | 开始前设置隔离工作区 |
| `writing-plans` | 创建本 skill 执行的计划 |
| `verification-before-completion` | code-compliance-check 通过后出示验证证据 |
| `requesting-code-review` | Gate 2 + 最终审查子代理使用的模板 |
| `code-compliance-check` | Gate 2 通过后的统一编码规范检查（KB 语义 + lint + 缓存） |
| `finishing-a-development-branch` | 全部验证通过后的收尾 |
| `spec-commit` | implementer 子代理提交遵循结构化提交格式 |
| `test-driven-development` | 子代理遵循 TDD |
