# cospowers — Skill-Driven Development Workflow

This project uses **cospowers**, an integrated skill system installed at `~/.opencode/skills/`.

## Entry Points

| Skill | When to Use |
|-------|-------------|
| `using-spec-developer` | Session start — skill usage guidance |
| `brainstorming` | ALL creative/development work — central router |
| `systematic-debugging` | Bug reports, test failures |
| `auto-test` | Automated testing loop (MCP/TP / RF) |
| `spec-commit` | Git commit / push / MR creation |

## Workflow

```
用户意图 ──→ brainstorming ──┬─ 小微项目 ──→ writing-plans-detail ──→ execution ──→ spec-commit
                            ├─ 增量项目 A ──→ requirement-analysis → system-requirement-analysis → overall-design-spec → module-design-spec → writing-plans → execution → spec-commit
                            ├─ 增量项目 B ──→ system-requirement-analysis → overall-design-spec → module-design-spec → writing-plans → execution → spec-commit
                            └─ 排障 ──→ systematic-debugging → test-driven-development → verification-before-completion → spec-commit
```

## Key Rules

- **Skills are not optional.** If even 1% chance a skill applies, invoke it.
- **Do NOT write code without brainstorming first.** Always route through brainstorming.
- **All commits go through `spec-commit`** for AI-native commit messages.
- **Use Sub Agent execution** (`subagent-driven-development`) for implementation plans.

## Tool Mapping (opencode)

Skills reference Claude Code tools. Here are opencode equivalents:
- `TodoWrite` → `todowrite`
- `Skill` → native `skill` tool
- `Task` with subagents → `task` tool with subagent_type
- `Read`, `Write`, `Edit`, `Bash` → native tools

## Useful Skills

- `cospowers-configure` — interactive config wizard
- `env-conflict-checker` — environment compatibility check
- `daedalus-knowledge` — team knowledge search/archival
- `design-master-perspective` — architecture/design decision guidance
- `session-context` — session state persistence
