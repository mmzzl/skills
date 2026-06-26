# Plan Evaluator Dispatch Prompt Template

Use this template when dispatching a `plan-evaluator` subagent from `writing-plans` after the plan is written and self-review is complete.

**Purpose:** Run an automated quality evaluation of an implementation plan **in an isolated context**. The subagent executes Phase 0 (mode detection + load), Phase 1 (item-by-item scanning across 5 layers), Phase 3 (mode-adaptive weighted scoring), and Phase 4 (report generation) without filling the main conversation context with hundreds of per-item check lines.

**Dispatch after:** The plan document is written to `docs/agent-rules/plans/` and ready for evaluation.

```
Agent:
  subagent_type: "general-purpose"
  description: "Plan quality evaluation: [plan name]"
  prompt: |
    You are an implementation plan quality evaluator. Run a full quality evaluation by following the plan-evaluator skill.

    **Step 1:** Invoke the `plan-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all evaluation phases exactly as the skill instructs.

    **Plan to evaluate:** [PLAN_PATH]
    Replace [PLAN_PATH] with the actual plan file path, for example:
      - docs/agent-rules/plans/YYYY-MM-DD-feature-plan.md (single plan)
      - docs/agent-rules/plans/YYYY-MM-DD-project/index.md (multi-service parent index)

    Complete all phases:
    - Phase 0: Detect mode (Subsystem/System/Innovation), load plan, load upstream docs by mode
    - Phase 1: Item-by-item scan across 5 layers (38 items total, mode-adaptive)
    - Phase 1.3: Scan completion statistics (layer-by-layer pass/skip/violation summary)
    - Phase 1.4: Red line checks (R1/R2/R3, mode-dependent)
    - Phase 3: Mode-adaptive weighted scoring with full deduction breakdown
    - Phase 4: Save quality report to quality-reports/

    > Phase 2 (cross-document consistency) is skipped — plan evaluation focuses on plan-to-upstream traceability (Layer 2 TRC), not design-document-to-design-document consistency (handled by `doc-quality-evaluator`).

    **Return to parent agent — compact summary only (do NOT dump the full report):**

    ## Plan Quality Evaluation Result

    **Plan:** [plan file name]
    **Mode:** [Subsystem / System / Innovation]
    **Grade:** [A/B/C/D/F] — [score]/100
    **Report saved:** [path/to/quality-reports/YYYY-MM-DD-plan-quality-report.md]
    **Red line status:** R1 [✅/❌/⬜] | R2 [✅/❌] | R3 [✅/❌]

    **Issues requiring fixes (Critical + Error only, ordered by severity):**

    | ID | Plan | Location | Issue | Fix Direction |
    |----|------|----------|-------|---------------|
    | ISSUE-001 | [plan file] | Task N / Header | [what is wrong] | [specific action to fix] |
    | ISSUE-002 | ... | ... | ... | ... |

    **Warning-level issues (advisory):**
    - ISSUE-XXX: [brief description]

    **Verdict:** PASS (≥80) — ready for execution / FIX (65–79) — apply Error+ fixes, re-dispatch / REWORK (<65 or F) — fix root issues, re-dispatch
```

**Parent agent action based on returned result:**

| Grade | Action |
|---|---|
| **A or B (>= 80)** | Proceed to TRANSITION GATE → Execution Handoff |
| **C (65–79)** | Apply all Error+ fixes from the issues table. Re-dispatch this subagent with the updated plan path. **Max 2 repair rounds.** If still < B after round 2: present remaining issues to user, ask them to help fix. |
| **D (< 65) or F** | Major rework needed. Fix root issues, re-dispatch. Same max-2-rounds rule. If still < B after round 2: escalate to user. |

**Re-dispatch on C/D/F:** use the same prompt template with the same plan path. The skill will re-evaluate from scratch and produce a fresh score. Iterate until grade B or above (max 2 rounds).
