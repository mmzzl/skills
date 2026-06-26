---
name: code-compliance-check
description: Pre-commit coding standards compliance check. Runs lint tools for format issues and checks coding standards for semantic violations (logging, audit, security). Called by committer before git add.
version: 1.0
type: skill
tags: [compliance, lint, standard, kb, committer]
---

# code-compliance-check

**Skill 标识**: `code-compliance-check`

Pre-commit compliance gate. Two sequential steps: coding standards check first (blocks on violation), then lint auto-fix (never blocks). Order matters — lint runs after standards to avoid format churn from code rework. Called by `committer` after unit tests pass, before `git add`.

## Inputs

- `diff` — output of `git diff HEAD` (new lines to check)
- `changed_files` — output of `git diff --name-only HEAD`
- `KB_SESSION_ID` — session ID from the current committer run (used for caching)

## Overview

```
code-compliance-check
├── Step 1: Coding Standards check  — load all standard docs by scope, check diff against every rule (blocks on violation)
│   ├── Always: 通用
│   └── Language: python2+python / python3+python (detect version) / go
└── Step 2: Lint auto-fix      — format auto-fix after standards pass (never blocks)
```

Step 1 must pass before Step 2 runs. If Step 1 fails, return to executor immediately — no point fixing format on code that will be rewritten.

## Extension Points

Before starting, read `cospowers.config.json` from the plugin root (2 levels above this skill's base directory — the directory shown in "Base directory for this skill" at skill load time). No fallback needed — the config always has valid defaults.

| Config field | Used for |
|---|---|
| `config.env.DAEDALUS_URL` | Remote KB server URL; non-null = remote mode, null = local rules mode |
| `config.env.DAEDALUS_API_KEY` | API key sent as `X-API-Key` header to Daedalus OpenAPI requests |
| `config.project.product` | Product identifier (e.g., SCC, SCP, DMP) |
| `config.rules["coding-standards"]` | Coding standards rules directory |

---

## Step 2 — Lint Auto-Fix (Format, Non-blocking)

Runs only after Step 1 passes.

Run available lint tools with **auto-fix** flags. Format issues are fixed in place — Track A never blocks the commit.

### Python

First detect the project's Python version:

```bash
# 1. pyproject.toml requires-python field
grep -oP 'requires-python\s*=\s*"[^"]*"' pyproject.toml 2>/dev/null

# 2. setup.py python_requires
grep 'python_requires' setup.py 2>/dev/null

# 3. shebang line of changed files
head -1 <first_changed_py_file> | grep -o 'python[0-9]'

# 4. which python interpreter the project uses
python2 --version 2>/dev/null && echo "py2" || echo "py3"
```

**Python 2** — use `autopep8` (ruff/flake8 do not support py2):
```bash
changed_py=$(git diff --name-only HEAD | grep '\.py$' | tr '\n' ' ')
if [ -n "$changed_py" ]; then
  if python2 -m autopep8 --version &>/dev/null; then
    python2 -m autopep8 --in-place $changed_py
  fi
  # autopep8 not available → skip, note [SKIP-LINT: no py2 lint tool]
fi
```

**Python 3** — use `ruff` (preferred) or `flake8`:
```bash
changed_py=$(git diff --name-only HEAD | grep '\.py$' | tr '\n' ' ')
if [ -n "$changed_py" ]; then
  if python3 -m ruff --version &>/dev/null; then
    python3 -m ruff check --fix $changed_py
  elif python3 -m flake8 --version &>/dev/null; then
    python3 -m flake8 $changed_py  # flake8 has no auto-fix; report only
  fi
fi
```

### Go

```bash
changed_go=$(git diff --name-only HEAD | grep '\.go$')
if [ -n "$changed_go" ]; then
  gofmt -w $changed_go   # overwrites files with corrected formatting
fi
```

### Frontend (*.vue / *.ts / *.js)

Skip — no standard tool configured.

### Track A Result

- Tool found and run → report what was auto-fixed (informational only, does not block)
- Tool not found → note `[SKIP-LINT: tool not available]`, continue
- **Track A never blocks the commit**

---

## Step 1 — Coding Standards Check (Blocking Gate)

### Step 1: Determine Scopes to Load

**Detect Python version first** (when `*.py` files are changed):

```bash
# 1. pyproject.toml requires-python
grep -oP 'requires-python\s*=\s*"[^"]*"' pyproject.toml 2>/dev/null
# 2. setup.py python_requires
grep 'python_requires' setup.py 2>/dev/null
# 3. shebang of first changed py file
head -1 <first_changed_py_file> | grep -o 'python[0-9]'
# 4. interpreter availability
python2 --version 2>/dev/null && echo "py2" || echo "py3"
```

| Condition | Add scope(s) |
|---|---|
| `*.py` changed, Python 2 project | `python2`, `python` |
| `*.py` changed, Python 3 project | `python3`, `python` |
| `*.go` files changed | `go` |
| `*.vue / *.ts / *.js` files changed | (frontend — no language scope) |
| Always | `通用` |

Note: Security, API design, database, GDPR/audit logging, and all other cross-cutting rules are classified under `通用` — no separate scopes exist for them.

Example for a Python 3 PR:
→ scopes = `[python3, python, 通用]`

Example for a Go PR:
→ scopes = `[go, 通用]`

### Step 2: Load Standard Documents (Session-Level Cache)

**If standard documents for these scopes were already loaded in this session, reuse the cache — skip to Step 3.**

**Mode detection** — read `cospowers.config.json` from the plugin root (see Extension Points above), then check:

```bash
# Read from cospowers.config.json
DAEDALUS_URL="${config_env_DAEDALUS_URL}"
DAEDALUS_API_KEY="${config_env_DAEDALUS_API_KEY}"

# Fall back to OS env vars if config values are null
if [ -z "${DAEDALUS_URL}" ]; then
  DAEDALUS_URL="${DAEDALUS_URL:-}"
fi
if [ -z "${DAEDALUS_API_KEY}" ]; then
  DAEDALUS_API_KEY="${DAEDALUS_API_KEY:-}"
fi


if [ -n "${DAEDALUS_URL}" ]; then
  MODE="remote"   # load from KB API
else
  MODE="local"    # load from local rules/ directory
fi
```

#### Local mode (DAEDALUS_URL not set)

Read files from `config.rules["coding-standards"]` (default: `rules/coding-standards/`). Plugin root is 2 levels above this skill's base directory (the `skills/code-compliance-check/` directory shown at load time).

Let `CODING_STANDARDS_DIR` = value of `config.rules["coding-standards"]` (default: `rules/coding-standards/`).

| Scope | Local file |
|-------|-----------|
| `通用` | `<CODING_STANDARDS_DIR>/通用编码checklist.md` |
| `python3` | `<CODING_STANDARDS_DIR>/python-checklist-py3-总规范.md` |
| `python2` | `<CODING_STANDARDS_DIR>/python-checklist-py2-总规范.md` |
| `python` | Same file as the detected version (`python3` → py3 file, `python2` → py2 file) |
| `go` | `<CODING_STANDARDS_DIR>/go-checklist.md` |

Read each file with the Read tool. If a file does not exist for a scope, skip that scope and note `[SKIP-SCOPE: file not found]`.

#### Remote mode (DAEDALUS_URL set)

Load standards from Daedalus OpenAPI. `DAEDALUS_URL` is the server root URL (do not include `/openapi/v1`). Every request must include `X-API-Key: ${DAEDALUS_API_KEY}`.

**Endpoint contract**:
- Scope enum endpoint: `GET ${DAEDALUS_URL}/openapi/v1/kb/meta/field-options`
- Rule document search endpoint: `GET ${DAEDALUS_URL}/openapi/v1/kb/search`
- Required query inputs from AI: `scopes=[...]` and `pipeline_role=coding`
- Optional additive inputs from AI: `tags=[...]` / `keywords=[...]` when the diff indicates relevant technologies
- Backend-owned defaults: do not pass `status`, `library_type`, `include_content`, or `size`

Fetch Daedalus scope options first, keep only detected scopes that exist, and always include `通用`. For every search response, follow pagination until all returned `total` items are collected, then deduplicate by document `id`.

**Graceful degradation** (remote mode only): If standards cannot be loaded (unreachable, timeout, missing/invalid API key), **do NOT silently skip**. Instead, report the failure to the user and ask:

```
⚠️ 编码规范服务不可达

无法从 KB API 加载编码规范文档。可能原因：网络问题、DAEDALUS_URL 配置错误、KB 服务异常。

请选择：
1. 降级为本地 rules/ 目录检查（使用本地规范文件继续 Step 1）
2. 排查服务异常原因后重试
3. 跳过本次规范检查（提交时将在 commit message 中标记 [SKIP-STANDARDS-CHECK: 规范不可达]）
```

| 用户选择 | 行为 |
|---|---|
| 1. 降级本地 | 切换到 local mode，从 `config.rules["coding-standards"]` 加载本地规范文件，继续 Step 1 |
| 2. 排查重试 | 等待用户修复问题，重新执行 Step 1 |
| 3. 跳过 | 跳过 Step 1 全部规范检查，在 commit message 追加 `[SKIP-STANDARDS-CHECK: 规范不可达]`，直接进入 Step 2 |

Do not retry automatically. Do not block the commit without user consent.

### Step 3: Review Diff Against Standards

Get the diff:

```bash
git diff HEAD
```

Review all lines starting with `+` (excluding `+++` file headers) against **every** loaded standard document — no document is skipped. For each rule in each document, check whether the diff violates it.

### Step 4: Output Result

Passed → proceed to Step 5 (write compliance cache), then Step 2 (lint auto-fix).

Failed → block immediately, output violation report (see Final Output section). Do not run Step 2.

### Step 5: Write Compliance Cache

After Step 1 passes, write a compliance cache file so that `spec-commit` Step 0 can skip re-checking already-verified documents. This eliminates redundant KB document fetching and rule-by-rule diff checking at commit time.

**Cache file path**: `docs/agent-rules/spec_developer/output/compliance-cache.json` (relative to repo root)

**Write the cache**:

```bash
BASE_COMMIT=$(git rev-parse HEAD)
CACHE_DIR="docs/agent-rules/spec_developer/output"
mkdir -p "$CACHE_DIR"
```

Cache file format:

```json
{
  "base_commit": "<HEAD commit hash>",
  "checked_at": "<ISO 8601 timestamp>",
  "source": "code-compliance-check",
  "scopes_checked": ["通用", "python3", "python"],
  "documents": [
    {"id": "doc-001", "title": "Python编码规范", "rules_checked": 15, "status": "pass", "update_time": null, "published_at": null, "content_hash": "<sha256>"}
  ],
  "files_checked": ["service/user.py", "api/order.py"],
  "summary": {"rules_total": 23, "pass": 20, "not_involved": 3, "violated": 0}
}
```

**Fields**:
- `base_commit`: `git rev-parse HEAD` at the time of check
- `documents`: one entry per KB document checked, with `id`, `title`, `rules_checked` count, and `status` (always `"pass"` — cache is only written on pass)
- `documents[].update_time` / `documents[].published_at`: KB document freshness markers when returned by Daedalus; use `null` if unavailable
- `documents[].content_hash`: SHA-256 hash of the exact document content checked, used as fallback freshness marker
- `files_checked`: list of files from `git diff --name-only HEAD` that were checked
- `summary`: aggregate counts across all documents

> Cache is only written when Step 1 passes. If Step 1 fails, no cache is written — the violation must be fixed and re-checked.

---

## Final Output

**All passed:**
```
✅ 编码规范校验通过
  - Step 1 (规范检查): 通过，共检查 N 篇规范
  - Step 2 (lint自动修复): 已修复 N 处格式问题 / 无需修复
```

**Step 1 failed** → block commit immediately, return to executor:

```markdown
## ❌ 编码规范校验不通过 — 禁止提交

**违规项**:
1. `path/to/file.py:42` — 问题描述
   依据规范: <文档标题>（ID: xxx）
   修复建议: xxx

**下一步**: 返回 executor 修复后重新触发 committer。
```
