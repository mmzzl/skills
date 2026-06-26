# 配置结构（存根）

> **统一配置定义已迁移至 `auto-test/references/unified-config.md`。本文件仅作索引。**

## 存储位置

- **项目级配置**: `.cospowers/auto-test/config.yaml` → `mcp:` 段（详见 unified-config.md §1）
- **任务目录**: `.cospowers/auto-test/tasks/{task_dir}/`（详见 unified-config.md §2）

## MCP 特定字段索引

| 字段路径 | 说明 | 默认值 |
|---------|------|-------|
| `mcp.testbed.ip` | 测试床 IP | "" |
| `mcp.testbed.ssh_user` | SSH 用户名 | `admin` |
| `mcp.testbed.ssh_password` | SSH 密码 | `Sangfor@123` |
| `mcp.testbed.ssh_port` | SSH 端口 | `22` |
| `mcp.tp_task.project_id` | TP 项目 ID | "" |
| `mcp.tp_task.version_id` | TP 版本 ID | "" |
| `mcp.tp_task.ai_testcase_task_id` | AI 测试任务 ID | "" |
| `mcp.tp_task.testbed_name` | 测试床名称 | "" |
| `mcp.tp_task.exec_host_name` | 执行机名称 | "" |
| `mcp.tp_task.agent_version` | Agent 版本 | "" |
| `mcp.tp_task.tp_base_url` | TP 平台地址 | `https://tp.sangfor.com` |
| `mcp.strategy.case_fix` | 用例修复策略 | `auto_high` |
| `mcp.strategy.code_fix` | 代码修复策略 | `auto_deploy` |
| `strategy.max_rounds` | 最大重试轮数 | 3 |
