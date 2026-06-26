---
name: module-design
description: 模块概要设计路由入口——根据 DESIGN_MODE 配置分发到完整概设或轻量概设
---

# 模块概要设计

**Skill 标识**: `module-design`

其他 skill 通过 `module-design` 引用本 skill。本 skill 是模块概要设计流程的入口，根据项目配置决定使用哪种设计模式。

## 概述

本 skill 是模块概要设计的统一入口。它读取项目的设计模式配置，并将请求路由到对应的设计 skill。

**开始时声明:** "我正在使用 module-design skill 来设置模块概要设计。"

## 路由逻辑

### 步骤 1：读取配置

读取插件根目录下的 `cospowers.config.json`（路径：`$CLAUDE_PLUGIN_ROOT/cospowers.config.json`），检查 `env.DESIGN_MODE` 字段。

### 步骤 2：根据 DESIGN_MODE 路由

| DESIGN_MODE | 操作 |
|-------------|------|
| `"detail"` | 调用 `module-design-spec` skill — 完整模块概要设计，包含方案选型、11 步全流程、评估器门禁 |
| `"brief"` | 调用 `module-design-brief` skill — 轻量模块设计，仅填写内部设计和数据库设计，其余章节标注"不涉及" |
| 其他值 | 请用户选择模式，更新配置后路由 |
| 缺失（字段不存在） | 请用户选择模式，更新配置后路由 |

### 步骤 3：DESIGN_MODE 缺失或无效时

如果 `env.DESIGN_MODE` 缺失或值无法识别，询问用户：

**"你想使用哪种模块概要设计模式？"**

1. **Detail**（完整模式）— 完整模块概要设计，包含方案选型、DFX 设计、自测用例、部署方案、评估器质量门禁。适合需要正式设计评审的模块。
2. **Brief**（轻量模式）— 轻量模块设计，仅填写内部设计（ch04）和数据库设计，其余章节标注"不涉及"。适合只需要内部设计文档的模块。

用户选择后，更新 `cospowers.config.json`：

```json
"env": {
  "DESIGN_MODE": "<detail 或 brief>",
  ...
}
```

然后调用对应的 skill（`module-design-spec` 或 `module-design-brief`）。

### 步骤 4：调用目标 Skill

确定模式后，立即调用目标 skill：

- detail 模式 → 调用 `module-design-spec`
- brief 模式 → 调用 `module-design-brief`

**不要在本 skill 中继续执行** — 将所有后续工作交给目标设计 skill。

## 设计模式配置

`cospowers.config.json` 中的 `env.DESIGN_MODE` 字段控制使用哪种设计模式：

```json
{
  "env": {
    "DESIGN_MODE": ""
  }
}
```

- **`"detail"`**: 始终使用 `module-design-spec`，无需提示
- **`"brief"`**: 始终使用 `module-design-brief`，无需提示
- **缺失 / 其他值**: 首次使用时提示用户选择，之后保存选择

如需更改模式，可以：
- 直接在 `cospowers.config.json` 中修改 `DESIGN_MODE`
- 删除该字段以便再次被提示选择
- 使用 `cospowers-configure` skill

## 后续步骤

本 skill 的唯一职责是路由。路由完成后，所有工作由 `module-design-spec` 或 `module-design-brief` 处理。
