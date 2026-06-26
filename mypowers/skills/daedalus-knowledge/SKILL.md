---
name: daedalus-knowledge
version: 2.0
type: skill
description: |
  Daedalus 知识中枢检索技能。搜索团队知识库获取编码规范、技术方案、设计指引，解决问题后贡献知识形成闭环。
  遇到技术问题、错误信息、通用模式实现、或用户描述已遇到过的问题时触发。
author: daedalus
tags: [knowledge, rag, search, contribute, standard, guideline, evolution]
---

# daedalus-knowledge

**Skill 标识**: `daedalus-knowledge`

其他 skill 通过 `daedalus-knowledge` 引用本 skill。

Knowledge Hub Skill: When you encounter technical problems in conversation, proactively search the Daedalus Knowledge Hub for existing solutions to avoid repeatedly solving known problems.

## Configuration

Before starting, read `cospowers.config.json` from the plugin root (2 levels above this skill's base directory — the directory shown in "Base directory for this skill" at skill load time). No fallback needed — the config always has valid defaults.

| Config field | Used for |
|---|---|
| `config.env.DAEDALUS_URL` | Daedalus server URL; non-null = remote mode, null = local mode |
| `config.env.DAEDALUS_API_KEY` | API key for authentication; set via cospowers-configure or Daedalus personal page |
| `config.kb.localPath` | Local knowledge store directory for local mode |
| `config.project.product` | Project identifier for scope context |

## Environment Prerequisite

**Before executing any step**, read `cospowers.config.json` from the plugin root (see Configuration above) and detect the operating mode:

```bash
# Read from cospowers.config.json (config takes priority over OS env var)
DAEDALUS_URL="${config_env_DAEDALUS_URL}"
DAEDALUS_API_KEY="${config_env_DAEDALUS_API_KEY}"
KB_LOCAL_PATH="${config_kb_localPath:-memory/kb/}"  # default: memory/kb/

# Fall back to OS env var if config value is null
if [ -z "${DAEDALUS_URL}" ]; then
  DAEDALUS_URL="${DAEDALUS_URL:-}"
fi

if [ -n "${DAEDALUS_URL}" ]; then
  MODE="remote"
else
  MODE="local"
fi
```

- **Remote mode** (`DAEDALUS_URL` is set in config or OS env): Full API workflow (Steps 0–5). All API calls use this URL with `X-API-Key` header.
- **Local mode** (`DAEDALUS_URL` not set): Use local knowledge store at `KB_LOCAL_PATH`. See **Local Fallback Mode** section below. Do not attempt any API calls. Do not use any hardcoded IP address.

## Local Fallback Mode

When `DAEDALUS_URL` is not set, all knowledge operations use local files from `config.kb.localPath` (default: `memory/kb/`). Supports Claude Code, Codex, and any platform with file system access.

### Knowledge Directory

Use the path from `config.kb.localPath` (default: `memory/kb/` relative to project root). If the directory does not exist, create it on first write.

### Local Search

1. Check if `memory/kb/INDEX.md` exists:
   - No index → no local knowledge → treat as Case D (solve from scratch)
2. Use Grep to search `memory/kb/INDEX.md` and all `memory/kb/*.md` files for the keywords
3. For each matched file, read its full content and evaluate relevance (same criteria as Case A/C capsule matching)
4. Return the best match (if any); if none, treat as Case D

### Local Save (replaces Contribution Steps 2–4)

When a problem qualifies for contribution (same "When to Contribute" rules apply):

1. **Check for existing entry** — Grep `memory/kb/INDEX.md` for keywords. If found, update the existing file (merge, not append).
2. **Write knowledge file** — Use Write tool to save `memory/kb/<topic-slug>.md`:

```markdown
---
type: knowledge
scope: <project|module|domain>
trigger: ["keyword1", "keyword2"]
created: YYYY-MM-DD
updated: YYYY-MM-DD
confidence: 0.85
---

## [Root Cause] ...
## [Solution] ...
## [Constraints] ...
## [Verification] ...
## [Environment] ...
## [Related] ...
```

3. **Update index** — Append or update entry in `memory/kb/INDEX.md`:

```markdown
- [<topic-slug>](<topic-slug>.md) — <one-line summary> | trigger: keyword1, keyword2
```

4. **No node event recording** — Node evolution tracking requires the remote Hub; skip in local mode.

> Local knowledge is immediately searchable in the same session and in future sessions via the session-context memory system.

## When to Trigger

Search the knowledge Hub when **any** of the following conditions are met:

1. Error messages encountered (stack traces, compilation failures, runtime exceptions)
2. Common technical patterns needed (retry, caching, auth, concurrency, rate limiting)
3. User describes "previously encountered problem" or "still unresolved"
4. Debugging more than 1 attempt without finding root cause
5. User requests any code changes (new features, logic modifications, refactoring)
6. User requests inspection, review or analysis (code review, troubleshooting, performance analysis)
7. User asks about technical solutions or architecture design

## Operation Steps

### Step 0: Local Knowledge Base Priority Search (must execute first)

Before searching the remote Hub, **must first search the local knowledge base** -- local knowledge base responds faster with more precise context.

**Three-tier knowledge architecture search order**:

| Tier | Path | Description |
|------|------|------|
| Project-level | Current project `docs/kb/` | Project private knowledge base, highest priority |
| Module-level | `agent-rules/kb/{module}/` | Cross-project shared module knowledge |
| Domain-level | Agent personal skills directory (check available skills in the current session's system prompt) | General domain capabilities (via Skill invocation) |

**Search process**:

1. **Check project-level knowledge base**:
   ```bash
   ls docs/kb/ 2>/dev/null
   ```
   - If exists, use Grep to search keywords for matching documents
   - Found match -> use local knowledge directly, **skip remote Hub search**

2. **Check module-level knowledge base**:
   ```bash
   ls agent-rules/kb/ 2>/dev/null
   ```
   - Search `agent-rules/kb/{relevant-module}/` documents
   - Found match -> use module knowledge, **skip remote Hub search**

3. **Check Skill knowledge**:
   - Check if any installed skill (visible in the current session's available skills list) provides relevant domain knowledge (e.g., `understanding-{module}`)
   - Found match -> invoke Skill to get knowledge, **skip remote Hub search**

4. **No local match** -> continue executing Step 1-5 (remote Hub search process)

**Decision rules**:
- Local match with sufficient content -> use directly, don't call remote API
- Local match but insufficient content -> supplement with remote Hub
- No local match, **remote mode** -> continue Steps 1-5 (remote Hub search)
- No local match, **local mode** (DAEDALUS_URL not set) -> use **Local Search** from the Local Fallback Mode section above; if still no match, treat as Case D (solve from scratch)

### Step 1: Read Node Profile

Read current node's capability status from local cache:

```bash
cat ~/.evo_node_profile.json
```

Profile content example:
```json
{
  "nodeId": 1,
  "username": "zhangsan",
  "evolutionStage": "growth",
  "domainTags": {"sqlite": 3, "go": 2},
  "consumedCapsuleIds": ["sha256:a1b2..."],
  "totalConsumed": 12,
  "totalContributed": 5
}
```

If file doesn't exist, skip this step and perform anonymous search.

Also record the `username` field for use as `authorUsername` when contributing:

```bash
node -e "try{const p=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.evo_node_profile.json','utf8'));console.log(p.username||p.authorUsername||'unknown')}catch(e){console.log('unknown')}"
```

If no profile, try these in order:

```bash
# 1. git config
USERNAME=$(git config user.name 2>/dev/null)

# 2. ssh -T GitLab (parses "Welcome to GitLab, @?username!")
if [ -z "$USERNAME" ]; then
  USERNAME=$(ssh -T -o StrictHostKeyChecking=no -o ConnectTimeout=5 git@git.sangfor.com 2>&1 | grep -oP 'Welcome to GitLab, @?\K[^!]+' | head -1)
fi
if [ -z "$USERNAME" ]; then
  USERNAME=$(ssh -T -o StrictHostKeyChecking=no -o ConnectTimeout=5 git@mq.code.sangfor.org 2>&1 | grep -oP 'Welcome to GitLab, @?\K[^!]+' | head -1)
fi

# 3. whoami
USERNAME="${USERNAME:-$(whoami)}"
```

#### Step 1b: Ensure a valid nodeId (remote mode only)

> **Local mode**: skip — there is no node tracking in local mode.

`nodeId` is a database auto-increment primary key. **Never guess it** (1/2/3/10/100/1000 etc.) — unknown ids make every `node-events` call return `{"success": false, "message": "Node N not found"}`. A valid id only comes from one of two places:

1. **Profile** — if `~/.evo_node_profile.json` exists, read `nodeId` from it. Done.
2. **Self-register** — if there is no profile (the background analyzer hasn't run, or this is a fresh environment), register the node yourself via the node-register endpoint, then cache the returned id.

> **IMPORTANT**: the node-register endpoint lives under `/knowledge/`, **not** `/evo/`. There is no `/evo/nodes` route — `GET /evo/nodes` returns 307→404 by design. Use the `/knowledge/nodes/register` path below.

```bash
# Self-register and capture the real nodeId (USERNAME resolved above).
# platform: set to your agent if known (claude-code/codex/gemini/...), or omit - it is optional.
REG=$(curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/nodes/register" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${USERNAME}\"}")
NODE_ID=$(echo "$REG" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const r=JSON.parse(s);console.log(r&&r.success&&r.data?r.data.id:'')}catch(e){console.log('')}})")
echo "nodeId=${NODE_ID}"
```

Register is an **upsert** keyed on `username`: calling it repeatedly is safe and returns the same node. Persist the id so later steps and future sessions reuse it:

```bash
# Cache nodeId locally to ~/.evo_node_profile.json (home root, agent-neutral; best-effort, must not block contribution)
[ -n "${NODE_ID}" ] && node -e "const fs=require('fs'),os=require('os'),p=require('path').join(os.homedir(),'.evo_node_profile.json');let o={};try{o=JSON.parse(fs.readFileSync(p,'utf8'))}catch(e){}o.nodeId=${NODE_ID};o.username=o.username||'${USERNAME}';fs.writeFileSync(p,JSON.stringify(o,null,2))"
```

If register fails (network/endpoint unavailable), proceed **without** a nodeId: search and gene/capsule contribution do not need one. Only the optional `node-events` bookkeeping (Step 5 / Contribution Step 4) is skipped — see those steps.

### Step 2: Extract Search Keywords

**Keyword language rules (mandatory)**:

Knowledge Hub stores Gene/Capsule content **predominantly in Chinese**. Search uses `LIKE %keyword%` matching on `trigger`, `summary`, `content` fields, therefore **keyword language must match the stored content**.

**Mandatory rule: Search keywords must use Chinese, translation to English is prohibited.**

| User Problem | Correct Keywords | Wrong Keywords |
|---------|------------|------------|
| SQLite database lock | `"数据库锁"` | `"database locked"` |
| Need exponential backoff retry | `"重试"` | `"retry backoff"` |
| Go multi-version coexistence | `"Go 版本"` | `"go version mismatch"` |
| Batch operation transaction control | `"批量操作"` or `"事务"` | `"batch transaction"` |
| Frontend route duplicate registration | `"路由"` or `"重复注册"` | `"duplicate route"` |

**Keyword extraction method (by priority)**:
1. **Directly use keywords from user's original message** (optimal, as contributors typically use same vocabulary)
2. **Use Chinese technical terms**: Extract 2-4 core Chinese words from the problem
3. **Chinese-English mix** (only when the technical term itself is English): e.g., `"GOROOT"`, `"JSON 序列化"`, `"ORM 配置"`
4. **Translating Chinese descriptions to pure English keywords is prohibited**

**Multi-keyword strategy**: If first search yields no results, try different Chinese keywords (synonyms or shorter terms), rather than switching to English.

### Step 3: Search Hub (Remote mode only)

> **Local mode**: skip this step — use Local Search in **Local Fallback Mode** section above instead.

Call the unified Knowledge Hub search API. Do not split normal retrieval into separate document, network, capsule, or gene searches.

**Get server address:**
```bash
echo $DAEDALUS_URL
```

> **IMPORTANT**: If `DAEDALUS_URL` is not set, skip all API calls and return immediately. Do not use any hardcoded IP address.

**Search request:**
```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/search" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "<search keyword (Chinese preferred)>",
    "types": ["document", "kb_network", "capsule", "gene"],
    "top_k": 20,
    "node_id": <real nodeId from profile or Step 1b - omit if empty>
  }'
```

If no node profile, omit `node_id`:
```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/search" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "<search keyword (Chinese preferred)>", "types": ["document", "kb_network", "capsule", "gene"], "top_k": 20}'
```

> Include `node_id` when available; omit it when absent, never invent one. The response may include `data.prompt_sections`, which are prepared for direct AI consumption and should be used before falling back to raw `data.results`.

### Step 4: Evaluate Search Results

Unified search returns mixed knowledge results selected by the backend. If `data.prompt_sections` exists, apply those sections first; otherwise fall back to `data.results` and handle by type:

#### Case A: Document/standard matched

Documents contain coding standards, design guidelines, and project/team rules. Apply mandatory standards strictly. If content is empty, treat title/metadata as a weak clue only and verify against code before applying.

#### Case B: Capsule matched (specific reusable solution)

Capsule contains specific code implementations. Evaluation method:

1. Check `confidence` score -- higher is more reliable (0-1 range)
2. Check `success_streak` -- consecutive success count, >3 indicates highly reliable
3. Check `env_fingerprint` -- if environment fingerprint exists, compare with current environment compatibility
4. **Check knowledge freshness** -- if `lastVerifiedAt` is more than 30 days ago, mark as "needs verification", apply with extra caution
5. Read `content` -- understand the solution content

**Application method:**
- Directly reference Capsule's `content` field to modify code
- Make necessary adaptations based on current project context
- Inform user of solution source: "Found a relevant solution from team knowledge Hub"

#### Case C: Recipe matched (multi-step recipe)

Recipe is a workflow composed of multiple Genes. Handling:

1. Present recipe summary to user:
   - Title (title)
   - Description (description)
   - Step count (genes array length)
   - Each step's Gene strategy name

2. After user confirms, create Organism (execution instance):
```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/organisms" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "recipeId": <recipe_id>,
    "executorUsername": "<current username>"
  }'
```

   Then record recipe consumption event (records that this node consumed the recipe). **Best-effort + valid id only** — send only with a real `nodeId` (profile or Step 1b); skip if empty, never guess:
```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/node-events" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": <real nodeId from profile or Step 1b - skip the call if empty>,
    "eventType": "consume",
    "capsuleAssetId": "",
    "geneAssetId": "<recipe genes[0].geneAssetId>",
    "domainTags": ["recipe"],
    "outcome": "success"
  }'
```

3. Execute sequentially per Recipe's `genes` array:
   - Optional steps (`optional: true`) check `condition` before deciding to execute
   - Each step references corresponding Gene's strategic direction to generate specific solution
   - Update Organism after each step completion

4. Mark completed when all done:
```bash
curl -s -X PUT "${DAEDALUS_URL}/openapi/v1/evo/organisms/<organism_id>" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

#### Case D: Only Gene matched (strategic direction)

Gene provides strategic thinking but no ready-made implementation. Handling:

1. Read Gene's `summary` to understand strategic direction
2. Read Gene's `validation` to understand verification criteria
3. Generate specific implementation code based on strategic thinking + current project context
4. After resolution, background Analyzer will automatically associate this implementation as new Capsule in next cycle

#### Case E: No match

Solve from scratch normally. Background Analyzer will automatically distill this resolution process into new Gene + Capsule pair in next cycle.

### Step 5: Record Consumption Event (Remote mode only)

> **Local mode**: skip this step — no node event tracking in local mode.

After applying Capsule or Recipe, record consumption event to update node evolution status.

> Search hits with high relevance are counted automatically by the server as `use_count`; do NOT manually update hit/use totals.
>
> **Application feedback trigger (3-state):** After the user reacts to the knowledge you presented, first decide **whether it was actually used** (you applied its approach/code/decision), then judge correctness:
> - **Used and it worked / matched expectation** → `outcome: "used_correct"`
> - **Used but the knowledge is wrong or outdated** → `outcome: "used_wrong"` — you MUST fill `correction` with the corrected approach so a human can fix the entry
> - **Not used / irrelevant / user just glanced at it** → `outcome: "not_used"` (exposure only, does not count as success or failure)
>
> "Used" = you actually adopted the knowledge's content (not merely showed it). Distinguish "looked right but I didn't use it" (not_used) from "I used it and it was correct" (used_correct).
>
> Use the Capsule database `id` in `cap-*` format as `knowledge_id`, NOT `assetId`. For unified search results, prefer the returned `id` field for `/knowledge/feedback`; `assetId` is only for evo node events.
>
> **Best-effort + valid id only**: send this **only** when you have a real `nodeId` (from the profile or Step 1b self-register). If `nodeId` is empty, **skip this step** — do not invent an id. A failed or skipped `node-events` call is bookkeeping only; it never affects the solution you already applied. Recording with an unknown id just returns `{"success": false, "message": "Node N not found"}` and wastes a round-trip.

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/node-events" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": <real nodeId from profile or Step 1b - skip the call if empty>,
    "eventType": "consume",
    "capsuleAssetId": "<applied capsule asset_id>",
    "geneAssetId": "<corresponding gene asset_id>",
    "domainTags": ["<problem-related domain tags>"],
    "outcome": "success"
  }'
```

Then submit Capsule application feedback (3-state):

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/feedback" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_id": "<cap-* id from search result, NOT assetId>",
    "outcome": "used_correct",
    "node_id": <real nodeId from profile or Step 1b - omit if empty>,
    "feedback": "Applied this capsule and resolved the issue"
  }'
```

For `outcome: "used_wrong"`, **always** include `correction` with the corrected approach — this flags the capsule as `needs_review` and records your fix for a human to review:

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/feedback" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "knowledge_id": "<cap-* id>",
    "outcome": "used_wrong",
    "correction": "<the correct approach that should replace the wrong knowledge>",
    "feedback": "<what was wrong / outdated>"
  }'
```

For `outcome: "not_used"`, send just `{knowledge_id, outcome}` — it records exposure only, no count change. The legacy `"success": true/false` field still works (maps to used_correct / used_wrong).

## Explaining to User

When search finds results, briefly explain the source:

- "Found a relevant solution from team knowledge Hub (confidence 0.92, 7 consecutive successes), applying..."
- "Found a 3-step fix recipe, needs sequential execution: detect -> retry -> circuit break. Execute per recipe?"
- "Found a relevant strategic direction (exponential backoff retry), generating specific solution based on this..."

## Real-Time Contribution

> **Local mode**: Replace Contribution Steps 2–4 with **Local Save** from the Local Fallback Mode section. The "When to Contribute" rules and Pre-Contribution Mandatory Rules still apply.

When you **solve a technical problem** in a session, you should proactively contribute the solution to the knowledge Hub for team members' benefit. Don't wait for the background Analyzer to collect -- real-time contribution is more precise and complete.

### When to Contribute

**Core principle: Only contribute "pitfall", "user-guided", "takeover-reflux" knowledge, refuse to contribute "common sense".**

#### Must Contribute (meets both A + B)

**Condition A: Problem belongs to one of these types**
- Bug fix: Clear error message, cause not obvious
- Config/environment trap: Correct usage contradicts intuition, easy to stumble on
- Framework/library undocumented usage: Official docs don't cover or docs are misleading
- Cross-module integration issue: Involves coordination of multiple systems/services
- High-risk scenario experience: Involves security boundaries, concurrency races, data consistency handling
- Architecture decisions and constraints: Database selection, module communication methods, caching strategies

**Condition B: Resolution process meets any of the following**
- User **supplemented information multiple times** for AI to find direction (>=3 conversation rounds)
- User **corrected AI's misjudgment** (AI's initial direction was wrong)
- User **pointed out key clues** that AI couldn't discover alone
- AI debugged **more than 2 times** without self-resolution
- **Human takeover resolution** (AI triggered takeover condition, human completed it -- this is the most valuable knowledge source)

#### Don't Contribute (skip if any met)

- AI solved independently in **1-2 rounds** (problems not needing user guidance aren't scarce knowledge)
- Pure business logic changes (CRUD, UI adjustments, config modifications)
- General technical implementation that AI can complete independently (standard CRUD, common design patterns)
- Cause is immediately obvious (typo, missing import, syntax error)
- One-time operations (temporary scripts, data fixes, environment cleanup)

#### Quick Judgment Mnemonic

> **"Next time encountered, can AI handle it alone?"**
> - **Yes** -> Don't contribute
> - **No, needs human guidance** -> Contribute

### Pre-Contribution Mandatory Rules

#### Rule 1: Reuse existing Gene if available, create new only if none, duplicate creation prohibited

Before contributing a Capsule, **must search first** to confirm if Gene exists:

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/knowledge/search" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query": "<solution core Chinese keyword>", "types": ["gene", "capsule"], "top_k": 20}'
```

**Decision rules (choose one, no third option):**

| Search Result | Action |
|---------|------|
| Found Gene (`signalsMatch` has overlap / `summary` direction matches) | **Reuse** that Gene's `assetId`, create Capsule directly |
| No matching Gene found | **Create new** Gene, then create Capsule |

Multiple Capsules in the same strategy domain must belong to the same Gene, reflecting knowledge evolution rather than fragmentation.

#### Rule 2: JSON containing Chinese must be written to file for submission, inline in -d parameter is prohibited

Windows terminals encode Chinese in `curl -d '...'` using local codepage, causing garbled text stored in Hub.

**Mandatory approach (three steps):**
1. Use Write tool to write JSON to temporary file (auto UTF-8 encoding)
2. Submit with `--data-binary @"/path/to/file.json"`
3. Delete temporary file after submission

#### Rule 3: `authorUsername` must be a real identity, never empty and never the literal `agent`

Every Gene and Capsule payload **must** carry a real `authorUsername`. The backend defaults a missing/empty value to the literal string `"agent"` (`author = request.authorUsername or "agent"`), which destroys attribution — the Hub then shows `author: agent` instead of a person. This is silent: the contribution still succeeds, so it is easy to miss.

**Resolve the value before contributing, in this priority order:**
1. `nodeId`/`username` from `~/.evo_node_profile.json` (Step 1) — use its `username`
2. The `USERNAME` resolved in Step 1 (git config → ssh GitLab → whoami)
3. Step 1b also persists `username` into the profile, so once self-register runs, the profile always has it

**Forbidden:** leaving the placeholder `<username read from node profile>` literally in the payload, sending `null`/`""`, or hardcoding `"agent"`. If you genuinely cannot resolve any real identity, use the `whoami` result — never `agent`.

### Contribution Steps

#### Step 1: Search for existing Gene reuse (see Rule 1)

After search:
- **Match found** -> record that Gene's `assetId`, skip directly to Step 3
- **No match** -> continue Step 2 to create new Gene

#### Step 2: Create Gene (only when no match)

Write payload to file (see Rule 2), then submit:

```json
{
  "category": "repair|optimize|innovate|pattern|config|pitfall",
  "summary": "[Constraint/Decision/Rule/Forbidden] One-sentence strategy direction description",
  "signalsMatch": ["trigger signal 1 (Chinese)", "trigger signal 2 (Chinese)"],
  "validation": "How to verify the solution is effective (executable verification steps)",
  "authorUsername": "<real USERNAME from Step 1/1b - see Rule 3, never empty, never agent>",
  "nodeId": <real nodeId from profile or Step 1b - omit if empty>
}
```

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/genes" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @"/path/to/gene_payload.json"
```

**Contribution content language rule**: Gene's `summary`, `signalsMatch` and Capsule's `trigger`, `summary`, `content` **must use Chinese** (technical terms excepted, e.g., Go, SQLite, JSON keep English).

#### Step 3: Create Capsule

Write payload to file (see Rule 2), then submit:

```json
{
  "geneAssetId": "<reused or newly created Gene assetId>",
  "trigger": ["trigger keyword 1", "trigger keyword 2"],
  "summary": "Solution summary (one sentence)",
  "content": "Complete solution content (Markdown, as detailed as possible)",
  "confidence": 0.85,
  "scope": "<project|module|domain>",
  "envFingerprint": {"framework": "...", "lang": "...", "os": "..."},
  "authorUsername": "<real USERNAME from Step 1/1b - see Rule 3, never empty, never agent>",
  "nodeId": <real nodeId from profile or Step 1b - omit if empty>
}
```

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/capsules" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json; charset=utf-8" \
  --data-binary @"/path/to/capsule_payload.json"
```

Capsule's `content` must be in **Agent-consumable structured format** (not narrative paragraphs), using tag-prefix titles for Grep positioning:

```markdown
## [Root Cause] Root cause of the problem
[Root cause analysis]

## [Solution] Resolution approach
[Specific fix steps and code]

## [Constraints] Key considerations
- Prerequisites: [conditions that must be met before using this solution]
- Side effects: [potential impacts of this solution]
- Prohibited: [things absolutely not to do when using this solution]

## [Verification] How to confirm solution is effective
[Verification steps]

## [Environment] Applicable environment
- Language/Framework: [e.g., Go 1.21+ / Python 3.x]
- OS: [e.g., Linux/Windows]
- Dependencies: [e.g., specific library version required]

## [Related] Related code paths
- [e.g., src/order/order_service.py:cancel_order()]
```

#### Step 4: Record Contribution Event

> **Best-effort + valid id only**: this step is bookkeeping. The Gene/Capsule you created in Steps 2–3 is **already saved** and searchable — it does **not** depend on this event. Send it **only** when you have a real `nodeId` (from the profile or Step 1b self-register). If `nodeId` is empty, **skip this step**; never guess an id. An unknown id returns `{"success": false, "message": "Node N not found"}` and changes nothing.

```bash
curl -s -X POST "${DAEDALUS_URL}/openapi/v1/evo/node-events" \
  -H "X-API-Key: ${DAEDALUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": <real nodeId from profile or Step 1b - skip the call if empty>,
    "eventType": "contribute",
    "capsuleAssetId": "<newly created capsule asset_id>",
    "geneAssetId": "<used gene asset_id>",
    "domainTags": ["<problem-related domain tags>"],
    "outcome": "success"
  }'
```

## Session End Knowledge Sedimentation

At session end (user says "done", "that's it", receives COMPLETE/VERIFIED signals), proactively perform knowledge sedimentation check:

### Sedimentation Checklist

1. **Review this session**: Were technical problems solved? Were there key user guidance moments?
2. **Judge whether to contribute** (refer to "When to Contribute" rules)
3. **If contribution needed**: Execute contribution steps (Step 1-4)
4. **Local knowledge update**: If the solution has ongoing value for current project, suggest updating project local knowledge base

### Human Takeover Knowledge Reflux (Highest Priority)

When AI triggers takeover conditions (same problem fixed 3 times still failing, changes spanning 5+ modules), after human takes over and resolves, **must** reflux the takeover experience as knowledge:

1. **Record takeover reason**: Why did AI fail? Knowledge gap, reasoning bias, or tool limitation?
2. **Record correct solution**: How did human solve it? Key steps and decision points?
3. **Contribute to Hub**: Contribute as `pitfall` or `repair` type Gene + Capsule
4. **Capsule content must include**:
   - `## [Root Cause] Why AI failed` (clearly explain why AI couldn't handle it)
   - `## [Solution] Human's resolution steps` (precise to command/code level)
   - `## [Constraints] What AI should note next time` (avoid same reasoning bias)

> Human takeover experience is **the scarcest knowledge** -- it precisely marks AI capability boundaries, the highest value entries in the knowledge Hub.
