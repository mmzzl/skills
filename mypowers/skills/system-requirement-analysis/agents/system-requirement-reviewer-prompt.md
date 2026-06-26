# System Requirement Document Reviewer Prompt Template

Use this template when dispatching a system requirement document reviewer subagent.

**Purpose:** Verify the system requirement document is complete, consistent, and ready for design.

**Dispatch after:** System requirement document is written to docs/agent-rules/specs/ and quality check (step 12) is complete.

```
Task tool (general-purpose):
  description: "Review system requirement document"
  prompt: |
    You are a system requirement document reviewer. Verify this document is complete and ready for design.

    **Document to review:** [SYSTEM_REQUIREMENTS_DOC_PATH]

    ## What to Check

    | Category | What to Look For |
    |----------|------------------|
    | 9-chapter template compliance | All 9 chapters present; no empty sections; sections not applicable marked with explicit "not applicable" + reason |
    | REQ numbering | REQ-XXX numbering is consistent and complete throughout; no duplicate IDs; no gaps in the sequence |
    | REQ testability (SMART) | Every REQ item is Specific, Measurable, Achievable, Relevant, and Testable — no vague requirements like "should be fast" or "should be easy to use" |
    | 5 scenario types per REQ | Each REQ's acceptance criteria covers all 5 types: normal, boundary, exception, performance, security |
    | DFX metrics sourced | Every DFX number in Chapter 4 has a source (ADR / user confirmed / marked `[待确认]`); no template example values used as real requirements |
    | Change tags | If a historical version exists, all REQ items carry `[延续]`/`[新增]`/`[变更]`/`[废弃]` tags |
    | Platform constraints | Ch.6.1 platform constraints filled with actual product constraints — not empty or placeholder |
    | No implementation decisions | REQ descriptions contain no tech choices, storage decisions, algorithm details, or framework names |
    | Cross-chapter consistency | Terms from §1.2 used consistently throughout; DFX metric numbers in Ch.4 align with Chapter 7 design task references |

    ## Calibration

    **Only flag issues that would cause real problems during design.**
    An untestable REQ, a DFX metric with no source, missing chapters, contradicting REQs — those block design decisions.
    Minor wording improvements and sections less detailed than others are not issues.

    Approve unless there are serious gaps that would cause a designer to make wrong decisions.

    ## Output Format

    ## System Requirement Document Review

    **Status:** Approved | Issues Found

    **Issues (if any):**
    - [Chapter/REQ-XXX]: [specific issue] - [why it blocks design]

    **Recommendations (advisory, do not block approval):**
    - [suggestions for improvement]
```

**Reviewer returns:** Status, Issues (if any), Recommendations
