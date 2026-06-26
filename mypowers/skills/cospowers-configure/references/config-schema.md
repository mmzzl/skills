# cospowers.config.json Schema Reference

This document describes every field in `cospowers.config.json`. It lives in the plugin root and is read at runtime by cospowers skills before they execute. All fields are optional — set to `null` (or omit) to use cospowers's built-in default.

---

## Reading Priority

For every field, cospowers applies this priority order:

```
cospowers.config.json (non-null value)
  → OS environment variable of the same name (env block only)
  → cospowers built-in default
```

This means you can set values in the config without changing any OS environment variables, and existing OS variables still work as a fallback if config is null.

---

## `project` — Project Metadata

Identifies the project context. `product` is an identifier for the product line the project belongs to.

| Field | Type | Default | Used By |
|---|---|---|---|
| `product` | string \| null | null | 项目产品线标识 |

**`product`** — 产品名称（如 SCC、SCP、DMP），用于标识当前项目所属产品线。

---

## `env` — Environment Variables

Controls the service endpoints and credentials used by cospowers skills.

| Field | Type | Default | Used By |
|---|---|---|---|
| `SPEC_DEVELOPER_SERVER_URL` | string \| null | null (local mode) | hooks 使用上报 |
| `DAEDALUS_URL` | string \| null | null (skip KB lookup) | `daedalus-knowledge`, `code-compliance-check`, `spec-commit` Step 0 |
| `DAEDALUS_API_KEY` | string \| null | null (per-user, configured via cospowers-configure) | `daedalus-knowledge`, `code-compliance-check`, `spec-commit` Step 0 |
| `GITLAB_TOKEN` | string \| null | null | `spec-commit` Step 8 |
| `GITLAB_TOKEN_PATH` | string \| null | null | `spec-commit` Step 8 |

**`SPEC_DEVELOPER_SERVER_URL`** — When set, hooks report usage events to this server. When null, hooks exit silently.

**`DAEDALUS_URL`** — The Daedalus platform URL, shared by `daedalus-knowledge` (knowledge search), `code-compliance-check` (coding standards KB), and `spec-commit` Step 0 (pre-commit compliance check). When null, each skill degrades gracefully without blocking the workflow. Note: this is a separate service from `SPEC_DEVELOPER_SERVER_URL`.

**`DAEDALUS_API_KEY`** — API key sent as `X-API-Key` header to `DAEDALUS_URL`. When null, is now per-user, configured via cospowers-configure or Daedalus personal page.

**`GITLAB_TOKEN` / `GITLAB_TOKEN_PATH`** — Used by `spec-commit` Step 8 to create GitLab MRs. `GITLAB_TOKEN` takes precedence over `GITLAB_TOKEN_PATH`. `GITLAB_TOKEN_PATH` points to a JSON file with `{"token": "..."}` or `{"gitlab": {"token": "..."}}` format. If both are null, falls back to `~/.qianliu/config.json` for backward compatibility.

---

## `kb` — Knowledge Base Access

Controls how cospowers skills discover and query the product knowledge base during requirement analysis and design.

| Field | Type | Default | Description |
|---|---|---|---|
| `skill` | string \| null | null | Replace `kb-query` with your own KB skill name |
| `localPath` | string \| null | null (`doc/kb/`) | Replace the local KB directory path |

**`skill`** — When set, cospowers invokes this skill name instead of `kb-query` for product knowledge queries. The replacement skill must support the same query interface (module/keyword search returning overview and API info).

**`localPath`** — When set and `skill` is null, cospowers Greps this directory instead of `doc/kb/` for local knowledge base lookups.

**KB discovery order (unchanged by config):**
```
config.kb.skill (if set) → kb-query (if available) → config.kb.localPath or doc/kb/ → code-first (Glob + Grep + Read)
```

---

## `templates` — Template File Overrides

Replace individual cospowers template files with your own. Paths are relative to the plugin root unless they start with `/` or `~/`.

| Key | cospowers Default | Used By |
|---|---|---|
| `ai-requirement` | `templates/user-requirement-template.md` | `requirement-analysis` |
| `system-requirement` | `templates/system-requirement-template.md` | `system-requirement-analysis` |
| `overall-design` | `templates/overall-design-template.md` | `overall-design-spec` |
| `module-design` | `templates/module-design-template.md` | `module-design-spec` |
| `micro-design` | `templates/micro-design-template.md` | `brainstorming` (lightweight projects, dual-path: patch/feature) |
| `openapi` | `templates/openapi-template.yaml` | `overall-design-spec` |

Set a key to a file path to replace the cospowers template entirely. The replacement file must follow the same structural conventions (chapter numbering, required sections) as the cospowers template it replaces, or the downstream evaluator gates may fail.

---

## `rules` — Rules Directory Overrides

Replace entire cospowers rules directories with your own. Paths are relative to the plugin root unless they start with `/` or `~/`.

| Key | cospowers Default | Used By |
|---|---|---|
| `design-review` | `rules/design-review/` | `overall-design-evaluator`, `module-design-evaluator` |
| `coding-standards` | `rules/coding-standards/` | `code-compliance-check` |
| `dfx` | `rules/dfx/` | `overall-design-spec`, `overall-design-evaluator` |

Set a key to a directory path to replace all files in that rules directory. The replacement directory must contain files with equivalent names to what the evaluator skills expect to load, or explicitly list what files exist so the evaluator can adapt.

---

## `evaluators` — Quality Gate Overrides

Replace or disable individual quality gate evaluator skills.

| Key | cospowers Default | Gate Location |
|---|---|---|
| `aireq` | `aireq-evaluator` | After `requirement-analysis` |
| `sysreq` | `sysreq-evaluator` | After `system-requirement-analysis` |
| `overall-design` | `overall-design-evaluator` | After `overall-design-spec` |
| `module-design` | `module-design-evaluator` | After each `module-design-spec` |
| `doc-quality` | `doc-quality-evaluator` | After last `module-design-spec` |

**Non-null string** — Use this skill name instead of the cospowers default evaluator. The replacement skill must return the same result format (grade A/B/C/D/F + issue list, or pass/fail for doc-quality).

**`false`** — Disable this gate entirely. The workflow proceeds without running the evaluator. Use with caution — skipping evaluators removes the quality assurance that prevents low-quality documents from reaching implementation.

**`null`** — Use cospowers default (no change).
