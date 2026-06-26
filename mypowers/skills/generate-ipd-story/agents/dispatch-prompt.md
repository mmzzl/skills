# IPD Story 生成 Dispatch 提示模板

当从 `system-requirement-analysis` dispatch `generate-ipd-story` 子 agent 时使用本模板。

**用途：** 在独立后台上下文中，从已完成的系统需求目录生成 IPD 格式的 Epic/Feature/Story 文档，不占用主对话上下文。

**调用场景：**

| 调用方 | 触发时机 | 输入参数 |
|---|---|---|
| `system-requirement-analysis` 步骤 2.3 | 9 个章节文件全部写入输出目录后 | `sysreq_dir` = 输出目录路径 |

**执行模式：** 后台运行（`run_in_background: true`）。dispatch 后立即继续主流程，无需等待子 agent 完成。

```
Agent:
  subagent_type: "general-purpose"
  description: "从系统需求生成 IPD Epic/Feature/Story：[PROJECT_NAME]"
  run_in_background: true
  prompt: |
    你正在生成 IPD 格式的 AI 需求文档（Epic/Feature/Story）。

    **第一步：** 在做任何事之前，先使用 Skill tool 调用 `generate-ipd-story` skill。
    **第二步：** 严格按照 skill 的指引完成所有步骤。

    **系统需求目录：** [SYSREQ_DIR]

    将 [SYSREQ_DIR] 替换为实际输出目录路径，例如：
      docs/agent-rules/2-system-requirements/output/2026-05-12-my-project/

    需完成的 skill 步骤：
    - 步骤 0：定位系统需求目录
    - 步骤 1：加载 templates/ipd-story-template.md
    - 步骤 2：规划 E/F/S 结构——后台模式下跳过用户确认，直接按规划写入
    - 步骤 3：写入前自检规则
    - 步骤 4：写入输出文件

    **向父 agent 返回精简摘要：**

    ## IPD Story 生成结果

    **状态：** 完成 | 失败
    **输出路径：** [path/to/2-system-requirements/output/ipd-story/YYYY-MM-DD-xxx-ipd.md]
    **Epic 数量：** [N] | **Feature 数量：** [N] | **Story 数量：** [N]

    **失败原因（如有）：**
    - 根因：[发生了什么问题]
```

**父 agent 根据返回结果的处理方式：**

| 状态 | 操作 |
|---|---|
| **完成** | 记录 E/F/S 输出路径，纳入最终汇总告知用户 |
| **失败** | 告知用户："IPD Story 生成失败。[子 agent 返回的根因]。" |

**关于后台执行：** 子 agent 以无人值守方式运行，会跳过步骤 2 的用户确认。若用户希望在写入前审查 E/F/S 结构，请在主会话中直接调用 `generate-ipd-story`。
