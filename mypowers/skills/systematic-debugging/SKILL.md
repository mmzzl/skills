---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes. Enforces evidence-first investigation with 5W1H collection, fault classification, confidence assessment, and investigation-fix separation.
---

# Systematic Debugging

**Skill 标识**: `systematic-debugging`

其他 skill 通过 `systematic-debugging` 引用本 skill。

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues. Guessing without data leads to wrong conclusions.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Evidence principle:** Real data trumps all. When you lack evidence, STOP and ask -- do NOT guess.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
NO GUESSES WITHOUT EVIDENCE FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.
If you haven't collected real data, you cannot form conclusions.

## Step 0: Search Team Knowledge Hub

**BEFORE starting any investigation**, search the team knowledge Hub for known solutions:

Use the Skill tool to invoke `daedalus-knowledge` with keywords extracted from the error message or problem description. The Hub may contain:
- Exact same error with proven fix (Capsule)
- Similar problem pattern with strategic direction (Gene)
- Multi-step fix recipe (Recipe)

If a matching Capsule is found with high confidence, apply it directly. Only proceed to Phase 1 if no match or if the matched solution doesn't resolve the issue.

## Step 1: Data Validation Priority

Enforce this strict evidence hierarchy throughout all phases:

```
Real Data (API responses, logs, DB queries, screenshots, core dumps)
  > Code Analysis (call chain tracing, static analysis)
  > Documentation (design docs, API specs)
  > Experience Guessing (pattern recognition)
```

**Key rule:** When real data is needed but unavailable, STOP and ask the user to provide it. Do NOT guess. Do NOT fabricate evidence. Do NOT paraphrase logs -- quote them exactly.

## The Four Phases

You MUST complete each phase before proceeding to the next.

**Investigation phases (1-3): READ ONLY.** Do NOT modify any code.
**Fix phase (4): ONLY after confidence >= High or explicit user approval.**

### Phase 1: Problem Definition & Root Cause Investigation

#### 5W1H Information Collection

Before investigating, systematically collect:

| Dimension | Question | How to Obtain |
|-----------|----------|---------------|
| **What** | Fault phenomenon vs. expected behavior? | User description, error messages, screenshots |
| **When** | When did it start? Continuous or intermittent? | Logs, monitoring, user report timeline |
| **Where** | Which environment / service / module / line? | Stack traces, error context |
| **Who** | Which users affected? What scope? | User reports, access logs |
| **Why** | Any recent changes? | `git log --oneline -20`, deploy history, config changes |
| **How** | Exact reproduction steps? | User steps, automated test that triggers it |

If any critical dimension is missing (especially What, Where, How), STOP and ask the user before proceeding.

#### Fault Classification & Strategy Selection

After 5W1H collection, classify the fault to select investigation strategy:

| Type | Examples | Primary Strategy |
|------|----------|-----------------|
| **Crash** | Service hang, process exit, OOM | Check logs, core dumps, resource usage |
| **Functional** | Logic error, feature mismatch | Code tracing, input/output comparison |
| **Performance** | Slow response, timeout | Profiling, bottleneck analysis |
| **Intermittent** | Sporadic, hard to reproduce | Add logging, increase observation window |
| **Data** | Inconsistency, loss, corruption | DB queries, data flow tracing |
| **Configuration** | Environment differences, wrong params | Config diff, environment comparison |
| **Integration/E2E** | Multi-service interaction failure, async message loss | Trace chain tracing, message log replay, environment replication |
| **Stability** | Memory leak, gradual degradation, deadlock | Resource trend analysis, long-duration observation, stress reproduction |

**Non-code problem routing:** Performance, Integration/E2E, and Stability faults cannot be solved by static code analysis alone. For these types, the Evidence Collection must include:
- **Environment data** (resource usage trends, network topology, configuration dumps)
- **System state snapshot** (current connections, queue depths, goroutine/thread counts)
- **Reproduction environment** (isolated test environment matching production topology, not unit test mock)

If environment data is unavailable and you're relying only on code reading, STOP and ask for it.

#### Evidence Collection

1. **Read Error Messages Carefully** -- Don't skip past errors or warnings. Read stack traces completely. Note line numbers, file paths, error codes. Quote exact text.

2. **Reproduce Consistently** -- Can you trigger it reliably? What are the exact steps? If not reproducible, gather more data, don't guess.

3. **Check Recent Changes** -- Git diff, recent commits, new dependencies, config changes, environmental differences.

4. **Gather Evidence in Multi-Component Systems** -- Before proposing fixes, add diagnostic instrumentation at each component boundary. Run once to gather evidence showing WHERE it breaks.

5. **Trace Data Flow** -- See `references/root-cause-tracing.md` in this directory for the complete backward tracing technique. Fix at source, not at symptom.

6. **Environment Replication Check** -- Before forming conclusions, verify you have environment context matching the fault conditions:

   - **Runtime environment**: OS version, kernel parameters, container orchestration version
   - **Dependency versions**: Service versions, library versions, shared module versions — exact versions, not ranges
   - **Configuration dump**: Full configuration snapshot from the fault environment (not the default config)
   - **Data state**: Dataset size, index status, data distribution at time of fault
   - **Topology context**: Which instances were involved, load balancer routing at time of fault

   **Gate:** If any of the above cannot be obtained from the fault environment and you're attempting to reproduce on a different environment, flag this gap explicitly. An environment mismatch between analysis and fault is the #1 cause of wrong root cause conclusions.

#### 5-Why Root Cause Analysis

After finding the direct cause, apply 5-Why to drill to the true root cause:

```
Interface returns 500
  -> Why? DB connection timeout
  -> Why? Connection pool exhausted
  -> Why? Slow query holding connections
  -> Why? Missing index on large table
  -> Why? Index not optimized after data volume growth
  -> Root Cause: Missing index management process for growing tables
```

Keep asking "Why?" until you reach a cause that is actionable and preventable. The direct cause is rarely the root cause.

### Phase 2: Pattern Analysis

1. **Find Working Examples** -- Locate similar working code in same codebase
2. **Compare Against References** -- Read reference implementation COMPLETELY
3. **Identify Differences** -- List every difference, however small
4. **Understand Dependencies** -- What other components, settings, config, environment?

### Phase 3: Hypothesis, Testing & Confidence Assessment

1. **Form Single Hypothesis** -- "I think X is the root cause because Y [evidence]"
2. **Test Minimally** -- SMALLEST possible change, one variable at a time
3. **Verify Before Continuing** -- Worked? Assess confidence. Didn't? NEW hypothesis.
4. **When You Don't Know** -- Say so. Ask for help. Research more.

#### Confidence Assessment

After investigation, assess confidence before proposing any fix.

**Evidence types and weights:**

| Evidence Type | Weight | Description |
|--------------|--------|-------------|
| `log_exact_match` | 30% | Exact log text quoted from real output |
| `api_response` | 30% | Actual API response data observed |
| `reproduction` | 35% | Successfully reproduced the fault |
| `code_defect` | 40% | Definite code defect identified |
| `code_trace` | 35% | Deterministic call chain traced |
| `db_query_result` | 25% | Database query confirms the issue |
| `code_analysis` | 15% | Static code analysis only |
| `git_blame` | 15% | Git change history correlation |
| `expert_opinion` | 10% | Experience-based guess only |

**Decision thresholds:**

- **>= 80% High**: Proceed to fix
- **50-79% Medium**: Recommend supplementing data, or get explicit user approval before fixing
- **< 50% Low**: Continue investigation. Do NOT propose fixes.

## Troubleshooting Report

**Before attempting any fix**, generate a structured report and save to `docs/agent-rules/reports/YYYY-MM-DD-<issue>-troubleshooting.md`:

```markdown
# Troubleshooting Report

## Problem Summary
- Fault phenomenon: [one-sentence summary]
- Impact scope: [which operations/users/features affected]
- Duration: [since when, continuous or intermittent]
- Classification: [Crash/Functional/Performance/Intermittent/Data/Configuration/Integration-E2E/Stability]
- Environment: [which environment, runtime versions, topology, instance count]

## 5W1H
- What: [phenomenon vs. expected]
- When: [timeline]
- Where: [environment/service/module]
- Who: [affected users/scope]
- Why: [recent changes found]
- How: [reproduction steps]

## Investigation Process
- [Key investigation steps in timeline]
- [Verified hypotheses & results]
- [Ruled out directions]

## Root Cause Analysis (5-Why)
- Why1: ...
- Why2: ...
- ...
- Root cause: ...

## Key Evidence
[MUST quote original log text / API responses / DB results exactly. No paraphrasing.]

## Confidence Assessment
- Current confidence: [High/Medium/Low] ([percentage]%)
- Evidence items: [list each with type and weight]
- Unverified items: [what still needs verification]

## Fix Recommendation
1. [Specific executable step]
2. ...

## Prevention Recommendation
- [How to avoid similar issues in future]
```

### Phase 4: Implementation

**Gate:** Only enter this phase when confidence >= High, OR the user explicitly approves proceeding at Medium confidence.

#### Pre-Fix

1. **Read coding standards** -- Read from `config.rules["coding-standards"]` (default: `rules/coding-standards/`). Check `<CODING_STANDARDS_DIR>/code-review-error-rules.md` to identify rules applicable to the fix area
2. **Read testing standards** -- Check `rules/testing-standards/` for applicable test requirements
3. **Confirm scope** -- The fix must address ONLY the identified root cause. No "while I'm here" improvements.

#### Fix

1. **Create Failing Test Case** -- Use `test-driven-development`. The test must reproduce the exact bug scenario identified in Phase 1.
2. **Implement Single Fix** -- ONE change at a time, minimum necessary change.
3. **Verify Fix (HARD GATE)**:
   - **3a. Bug scenario fixed**: Run the new failing test — it must now PASS. This confirms the root cause is addressed.
   - **3b. No regression**: Run linked test suite (Go: packages of changed files; Python: test files covering changed modules). All existing tests must still pass.
   - **3c. Evidence**: Invoke `verification-before-completion`. Run the verification commands, read the full output, confirm pass. Do NOT claim success without evidence.
4. **Commit following `spec-commit`** (AI tag, structured message, no `git add -A`)
5. **Knowledge archival** -- After fix is committed, scan for reusable knowledge and present candidates to user:

   ```
   📦 知识归档候选项（排障完成）

   扫描到以下内容值得归档：
   1. [根因] xxx 导致 yyy（触发条件：zzz）
   2. [方案] 通过修改 xxx 解决，约束：yyy 不可用此方案
   3. [验证] 通过 xxx 测试确认

   请选择要归档的序号（如 1 2 3），或输入"跳过"不归档。
   ```

   若未扫描到复用价值内容，仍需告知用户：

   ```
   📦 知识归档候选项（排障完成）

   此次修复为项目特异性问题，未发现对团队有通用复用价值的内容。

   如有需要补充归档的内容，请现在告知；否则输入"继续"完成排障。
   ```

   用户确认后，对选中条目调用 `daedalus-knowledge` 执行归档，使用 `[根因]`/`[方案]`/`[约束]`/`[验证]` 格式。

6. **Risk assessment** -- What could this change break? What edge cases remain?
7. **Append fix record to report:**

```markdown
## Fix Record
- Changed files: [list]
- Bug scenario test: [pass/fail]
- Regression test: [pass/fail, N tests]
- Residual risks: [any remaining concerns]
```

7. **If fix doesn't work** -- If < 3 attempts: Return to Phase 1. **If >= 3: STOP. This is likely an architectural problem. Discuss with the user before attempting more fixes.**

## Stop-and-Ask Protocol

**STOP all operations and ask the user when:**

- Need real data (logs, screenshots, reproduction steps) that you don't have
- Confidence < 50% and no more investigation paths available
- Fix attempt #3 fails (likely architectural problem, escalate)
- About to modify code outside the identified root cause scope
- 5W1H collection is missing critical dimensions (What, Where, How)
- Encountering a component you have no context for
- The fault is intermittent and you cannot reproduce it
- Environmental context is incomplete -- you're analyzing on a different environment than the fault occurred
- Fault type is Integration/E2E or Stability and you lack environment topology or system state snapshot

**Do NOT:**
- Guess at data you should be reading from logs or responses
- Propose fixes at Low confidence
- Expand fix scope beyond the root cause
- Continue fixing after 3 failures without user discussion

## Red Flags -- STOP and Follow Process

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- Paraphrasing log output instead of quoting it exactly
- Forming conclusions without real data
- Skipping 5W1H and jumping straight to code
- Fixing symptoms while the root cause remains unknown
- **"Let me just read the code" (when fault type is Integration/Stability/Performance)**

**ALL of these mean: STOP. Return to Phase 1.**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check. |
| "I see the problem, let me fix it" | Seeing symptoms != understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. |
| "The log probably says X" | Read the actual log. Probably != definitely. |
| "Based on my experience, it's likely Y" | Experience is the weakest evidence. Get data. |
| "Let me fix this while I'm here" | Scope creep during debugging creates new bugs. |
| "I can't reproduce it, but I know the fix" | No reproduction = no verification = no confidence. |

## Supporting Techniques

- **`references/root-cause-tracing.md`** -- Trace bugs backward through call stack
- **`references/defense-in-depth.md`** -- Add validation at multiple layers after finding root cause
- **`references/condition-based-waiting.md`** -- Replace arbitrary timeouts with condition polling

**Related skills:**
- **test-driven-development** -- For creating failing test case (Phase 4)
- **verification-before-completion** -- Verify fix worked before claiming success
- **spec-commit** -- Commit fix following structured commit format
- **daedalus-knowledge** -- Search/contribute team knowledge (Step 0 and post-fix)

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## Real-World Impact

From debugging sessions:
- Systematic approach: 15-30 minutes to fix
- Random fixes approach: 2-3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: Near zero vs common
