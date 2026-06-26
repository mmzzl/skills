---
name: ipd-sync
description: |
  ipd-sync handles ALL IPD data transfer operations:
  
  UPLOAD to IPD:
  - Sync local E/F/S/T directory tree to IPD (完整同步/批量同步)
  - Upload single E/F/S/T item to IPD (部分同步)
  - Upload deliverable files to IPD activities (上传交付物/上传到活动)
  
  DOWNLOAD from IPD:
  - Download E/F/S/T requirements from IPD to local dir (下载IPD需求/从IPD下载)
  - Download deliverable files from IPD activities (下载交付物/下载活动文件)
  
  QUERY:
  - List activity deliverables (查看活动/查询活动交付物)
  
  Trigger: any mention of IPD sync/upload/download/deliverable/activity operations.
  Does NOT apply to GENERATING IPD stories from requirements — that's generate-ipd-story.
---

# IPD同步系统

**Skill 标识**: `ipd-sync`

## 能做什么

- **完整同步**：将本地 E/F/S/T 完整目录树批量同步到 IPD，自动创建 Epic → Feature → Story → Tech 层级
  > "帮我把 `docs\output\ipd-story\2026-06-04-灾备服务\` 同步到 IPD：
  > https://ipd.atrust.sangfor.com/ipd/project/102972/develop?productId=6&versionId=12818"

- **部分同步**：上传单个层级（Epic/Feature/Story/Tech-系统级/Tech-服务级），挂载到已有父节点下，支持树结构或单文件模式
  > "帮我把 `Feature1.1-服务注册\` 挂载到 Epic 1099431 下，树结构上传"
  > "帮我把 `Tech-服务级-注册灾备服务API.md` 挂载到 Tech-系统级 1099435 下"

- **从 IPD 下载**：从 IPD 下载需求（Epic/Feature/Story/Tech）到本地目录，支持树结构或单文件模式
  > "帮我把 IPD 需求 1099431 下载到 `~/downloads/`"
  > "从 https://ipd.atrust.sangfor.com/ipd/product/6/issue/1099431 下载需求到本地，树结构"

- **查询活动交付物**：获取活动关联的交付物信息（含模板文件下载地址）
  > "查看活动 12345 的交付物列表"

- **上传交付物文件**：智能识别文档类型，单文件直传或文件夹拼接上传
  > "帮我把 `docs\...\2026-05-31-resource-trial-requirements.md` 上传到活动 12345"
  > "帮我把 `docs\...\2026-06-04-resource-trial\` 上传到活动 12345"

- **下载交付物文件**：从活动下载指定类型的交付物文件到本地
  > "帮我把活动 12345 的系统需求文档下载到本地"

---

## 配置

The skill reads the IPD token from `~/.cospowers/ipd.json`:

```json
{
  "ipd": {
    "token": "your-ipd-token"
  }
}
```

If not configured, guide the user to provide their token:

> IPD token 未配置。请提供你的 IPD token，我会帮你写入 `~/.cospowers/ipd.json`。
> 获取 token：打开 http://ipd.sangfor.com → 左下角个人头像 → 复制用户 token

---

## 功能：完整同步

### 输入格式

The input is a directory tree starting from Epic:

```
docsRoot/
├── Epic1-<name>/
│   ├── README.md
│   ├── Feature1.1-<name>/
│   │   ├── README.md
│   │   ├── Story1.1.1-<name>/
│   │   │   ├── README.md
│   │   │   ├── Tech-系统级-<name>/
│   │   │   │   ├── README.md
│   │   │   │   ├── Tech-服务级-<name>.md
│   │   │   │   └── Tech-服务级-<name>.md
│   │   │   └── Tech-系统级-<name>/
│   │   └── Story1.1.2-<name>/
│   └── Feature1.2-<name>/
└── ...
```

**命名规范：**

| Level | Canonical Format (from generate-ipd-story) | Also Accepts |
|-------|---------------------------------------------|--------------|
| Epic | `Epic1-xxx` | `Epic-xxx`, `E04.xxx`, `【Epic】xxx` |
| Feature | `Feature1.1-xxx` | `Feature-xxx`, `Feature1-xxx`, `F04.xxx`, `【Feature】xxx` |
| Story | `Story1.1.1-xxx` | `Story-xxx`, `Story1.1-xxx`, `S04.xxx`, `【Story】xxx` |
| Tech-系统级 | `Tech-系统级-xxx` | `【系统级】xxx` |
| Tech-服务级 | `Tech-服务级-xxx.md` | `Tech-服务级/xxx.md`, `Tech-服务级-xxx/`, `【服务级】xxx` |

**Use script:** `sync_from_docs.js`

### URL 解析规则

When the user provides an IPD URL, parse the IDs from it. Do NOT ask the user to manually extract them.

**Project Develop Page URL:**

```
https://ipd.atrust.sangfor.com/ipd/project/{projectId}/develop?productId={productId}&versionId={versionId}&teamId={teamId}&...
```

Parse these parameters from the URL (all optional except `projectId` and `productId`):

| Parameter | Source | Required | Description |
|-----------|--------|----------|-------------|
| `projectId` | URL path `/project/{projectId}` | Yes | Project ID |
| `productId` | query `productId` | Yes | Product ID |
| `versionId` | query `versionId` | No | Version ID |
| `teamId` | query `teamId` | No | Team ID (directly mapped to `teamVersionId`) |

**Sync Target Logic:**

| # | Parameters Present | Sync Target |
|---|-------------------|-------------|
| 1 | `projectId` + `productId` | **项目需求池** (project backlog) |
| 2 | + `versionId` | 对应**版本** (specific version, team auto-resolved) |
| 3 | + `versionId` + `teamId` | 对应版本的**团队** (specific version + team) |

When `versionId` is present without `teamId`, the script auto-resolves the team via `getTeamsByProject`. When `teamId` is explicitly provided alongside `versionId`, it is used directly.

**What to Show the User:**

After parsing, always show the detected IDs first, then a single line indicating the sync target. **Only list parameters that were actually present in the URL — do NOT add missing parameters with explanations like "未提供" or "将自动解析".**

**Case 1 — projectId + productId:**

> 从 URL 解析到以下参数：
> - projectId: 102972
> - productId: 6
>
> 将同步到对应的**项目需求池**中。
> 即将同步 `docs\output\ipd-story\2026-06-04-灾备服务\` 到 IPD，是否确认？

**Case 2 — + versionId:**

> 从 URL 解析到以下参数：
> - projectId: 102972
> - productId: 6
> - versionId: 12818
>
> 将同步到对应的**版本**下。
> 即将同步 `...` 到 IPD，是否确认？

**Case 3 — + versionId + teamId:**

> 从 URL 解析到以下参数：
> - projectId: 102972
> - productId: 6
> - versionId: 12818
> - teamId: 8763
>
> 将同步到对应的**团队**下。
> 即将同步 `...` 到 IPD，是否确认？

### 执行流程

**Step 1: Parse User Input**

Extract from the user's message:
- **Path** (required) — a directory containing Epic/Feature/Story/Tech subdirectories
- **IPD URL** (required) — parse to get `projectId` (required), `productId` (required), `versionId` (optional), `teamId` (optional)

If the URL is missing or cannot be parsed for `projectId` and `productId`, ask:

> 需要两个信息才能开始同步：
> 1. **目录路径** — 包含 Epic/Feature/Story/Tech 目录结构的文件夹
> 2. **IPD 项目版本页面 URL** — 格式如 `https://ipd.atrust.sangfor.com/ipd/project/{projectId}/develop?productId=...`
>
> 请提供以上信息。

**Step 2: Verify Token**

```bash
node -e "const api = require('./scripts/ipd_api.js'); console.log('OK');"
```

If this fails with a token error, guide the user to configure `~/.cospowers/ipd.json`.

**Step 3: Verify Input & Show Structure**

Run a dry-run scan. The script outputs a tree view and a summary with counts per level.

```bash
node scripts/sync_from_docs.js "<docsRoot>" \
  --projectId <projectId> --productId <productId> \
  [--versionId <versionId>] [--teamId <teamId>] \
  --dry-run
```

Show the summary to the user and ask for confirmation before proceeding.

If the scan finds nothing or errors, stop and ask the user to check the path.

**Step 4: Confirm & Run Sync**

```bash
node scripts/sync_from_docs.js "<docsRoot>" \
  --projectId <projectId> \
  --productId <productId> \
  [--versionId <versionId>] \
  [--teamId <teamId>]
```

**Important:** Only pass `--versionId` and `--teamId` when they are present in the URL. The script handles all 3 parameter combinations.

The script creates all items from the input. Re-running will create duplicates — use with care.

**Step 5: Report Results**

> 同步完成！
> - 新建: 21 条
> - 共处理: 21 条需求
> - 工作量统计: 8 人天
> - 索引文件: `docs\output\ipd_index.yaml`

**Dry-Run Mode:**

```bash
node scripts/sync_from_docs.js "<path>" --projectId X --productId Y [--versionId Z] [--teamId T] --dry-run
```

### 脚本内部执行内容

1. **Scan** — Scan the directory tree to extract Epic→Feature→Story→Tech hierarchy
2. **Resolve team** — Calls `getTeamsByProject(projectId)` and matches by `versionId`
3. **Create loop** (ordered: Epic → Feature → Story → Tech):
   - Create each item via `createIssue` with the correct `parentId`
   - 300ms delay between creations to avoid rate limiting
4. **Generate index** — Writes `ipd_index.yaml` with hierarchy, IDs, URLs, and workload stats

**Workload Rules:**

| Type | Carries Workload |
|------|-----------------|
| Epic | No |
| Feature | No |
| Story | No |
| Tech-系统级 (with children) | No |
| Tech-系统级 (leaf) | Yes |
| Tech-服务级 | Yes (default 1 day, min 0.5 day) |

Only leaf Tech nodes (no children) count toward `total_estimated_days`.

### 重复同步

Re-running the sync command will create all items again. This is intentional — the script does not check for duplicates. Use with care.

### ipd_index.yaml 格式

After syncing, an index file is generated next to the input:

```yaml
stats:
  epic: 1
  feature: 2
  story: 2
  tech: 16
  total: 21
  total_estimated_days: 16

meta:
  project_id: 102972
  version_id: 12818
  team_id: 8763
  product_id: 6
  sync_time: "2026-05-31T..."
  source_file: "D:\\docs\\output\\2026-05-31-灾备服务-ipd.md"

issues:
  - id: 1099431
    type: epic
    name: 灾备服务全生命周期管理
    url: "https://ipd.atrust.sangfor.com/ipd/product/6/issue/1099431"
    children:
      - id: 1099434
        type: tech
        level: 系统级
        name: "Tech-系统级-XaaS服务注册模块"
        url: "..."
        children:
          - id: 1099435
            type: tech
            level: 服务级
            name: "注册灾备服务API"
            estimated_day: 1
```

---

## 功能：部分同步

When the user provides a single file or directory (instead of a full tree starting from Epic), collect the mount target and upload mode, then let the script and API handle the rest.

### Step 1: Collect Mount Target

Determine what the user provided and what's missing:

| Situation | Action |
|-----------|--------|
| User provided path + IPD URL | Extract `projectId`/`productId` from URL (and `versionId`/`teamId` if present). Skip to Step 2. |
| User provided path + parent ID | **Do NOT ask for projectId/productId or IPD URL.** Pass only `--parent-id` — the script auto-resolves project context from the parent node. Skip to Step 2. |
| User only provided path | Ask: "请提供该文件/目录要挂载到的父需求 ID" |

**Important:** Never ask the user for projectId/productId in partial sync. The script handles it. When the user gives a parent ID, just use it directly.

### Step 2: Confirm Mode (ALWAYS ask)

No matter how complete the information is, **always** ask:

> "树结构上传（含子级）或 单文件上传（仅该层级）？"

- **树结构**: Upload the item and all its children
- **单文件**: Upload only the item itself

(For `.md` files, single-only — skip this question.)

### Step 3: Run Sync

**With IPD URL** (mount as root — projectId/productId from URL):

```bash
node scripts/sync_from_docs.js "<path>" \
  --projectId <projectId> --productId <productId> \
  [--versionId <versionId>] [--teamId <teamId>] \
  [--single]
```

**With parent ID** (mount under existing item — script auto-resolves projectId/productId):

```bash
node scripts/sync_from_docs.js "<path>" \
  --parent-id <parentIssueId> \
  [--single]
```

If the API returns an error, decorate it:

> 无法上传到该节点：{API error message}
> 请检查挂载目标是否正确，提供新的父需求 ID。

---

## 功能：从 IPD 下载

从 IPD 下载需求（Epic/Feature/Story/Tech）到本地目录，支持树结构或单文件模式。

### URL 解析

用户可提供 IPD 需求 URL 或直接提供 issue ID：

```
https://ipd.atrust.sangfor.com/ipd/product/{productId}/issue/{issueId}
```

从 URL 中提取 `issueId` 和 `productId`。

### 执行流程

**Step 1: Parse Input**

Extract from the user's message:
- **Issue ID** (required) — from URL or directly
- **Output directory** (required) — target local folder
- **Product ID** (optional) — from URL if available, helps speed up sub-issue queries

**Step 2: Get Issue Info**

```bash
node -e "
const api = require('./scripts/ipd_api.js');
api.getIssueDetail(ISSUE_ID).then(d => {
  console.log('名称: ' + d.name);
  console.log('类型: ' + d.issueCategory);
  console.log('状态: ' + d.status);
  console.log('链接: ' + d.url);
}).catch(e => console.error(e.message));
"
```

Show the issue info to the user.

**Step 3: Confirm Mode**

Ask: "树结构下载（含子级）或 单文件下载（仅该层级）？"

- **树结构**: Download the item and all its children recursively
- **单文件**: Download only the item itself

**Step 4: Run Download**

```bash
node scripts/download_from_ipd.js <issueId> \
  --output <outputDir> \
  [--single] \
  [--productId <productId>]
```

**Step 5: Report Results**

The script outputs a summary of what was downloaded:

> 📊 下载概览：
> - 1 个 Epic
> - 3 个 Feature
> - 6 个 Story
> - 6 个 Tech-系统级（目录）
> - 12 个 Tech-服务级（.md 文件）
> - 总需求数: 28 条
>
> ✅ 下载完成: D:\downloads\Epic1-灾备服务\

### 下载输出结构

和上传输入结构一致：

```
outputDir/
└── Epic1-{名称}/
    ├── README.md
    └── Feature-{名称}/
        ├── README.md
        └── Story-{名称}/
            ├── README.md
            └── Tech-系统级-{名称}/
                ├── README.md
                └── Tech-服务级-{名称}.md
```

**目录命名规则：** 脚本自动从 IPD 名称中剥离已有前缀，加上规范前缀：
- Epic → `Epic1-{基础名称}/`
- Feature → `Feature-{基础名称}/`
- Story → `Story-{基础名称}/`
- Tech（有子级）→ `Tech-系统级-{基础名称}/`
- Tech（无子级）→ `Tech-服务级-{基础名称}.md`

**README.md 内容：** 包含 IPD 需求名称（H1）、HTML 描述、元信息（来源链接、状态、优先级、负责人）。

---

## 功能：交付物管理

### 查询活动交付物

When the user asks to view deliverables on an activity (e.g., "查看活动 12345 的交付物列表"):

```bash
node -e "
const api = require('./scripts/ipd_api.js');
api.getActivityDeliverables(12345).then(list => {
  if (!list.length) { console.log('该活动暂无交付物。'); process.exit(0); }
  console.log('交付物列表 (' + list.length + ' 个):');
  list.forEach((d, i) => {
    console.log('  ' + (i+1) + '. [' + d.type + '] ' + d.name + ' (id=' + d.id + ')');
    console.log('     状态: ' + d.state);
    console.log('     模板地址: ' + d.fileLink);
  });
}).catch(e => console.error(e.message));
"
```

Extract the `activityId` from the user's message. Present the results as a formatted table:

> 活动 12345 共有 N 个交付物：
> | # | 名称 | 类型 | 交付物ID | 状态 | 模板地址 |
> |---|------|------|---------|------|----------|
> | 1 | xxx | file | 678 | pending | https://... |

### 上传交付物文件

Two-step workflow: identify what to upload, confirm & upload.

#### Step 1: Identify Document Type & Target Deliverable

Extract from the user's message: **file/folder path** and **activity ID**.

**Always** call `getActivityDeliverables(activityId)` first to see what deliverables exist:

```bash
node -e "
const api = require('./scripts/ipd_api.js');
api.getActivityDeliverables(ACTIVITY_ID).then(list => {
  if (!list.length) { console.log('该活动暂无交付物。'); process.exit(0); }
  console.log('活动 ' + ACTIVITY_ID + ' 的交付物列表 (' + list.length + ' 个):');
  list.forEach((d, i) => {
    console.log('  ' + (i+1) + '. [' + d.type + '] ' + d.name + ' (id=' + d.id + ')');
    console.log('     状态: ' + d.state);
  });
}).catch(e => console.error(e.message));
"
```

**Determine the document type** from the path:

| Path Pattern | Document Type |
|-------------|---------------|
| `1-ai-requirements/output/` | 用户需求文档 |
| `2-system-requirements/output/` | 系统需求文档 |
| `3-overall-design/output/` | 系统设计文档（总设） |

If the path doesn't match any of the three:
> 未识别到 {folder} 的文档类型（路径不匹配 1-ai-requirements / 2-system-requirements / 3-overall-design）。请确认，或手动指定文档类型。

**Match document type to deliverable:**

| Deliverables Found | Action |
|--------------------|--------|
| 0 | "该活动暂无交付物，请检查活动 ID 是否正确。" |
| 1 match | Auto-select. Skip to confirmation. |
| Multiple matches | AI auto-matches by name (用户需求↔用户需求文档, 系统需求↔系统需求文档, 特性级总体设计/总设↔系统设计文档). Show: "匹配到交付物 **{name}**（{id}），确认吗？" If ambiguous, list matches and ask user to pick. |

#### Step 2: Confirm & Upload

**Single file:**

Show what will be uploaded, ask confirmation, then upload:

> 将 `{filename}` 上传到活动 {activityId} 的交付物 **{deliverableName}**，确认吗？

**Folder:**

Filter files by document type structure:

| Type | Files to Include | Files to Exclude |
|------|-----------------|-----------------|
| 用户需求文档 | The single `.md` file directly under output | `quality-reports/` |
| 系统需求文档 | `index.md` + `ch01` ~ `ch09` | `quality-reports/`, `ipd-story/` |
| 系统设计文档（总设） | `index.md` + `ch02` ~ `ch11` + `.yaml` OpenAPI files | `quality-reports/` |

Show the file list and ask confirmation:

> 识别为 **{文档类型}**，匹配到交付物 **{deliverableName}**，将上传以下文件到活动 {activityId}：
> - index.md
> - ch02-xxx.md
> - ...
>
> 已剔除以下无关文件：
> - 质量检测报告.md（质量报告）
>
> 确认吗？

After confirmation, merge and upload:

**Single file:** upload directly via `uploadDeliverableFile`.

```bash
node -e "
const fs = require('fs');
const api = require('./scripts/ipd_api.js');
const fileBuffer = fs.readFileSync('/absolute/path/to/file');
api.uploadDeliverableFile(DELIVERABLE_ID, ACTIVITY_ID, fileBuffer, 'FILENAME').then(result => {
  console.log('上传成功!');
  console.log('  文件路径: ' + result.filePath);
  console.log('  交付物状态: ' + result.deliverable.state);
}).catch(e => console.error(e.message));
"
```

**Folder:** AI selects the files, then merges via the merge script.

```bash
# AI filters the file list, then:
node scripts/merge_deliverable.js "<folder>" \
  --files "ch01-xxx.md,ch02-xxx.md,..." \
  --output "<merged-path>"
```

The script sorts files in chapter order (`index.md` always first, then ch01→ch12). Show the merged content to the user for review, then upload:

```bash
node -e "
const fs = require('fs');
const api = require('./scripts/ipd_api.js');
const fileBuffer = fs.readFileSync('<merged-path>');
api.uploadDeliverableFile(DELIVERABLE_ID, ACTIVITY_ID, fileBuffer, 'FILENAME').then(result => {
  console.log('上传成功!');
  console.log('  文件路径: ' + result.filePath);
  console.log('  交付物状态: ' + result.deliverable.state);
}).catch(e => console.error(e.message));
"
```

**Before executing:**
- Resolve all paths to absolute paths.
- Verify files exist and are readable.
- Always confirm with the user before uploading.

### 下载交付物文件

When the user wants to download a deliverable file from an activity. The user specifies a **document type** keyword: 用户需求文档 / 系统需求文档 / 系统设计文档（总设）.

**Step 1: Match Document Type to Deliverable**

Extract from the user's message: **activity ID** and **document type keyword**. Example:

> "帮我把活动 328570 的用户需求文档下载到本地"
> "下载活动 328570 的系统设计文档（总设）"

Call `getActivityDeliverables` to get the list:

```bash
node -e "
const api = require('./scripts/ipd_api.js');
api.getActivityDeliverables(ACTIVITY_ID).then(list => {
  if (!list.length) { console.log('该活动暂无交付物。'); process.exit(0); }
  console.log('交付物列表 (' + list.length + ' 个):');
  list.forEach((d, i) => {
    console.log('  ' + (i+1) + '. [' + d.type + '] ' + d.name + ' (id=' + d.id + ')');
    console.log('     状态: ' + d.state);
    console.log('     文件: ' + (d.filePath || d.fileLink || '(无)'));
  });
}).catch(e => console.error(e.message));
"
```

Match the document type keyword against deliverable names:

| User Keyword | Match Against Deliverable Name |
|-------------|-------------------------------|
| 用户需求文档 | 用户需求 |
| 系统需求文档 | 系统需求 |
| 系统设计文档 / 总设 | 特性级总体设计 / 总设 |

| Match Result | Action |
|-------------|--------|
| **Single match found** | Auto-select, skip to Step 2 |
| **No match** | List all deliverables and ask user to pick one. If the user picks a deliverable whose name does NOT match any of the three document types → "目前仅支持下载 用户需求文档、系统需求文档、系统设计文档（总设），请在这三种类型的交付物中选择。" |
| **Deliverable has no file** | Tell user and stop |
| **Activity has no deliverables** | "该活动暂无交付物。" and stop |

**Step 2: Download**

> 将活动 {activityId} 的交付物 {deliverableName}（{documentType}）下载到本地，确认吗？

```bash
node -e "
const api = require('./scripts/ipd_api.js');
api.downloadDeliverableFile(DELIVERABLE_ID, ACTIVITY_ID, 'ABSOLUTE_TEMP_PATH').then(result => {
  console.log('下载完成!');
  console.log('  文件大小: ' + (result.fileSize / 1024).toFixed(1) + ' KB');
}).catch(e => console.error(e.message));
"
```

**Step 3: Split into Chapter Structure**

The document type is already known from Step 1. Each type has a fixed chapter structure:

| Document Type | Output Directory | Structure |
|--------------|-----------------|-----------|
| 用户需求文档 | `docs/agent-rules/1-ai-requirements/output/YYYY-MM-DD-{project}/` | Single `.md` file — no split needed |
| 系统需求文档 | `docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-{project}/` | `index.md` + `ch01` ~ `ch09` |
| 系统设计文档（总设） | `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-{project}/` | `index.md` + `ch02` ~ `ch11` + `.yaml` OpenAPI files |

For **用户需求文档**, just move the downloaded file to the output directory.

For **系统需求文档** and **系统设计文档**, the downloaded file is a merged document joined by `<!-- split -->` separators. To split:

1. Read the merged file content
2. Split by `<!-- split -->` to get individual parts. The **first part is always `index.md`**.
3. For each remaining part, look at the heading to identify what it is:
   - `# 第X章 xxx` or similar → `chXX-xxx.md` (map to the chapter structure below)
   - `## xxx.yaml` or `## xxx.yml` → `xxx.yaml` (OpenAPI file, keep as-is)
4. Map chapter numbers to filenames using the structure above:
   - 系统需求文档: `ch01` ~ `ch09` (ch01 = 概述与范围, ch02 = 关键场景, ch03 = 功能需求, ...)
   - 系统设计文档（总设）: `ch02` ~ `ch11` (ch02 = 系统总体架构, ch03 = 硬件方案, ...) — note: **no ch01** in 系统设计文档
5. Build the `--files` list including ALL identified parts (both `.md` chapters and `.yaml` files). Run the split script:

```bash
node scripts/split_deliverable.js "<tempFile>" \
  --output "<outputDir>" \
  --files "index.md,ch01-概述与范围.md,ch02-关键场景.md,...,resource-trial-openapi.yaml"
```

**Important:**
- The `--files` list must follow the document type's specific chapter range and include ALL parts identified in step 3.
- The script splits in order — it assigns the 1st part to `index.md`, 2nd part to the next filename, and so on.
- **If the merged file contains a YAML section** (heading `## xxx.yaml`), it MUST be included in `--files`, typically as the last entry.

> 识别为 **{文档类型}**，已拆分到：
> `docs/agent-rules/{type}/output/YYYY-MM-DD-{project}/`
> - index.md
> - ch01-概述与范围.md
> - ch02-关键场景.md
> - ...
> - resource-trial-openapi.yaml

**Before executing:**
- Download to a temp path first, then split/move to final location.
- Verify the number of split parts matches the expected chapter count for the document type. If mismatched, review the content manually before splitting.

---

## 脚本路径参考

| Script | Path | Used For |
|--------|------|----------|
| API client | [ipd_api.js](scripts/ipd_api.js) | Shared by all scripts |
| Sync from dir | [sync_from_docs.js](scripts/sync_from_docs.js) | Directory tree sync |
| Download from IPD | [download_from_ipd.js](scripts/download_from_ipd.js) | Download issues to local |
| Merge deliverable | [merge_deliverable.js](scripts/merge_deliverable.js) | Merge chapter files for deliverable upload |
| Split deliverable | [split_deliverable.js](scripts/split_deliverable.js) | Split merged file back to chapters |
