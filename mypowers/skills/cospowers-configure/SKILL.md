---
name: cospowers-configure
description: Use when configuring cospowers for a new project — interactively guides replacement of KB servers, templates, rules directories, evaluators, and environment variables by writing to cospowers.config.json in the plugin root. Activated by "配置cospowers", "configure cospowers", "我有自己的规范", "替换模板", "用我自己的评估器", "设置环境变量".
---

# cospowers Configure

**Skill 标识**: `cospowers-configure`

Interactive configuration wizard. Reads the current `cospowers.config.json`, guides the user through replacing any built-in defaults with their own paths, skill names, or credentials, then writes the updated config back.

**This skill does NOT modify any skill files.** It only updates `cospowers.config.json`. cospowers skills read this file at runtime to override their built-in defaults.

---

## When to Use

- First time setting up cospowers in a project with an existing rules/template structure
- Replacing the KB server URL or credentials
- Swapping in custom evaluator skills
- Disabling evaluator gates for a lightweight workflow
- Updating paths after reorganizing project structure

---

## Checklist

1. **Load current config** — The plugin root is 2 levels above this skill's base directory (shown in "Base directory for this skill" at skill load time). Read `<plugin-root>/cospowers.config.json`. Parse and display current non-null values so the user knows what's already configured.
2. **Ask which category to configure** — Present a menu; user may configure one or all categories.
3. **Run the wizard for each selected category** — One question per field, provide recommended answer each time (see wizard sections below).
4. **Validate all provided values** — Verify paths exist and skills are resolvable before writing.
5. **Write updated config** — Merge changes into `cospowers.config.json` and display a diff summary.
6. **Offer to continue** — Ask if the user wants to configure another category.

---

## Step 1: Display Current State

After reading the config, output:

```
📋 cospowers.config.json 当前状态

✅ 已配置:
  env.KNOWLEDGE_URL = "http://..."
  templates.overall-design = "my-templates/overall-design.md"

⬜ 未配置 (null，无外部服务连接):
  env.SPEC_DEVELOPER_SERVER_URL, env.DAEDALUS_URL, env.DAEDALUS_API_KEY, env.GITLAB_TOKEN,
  env.GITLAB_TOKEN_PATH, kb.skill

⬜ 使用内置默认路径 (未自定义):
  kb.localPath = "doc/kb/", templates.ai-requirement, templates.system-requirement, ...

要配置哪个类别？
  1. project    — 项目信息（产品名称，用于项目标识）
  2. env        — 环境变量（服务地址、API Key、GitLab Token）
  3. kb         — 知识库访问（替换 kb-query 或本地 KB 路径）
  4. templates  — 模板文件（替换需求/设计/OpenAPI 模板）
  5. rules      — 规范目录（替换 design-review / coding-standards / dfx）
  6. evaluators — 质量门控（替换或禁用评估器 skill）
  7. 全部配置
```

---

## Restore: 还原默认配置

If the user selects **8. 还原默认配置**, execute the following:

1. Check if `<plugin-root>/cospowers.config.json.bak` exists using Bash (`test -f`).
2. **If backup exists**: Use Bash to copy the backup over the current config:
   ```
   cp <plugin-root>/cospowers.config.json.bak <plugin-root>/cospowers.config.json
   ```
   Then output:
   ```
   ✅ 已从 cospowers.config.json.bak 还原默认配置。
   
   还原内容：
   <show diff between old and restored config>
   ```
3. **If backup does not exist**: Output:
   ```
   ⚠️ 未找到 cospowers.config.json.bak 备份文件。
   
   尚未执行过配置操作，没有可还原的备份。请先通过选项 1-7 完成首次配置。
   ```

After restore, ask if the user wants to continue configuring other categories (loop back to step 2).

---

## Step 2: Category Wizards

### `project` — 项目信息

**product**
> "你的产品名称是什么（如 SCC、SCP、DMP）？用于标识当前项目所属产品线。没有则跳过。"

---

### `env` — 环境变量

Ask one at a time. For each, current value (if set) is shown. Recommended answer: keep null unless user has a service to connect.

**SPEC_DEVELOPER_SERVER_URL**
> "你是否有使用分析上报服务（hooks 使用上报）？如有，请提供 URL，格式：http://host:port。没有则跳过（hooks 以退出码 0 静默退出）。"

**DAEDALUS_URL**
> "你是否有 Daedalus 知识平台（daedalus-knowledge / code-compliance-check / spec-commit 合规检查 使用）？如有，请提供 URL，格式：http://host:port。没有则跳过（各 skill 自动降级，不阻塞流程）。"

**DAEDALUS_API_KEY**
> "Daedalus 平台 API Key。如需个人数据隔离请在 Daedalus 平台 → 个人信息 → 创建我的 API Key。不填则留空。"

**GITLAB_TOKEN**
> "你是否需要通过 cospowers 自动创建 GitLab MR？如需，请提供 Personal Access Token（需要 api 权限）。或者提供 token 文件路径（下一题），两者提供其一即可。"

**GITLAB_TOKEN_PATH**
> "是否通过 JSON 文件提供 GitLab token？格式：`{\"token\": \"...\"}` 或 `{\"gitlab\": {\"token\": \"...\"}}`。请提供文件绝对路径，或跳过。"

---

### `kb` — 知识库访问

**skill**
> "你是否有自己的产品知识库 skill（替换 cospowers 的 kb-query）？如有，请提供 skill 名称。没有则跳过（使用 kb-query → doc/kb/ → code-first 的默认检测顺序）。"

After user provides a skill name: verify the skill exists in the available skills list. If not found, warn: "未在已安装的 skills 中找到该 skill，请确认名称是否正确。是否仍然保存？"

**localPath**
> "你的本地知识库目录在哪里（替换默认的 doc/kb/）？请提供相对于 plugin 根目录的路径，或跳过。"

After user provides a path: use `ls` or `Glob` to verify the directory exists. If not found, warn before saving.

---

### `templates` — 模板文件

For each template key, show the cospowers default path and ask:

> "你是否有自己的 [ai-requirement / system-requirement / overall-design / module-design / micro-design / openapi] 模板？请提供文件路径（相对 plugin 根目录或绝对路径），或跳过使用 cospowers 默认：`[default path]`。"

After user provides a path: use `Read` tool to verify the file exists and is non-empty. If the file is not found, warn: "文件不存在，请确认路径后重试，或跳过。"

Group all template questions together but ask one at a time.

---

### `rules` — 规范目录

For each rules key, show the cospowers default directory and ask:

> "你是否有自己的 [design-review / coding-standards / dfx] 规范目录？请提供目录路径（相对 plugin 根目录或绝对路径），或跳过使用 cospowers 默认：`[default dir]`。"

After user provides a path: use `Glob` to verify `<path>/**/*.md` returns at least one file. If empty, warn: "目录为空或不存在，请确认后重试，或跳过。"

---

### `evaluators` — 质量门控

For each evaluator key, show the cospowers default skill name and ask:

> "你是否要替换 [aireq / sysreq / overall-design / module-design / doc-quality] 评估器？
>   - 输入 skill 名称 → 使用你自己的评估器
>   - 输入 false → 禁用该质量门控（跳过该阶段的评估）
>   - 跳过 → 使用 cospowers 默认：[default skill name]"

If user inputs `false`, confirm explicitly:
> "确认禁用 [evaluator name] 质量门控？禁用后该阶段不再做质量评估，文档直接进入下一步。(y/n)"

---

## Step 3: Validation Summary

Before writing, display what will be changed:

```
📝 即将写入 cospowers.config.json：

  env.KNOWLEDGE_URL:           null → "http://kb.example.com:8080"
  templates.overall-design:    null → "my-templates/overall-design.md"  ✅ 文件已验证
  evaluators.sysreq:           null → false  ⚠️ 将禁用 sysreq 质量门控

是否确认写入？(y/n)
```

---

## Step 4: Write Config

Merge the new values into the existing `cospowers.config.json` — only update the changed fields, preserve all existing values and comments. Write using the Write tool.

**Before writing**: create a backup of the current config if one does not already exist:
```bash
cp <plugin-root>/cospowers.config.json <plugin-root>/cospowers.config.json.bak
```
If `.bak` already exists, overwrite it with the latest pre-write state. This ensures `还原默认配置` (option 8) always restores the last saved state before the current configuration change.

After writing:

```
✅ cospowers.config.json 已更新。

配置立即生效——cospowers skills 下次运行时会自动读取新配置，无需重启。

是否继续配置其他类别？
```

---

## Validation Rules

| Value Type | Validation |
|---|---|
| URL string | Must start with `http://` or `https://`; warn if not reachable (but allow save) |
| File path | Use `Read` tool to verify file exists and is non-empty |
| Directory path | Use `Glob` to verify at least one `.md` or `.yaml` file exists inside |
| Skill name | Check if skill appears in available skills list; warn if not found but allow save |
| `false` | Require explicit confirmation before saving |
| `null` / skip | Always valid — resets to cospowers default |

---

## Plugin Isolation

`cospowers.config.json` is the **only** supported extension mechanism. cospowers's core workflow skills (`brainstorming`, `writing-plans`, `executing-plans`, `spec-commit`, etc.) enforce their own SOP and cannot be overridden by other plugins or skills. Only the leaf extension points declared in this config (evaluators, templates, rules, kb, env) are replaceable.

If you need to extend cospowers behavior beyond these extension points, the correct approach is to fork the plugin and modify the skill files directly — but that is outside the scope of this configuration wizard.

---

## Reference

Full schema documentation: `skills/cospowers-configure/references/config-schema.md`
