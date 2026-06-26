> 本文件仅供人阅读，不加入 AI 上下文。

# IPD 同步系统 — 用户手册

## 前置准备

### 配置 Token

在 `~/.cospowers/ipd.json`（即用户目录下的 `.cospowers/ipd.json`）中配置：

```json
{
  "ipd": {
    "token": "你的token"
  }
}
```

**获取 token：** 打开 http://ipd.sangfor.com → 左下角个人头像 → 复制用户 token。

如未配置，对 AI 说"配置 IPD token"即可。

---

## 功能一：完整同步（目录树 → IPD）

**用途：** 将本地的 Epic → Feature → Story → Tech 完整目录树一次性同步到 IPD。

### 目录格式要求

本地目录必须遵循以下结构（由 `generate-ipd-story` 产出）：

```
你的目录/
├── Epic1-灾备服务/
│   ├── README.md
│   ├── Feature1.1-服务注册/
│   │   ├── README.md
│   │   └── Story1.1.1-注册API/
│   │       ├── README.md
│   │       └── Tech-系统级-消息队列/
│   │           ├── README.md
│   │           ├── Tech-服务级-灾备注册.md
│   │           └── Tech-服务级-灾备注销.md
│   └── Feature1.2-灾备切换/
│       └── ...
└── Epic2-日志审计/
    └── ...
```

| 层级 | 规范命名 | 也接受 |
|------|---------|--------|
| Epic | `Epic1-灾备服务/` (目录 + README.md) | `Epic-xxx`、`E04.xxx` |
| Feature | `Feature1.1-服务注册/` (目录 + README.md) | `Feature-xxx`、`F04.xxx` |
| Story | `Story1.1.1-注册API/` (目录 + README.md) | `Story-xxx`、`S04.xxx` |
| Tech-系统级 | `Tech-系统级-消息队列/` (目录 + README.md) | `【系统级】xxx` |
| Tech-服务级 | `Tech-服务级-灾备注册.md` (单文件) | `Tech-服务级/xxx.md` |

### 使用方式

**第 1 步：复制 IPD 页面 URL**

在 IPD 中打开你要同步到的目标页面，复制浏览器地址栏的 URL。根据你想同步到的位置，打开对应的页面：

| 我想同步到 | 打开这个页面 | URL 示例 |
|-----------|------------|---------|
| 项目需求池 | 项目 → 需求池 | `.../project/{projectId}/develop?productId={productId}` |
| 某个版本下 | 项目 → 版本 → 需求 | `.../project/{projectId}/develop?productId={productId}&versionId={versionId}` |
| 某个团队下 | 项目 → 版本 → 团队 → 需求 | `.../project/{projectId}/develop?productId={productId}&versionId={versionId}&teamId={teamId}` |

**第 2 步：在对话中粘贴 URL + 本地目录路径**

> "帮我把 `docs\output\ipd-story\2026-06-04-灾备服务\` 同步到 IPD：
> https://ipd.atrust.sangfor.com/ipd/project/102972/develop?productId=6&versionId=12818"

AI 会自动从 URL 中提取参数，并告诉你同步目标是什么：

> 从 URL 解析到以下参数：
> - projectId: 102972
> - productId: 6
> - versionId: 12818
>
> 将同步到对应的**版本**下。

**第 3 步：确认并同步**

AI 会：
1. 输出目录结构概览（各层级数量）
2. 请你确认
3. 逐层创建 Epic → Feature → Story → Tech
4. 生成 `ipd_index.yaml` 索引文件

### 注意事项

- **重复运行 = 重复创建**。脚本不会检查 IPD 中是否已存在同名条目。
- 同步后生成 `ipd_index.yaml`，记录本地路径与 IPD ID 的映射关系。
- 仅叶子节点 Tech（无子级）计入工作量统计，默认 1 天/条。

---

## 功能二：部分同步（单个层级 → IPD）

**用途：** 上传单个目录或文件，挂载到 IPD 中已有的父节点下。

### 适用场景

- 只新增了一个 Feature，不想重新跑完整同步
- 补一个遗漏的 Tech-服务级文件
- 把某个 Story 挂载到已有的 Feature 下

### 使用方式

在IPD平台获取节点的ID，在对话中说：

> "帮我把 `docs\...\Feature1.1-服务注册\` 挂载到 Epic 1099431 下"

> "帮我把 `Tech-服务级-注册灾备服务API.md` 挂载到 Tech-系统级 1099435 下"

AI 会问你一个问题：

> 树结构上传（含子级）或 单文件上传（仅该层级）？

| 模式 | 效果 |
|------|------|
| 树结构 | 上传该层级 + 所有子级 |
| 单文件 | 仅上传该层级本身 |

（Tech-服务级 `.md` 文件始终为单文件模式，无需选择。）

### 挂载目标

| 要上传的层级 | 父节点类型 |
|------------|----------|
| Epic | 无需父节点（提供 IPD URL 即可） |
| Feature | Epic ID |
| Story | Feature ID |
| Tech-系统级 | Story ID |
| Tech-服务级 | Tech-系统级 ID |

---

## 功能三：从 IPD 下载需求（E/F/S/T）

**用途：** 将 IPD 中的需求（Epic/Feature/Story/Tech）下载到本地目录。

### 使用方式

> "帮我把 IPD 需求 1099431 下载到 `~/downloads/`"
> "从 https://ipd.atrust.sangfor.com/ipd/product/6/issue/1099431 下载需求到本地，树结构"

支持两种输入：
- **需求 ID**（如 `1099431`）
- **IPD 需求 URL**（自动提取 issueId 和 productId）

AI 会：

1. 获取需求信息（名称、类型、状态）展示给你
2. 询问：**树结构下载（含子级）或 单文件下载（仅该层级）？**
3. 从 IPD 递归拉取子需求，写入本地目录

### 下载输出结构

```
downloads/
└── Epic1-灾备服务/
    ├── README.md
    └── Feature-服务注册/
        ├── README.md
        └── Story-注册API/
            ├── README.md
            └── Tech-系统级-消息队列/
                ├── README.md
                └── Tech-服务级-灾备注册.md
```

- **命名规则：** 自动从 IPD 名称剥离已有前缀，重新加上规范前缀
- **README.md 内容：** 需求名称、HTML 描述、状态、优先级、负责人、IPD 链接

---

## 功能四：查询活动交付物

**用途：** 查看某个 IPD 活动下关联的交付物信息。

### 使用方式

> "查看活动 328570 的交付物列表"

AI 返回表格：

| # | 名称 | 类型 | 交付物ID | 状态 | 文件 |
|---|------|------|---------|------|------|
| 1 | 系统需求文档 | file | 458088 | submitted | /static/attachments/... |

---

## 功能五：上传交付物文件

**用途：** 将本地文档上传到 IPD 活动的交付物中。支持单文件直传或文件夹拼接上传。

### 使用方式

在对话中指定文件路径和活动 ID：

> "帮我把 `docs\...\2026-06-04-resource-trial-requirements.md` 上传到活动 328570"

### 单文件上传

> "帮我把 `docs\...\2026-06-04-resource-trial-requirements.md` 上传到活动 328570"

AI 会：

1. 查询活动交付物列表
2. 从路径识别文档类型（用户需求 / 系统需求 / 特性级总体设计）
3. **自动匹配**对应的交付物 → 确认后上传
4. 如果有多个匹配 → 列出让你选

### 文件夹上传

> "帮我把 `docs\...\2-system-requirements\output\2026-06-04-resource-trial\` 上传到活动 328570"

AI 会：

1. 查询活动交付物列表，自动匹配交付物
2. 识别路径为 **系统需求文档**
3. 筛选文件：`index.md` + `ch01`~`ch09`（自动排除质量报告）
4. 按章节顺序拼接为一个文件
5. 展示合并内容请你确认
6. 上传到匹配的交付物

### 支持三种文档类型

| 类型 | 来源路径 | 上传方式 |
|------|---------|---------|
| 用户需求文档 | `1-ai-requirements/output/xxx.md` | 单文件直传 |
| 系统需求文档 | `2-system-requirements/output/` (index.md + ch01~ch09) | 拼接后上传 |
| 系统设计文档 | `3-overall-design/output/` (index.md + ch02~ch10 + .yaml) | 拼接后上传 |

---

## 功能六：下载交付物文件

**用途：** 从 IPD 活动下载指定类型的交付物文件到本地，并自动拆分回章节结构。

### 使用方式

在对话中指定活动 ID 和文档类型：

> "帮我把活动 328570 的用户需求文档下载到本地"
> "下载活动 328570 的系统需求文档（总设）"

支持的三种文档类型：

| 你说 | AI 匹配交付物名称 |
|------|-----------------|
| 用户需求文档 | 含"用户需求"的交付物 |
| 系统需求文档 | 含"系统需求"的交付物 |
| 系统设计文档 / 总设 | 含"特性级总体设计"或"总设"的交付物 |

AI 会：

1. 查询活动交付物列表，按文档类型匹配目标交付物
2. **找到** → 自动选中，确认后下载；**没找到** → 列出所有交付物让你选
3. 如果你选的不是上述三种类型 → "目前仅支持下载 用户需求文档、系统需求文档、系统设计文档（总设）"
4. 下载后按类型拆分到对应目录：

| 文档类型 | 拆分结果 | 输出位置 |
|---------|---------|---------|
| 用户需求文档 | 单文件，不拆分 | `docs/agent-rules/1-ai-requirements/output/YYYY-MM-DD-{项目}/` |
| 系统需求文档 | `index.md` + `ch01`~`ch09` | `docs/agent-rules/2-system-requirements/output/YYYY-MM-DD-{项目}/` |
| 系统设计文档 | `index.md` + `ch02`~`ch10` + `.yaml` | `docs/agent-rules/3-overall-design/output/YYYY-MM-DD-{项目}/` |

---

## 快速参考

### 常用对话

| 我想做什么 | 这样说 |
|-----------|--------|
| 同步整个目录树到 IPD | "帮我把 `docs\...\` 同步到 IPD：\<URL\>" |
| 上传单个 Feature | "帮我把 `Feature1.1-xxx\` 挂载到 Epic \<ID\> 下" |
| 查看活动交付物 | "查看活动 \<ID\> 的交付物列表" |
| 上传文档到活动 | "帮我把 `docs\...\` 上传到活动 \<ID\>" |
| 下载活动交付物 | "下载活动 \<ID\> 的 \<文档类型\> 到本地" |
| 下载 IPD 需求 | "帮我把 IPD 需求 \<ID\> 下载到 `~/downloads/`" |

### 脚本清单

| 脚本 | 用途 |
|------|------|
| `ipd_api.js` | API 客户端（所有功能的基础） |
| `sync_from_docs.js` | 目录树 → IPD 同步 |
| `download_from_ipd.js` | IPD → 本地目录下载 |
| `merge_deliverable.js` | 章节文件拼接（上传用） |
| `split_deliverable.js` | 合并文件拆分（下载用） |

无需安装 npm 依赖，仅使用 Node.js 内置模块。

