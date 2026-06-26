---
name: env-conflict-checker
description: Use when checking for environment conflicts. Runs a script-first scan for external skills and config files that may compete with cospowers workflow, then asks the model to review the structured candidates. Activated by "检查环境冲突", "env check", "冲突检测", "环境诊断".
version: 1.1
type: skill
tags: [diagnostic, conflict-detection, environment, cospowers]
tools: [Read, Glob, Grep, Bash]
---

# Env Conflict Checker

**Skill ID**: `env-conflict-checker`

<HARD-GATE>
This skill is READ-ONLY. It must NEVER modify files, disable skills, or change configuration automatically.

The script phase only scans and writes a report to `docs/env-conflict-report.json`.

Any remediation must be proposed to the user explicitly and must not be executed automatically.
</HARD-GATE>

## Overview

Diagnose two classes of environment conflicts:

1. External skills whose trigger scope or workflow may compete with cospowers.
2. Preloaded config files whose instructions may weaken, bypass, or override cospowers workflow constraints.

This skill is **manual only**. It does **not** run on session start and does **not** rely on hooks.

## Output Contract

This skill always works in two stages:

1. **Script stage**
   Run the local scanner first. It performs deterministic checks only and writes:
   - `docs/env-conflict-report.json`

   The scanner primarily discovers skills from the filesystem:
   - project skill directories
   - user skill directories
   - plugin cache skill directories

2. **Model stage**
   Read the generated report and review only the reported candidates.
   The model is responsible for semantic judgment such as whether two skills truly overlap, whether a workflow is complementary or conflicting, and whether a config instruction is an actual override or just background preference.

INFO-only observations must not be written to the report.

## What The Script Checks Directly

The scanner directly detects:

- skill scan locations
- file existence and readability
- same-skill dedupe only when it resolves to the same physical file
- same-name different-path collision as script-confirmed `BLOCKER`
- cospowers self exclusion
- internal role exclusion
- skill metadata extraction
- domain keyword matches
- trigger phrase extraction
- hard-gate signal extraction
- direct-to-code / workflow bypass signal extraction
- explicit priority override text
- explicit Skill tool disable text
- explicit skip planning / design / brainstorming text
- explicit commit / push without confirmation text
- `disabledSkills`
- `permissions.deny`
- `MEMORY.md` body scan and recursive referenced `.md` scan
- obvious hard-conflict classification
- candidate collation
- report output to `docs/env-conflict-report.json`

## What The Model Must Review

The model must review:

- whether trigger scenarios truly overlap
- whether same-domain items actually differ in scope
- whether workflow is complementary, competitive, or conflicting
- whether hard-gate signals form a real competing workflow
- whether priority language truly overrides cospowers
- whether direct-to-code text is a real bypass or a false positive
- whether memory instructions across `MEMORY.md` and referenced memory files are merely preferences or actual workflow overrides
- final `WARN` / `BLOCKER` judgment for each candidate
- user-facing explanation and remediation guidance

The model must be conservative when downgrading script candidates:

- Do not conclude "environment is clean" merely because no `BLOCKER` remains after review.
- If two skills still share a real trigger surface, capability domain, or user-facing workflow entry point, keep at least `WARN` even when they can coexist.
- Use `NO_CONFLICT` only when the candidate is clearly out of scope, purely complementary, or the script evidence is based on negated / anti-pattern / "do not do this" text rather than an actual instruction.
- If overlap is real but manageable through scope separation, classify it as `WARN`, not `NO_CONFLICT`.
- If a candidate already entered the report and still shows same-domain overlap plus a plausible shared user request entry point, keep at least `WARN` unless the evidence is clearly false-positive or clearly out of scope.
- Different document outputs, different artifact locations, different operating layers, or different granularity are not sufficient by themselves to downgrade a same-domain same-trigger candidate to `NO_CONFLICT`.
- Treat "could both be activated by the same user ask" as conflict evidence even when the workflows can technically coexist.

High-consistency review rules:

- If a candidate contains confirmed `auto_commit_push` behavior, do not downgrade it to "scope is narrow" or "use with care".
- If a candidate contains confirmed automatic `push` behavior, classify it as `BLOCKER`.
- If a candidate contains confirmed automatic `commit` behavior without confirmation, classify it as at least `WARN`; if it is part of a reusable workflow rather than a one-off internal helper, classify it as `BLOCKER`.
- If a candidate contains explicit `priority_override_skills` language, do not downgrade it to `NO_CONFLICT`.
- If the language explicitly says override / supersede / ignore other skills or take precedence over skill instructions, classify it as `BLOCKER`.
- If a candidate contains confirmed `direct_implement`, `skip_design`, or `skip_brainstorm` behavior as an active instruction, do not downgrade it to `NO_CONFLICT`.
- Treat active "go straight to code", "implement directly", "skip design", or "skip brainstorming" workflow instructions as at least `WARN`, and classify them as `BLOCKER` when they compete with the cospowers requirement/design/plan flow.
- Do not use "different document outputs", "different artifact location", or "different layer" alone as a reason to downgrade a same-domain same-trigger candidate to `NO_CONFLICT`.
- If the same user request could plausibly activate both workflows, keep at least `WARN` even if one is broader or more specialized.

## Execution Order

Execute in strict order.

### Phase 1: Run The Scanner

Use the local script from this skill directory.

Path resolution rule:

- resolve `scripts/env_conflict_checker.js` relative to the directory containing this `SKILL.md`
- do not assume the scanned project contains `./skills/env-conflict-checker/`
- do not build the script path from the target project root

Run the Node entry directly with a Node.js 18+ interpreter using the resolved skill-local path:

```powershell
node "<resolved-skill-dir>/scripts/env_conflict_checker.js" --project-root .
```

The scanner always performs filesystem-first discovery.

### Phase 2: Read The Report

Read:

- `docs/env-conflict-report.json`

Treat the JSON report as the source of truth.

### Phase 3: Review Skill Candidates

For every skill candidate in the report:

1. Check the matched domains.
2. Check trigger hints.
3. Check hard-gate / bypass / priority / commit signals.
4. Decide whether it is:
   - not a real conflict
   - a manageable overlap
   - a real workflow conflict

When making this decision:

- treat anti-pattern sections, warning examples, and "what not to do" guidance as negative evidence, not as active competing instructions
- do not collapse same-domain / same-trigger candidates into `NO_CONFLICT` only because they operate on different documents or at different layers; if the user could plausibly trigger either one for the same request, keep `WARN`
- do not soften confirmed auto-commit / auto-push behavior into a mere usage note
- do not soften explicit priority override language into a style preference
- do not soften active direct-to-code / skip-design / skip-brainstorm instructions into harmless specialization
- if `trigger_comparisons` contains `high_overlap` or `possible_overlap`, default to at least `WARN` unless the candidate is clearly an anti-pattern example, clearly unrelated in actual use, or clearly outside cospowers scope
- if a candidate is in the same domain and the user could plausibly invoke both workflows with one natural-language request, do not downgrade it to `NO_CONFLICT`
- if the only reason to downgrade is "different documents", "different outputs", "different layer", or "different abstraction level", keep `WARN`

Required decision labels for the final user-facing answer:

- `BLOCKER`
- `WARN`
- `NO_CONFLICT`

Do not reintroduce `INFO` into the persisted report.

### Phase 4: Review Config Findings

For every config finding in the report:

1. Check whether the evidence actually changes workflow behavior.
2. Distinguish between:
   - harmless preference
   - partial override
   - hard contradiction

Special rule for `preloaded_instruction_file_present`:

- do not downgrade it based on file contents
- do not treat an empty file as harmless
- do not treat a short personal preference as harmless
- if the file exists on the active inheritance chain or fixed user-level path, it remains `BLOCKER`
- the required action is removal, relocation out of scope, or renaming so it is no longer preloaded
- do not read back the file contents in order to overturn this finding
- do not output conclusions such as "内容无害", "可以忽略", "empty file so no conflict", or "personal preference only" for this category
- if the report contains this category, the final diagnosis must keep it as a confirmed problem

Special review rules for common semantic categories:

- `preloaded_instruction_file_present`
  - existence alone is sufficient for a confirmed problem
  - empty file is still `BLOCKER`
  - harmless-looking text is still `BLOCKER`
  - remediation must require removal, relocation out of preload scope, or rename
- `auto_commit`
  - do not conclude "just be careful when using it"
  - if automatic push is present, classify as `BLOCKER`
  - remediation must require disablement or removal of the automatic push / commit logic
- `priority_override`
  - do not conclude it is harmless emphasis when the text explicitly overrides other skills or instructions
  - explicit override / ignore / supersede language is `BLOCKER`
- `workflow_bypass`
  - active direct-to-code / skip-design / skip-brainstorm instructions must not be treated as harmless style
  - if they compete with cospowers pipeline gates, classify as `BLOCKER`
- `same_name_path_collision`
  - if an external skill has the same normalized name as a cospowers baseline skill but resolves to a different physical path, it is a confirmed `BLOCKER`
  - do not downgrade it based on similar wording, same marketplace family, or apparent sync/mirror intent
  - remediation must require removal, disablement, or renaming of the external same-name copy

### Phase 5: Present Final Diagnosis

Your final response must:

1. Output only the final confirmed problems and the corresponding remediation guidance.
2. Include confirmed `BLOCKER` and `WARN` items only.
3. For each item, state the problem plainly and then give the concrete remediation action.
4. Do not include phase narration, scanner process, intermediate reasoning, candidate counts, false-positive discussion, or any "how I checked" explanation unless the user explicitly asks for it.
5. Keep the skill read-only unless the user explicitly asks for follow-up handling.
6. Use exactly two sections in this order: `问题` then `建议`.
7. `问题` must be a single Markdown table.
8. `建议` must be a flat bullet list.
9. Keep confirmed overlap-only `WARN` items in the final output when they still share a real trigger surface, capability domain, or user-facing workflow entry point with cospowers.

When presenting remediation guidance:

- give the user an explicit action for each confirmed item
- prefer file-specific guidance over generic advice
- for `preloaded_instruction_file_present`, tell the user that the detected preloaded instruction file must be removed from the active environment before relying on cospowers workflow
- if the file cannot be deleted permanently, tell the user to move it out of the active project scope or rename it so it will not be preloaded
- for `disabled_skill` and `permission_deny`, tell the user exactly which settings file must be edited and what kind of entry must be removed
- end with a short recheck instruction telling the user to rerun this skill after remediation

Hard output-format rules:

- In `问题`, always place `BLOCKER` rows before `WARN` rows
- The `问题` table must use exactly these columns: `级别 | 位置 | 问题 | 处理`
- `级别` only allows `BLOCKER` or `WARN`
- `位置` should be the concrete skill or config source path when available
- `问题` should contain the confirmed conflict only
- `处理` should be a short imperative action, not a paragraph
- Do not split `BLOCKER` and `WARN` into separate sections; distinguish them by table rows
- In `建议`, do not use a table
- In `建议`, do not repeat long diagnosis text; only write actionable remediation steps
- If there are no confirmed `BLOCKER` or `WARN` items, still keep the same two sections:
  - `问题`: output one table row `| NONE | - | 未发现确认冲突 | 无需处理 |`
  - `建议`: output one bullet stating the environment is currently clean
- Never omit or downgrade a reported `preloaded_instruction_file_present` item from the final `问题` table
- Do not omit a confirmed overlap-only `WARN` item merely because it does not rise to `BLOCKER`

Use this response shape by default:

```md
问题:

| 级别 | 位置 | 问题 | 处理 |
| --- | --- | --- | --- |
| BLOCKER | <path> | <confirmed conflict> | <short action> |
| WARN | <path> | <confirmed overlap/risk> | <short action> |

建议:
- <action 1>
- <action 2>
```

Do not add extra sections such as "过程", "分析", "诊断依据", "扫描结果汇总", or "无冲突项" unless the user explicitly asks for them.

## Scope Rules

Apply these exact scope rules:

- scan project-level and user-level targets
- write reports under `docs/`
- apply the same detection rules to all external skills within the scan scope
- do not write `INFO` items into the report
- for `MEMORY.md`, scan the file body and recursively follow referenced `.md` files
- keep memory reference traversal within the memory workspace roots and prevent cycles

## Scan Inputs

### Domain Definitions

Read:

`skills/env-conflict-checker/references/spec-domains.yaml`

### Config Targets

Read:

`skills/env-conflict-checker/references/config-files.yaml`

## Interpretation Notes

The script uses filesystem discovery as the only skill enumeration source.

Final semantic judgment still belongs to the model.

## Follow-Up Handling

If the user asks how to resolve a confirmed conflict:

- provide exact commands or config snippets
- do not execute them automatically
- keep changes narrowly scoped to the confirmed conflict

## Success Criteria

This skill is successful when:

1. the scanner has been run
2. the reports were generated under `docs/`
3. the model reviewed the reported candidates
4. the user receives a clear distinction between confirmed conflicts and false positives
