---
name: tdd-loop
description: Use when code development is complete and you need the CI/CD pipeline — compile, deploy, E2E verify via auto-test, fix B类 failures via auto-fix, loop until all E2E pass (or max rounds reached) — before commit
metadata:
  version: "1.0.0"
  triggers:
    - CI/CD pipeline
    - compile deploy test
    - E2E verification loop
    - tdd loop
    - tdd-loop
  tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash", "Agent", "Skill"]
  model: sonnet
---

# tdd-loop

**Skill 标识**: `tdd-loop`

其他 skill 通过 `tdd-loop` 引用本 skill。

## Overview

Automated CI/CD loop: compile code, deploy artifacts, run E2E tests via `auto-test`, classify failures, fix B类 defects via `auto-fix`, and retry — until all E2E test cases pass or max rounds are exhausted.

**Core principle:** Code development is not complete until E2E tests pass in a deployed environment. Commit only after tdd-loop succeeds.

**Announce at start:** "I'm using the tdd-loop skill to execute the CI/CD pipeline."

**Commit is NOT part of tdd-loop.** The caller (writing-plans, subagent-driven-development, executing-plans) handles commit after tdd-loop reports success.

## When to Use

Invoked by upstream orchestrators after all implementation tasks are complete:

- **writing-plans** — Stage 2, after Stage 1 (code development) completes
- **subagent-driven-development** — After all tasks pass review gates
- **executing-plans** — After final code review and test verification

## Pipeline Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Phase 1        Phase 2        Phase 3          Phase 4      │
│  Compile ──→   Deploy  ──→  E2E Verify  ──→   Fix    ──┐    │
│      ↑                                                  │    │
│      └──────────────── loop back ───────────────────────┘    │
│                                                              │
│  All E2E pass → return {status: "passed"} to caller          │
│  Max rounds reached → return {status: "failed"} + escalate   │
└──────────────────────────────────────────────────────────────┘
```

### Loop Variables

Track these throughout the pipeline:

| Variable | Default | Description |
|----------|---------|-------------|
| `tdd_loop_iteration` | 0 | Current loop round, increments after each Phase 4→Phase 1 cycle |
| `tdd_loop_max_rounds` | 3 | Max full loop iterations before escalation |
| `compile_fix_count` | 0 | Fix attempts within current compile phase (max 3) |
| `deploy_fix_count` | 0 | Fix attempts within current deploy phase (max 3) |

## Phase Details

### Phase 1: Code Compilation

Auto-detect the project's build system and compile. Handle failures inline (compile errors are not B类 defects — do NOT invoke `auto-fix`).

**Step 1 — Detect build system.** Scan for indicator files in priority order:

| Indicator | Build System | Compile Command |
|-----------|-------------|-----------------|
| `pom.xml` | Maven | `mvn compile -q` |
| `build.gradle` / `build.gradle.kts` | Gradle | `gradle compileJava` |
| `package.json` (scripts.build exists) | npm | `npm run build` |
| `go.mod` | Go | `go build ./...` |
| `Makefile` (build target) | Make | `make build` |
| `Cargo.toml` | Cargo | `cargo build` |
| `*.csproj` / `*.sln` | .NET | `dotnet build` |
| `CMakeLists.txt` | CMake | `cmake --build build` |

If none detected: `AskUserQuestion` — "未检测到构建系统。请提供编译命令或确认跳过编译阶段。"

**Step 2 — Execute compile.** Run the detected command, capture stdout/stderr.

**Step 3 — Handle result:**
- **Compile succeeds** → proceed to Phase 2.
- **Compile fails** → diagnose error, apply minimal fix, recompile. Max 3 fix rounds (`compile_fix_count`). If still failing after 3 rounds → `AskUserQuestion` for human intervention.

**HARD GATE**: If no build system was detected and the user provided none, STOP. Do not skip compile without explicit user confirmation.

### Phase 2: Artifact Deployment

Auto-detect deployment target and deploy the compiled artifact.

**Step 1 — Detect deployment target.** Scan for indicators:

| Indicator | Target Type | Deploy Action |
|-----------|-------------|---------------|
| `Dockerfile` + `docker-compose.yml` | Docker Compose | `docker compose up -d --build` |
| `Dockerfile` only | Docker | `docker build -t <project> .` |
| `deploy/` directory | Deploy scripts | Execute scripts in `deploy/` |
| `k8s/` or `kubernetes/` directory | Kubernetes | `kubectl apply -f k8s/` |
| `.cospowers/auto-test/config.yaml` with `server` field | Configured target | Deploy to configured server |
| `helm/` directory | Helm | `helm upgrade --install <release> helm/` |

If none detected: skip with notice — "未检测到部署目标，跳过部署阶段。假设测试环境已就绪。" Proceed directly to Phase 3.

**Step 2 — Execute deployment.** Run the detected deploy command.

**Step 3 — Handle result:**
- **Deploy succeeds** → proceed to Phase 3.
- **Deploy fails** → diagnose issue, fix configuration, re-deploy. Max 3 fix rounds (`deploy_fix_count`). If still failing after 3 rounds → `AskUserQuestion` for human intervention.

**HARD GATE**: Deployment is optional only when no target is detected. If a target was detected but deployment fails, DO NOT proceed to Phase 3 without fixing or user confirmation.

### Phase 3: E2E Verification

Invoke `auto-test` for requirement-level E2E test execution and failure classification.

**Step 1 — Invoke auto-test:**

```
Skill tool:
  skill: "auto-test"
  args: "<user-provided test parameters>"
```

Use the test parameters provided by the calling context (plan's E2E section, user's testbed config, etc.).

**Step 2 — Read results.** After `auto-test` completes:
- Read `.cospowers/auto-test/tasks/{task_dir}/case_status.json` for pass/fail counts
- Read `.cospowers/auto-test/tasks/{task_dir}/analysis/summary.md` for A/B/C/D classification breakdown

**Step 3 — Decide next action:**
- **ALL pass** → exit loop. Return `{status: "passed", rounds: N}` to caller.
- **Any failure** → proceed to Phase 4.

**HARD GATE**: If the plan includes E2E test cases (`Post-Implementation E2E Verification` section), this phase MUST run and CANNOT be skipped.

### Phase 4: Failure Fix

Classify failures using `auto-test`'s analysis output and dispatch fixes by category.

**Step 1 — Read classification.** Parse `.cospowers/auto-test/tasks/{task_dir}/analysis/summary.md` for the "按分类统计" table. Extract counts and case codes for A/B/C/D categories.

**Step 2 — Fix by classification:**

| Class | Description | Action |
|-------|-------------|--------|
| **A类—用例编写错误** | Test step inaccuracies, wrong locators, wrong parameters | `AskUserQuestion`: present analysis details, ask user to correct test case. After confirmation, continue to loop back. |
| **B类—业务代码缺陷** | Logic bug, wrong API response | Invoke `auto-fix` via Skill tool: `skill="auto-fix", args="--task-dir {task_dir}"`. `auto-fix` reads B类 cases from `summary.md`, executes RED→GREEN→REFACTOR per case. |
| **C类—环境/数据问题** | Service unavailable, timeout, data pollution | `AskUserQuestion`: present environment issue details, ask user to resolve. After confirmation, continue to loop back. |
| **D类—MCP工具问题** | MCP tool internal error (MCP path only) | `AskUserQuestion`: present MCP tool issue details, ask user to investigate MCP Server. |

**Step 3 — Detect stall.** Before looping back, compare current failures against previous round:
- If the same B类 failures persist with no improvement after 2 consecutive rounds: escalate early (don't wait for max rounds).
- If auto-fix produces no changes but failures remain: escalate immediately (would loop infinitely).

**Step 4 — Loop back.** Increment `tdd_loop_iteration`. If `< tdd_loop_max_rounds`, loop back to Phase 1 (recompile with fixes, redeploy, re-test). If `≥ tdd_loop_max_rounds`, exit loop and escalate.

### Loop Exit Conditions

Exit tdd-loop and return to caller when ANY of:

1. **Phase 3 ALL pass** → Normal exit. Report: `{status: "passed", rounds: N}`
2. **Max rounds reached** → Escalate. Report: `{status: "failed", rounds: 3, remaining_failures: [...]}`. Use `AskUserQuestion` to present failure summary and ask user how to proceed.
3. **Stall detected** → Early escalation. Same format as max rounds.
4. **User chooses to abort** during escalation → Return `{status: "aborted"}`.

## Output

Upon completion, report status to caller:

```
## tdd-loop Result

**Status:** passed / failed / aborted
**Rounds executed:** 2
**Compile phases:** 2 pass, 1 fail (auto-fixed)
**Deploy phases:** 1 pass, 0 fail
**E2E final results:** 15/15 pass
**B类 fixes applied:** 2
**Remaining issues (if failed):**
  - TC-001: C类 — environment issue, pending user action
```

## Quality Gates

- [ ] Compile must pass (within 3 fix rounds or escalated)
- [ ] Deploy must pass if target detected (within 3 fix rounds, or escalated/skipped)
- [ ] E2E HARD GATE: MUST run auto-test if plan includes E2E test cases
- [ ] All E2E pass → return success
- [ ] Max 3 full loop rounds; after exceeded, escalate to user with full failure report
- [ ] Stall detected within max rounds → escalate early
- [ ] B类 fixes recorded in `.cospowers/auto-test/tasks/{task_dir}/analysis/code_fixes.md`

## Integration

**Required workflow skills:**
- **auto-test** — Unified E2E test execution + failure classification (A/B/C/D)
- **auto-fix** — B类 TDD-based code fix (RED→GREEN→REFACTOR). Invoked with `--task-dir {task_dir}`.

**Caller skills:**
- **writing-plans** — Stage 2 CI/CD pipeline, calls tdd-loop then commits
- **subagent-driven-development** — E2E verification gate, calls tdd-loop then final review
- **executing-plans** — Post-completion verification, calls tdd-loop then knowledge archival

## Anti-Patterns

| Anti-Pattern | Correct Approach |
|-------------|-----------------|
| Skipping compile because "code compiled during development" | Always recompile in a clean pipeline to catch integration issues |
| Using `auto-fix` for compile errors | auto-fix is for B类 business logic defects only. Fix compile errors inline. |
| Skipping E2E when plan mandates it | HARD GATE — E2E MUST run if plan has `Post-Implementation E2E Verification` |
| Committing code inside tdd-loop | Commit is the caller's responsibility. tdd-loop only verifies and fixes. |
| Exceeding 3 rounds without escalating | Max 3 full iterations. Escalate to user with full report. |
| Looping without checking for improvement | Detect stall: if same failures persist, escalate early. |
| Fixing A类 test cases without user confirmation | A类 is test case errors — user must confirm changes to test specs. |
| Re-running auto-test directly instead of going through auto-test skill | auto-test provides framework detection and structured analysis output. |
| Skipping the deploy phase when a target was detected | If you detected a deployment target, you must attempt deployment or get user confirmation to skip. |

## Red Flags — STOP Immediately

- tdd-loop called but plan has no E2E test cases → ask caller: "这个计划没有 E2E 验证步骤，是否仍要执行 tdd-loop？"
- No build system detected and user provides none → STOP, cannot proceed
- auto-fix produces no changes but B类 failures remain → escalate, do not loop
- Same failures across 2+ rounds with no improvement → escalate early
- Compile fails 3 times with no progress → escalate, do not loop
