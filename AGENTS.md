# AGENTS.md – Repository‑wide guidance for OpenCode

## Repository layout
- The root contains a **set of independent skill directories** (e.g. `lottery-predictor`, `news-analysis`, `stock-ma-filter`, `physics_lottery`).
- Each skill directory follows the same pattern:
  - `SKILL.md` – human‑readable description and usage notes.
  - One or more **executable scripts** (often a `*.py` file) that implement the skill.
  - Optional `requirements.txt` for third‑party dependencies.
  - Optional `test_*.py` files containing `pytest` tests.
- There is **no monorepo build system**; commands are run per‑skill.

## Installing dependencies
- Run `pip install -r <skill>/requirements.txt` **only for the skill you plan to use**.  Most skills (e.g. `lottery-predictor`) rely solely on the standard library.
- Avoid installing all `requirements.txt` files at once; they may have conflicting versions.

## Running a skill
- **Lottery‑predictor** (standard‑library only):
  ```bash
  cd lottery-predictor
  python -m lottery_predictor
  # optional flags
  #   --probabilities   show full probability tables
  #   --history N       limit history to the last N draws
  ```
  The module works from the repository root as well, e.g. `python -m lottery-predictor.lottery_predictor`.
- **Other skills** may have hyphens in directory names (which are not valid Python package names).  Run them directly:
  ```bash
  python news-analysis/scripts/news_analysis.py
  python stock-ma-filter/scripts/ma_filter.py
  ```
  Consult the skill’s own `SKILL.md` for exact entry‑point details.

## Testing
- Run **all tests** across the repo from the root:
  ```bash
  pytest
  ```
- Individual skill tests can be targeted, e.g.:
  ```bash
  pytest lottery-predictor/test_lottery_predictor.py
  ```
- If a skill requires extra packages, install its `requirements.txt` before invoking its tests.

## Common gotchas
- **Network access**: `lottery-predictor` downloads a remote CSV on first run.  Ensure the machine has outbound internet; the file is cached at `~/.cache/lottery_predictor.txt`.
- **Hyphenated directories** cannot be imported as modules; always execute the script file directly (or `cd` into the directory).
- **Cache files** may become stale if the remote source changes format.  Delete `~/.cache/lottery_predictor.txt` to force a fresh download.
- **Ruff cache** (`.ruff_cache`) is harmless but may be large; you can delete it without affecting code execution.

## Development workflow checklist
1. `cd <skill>`
2. Install optional deps: `pip install -r requirements.txt` (if present).
3. Run the skill or its tests.
4. Make changes.
5. Re‑run relevant tests.
6. Commit – no repository‑wide scripts to run beforehand.

*Keep this file up‑to‑date when new skills are added or existing ones change their entry‑points.*
#### 测试用例指导原则
 
**禁止为通过测试而采取以下行为**：
- **简化业务逻辑**：为测试通过而简化或跳过真实业务逻辑
- **伪造测试数据**：使用不符合真实场景的模拟数据
- **篡改业务代码**：为适配测试而修改业务代码的正常流程
- **跳过流程步骤**：跳过必要的验证、权限检查、错误处理等步骤

**正确的测试做法**：
- 保持业务代码逻辑完整，使用 Mock 技术隔离外部依赖
- 测试数据应尽可能模拟真实场景
- 测试用例应验证业务代码的真实行为，包括边界条件和错误处理

#### 修复问题原则

- **先理解，后修复**：
- 修复前先认真查阅相关方法、类、结构体定义及设计文档，理解问题的根本原因，分析问题并提出解决方案，与用户确认
- 修复代码要遵循语法规范、日志规范、设计模式等
- 修复后测试用例防止回归，并记录原因和方案
- 永远不要猜测，不要擅自选择方案或路线，务必暂停运行让用户确认与澄清

#### 性能硬约束
- 必须使用二进制格式存储数据（npy / bin / parquet）
- 禁止重复解析 CSV，必须做缓存
- 向量化计算优先，禁止逐行循环
- 回测必须使用预加载数据
- 内存占用 < 8GB
- 速度要求：1天回测 < 2 秒
#### 执行python代码
- 必须使用py 命令执行python代码，而不是python
