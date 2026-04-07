## Why

`lottery-physics` skill 的实现代码目前嵌入在 SKILL.md 文件中，不利于代码维护和测试。本变更是将代码抽取到独立的 Python 模块中，提升可维护性和可测试性。

## What Changes

- 创建 `skills/lottery-physics/scripts/` 目录
- 将 SKILL.md 中的 Python 代码抽取为独立模块
- 更新 SKILL.md，引用外部脚本而非内联代码

## Capabilities

### New Capabilities
- `lottery-skill-code`: 将 skill 逻辑抽取为独立 Python 模块

### Modified Capabilities
- `lottery-physics-skill`: 更新调用方式，指向外部脚本

## Impact

- 新增 `skills/lottery-physics/scripts/lottery_runner.py`
- 修改 `skills/lottery-physics/SKILL.md`
- 不影响 `physics_lottery` 核心模块