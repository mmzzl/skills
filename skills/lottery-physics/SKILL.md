# Skill: lottery-physics

Use this skill when user wants to run a physical lottery simulation (物理摇号). This skill wraps the physics_lottery module and provides a natural language interface.

## Triggers

- User mentions "摇号", "彩票", "随机选号", "物理摇号"
- User asks to run a lottery simulation with specific parameters
- User wants to generate random numbers using a physics-based simulation

## Parameters

The skill accepts the following parameters extracted from natural language:

| Parameter | Required | Description |
|-----------|----------|-------------|
| `front_min` | No | Front zone minimum number (default: 1) |
| `front_max` | No | Front zone maximum number (default: 35) |
| `front_count` | No | Front zone selection count (default: 5) |
| `back_min` | No | Back zone minimum number (default: 1) |
| `back_max` | No | Back zone maximum number (default: 12) |
| `back_count` | No | Back zone selection count (default: 2) |
| `seed` | No | Random seed for reproducibility |

## Examples

- "前区1-35选5，后区1-12选2" → front_min=1, front_max=35, front_count=5, back_min=1, back_max=12, back_count=2
- "前区1-35选5" → front_min=1, front_max=35, front_count=5, back_count=0
- "前区1-35选5，seed=12345" → with seed for reproducibility

## Usage

```python
# Import from external script
import sys
sys.path.insert(0, "D:\\work\\skills\\skills\\lottery-physics\\scripts")
from lottery_runner import execute_lottery

# Run lottery simulation
result = execute_lottery("前区1-35选5，后区1-12选2")
print(result)
# Output: 🎱 前区: [3, 7, 15, 23, 31] | 🎱 后区: [2, 9]

result = execute_lottery("前区1-35选5，seed=12345")
print(result)
# Output: 🎱 前区: [1, 8, 13, 30, 33] (deterministic)
```

## API Reference

The `scripts/lottery_runner.py` module provides:

- `execute_lottery(request: str) -> str`: Main entry point
- `LotteryPhysics` class: Low-level wrapper with:
  - `parse_request(text: str) -> dict`: Parse natural language params
  - `run_simulation(params: dict, timeout: int = 60) -> str`: Run simulation
  - `format_output(result: str, params: dict) -> str`: Format result

## Error Handling

| Error | Message | Recovery |
|-------|---------|----------|
| Timeout | "模拟超时，请重试或使用不同参数" | Try with different seed |
| Invalid params | "Error: ..." with suggestion | Use correct format |
| Seed failure | "Error: Hard timeout exceeded" | Use different seed |