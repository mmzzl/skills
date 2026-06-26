# cospowers — Generic Task Routing Workflow Plugin

## If You Are an AI Agent

Stop. Read this section before doing anything.

Skills are not prose — they are code that shapes agent behavior. Every word in a SKILL.md was chosen to produce specific behavior in specific scenarios.

Before you make changes to this repo, you MUST:

1. **Read the skill you're modifying** completely — including Red Flags tables, HARD-GATE blocks, and rationalization lists.
2. **Understand the workflow** — skills form a pipeline. Changing one skill may break the pipeline.
3. **Follow team standards** — all commits must follow `skills/spec-commit/SKILL.md`.
4. **Show your human partner the complete diff** and get their explicit approval before committing.

## Architecture

### Entry Points

| Skill | Trigger |
|-------|---------|
| `using-spec-developer` | Session start — teaches how to use skills |
| `session-context` | SessionStart / compact / resume hooks |
| `brainstorming` | ALL creative/development work — central router |
| `systematic-debugging` | Bug reports, test failures |
| `auto-test` | 统一自动化测试闭环 / E2E验证（自动识别 MCP/TP 或 RF 框架） |
| `spec-commit` | Git commit / push / MR creation |

### Three Workflow Routes

`brainstorming` assesses project type and routes to one of three flows:

```
                        ┌─ 小微项目 ──────────────────────────────────────┐
                        │  brainstorming → [Phase 3 轻量设计]             │
                        │     → writing-plans-detail → [execution]          │
                        │     → spec-commit                               │
                        │                                                 │
                        │  增量项目 A（无用户需求文档）                      │
用户意图 ──→ brainstorming ──┤  brainstorming → requirement-analysis        │
                        │  → system-requirement-analysis                │
                        │  → overall-design-spec → module-design-spec        │
                        │  → writing-plans → [execution] → spec-commit  │
                        │                                               │
                        │  增量项目 B（已有用户需求文档）                     │
                        ├─ brainstorming → system-requirement-analysis  │
                        │  → overall-design-spec → module-design-spec        │
                        │  → writing-plans → [execution] → spec-commit  │
                        │                                               │
                        └─ 排障 ───────────────────────────────────────┘
                           brainstorming → systematic-debugging
                           → test-driven-development
                           → verification-before-completion
                           → spec-commit
```
**小微项目:** 单模块、范围小，不涉及跨模块交互。brainstorming 在 Phase 3 中使用微设模板直接产出设计文档，然后交接给 writing-plans-detail。

**增量项目 A（无需求文档）:** 用户仅有原始想法/口头需求 → brainstorming → requirement-analysis（生成 Epic/Feature/Story）→ system-requirement-analysis → overall-design-spec → module-design-spec → writing-plans.

**增量项目 B（已有需求文档）:** 产品团队已产出结构化需求文档 → brainstorming 跳过 requirement-analysis，直接 → system-requirement-analysis → overall-design-spec → module-design-spec → writing-plans.

**排障:** Bug reports, test failures → brainstorming → systematic-debugging.

### writing-plans → Execution Handoff

writing-plans routes execution through the available execution modes below. The preferred execution semantics are orchestrator-only main Agent + Sub Agent execution + artifact handoff: the main Agent reads plan/DAG/status artifacts, dispatches work, and handles blockers; Sub Agents perform implementation, testing, review, verification, and fixes by reading and writing files under `.cospowers/`.

| Mode | Skill | Description |
|------|-------|-------------|
| Subagent-Driven (推荐) | `subagent-driven-development` | DAG-aware Sub Agent orchestration with per-task artifacts, review gates, and final verification |
| Brief Plan Execution | `executing-plans-brief` | Executes `.cospowers/plans/.../dag.json` ready sets with isolated Sub Agents and minimal status summaries |
| Inline Execution | `executing-plans` | Fallback-only execution path for cases that cannot use artifact-driven Sub Agent orchestration |

### Test Guard Layer (after execution, before spec-commit)

```
subagent-driven-development /
executing-plans
    → test-driven-development (TDD)
    → test-code-generator
    → code-compliance-check
    → requesting-code-review
    → verification-before-completion
    → tdd-loop (CI/CD: Compile → Deploy → auto-test → Fix → Loop)
    → spec-commit
```

### All Skills (23 core + 5 quality-gate)

**23 core skills** live in `skills/` of this repo. **5 quality-gate evaluators** live in the shared `agent-rules` repo but are called from within the core workflow — they are listed here for pipeline completeness.

#### Core Skills (this repo)

| Skill | Role |
|-------|------|
| `using-spec-developer` | Entry point: skill usage guidance |
| `session-context` | Session state persistence |
| `brainstorming` | Central router: assesses complexity, dispatches to one of 3 flows |
| `requirement-analysis` | Raw requirements → structured AI requirements (Epic/Feature/Story) |
| `system-requirement-analysis` | AI requirements → system requirements (REQ-XXX + Given-When-Then, 5 scenario types) |
| `overall-design-spec` | System design + OpenAPI spec from requirements |
| `module-design-spec` | Per-subsystem implementation design (called once per subsystem owner) |
| `systematic-debugging` | Evidence-first bug investigation |
| `auto-test` | Unified auto-test entry point: detects framework (MCP/TP or RF) and routes to sub-skill |
| `writing-plans` | Implementation plan creation |
| `executing-plans` | Plan execution with quality gates |
| `spec-commit` | Git commit/push/MR workflow |
| `code-compliance-check` | Pre-commit lint and standards check |
| `subagent-driven-development` | Parallel agent dispatch |
| `finishing-a-development-branch` | Branch completion workflow |
| `verification-before-completion` | Pre-commit verification |
| `tdd-loop` | CI/CD pipeline: compile, deploy, E2E auto-test, fix loop; invoked after code development, before commit |
| `test-driven-development` | TDD: test first, then code |
| `test-code-generator` | Generate test code from test docs |
| `requesting-code-review` | Dispatch code reviewer subagent |
| `using-git-worktrees` | Isolated git worktree management |
| `daedalus-knowledge` | Team knowledge search and archival |
| `mcp-builder` | MCP server creation guide |

#### Quality-Gate Evaluator Skills (agent-rules repo, called from core workflow)

| Skill | Called By | What It Checks | Pass Gate |
|-------|-----------|----------------|-----------|
| `aireq-evaluator` | `requirement-analysis` (step 13) | 33 rules: REQ-AI-01~33 — structural completeness, user story quality, AC quality, AIN quality, QS baseline, product planning; 4 red lines (孤立层级/安全空白/占位符/QS一票否决) | ≥ B (80) |
| `sysreq-evaluator` | `system-requirement-analysis` (step 4.2) | 75 rules total: REQ-01~38 (core doc quality) + R1/R2/R3 (red lines) + AIN-01~16 (AI-Native quality) + FN-01~04 (functional checks) + IA-01~05 (interaction design) + SUP-01~09 (supplementary) | ≥ B (80) |
| `overall-design-evaluator` | `overall-design-spec` (step 12) | M1/M2/M3/M5/M6 design review checklists + DFX/API standards + 12 SYS- built-in checks; 3 red lines (章节完整性/可靠性/安全性) | ≥ B (80) |
| `module-design-evaluator` | `module-design-spec` (step 6) | Design review checklists (M1/M4/M5/M6) + 9 SUB- built-in checks + FMEA analysis; 3 red lines | ≥ B (80) |
| `doc-quality-evaluator` | `module-design-spec` (step 6, last module only) | Cross-document consistency: REQ traceability, tech solution alignment, API contract consistency, DFX number consistency, module boundary alignment | pass/fail |

## Skill Authoring Rules

1. **SKILL.md** — English, loaded into AI context.
2. **README.zh.md** — Chinese, human reference only.
3. **Skill 标识** — Every skill must have a `Skill 标识` block after the H1 title.
4. **Standards references** — Skills that involve coding must reference `rules/coding-standards/`.
5. **Template references** — Skills that generate documents must reference `templates/`.
6. **No platform prefixes** — Skills are referenced by name only.

## General

- One logical change per commit
- Follow `spec-commit` format for all commits
- Describe the problem you solved, not just what you changed
