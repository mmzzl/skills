# Graph Report - D:\myskills\skills  (2026-05-11)

## Corpus Check
- Corpus is ~13,287 words - fits in a single context window. You may not need a graph.

## Summary
- 237 nodes · 454 edges · 13 communities detected
- Extraction: 54% EXTRACTED · 46% INFERRED · 0% AMBIGUOUS · INFERRED: 207 edges (avg confidence: 0.61)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Lottery Runner & Config|Lottery Runner & Config]]
- [[_COMMUNITY_Repository Structure|Repository Structure]]
- [[_COMMUNITY_Stock MA Filter Core|Stock MA Filter Core]]
- [[_COMMUNITY_Physics Utilities|Physics Utilities]]
- [[_COMMUNITY_Lottery Physics Runner|Lottery Physics Runner]]
- [[_COMMUNITY_Lottery Predictor|Lottery Predictor]]
- [[_COMMUNITY_News Analysis|News Analysis]]
- [[_COMMUNITY_Lottery Physics Design|Lottery Physics Design]]
- [[_COMMUNITY_Stock Signals|Stock Signals]]
- [[_COMMUNITY_Lottery Simulator Core|Lottery Simulator Core]]
- [[_COMMUNITY_Lottery Physics Skill|Lottery Physics Skill]]
- [[_COMMUNITY_Natural Language Interface|Natural Language Interface]]
- [[_COMMUNITY_Code Extraction Spec|Code Extraction Spec]]

## God Nodes (most connected - your core abstractions)
1. `Ball` - 39 edges
2. `Container` - 35 edges
3. `AirflowField` - 35 edges
4. `LotteryConfig` - 25 edges
5. `LotteryRunner` - 25 edges
6. `LotterySimulator` - 24 edges
7. `UnrecoverableError` - 23 edges
8. `AGENTS.md Repository Guidance` - 14 edges
9. `News Analysis Skill` - 13 edges
10. `Stock MA Filter SKILL.md` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Lottery Selection Specification` --EXTRACTED--> `Lottery Simulator`  [INFERRED]
  openspec/changes/archive/2026-04-08-physical-lottery-simulator/specs/lottery-selection/spec.md → physics_lottery/lottery.py
- `Lottery Predictor Skill` --references--> `NVIDIA API Integration`  [INFERRED]
  lottery-predictor/SKILL.md → news-analysis/scripts/news_analysis.py
- `Stock PPTX Generator` --references--> `all_stock_industry.csv`  [INFERRED]
  create_stock_pptx.js → news-analysis/SKILL.md
- `Airflow Simulation Specification` --EXTRACTED--> `Airflow Field`  [INFERRED]
  openspec/changes/archive/2026-04-08-physical-lottery-simulator/specs/airflow-simulation/spec.md → physics_lottery/physics.py
- `Lottery Selection Specification` --EXTRACTED--> `Lottery Configuration`  [INFERRED]
  openspec/changes/archive/2026-04-08-physical-lottery-simulator/specs/lottery-selection/spec.md → physics_lottery/lottery.py

## Hyperedges (group relationships)
- **Physical Lottery System** — physics_lottery_physics, physics_lottery_lottery, physics_lottery_main, lottery_runner, LotteryPhysics, LotteryConfig, LotterySimulator, LotteryRunner, Ball, Container, AirflowField, UnrecoverableError [EXTRACTED 0.95]
- **Stock MA Filter System** — stock_ma_filter_skill, ma_filter, MongoDB, NVIDIA_API, GoldenCross, BullishAlignment, hs300_stocks_csv [EXTRACTED 0.95]
- **News Analysis System** — news_analysis, NVIDIA_API, all_stock_industry_csv [EXTRACTED 0.90]

## Communities

### Community 0 - "Lottery Runner & Config"
Cohesion: 0.14
Nodes (38): Exception, create_lottery_balls(), detect_pipe_ejection(), LotteryConfig, LotteryRunner, LotterySimulator, Lottery selection logic with dual-zone support., Run simulation until all balls selected or timeout. (+30 more)

### Community 1 - "Repository Structure"
Cohesion: 0.06
Nodes (36): Bullish Alignment Detection, Golden Cross Detection, MongoDB Database, NVIDIA API Integration, AGENTS.md Repository Guidance, AI Analysis Module, all_stock_industry.csv, API Authentication (+28 more)

### Community 2 - "Stock MA Filter Core"
Cohesion: 0.17
Nodes (20): calculate_ma(), call_ai_analysis(), detect_bullish_alignment(), detect_golden_cross(), filter_stocks(), generate_report(), get_all_codes(), get_default_hs300_codes() (+12 more)

### Community 3 - "Physics Utilities"
Cohesion: 0.12
Nodes (13): detect_collisions(), Core physics engine classes for lottery ball simulation., Gaussian center-weight function: exp(-d² / (2σ²))., Height-dependent airflow factor (0.3 at bottom → 1.5 at top)., Compute total force on a ball: gravity + airflow + perturbation., Simulate one physics step with sub-stepping., Simulate one frame with sub-stepping., Handle collision between ball and container boundary. (+5 more)

### Community 4 - "Lottery Physics Runner"
Cohesion: 0.17
Nodes (9): Lottery physics skill scripts package., execute_lottery(), LotteryPhysics, Lottery physics skill runner - extracts lottery logic from SKILL.md., Parse natural language lottery request., Run the physics lottery simulation., Format simulation result for display., Wrapper for the physics lottery simulation. (+1 more)

### Community 5 - "Lottery Predictor"
Cohesion: 0.19
Nodes (12): build_position_maps(), download_data(), format_output(), main(), predict_next_draw(), Predict next draw.      Args:         draws: list of draws (each a list of 7, Download and parse lottery data, return list of draws (7 ints each).     Handle, main() (+4 more)

### Community 6 - "News Analysis"
Cohesion: 0.22
Nodes (13): analyze_news(), calc_heat(), call_ai_analysis(), get_all_news(), get_sector_display_name(), get_sector_name(), main(), 计算热度值     热度 = 出现次数 * 10 + 评论数 * 2 + 分享数 * 5 (+5 more)

### Community 7 - "Lottery Physics Design"
Cohesion: 0.14
Nodes (14): execute_lottery Function, Formatted Output, Lottery Physics Skill, LotteryPhysics Class, Lottery Physics Skill Design, Lottery Physics SKILL.md, Natural Language Interface, Natural Language Parameter Parsing (+6 more)

### Community 8 - "Stock Signals"
Cohesion: 0.14
Nodes (14): AI Market Analysis, All A Shares, Bullish Alignment, detect_bullish_alignment Function, detect_golden_cross Function, Golden Cross Signal, HS300 Stocks, MA10 Calculation (+6 more)

### Community 9 - "Lottery Simulator Core"
Cohesion: 0.24
Nodes (10): Airflow Field, Ball Entity, Container Entity, Lottery Configuration, Lottery Runner, Lottery Simulator, Unrecoverable Error, Airflow Simulation Specification (+2 more)

### Community 10 - "Lottery Physics Skill"
Cohesion: 0.32
Nodes (7): LotteryPhysics Class, Lottery Physics Skill, Lottery Physics Runner, Lottery Selection Logic, Physical Lottery CLI, Core Physics Engine, Stock MA Filter Skill

### Community 11 - "Natural Language Interface"
Cohesion: 0.5
Nodes (4): Formatted Output Requirement, Lottery Physics Skill Specification, Natural Language Lottery Request, Simulation Execution

### Community 12 - "Code Extraction Spec"
Cohesion: 0.5
Nodes (4): Code Extraction to External Module, lottery_runner.py, Lottery Skill Code Extraction Specification, SKILL.md External Script Reference

## Knowledge Gaps
- **93 isolated node(s):** `Download and parse lottery data, return list of draws (7 ints each).     Handle`, `Predict next draw.      Args:         draws: list of draws (each a list of 7`, `根据板块代码获取板块名称和相关股票信息      Args:         code: 板块代码，如 '90.BK0815'      Return`, `获取板块显示名称（便捷函数）      Args:         code: 板块代码，如 '90.BK0815'      Returns:`, `调用 AI 模型进行深度分析     支持多种 AI 后端：NVIDIA NIM、Claude、OpenAI、本地模型等      Args:` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `parse_args()` connect `Lottery Predictor` to `Stock MA Filter Core`, `News Analysis`?**
  _High betweenness centrality (0.395) - this node is a cross-community bridge._
- **Why does `main()` connect `Lottery Predictor` to `Lottery Runner & Config`?**
  _High betweenness centrality (0.291) - this node is a cross-community bridge._
- **Are the 35 inferred relationships involving `Ball` (e.g. with `LotteryConfig` and `UnrecoverableError`) actually correct?**
  _`Ball` has 35 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `Container` (e.g. with `LotteryConfig` and `UnrecoverableError`) actually correct?**
  _`Container` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `AirflowField` (e.g. with `LotteryConfig` and `UnrecoverableError`) actually correct?**
  _`AirflowField` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `LotteryConfig` (e.g. with `Ball` and `Container`) actually correct?**
  _`LotteryConfig` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `LotteryRunner` (e.g. with `Ball` and `Container`) actually correct?**
  _`LotteryRunner` has 20 INFERRED edges - model-reasoned connections that need verification._