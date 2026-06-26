# Installing cospowers for Codex

Enable cospowers skills in Codex via native skill discovery. Just copy and symlink.

## Prerequisites

- Git
- Access to the cospowers repository

## Manual Installation

1. **Copy or clone the repository to a local path:**
   ```bash
   # Example: place it at ~/.codex/cospowers
   cp -r /path/to/cospowers ~/.codex/cospowers
   # or git clone if hosted in a git repo
   # git clone <your-repo-url> ~/.codex/cospowers
   ```

2. **Create the skills symlink:**
   ```bash
   mkdir -p ~/.agents/skills
   ln -s ~/.codex/cospowers/skills ~/.agents/skills/cospowers
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.agents\skills"
   cmd /c mklink /J "$env:USERPROFILE\.agents\skills\cospowers" "$env:USERPROFILE\.codex\cospowers\skills"
   ```

3. **Restart Codex** (quit and relaunch the CLI) to discover the skills.

4. **For subagent skills** (optional): Skills like `subagent-driven-development` require Codex's multi-agent feature. Add to your Codex config (`~/.codex/config.toml`):
   ```toml
   [features]
   multi_agent = true
   ```

## How It Works

Codex has native skill discovery — it scans `~/.agents/skills/` at startup, parses SKILL.md frontmatter, and loads skills on demand. cospowers skills are made visible through a single symlink:

```
~/.agents/skills/cospowers/ → ~/.codex/cospowers/skills/
```

The `using-spec-developer` skill is discovered automatically and enforces skill usage discipline — no additional configuration needed.

## Environment Variables

See `README.md` for the full list of optional environment variables (`SPEC_DEVELOPER_SERVER_URL`, `KNOWLEDGE_URL`, `KNOWLEDGE_API_KEY`).

## Verify

```bash
ls -la ~/.agents/skills/cospowers
```

You should see a symlink (or junction on Windows) pointing to your cospowers skills directory.

## Updating

```bash
cd ~/.codex/cospowers && git pull
# or copy the updated files
```

Skills update instantly through the symlink.

## Uninstalling

```bash
rm ~/.agents/skills/cospowers
```

**Windows (PowerShell):**
```powershell
Remove-Item "$env:USERPROFILE\.agents\skills\cospowers"
```

Optionally remove the copy: `rm -rf ~/.codex/cospowers`.
