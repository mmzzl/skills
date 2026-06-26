# Aireq Evaluator Dispatch Prompt Template

Use this template when dispatching an `aireq-evaluator` subagent from `requirement-analysis`.

**Purpose:** Run a full automated quality evaluation of an AI requirements document (`*-requirements.md`) **in an isolated context**. The subagent executes Phase 0 (loading), Phase 1 (item-by-item rule scanning for REQ-AI-01 to REQ-AI-34), Phase 3 (scoring), and Phase 4 (report generation) without filling the main conversation context with hundreds of per-rule check lines.

**Note:** This evaluator is dedicated to AI requirements documents (Epic/Feature/Story format) only. Cross-document consistency checks are handled by `doc-quality-evaluator`.

**Dispatch after:** The AI requirements document is written to `docs/agent-rules/1-ai-requirements/output/` and the subagent reviewer step is complete.

```
Agent:
  subagent_type: "general-purpose"
  description: "AI requirements quality evaluation: [document name]"
  prompt: |
    You are an AI requirements document quality evaluator. Run a full quality evaluation by following the aireq-evaluator skill.

    **Step 1:** Invoke the `aireq-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all evaluation phases exactly as the skill instructs.

    **Document to evaluate:** [DOC_PATH]
    Replace [DOC_PATH] with the actual file path of the AI requirements document, for example:
      - docs/agent-rules/1-ai-requirements/output/2026-04-21-xxx-requirements.md
    If the path is not yet known, omit this field and let the skill auto-discover.

    Complete all phases:
    - Phase 0: Load the AI requirements document and all relevant evaluation rule files
    - Phase 1: Item-by-item rule scanning (REQ-AI-01 to REQ-AI-34, output each check result in real time)
    - Phase 3: Weighted scoring with full deduction breakdown (7 dimensions: 结构完整性 20%, DFX需求质量 20%, QS质量基线 20%, 需求规格质量 15%, 设计策略质量 10%, 移交就绪性 10%, AIN文档质量 5%)
    - Phase 4: Save quality report to quality-reports/

    **Return to parent agent — compact summary only (do NOT dump the full report):**

    ## Quality Evaluation Result

    **Grade:** [A/B/C/D/F] — [score]/100
    **Report saved:** [path/to/quality-reports/YYYY-MM-DD-xxx-quality-report.md]
    **Red line status:** R1 [✅/❌] | R2 [✅/❌] | R3 [✅/❌]

    **Issues requiring fixes (Critical + Error only, ordered by severity):**

    | ID | Location | Issue | Fix Direction |
    |----|----------|-------|---------------|
    | ISSUE-001 | [Epic/Feature/Story name] | [what is wrong] | [specific action to fix] |
    | ISSUE-002 | ... | ... | ... |

    **Warning-level issues (advisory):**
    - ISSUE-XXX: [brief description]

    **Proceed?** Yes (grade B or above, ≥ 80) / No (fix required)
```

**Parent agent action based on returned result:**

| Grade | Action |
|---|---|
| **A or B (≥ 80)** | Apply any Warning-level fixes if straightforward; proceed to system requirement analysis phase |
| **C (65–79)** | Apply all Error+ fixes from the issues table; re-dispatch this subagent with the updated document path; repeat until grade B or above |
| **D (< 65) or F** | Major rework needed — return to `requirement-analysis` and fix root issues before re-dispatching |

**Re-dispatch on C/D/F:** use the same prompt template with the same document path. The skill will re-evaluate from scratch and produce a fresh score. Iterate until grade B or above.
