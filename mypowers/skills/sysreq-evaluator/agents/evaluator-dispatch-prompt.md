# Sysreq Evaluator Dispatch Prompt Template

Use this template when dispatching a `sysreq-evaluator` subagent from `system-requirement-analysis`.

**Purpose:** Run a full automated quality evaluation of a system requirements document (`*-system-requirements.md`) **in an isolated context**. The subagent executes Phase 0 (loading), Phase 1 (item-by-item rule scanning for REQ-01~38 + AIN-01~16 + FN-01~04 + IA-01~05 + SUP-01~09), Phase 3 (scoring), and Phase 4 (report generation) without filling the main conversation context with hundreds of per-rule check lines.

**Note:** This evaluator is dedicated to system requirements documents only. Cross-document consistency checks are handled by `doc-quality-evaluator`.

**Dispatch after:** The system requirements document is written to `docs/agent-rules/specs/` and the subagent reviewer step is complete.

```
Agent:
  subagent_type: "general-purpose"
  description: "System requirements quality evaluation: [document name]"
  prompt: |
    You are a system requirements document quality evaluator. Run a full quality evaluation by following the sysreq-evaluator skill.

    **Step 1:** Invoke the `sysreq-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all evaluation phases exactly as the skill instructs.

    **Document to evaluate:** [DOC_PATH]
    Replace [DOC_PATH] with the actual file path of the system requirements document, for example:
      - docs/agent-rules/specs/2026-04-13-xxx-system-requirements.md
    If the path is not yet known, omit this field and let the skill auto-discover.

    Complete all phases:
    - Phase 0: Load the system requirements document and all relevant evaluation rule files
    - Phase 1: Item-by-item rule scanning (REQ-01~38 + AIN-01~16 + FN-01~04 + IA-01~05 + SUP-01~09, 75 items total, output each check result in real time)
    - Phase 3: Weighted scoring with full deduction breakdown (5 dimensions: 需求完整性 35%, 技术可行性 25%, 可测试性 20%, 规范符合性 15%, 架构合理性 5%)
    - Phase 4: Save quality report to quality-reports/

    **Return to parent agent — compact summary only (do NOT dump the full report):**

    ## Quality Evaluation Result

    **Grade:** [A/B/C/D/F] — [score]/100
    **Report saved:** [path/to/quality-reports/YYYY-MM-DD-xxx-quality-report.md]
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
| **A or B (≥ 80)** | Apply any Warning-level fixes if straightforward; proceed to design phase |
| **C (65–79)** | Apply all Error+ fixes from the issues table; re-dispatch this subagent with the updated document path; repeat until grade B or above |
| **D (< 65) or F** | Major rework needed — return to `system-requirement-analysis` and fix root issues before re-dispatching |

**Re-dispatch on C/D/F:** use the same prompt template with the same document path. The skill will re-evaluate from scratch and produce a fresh score. Iterate until grade B or above.
