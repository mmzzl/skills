# Doc Quality Evaluator (Cross-Document Consistency) Dispatch Prompt Template

Use this template when dispatching a `doc-quality-evaluator` subagent from `module-design-spec`, after all individual document evaluations by `sysreq-evaluator`, `overall-design-evaluator`, and `module-design-evaluator` are complete.

**Purpose:** Check cross-document consistency across system requirements, technical requirements / overall design, OpenAPI, and module overview design documents — verifying REQ traceability, technical solution alignment, API contracts, DFX number consistency, and module boundary alignment.

**Dispatch after:** All three document types have been individually evaluated and their quality issues resolved.

```
Agent:
  subagent_type: "general-purpose"
  description: "Cross-document consistency check: [project/feature name]"
  prompt: |
    You are a cross-document consistency evaluator. Run consistency checks by following the doc-quality-evaluator skill.

    **Step 1:** Invoke the `doc-quality-evaluator` skill using the Skill tool before doing anything else.
    **Step 2:** Follow all phases exactly as the skill instructs.

    **Document paths (all required; omit a type only if it does not exist for this project):**

    系统需求文档目录:   [SYSREQ_DIR]
    总体设计文档目录:   [OVERALL_DESIGN_DIR]
    OpenAPI 规格路径:   [OPENAPI_PATH]
    模块概要设计目录列表:
      - [MODULE1_DESIGN_DIR]
      - [MODULE2_DESIGN_DIR]

    Replace the bracketed placeholders with the actual file paths, for example:
      - docs/agent-rules/2-system-requirements/output/2026-04-13-xxx/
      - docs/agent-rules/3-overall-design/output/2026-04-13-xxx/
      - docs/agent-rules/3-overall-design/output/2026-04-13-xxx/xxx-openapi.yaml
      - docs/agent-rules/4-module-design/output/2026-04-13-xxx/auth/
      - docs/agent-rules/4-module-design/output/2026-04-13-xxx/api/

    Execute phases in order:
    - Phase 1: Receive document paths (confirm which checks will be skipped if a document type is absent)
    - Phase 2: Cross-document consistency checks (REQ traceability, technical solution alignment, API contracts, DFX numbers, module boundaries)
    - Phase 3: Output consistency report

    **Return to parent agent — compact summary only:**

    ## Cross-Document Consistency Result

    **Conclusion:** ✅ pass / ❌ fail
    **REQ traceability:** [N]/[N] covered
    **Technical solution consistency:** ✅ all consistent / ❌ [m] conflicts
    **API contract consistency:** ✅ all consistent / ❌ [m] mismatches
    **DFX number consistency:** ✅ all consistent / ❌ [m] mismatches
    **Module boundary consistency:** ✅ all consistent / ❌ [m] conflicts

    **Inconsistency issues (fail only):**

    | ID | Location | Inconsistency | Fix Direction |
    |----|----------|---------------|---------------|
    | ISSUE-001 | [doc / § X.X] | [what differs between documents] | [specific action to fix] |
    | ISSUE-002 | ... | ... | ... |

    **Proceed?** Yes (conclusion: pass) / No (fix required)
```

**Parent agent action based on returned result:**

| Result | Action |
|---|---|
| **pass** | Continue with the next step in the workflow |
| **fail** | Fix all listed inconsistency issues across the relevant documents; re-dispatch this subagent with the same paths; repeat until conclusion is pass |
