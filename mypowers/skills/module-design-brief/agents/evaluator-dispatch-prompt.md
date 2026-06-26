# Module Design Brief Evaluator Dispatch Prompt

Use this template when dispatching a quality evaluation subagent from `module-design-brief` after the design document directory is written.

**Purpose:** Run a focused quality evaluation of a lightweight module design directory (all 10 files: index + ch02~ch09 + optional database-design). Only ch04 and database-design are evaluated for substantive content; all other chapters are verified for skeleton compliance ("不涉及" with reason, not empty).

**Dispatch after:** Step 4 (cross-chapter consistency check) is complete, before step 6 (user review).

```
Agent:
  subagent_type: "general-purpose"
  description: "Module design brief quality evaluation: [module name]"
  prompt: |
    You are a module design quality evaluator, specialized in lightweight (brief) module design documents where only Ch.4 (内部设计) and database-design have substantive content, and all other chapters are skeletons marked "不涉及".

    **Directory to evaluate:** [DESIGN_DIR]
    Replace [DESIGN_DIR] with the actual module design directory path, for example:
      - docs/agent-rules/4-module-design/output/2026-04-13-xxx/<module>/

    ## Evaluation Scope

    This evaluator checks only what is in scope for a brief module design:
    - **Ch.4 内部设计**: Full substantive evaluation (all 7 subsections)
    - **database-design.md**: Full evaluation if present; skipped if module has no persistent storage
    - **Skeleton chapters** (index, ch02, ch03, ch05, ch06, ch07, ch08, ch09): Verified for skeleton compliance only (not empty, states "不涉及" with reason)

    ## Phase 0: Load Documents and Rules

    1. Read all files in the design directory: `index.md`, `ch02-*.md` through `ch09-*.md`, and `database-design.md` (if exists)
    2. Read the following rule file:
       - `rules/design-review/design-01-doc-writing-standards-checklist.md` — M1 document writing standards

    ## Phase 1: Item-by-Item Scanning

    ### 1.1 Skeleton Chapter Compliance (Modified Red Line)

    Verify every file in the design directory:

    | File | Check |
    |------|-------|
    | `index.md` | Exists, contains metadata table and chapter index. Chapter summaries correctly mark chapters as "完整" (Ch.4, database-design if present) or "骨架" (all others). |
    | `ch02-模块职责和边界.md` | Not empty. Contains a brief module responsibility summary (3-5 lines). States "本次仅填写内部设计". |
    | `ch03-对外接口.md` | Not empty. States "接口契约见 OpenAPI 规格说明" or similar. |
    | `ch04-内部设计.md` | **Full evaluation — see 1.2 below.** |
    | `ch05-DFX特性设计.md` | Not empty. All 9 DFX dimensions state "不涉及，本次仅填写内部设计". |
    | `ch06-自测用例.md` | Not empty. States "不涉及，本次仅填写内部设计". |
    | `ch07-部署与发布.md` | Not empty. States "不涉及，本次仅填写内部设计". |
    | `ch08-总结与变更控制.md` | Not empty. States "不涉及，本次仅填写内部设计". |
    | `ch09-附录.md` | Not empty. Contains glossary/references OR states "不涉及". |
    | `database-design.md` | If module involves persistent storage: exists, **full evaluation — see 1.3 below**. If not: file may be absent, and ch04 §4.5.1 should state "不涉及". |

    **Critical:** Any skeleton chapter that is completely empty (no "不涉及" statement) is a blocking issue.

    ### 1.2 Ch.4 Internal Design Quality

    #### 1.2.1 Diagrams (Critical)

    - §4.1.2: Sub-module dependency diagram present, using Mermaid (`flowchart` or `graph`), not ASCII art. Each sub-module has a name and clear boundary.
    - §4.3: Each flow described has a Mermaid `sequenceDiagram` with `alt`/`else` branches for exception paths. Flowchart alone without sequenceDiagram is insufficient.

    #### 1.2.2 Flow Design Completeness (Critical)

    For each flow in §4.3:
    - Sequence diagram covers: normal path, parameter validation failure, authentication failure, external dependency unavailable, business logic exception, partial success requiring rollback
    - Step table present with `[内部]`/`[外部]` markers, exception handling column includes error codes and rollback actions
    - External calls annotated with interface paths
    - Function list includes parameter types, return types, and value ranges

    #### 1.2.3 Data Structure Design (Critical)

    - §4.5.1: Database tables in SQL DDL format (not Markdown tables). Each column has `COMMENT`, enum fields list all legal values, each index annotated with query purpose, each table annotated with owning repository.
    - §4.5.4: Configuration files specify storage path, format (yaml/json/ini), each field's type/default/range/meaning. Whether field change requires restart is explicitly marked.

    #### 1.2.4 Exception Handling (Error)

    - §4.6.1: Exception scenario table includes for each scenario: trigger condition, impact scope, handling strategy, recovery method
    - §4.6.2: Degradation strategy table includes: scenario, strategy, impact

    #### 1.2.5 Design Checklist (Warning)

    - §4.7: Design checklist covers maintainability, debuggability, testability, automation test support, scalability, stability, and effort estimate. Each dimension has a substantive assessment (not just "OK" or "满足").

    #### 1.2.6 Rigor Checks (Error)

    - Specific performance numbers (QPS, latency thresholds, timeout values) have a verifiable source (overall design §6, code benchmarks, user confirmation) OR are explicitly marked `[待确认]`
    - No contradictions within ch04 (e.g., §4.3 says timeout=30s but §4.6 says timeout=60s for the same scenario)
    - Sub-module names in §4.1 match those referenced in §4.3 flow step tables

    ### 1.3 Database Design Quality (if database-design.md exists)

    - §3.2: Complete table inventory
    - §3.3: Detailed table structures in SQL DDL format with `COMMENT` on each column, enum values listed, index annotations
    - §3.1: ER diagram present (Mermaid `erDiagram` or draw.io path)
    - §5.2: Backup and recovery strategy specified (backup type, cycle, retention, RTO, RPO)
    - DDL in database-design.md §3.3 is consistent with ch04 §4.5.1
    
    ### 1.4 M1 Document Writing Standards (Warning)

    - Naming conventions consistent within the document
    - Diagram numbering sequential
    - Cross-references point to correct sections
    - No placeholder text (e.g., "TODO", "TBD", "待补充") in substantive chapters — note: `[待确认]` markers are valid and not placeholders
    - Terminology consistent between ch04 subsections

    ## Phase 2: Scoring

    | Dimension | Weight | What It Measures |
    |-----------|--------|------------------|
    | Ch.4 内部设计质量 | 50% | Diagrams, flow completeness, data structure quality, exception handling |
    | 骨架章节合规 | 20% | All files exist, not empty, correctly marked "不涉及" |
    | 严谨性 | 15% | Numbers have sources, no contradictions, terminology consistent |
    | 数据库设计质量 | 10% | If database-design.md exists: DDL quality, ER diagram, backup strategy. If no database: this weight merges into Ch.4 quality (60%). |
    | M1 文档规范 | 5% | Format, naming, numbering |

    **Grade thresholds:**
    - A (≥90): All critical checks pass, no errors, minor warnings at most
    - B (≥80): All critical checks pass, ≤3 errors, fixable warnings
    - C (65-79): Critical checks have gaps, >3 errors
    - D (<65): Major gaps in ch04 or skeleton compliance
    - F: Any file completely empty, ch04 missing mandatory diagram, or DDL in Markdown table format

    ## Phase 3: Return Summary

    Return to parent agent in this exact format:

    ## Module Design Brief Quality Evaluation

    **Document:** [module name]
    **Grade:** [A/B/C/D/F] — [score]/100
    **Ch.4 status:** [Complete / Issues found]
    **Database design:** [Present: Complete / Issues found] | [Not applicable]
    **Skeleton compliance:** [All compliant / Issues found]

    **Issues requiring fixes (Critical + Error only):**

    | ID | Location | Issue | Fix Direction |
    |----|----------|-------|---------------|
    | ISSUE-001 | ch04 §4.1.2 | Missing sub-module dependency Mermaid diagram | Add Mermaid flowchart showing sub-module relationships |
    | ISSUE-002 | ch04 §4.5.1 | DDL in Markdown table format, must be SQL | Convert to CREATE TABLE statements with COMMENT |
    | ISSUE-003 | ch05 | Empty file, no "不涉及" statement | Add "不涉及，本次仅填写内部设计" |

    **Warning-level issues (advisory):**
    - ISSUE-XXX: brief description

    **Proceed?** Yes (grade B or above) / No (fix required)
```

**Parent agent action based on returned result:**

| Grade | Action |
|---|---|
| **A or B (≥ 80)** | Apply any Warning-level fixes if straightforward; continue to step 6 (user review) |
| **C (65-79)** | Apply all Error+ fixes from the issues table; re-dispatch evaluator; repeat until grade B or above (max 2 rounds) |
| **D (< 65) or F** | Major rework needed — fix root issues in ch04/skeleton compliance before re-dispatching |
