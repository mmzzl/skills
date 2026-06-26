# code-compliance-check — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

提交前合规检查门控。两个顺序步骤：先做编码规范检查（违规则阻断提交），再做 lint 自动修复（不阻断）。由 `committer` 在单元测试通过后、`git add` 前调用。

```
code-compliance-check
├── Step 1: 编码规范检查  — 按 scope 加载规范文档，逐条检查 diff（违规则阻断）
│   ├── 始终检查: 通用
│   └── 语言: python2+python / python3+python（自动检测版本）/ go
└── Step 2: Lint 自动修复  — 格式问题自动修复，从不阻断
```

Step 1 通过后才执行 Step 2。Step 1 失败则立即返回，不再进行格式修复。

---

## 无外部服务时的降级行为

### 规范文档加载（Step 1）

检测 `SPEC_DEVELOPER_SERVER_URL` 环境变量：

| 模式 | 条件 | 规范来源 |
|------|------|---------|
| **本地模式**（默认）| 未设置 `SPEC_DEVELOPER_SERVER_URL` | 读取 `rules/coding-standards/` 本地文件 |
| **远程模式** | 已设置 `SPEC_DEVELOPER_SERVER_URL` | 从远程知识库 API 加载 |

远程 Daedalus 协议：先请求 `GET ${DAEDALUS_URL}/openapi/v1/kb/meta/field-options` 获取 scope 枚举，再请求 `GET ${DAEDALUS_URL}/openapi/v1/kb/search` 拉取规则文档；请求头必须包含 `X-API-Key: ${DAEDALUS_API_KEY}`。AI 只传 `scopes`、`pipeline_role=coding` 以及可选 `tags/keywords`，不传 `status`、`library_type`、`include_content`、`size`。

> **结论：无 Daedalus / 无网络时，Step 1 规范检查照常运行，使用本地 `rules/` 文件，不会跳过。**

### Scope → 本地文件映射

| Scope | 本地文件 |
|-------|---------|
| `通用` | `rules/coding-standards/通用编码checklist.md` |
| `python3` | `rules/coding-standards/python-checklist-py3-总规范.md` |
| `python2` | `rules/coding-standards/python-checklist-py2-总规范.md` |
| `python` | 与检测到的版本对应的文件 |
| `go` | `rules/coding-standards/go-checklist.md` |

文件不存在时跳过该 scope 并标注 `[SKIP-SCOPE: file not found]`，不阻断整体流程。

### 远程模式降级（仅在远程模式下）

远程 API 不可达时，自动降级：跳过 Step 1 整体，在提交消息末尾追加 `[SKIP-STANDARDS-CHECK: 规范不可达]`，继续执行 Step 2 lint 修复，提交正常进行。

---

## Lint 工具（Step 2）

| 语言 | 工具（优先级） | 说明 |
|------|-------------|------|
| Python 3 | `ruff --fix`（首选）/ `flake8`（仅报告） | ruff 自动修复格式 |
| Python 2 | `autopep8 --in-place` | ruff 不支持 py2 |
| Go | `gofmt -w` | 直接覆盖修复 |
| Frontend | — | 无标准工具，跳过 |

工具未安装时标注 `[SKIP-LINT: tool not available]`，继续流程，不阻断。
