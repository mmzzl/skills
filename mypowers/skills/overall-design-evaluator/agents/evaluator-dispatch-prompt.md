# Overall Design Evaluator Dispatch Prompt Template

Use this template when dispatching an `overall-design-evaluator` subagent from `overall-design-spec`.

**Purpose:** Run a full automated quality evaluation of overall design documents and OpenAPI specs **in an isolated context**. The subagent executes all phases (rule loading, item-by-item scanning, scoring, report generation) without filling the main conversation context with hundreds of per-rule check lines.

**Dispatch after:** The technical requirements design, overall design document, and OpenAPI spec are written to `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-<project>/` and the self-check steps are complete.

```
Agent:
  subagent_type: "general-purpose"
  description: "Quality evaluation: [document name(s)]"
  prompt: |
    You are a document quality evaluator. Run a full quality evaluation by following the overall-design-evaluator skill.

    **Step 1:** Invoke the `overall-design-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all evaluation phases exactly as the skill instructs.

    **Documents to evaluate:** [DOC_PATHS]
    Replace [DOC_PATHS] with the actual file paths produced by the current workflow, for example:
      - docs/agent-rules/3-overall-design/output/2026-04-13-xxx/index.md
      - docs/agent-rules/3-overall-design/output/2026-04-13-xxx/xxx-openapi.yaml
    If paths are not yet known, omit this field and let the skill auto-discover.

    Complete all phases:
    - Phase 0: Load documents and all relevant evaluation rule files
    - Phase 1: Item-by-item rule scanning (output each check result in real time)
    - Phase 3: Weighted scoring with full deduction breakdown
    - Phase 4: Save quality report to quality-reports/

    **Return to parent agent — compact summary only (do NOT dump the full report):**

    ## Quality Evaluation Result

    **Grade:** [A/B/C/D/F] — [score]/100
    **Report saved:** [path/to/quality-reports/YYYY-MM-DD-xxx-quality-report.md]
    **Red line status:** R1 [✅/❌] | R2 [✅/❌] | R3 [✅/❌]

    **Issues requiring fixes (Critical + Error only, ordered by severity):**

    | ID | Document | Location | Issue | Fix Direction |
    |----|----------|----------|-------|---------------|
    | ISSUE-001 | [doc name] | § X.X [section name] | [what is wrong] | [specific action to fix] |
    | ISSUE-002 | ... | ... | ... | ... |

    **Warning-level issues (advisory):**
    - ISSUE-XXX: [brief description]

    **Proceed?** Yes (grade B or above, ≥ 80) / No (fix required)
```

**Parent agent action based on returned result:**

| Grade | Action |
|---|---|
| **A or B (≥ 80)** | Apply any Warning-level fixes if straightforward; present documents to user |
| **C (65–79)** | Apply all Error+ fixes from the issues table; re-dispatch this subagent with updated paths; repeat until grade B or above |
| **D (< 65) or F** | Major rework needed — return to relevant checklist steps and fix root issues before re-dispatching |

**Re-dispatch on C/D/F:** use the same prompt template with the same document paths. The skill will re-evaluate from scratch and produce a fresh score. Iterate until grade B or above.
