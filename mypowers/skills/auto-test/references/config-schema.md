# 配置结构（存根）

> **统一配置定义已迁移至 [unified-config.md](unified-config.md)。本文件仅作索引。**

## 存储位置

- **项目级配置**: `.cospowers/auto-test/config.yaml`（详见 unified-config.md §1）
- **任务目录**: `.cospowers/auto-test/tasks/{task_dir}/`（详见 unified-config.md §2）
- **数据 Schema**: `case_status.json` → unified-config.md §3；`dashboard_data.json` → unified-config.md §4

## 框架特定配置

| 配置 | 管理方 | 配置段 |
|------|--------|--------|
| RF 闭环配置 | `auto-test-rf` | `.cospowers/auto-test/config.yaml` → `rf:` |
| MCP/TP 闭环配置 | `auto-test-mcp` | `.cospowers/auto-test/config.yaml` → `mcp:` |

## task_config.yaml

```yaml
framework: mcp            # mcp | rf
created_at: "2026-06-08T10:30:00+08:00"
user_input: "/auto-test https://tp.sangfor.com/..."
```

## 固定框架选择

在当前工作目录创建 `.auto-test-framework` 文件：
```
mcp   # 或 rf
```
存在此文件时跳过框架识别。用户仍可通过命令行参数覆盖。

> 项目级配置 `.cospowers/auto-test/config.yaml` 中的 `framework` 字段优先级更高。
