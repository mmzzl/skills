---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

**Skill ID**: `requesting-code-review`

Other skills reference this skill via `requesting-code-review`.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## Review Method Routing

Code review has three methods, choose based on need:

| Review Method | Tool | Use Case |
|--------------|------|----------|
| **Manual Review** | code-reviewer agent | General code review, logic validation, coding standards check |
| **Quality Scan** | `review` skill | Deep data flow analysis, detect static defects, logical defects, memory issues |
| **Security Scan** | `security-review` skill | Security audit, vulnerability scan, penetration testing prep, OWASP Top 10 |

**Routing Decision:**
```
User requests code review
    │
    ├── General review → Dispatch code-reviewer agent
    │
    ├── Code quality issues (static defects, logical defects, memory issues) → Load `review` skill
    │
    └── Security-sensitive code / security audit / vulnerability scan → Load `security-review` skill
```

**Combined Use:** Can first dispatch code-reviewer agent for preliminary review, then load `review` or `security-review` skill for deep scan if issues found.

## Method 1: Manual Review (code-reviewer agent)

**1. Get git SHA:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code-reviewer subagent:**

Use Task tool with code-reviewer type, fill template at `agents/code-reviewer.md`

The code-reviewer MUST read and apply the team's coding standards during review. Read from `config.rules["coding-standards"]` (default: `rules/coding-standards/`):

Let `CODING_STANDARDS_DIR` = value of `config.rules["coding-standards"]` (default: `rules/coding-standards/`).

- `<CODING_STANDARDS_DIR>/code-review-error-rules.md` — E-rule violations (error/warning/suggestion)
- `<CODING_STANDARDS_DIR>/code-review-checklist.md` — 11-category review checklist
- Language-specific checklist (Python/Go/Shell)
- `rules/testing-standards/单元测试规范.md` — Testing standards (3-High priority) (keep original Chinese filename)

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Method 2: Quality Scan (review skill)

When deep automated analysis is needed, load `review` skill:

**⚠️ This will take a significant amount of time. Confirm with user before proceeding.**

Specify the target to scan:
- Specific file: `Use Skill tool to load \`review\` with args: <file_path>`
- Branch diff: `Use Skill tool to load \`review\` with args: <source_branch>..<target_branch>`
- Directory: `Use Skill tool to load \`review\` with args: <directory_path>`

**Purpose:** Detect static defects, security vulnerabilities, logical defects, memory issues via data flow analysis

**Use cases:**
- After code-reviewer identifies potential security patterns (SQL concatenation, eval usage, file operations)
- Before merge to main for critical code deep scan
- After fixing complex bug for verification

## Method 3: Security Scan (security-review skill)

When security-specific audit is needed, load `security-review` skill:

**⚠️ This will take a significant amount of time. Confirm with user before proceeding.**

Specify the target to scan:
- Specific file: `Use Skill tool to load \`security-review\` with args: <file_path>`
- Branch diff: `Use Skill tool to load \`security-review\` with args: <source_branch>..<target_branch>`
- Directory: `Use Skill tool to load \`security-review\` with args: <directory_path>`

**Purpose:** Threat exploration, taint analysis, OWASP Top 10, authentication/authorization checks

**Use cases:**
- Security audit, vulnerability scan
- Penetration testing prep
- When fixing bugs in security-related components (auth, payment, data handling)

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

See template at: requesting-code-review/agents/code-reviewer.md
