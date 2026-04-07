## Context

当前 `skills/lottery-physics/SKILL.md` 包含内联的 Python 实现代码。代码嵌入在 Markdown 中有以下问题：
- 无法单独测试
- 代码无法被其他模块导入
- 代码编辑体验差

目标是将代码抽取为独立的 Python 模块。

## Goals / Non-Goals

**Goals:**
- 创建 `scripts/lottery_runner.py` 模块
- 模块提供清晰的 API 接口
- 更新 SKILL.md 引用外部脚本

**Non-Goals:**
- 不修改物理引擎核心逻辑
- 不添加新功能

## Decisions

### 1. 模块结构

```
skills/lottery-physics/
├── SKILL.md
└── scripts/
    └── lottery_runner.py
```

### 2. API 设计

```python
class LotteryRunner:
    def parse_request(text: str) -> dict
    def run(params: dict, timeout: int = 60) -> str
    def format_output(result: str) -> str
```

### 3. SKILL.md 更新方式

在 SKILL.md 中保留文档部分，通过相对路径引用脚本：

```markdown
## Usage

from scripts.lottery_runner import execute_lottery
result = execute_lottery("前区1-35选5")
```

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| 路径变更 | 脚本无法找到 | 使用相对于 SKILL.md 的相对路径 |
| 依赖缺失 | 运行失败 | 确保 physics_lottery 在 sys.path |