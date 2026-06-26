---
name: writing-plans
description: 当你有需求文档或规格说明、需要执行多步骤任务时使用——在编写代码之前创建实施计划
---

# writing plans

**Skill 标识**: `writing-plans`

其他 skill 通过 `writing-plans` 引用本 skill。本 skill 是规划流程的入口，根据项目配置决定使用哪种规划模式。

## 概述

本 skill 是实施计划编写的统一入口。它读取项目的设计模式配置，并将请求路由到对应的规划 skill。

**开始时声明:** "我正在使用 writing-plans skill 来设置实施计划。"

## 路由逻辑

### 步骤 1: 读取配置

读取插件根目录下的 `cospowers.config.json`（路径：`$CLAUDE_PLUGIN_ROOT/cospowers.config.json`），检查 `env.DESIGN_MODE` 字段。

### 步骤 2: 根据 DESIGN_MODE 路由

| DESIGN_MODE | 操作 |
|-------------|------|
| `"detail"` | 调用 `writing-plans-detail` skill — 全面规划，包含完整代码示例、测试用例、逐步 TDD 流程 |
| `"brief"` | 调用 `writing-plans-brief` skill — 轻量规划，聚焦任务拆分和关键决策 |
| 其他值 | 请用户选择模式，更新配置后路由 |
| 缺失（字段不存在） | 请用户选择模式，更新配置后路由 |

### 步骤 3: DESIGN_MODE 缺失或无效时

如果 `env.DESIGN_MODE` 缺失或值无法识别，询问用户：

**"你想使用哪种规划模式？"**

1. **Detail**（详细模式）— 详细实施计划，包含完整代码示例、测试用例、逐步骤 TDD 流程。适合复杂/正式项目。
2. **Brief**（轻量模式）— 轻量规划，聚焦任务拆分和关键决策，不包含完整代码细节。适合快速迭代和简单任务。

用户选择后，更新 `cospowers.config.json`：

```json
"env": {
  "DESIGN_MODE": "<detail 或 brief>",
  ...
}
```

然后调用对应的 skill（`writing-plans-detail` 或 `writing-plans-brief`）。

### 步骤 4: 调用目标 Skill

确定模式后，立即调用目标 skill：

- detail 模式 → 调用 `writing-plans-detail`
- brief 模式 → 调用 `writing-plans-brief`

**不要在本 skill 中继续执行** — 将所有后续工作交给目标规划 skill。

## 设计模式配置

`cospowers.config.json` 中的 `env.DESIGN_MODE` 字段控制使用哪种规划模式：

```json
{
  "env": {
    "DESIGN_MODE": ""
  }
}
```

- **`"detail"`**: 始终使用 `writing-plans-detail`，无需提示
- **`"brief"`**: 始终使用 `writing-plans-brief`，无需提示
- **缺失 / 其他值**: 首次使用时提示用户选择，之后保存选择

如需更改模式，可以：
- 直接在 `cospowers.config.json` 中修改 `DESIGN_MODE`
- 删除该字段以便再次被提示选择
- 使用 `cospowers-configure` skill

## 后续步骤

本 skill 的唯一职责是路由。路由完成后，所有工作由 `writing-plans-detail` 或 `writing-plans-brief` 处理。

目标规划 skill 将产出计划，之后由对应的执行 skill 执行：
- 详细计划 → `subagent-driven-development` 或 `executing-plans`
- 轻量计划 → `executing-plans-brief`
