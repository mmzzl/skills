# Module Design Evaluator Dispatch Prompt Template

Use this template when dispatching a `module-design-evaluator` subagent from `module-design-spec` after each module overview design directory is written.

**Purpose:** Run an automated quality evaluation of a single module overview design directory (`index.md` + `ch*.md`) **in an isolated context**. The subagent executes Phase 0, Phase 1, Phase 3, and Phase 4 (rule loading, item-by-item scanning, scoring, report generation) without filling the main conversation context with hundreds of per-rule check lines.

> Phase 2 (cross-document consistency) is not executed by this skill — use `doc-quality-evaluator` for full cross-document evaluation.

**Dispatch after:** The module overview design directory is written to `docs/agent-rules/4-module-design/output/YYYY-MM-DD-<project>/<module>/` and the subagent reviewer step is complete.

```
Agent:
  subagent_type: "general-purpose"
  description: "Module overview design quality evaluation: [module name]"
  prompt: |
    You are a module overview design document quality evaluator. Run a full quality evaluation by following the module-design-evaluator skill.

    **Step 1:** Invoke the `module-design-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all evaluation phases exactly as the skill instructs.

    **Directory to evaluate:** [DESIGN_DIR]
    Replace [DESIGN_DIR] with the actual module overview design directory path, for example:
      - docs/agent-rules/4-module-design/output/2026-04-13-xxx/<module>/
    If the path is not yet known, omit this field and let the skill auto-discover.

    Complete all phases:
    - Phase 0: Load the module overview design directory and all relevant evaluation rule files
    - Phase 1: Item-by-item rule scanning (output each check result in real time)
    - Phase 3: Weighted scoring with full deduction breakdown
    - Phase 4: Save quality report to quality-reports/

    **Return to parent agent — compact summary only (do NOT dump the full report):**

    ## Module Design Quality Evaluation Result

    **Document:** [module design directory name]
    **Grade:** [A/B/C/D/F] — [score]/100
    **Report saved:** [path/to/quality-reports/YYYY-MM-DD-xxx-<module>-quality-report.md]
    **Red line status:** R1 [✅/❌] | R2 [✅/❌] | R3 [✅/❌]

    **Issues requiring fixes (Critical + Error only, ordered by severity):**

    | ID | Location | Issue | Fix Direction |
    |----|----------|-------|---------------|
    | ISSUE-001 | § X.X [section name] | [what is wrong] | [specific action to fix] |
    | ISSUE-002 | ... | ... | ... |

    **Warning-level issues (advisory):**
    - ISSUE-XXX: [brief description]

    **Proceed?** Yes (grade B or above, ≥ 80) / No (fix required)
```

**Parent agent action based on returned result:**

| Grade | Action |
|---|---|
| **A or B (≥ 80)** | Apply any Warning-level fixes if straightforward; continue to next module overview design or proceed to `writing-plans` |
| **C (65–79)** | Apply all Error+ fixes from the issues table; re-dispatch this subagent with the updated document path; repeat until grade B or above |
| **D (< 65) or F** | Major rework needed — return to `module-design-spec` and fix root issues before re-dispatching |

**Re-dispatch on C/D/F:** use the same prompt template with the same document path. The skill will re-evaluate from scratch and produce a fresh score. Iterate until grade B or above.
