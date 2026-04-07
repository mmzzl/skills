## Why

已有的 `physics_lottery` 物理引擎是一个纯 Python 模块，需要通过技能（skill）封装才能被 opencode 直接调用。本变更为该物理引擎创建一个 skill，使其能够响应自然语言请求，完成彩票选号任务。

## What Changes

- 新增 `lottery-physics` skill，包含物理引擎的完整封装
- 支持通过自然语言参数（"前区1-35选5，后区1-12选2"）调用模拟器
- 支持 seed 参数以实现可复现的结果
- 支持独立运行（`python -m physics_lottery.main`）和 skill 调用两种模式

## Capabilities

### New Capabilities
- `lottery-physics-skill`: 将物理摇号引擎封装为可调用技能，支持自然语言参数解析和结果格式化输出

### Modified Capabilities
<!-- 无现有spec需要修改 -->

## Impact

- 新增 skill 文件：`skills/lottery-physics/SKILL.md`
- 物理引擎模块保持不变（`physics_lottery/`）
- 不影响现有任何代码