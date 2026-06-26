---
name: ferret
description: 远程服务器操控工具。通过内嵌二进制直接操作，执行命令、同步文件、构建部署，无需配置 MCP Server。支持单服务器或多服务器配置。
metadata:
  version: "1.0.0"
  triggers:
    - ferret、remote-build、远程执行、远程同步、远程构建
    - sync to remote、execute remote、远程命令
  agents: []
  tools: ["Read", "Bash"]
  model: sonnet
---

# Ferret — 远程服务器操控工具

像雪貂一样灵巧地钻入远程服务器。通过内嵌二进制（JSON-RPC over stdio）直接操作，零配置即用，支持 Windows 和 Linux 双平台。

## 脚本位置

```
<skill目录>/scripts/ferret.js                  — 操控入口
<skill目录>/bin/ferret-server.exe     — Windows 二进制
<skill目录>/bin/ferret-server         — Linux 二进制
<skill目录>/bin/config.json                     — 服务器配置
```

`<skill目录>` 即本 SKILL.md 所在目录的绝对路径。

## 操作一览

| 操作 | 命令 | 用途 |
|------|------|------|
| 执行命令 | `node <skill目录>/scripts/ferret.js execute "cmd" [--server name]` | 在远程服务器执行任意命令 |
| 同步文件 | `node <skill目录>/scripts/ferret.js sync --local <path> [--remote <path>] [--server name]` | 同步本地文件/目录到远程 |
| 同步+构建 | `node <skill目录>/scripts/ferret.js build --command "cmd" [--local <dir>] [--server name]` | 同步后执行构建命令 |
| 测试连接 | `node <skill目录>/scripts/ferret.js test [--server name]` | 验证 SSH 连接可达 |
| 列出服务器 | `node <skill目录>/scripts/ferret.js list` | 查看所有已配置服务器 |
| 添加服务器 | `node <skill目录>/scripts/ferret.js add-server --name <n> --host <h> [--user root] [--password pw] [--port 22] [--remote-root /root]` | 动态添加服务器 |
| 设置默认 | `node <skill目录>/scripts/ferret.js set-default --name <n>` | 设置默认服务器 |

## 工作流

### 1. 首次使用：检查服务器配置

```bash
node <skill目录>/scripts/ferret.js list
```

- 若只有一个服务器：后续操作自动使用，不需要 `--server`
- 若有多个服务器：用 `--server name` 指定，或用 `set-default` 切换默认

### 2. 动态添加服务器（如需要）

```bash
node <skill目录>/scripts/ferret.js add-server \
  --name testbed \
  --host 10.74.167.22 \
  --user admin \
  --password Sangfor@123 \
  --remote-root /root
```

### 3. 测试连接

```bash
node <skill目录>/scripts/ferret.js test --server testbed
```

### 4. 执行远程命令（最常用）

```bash
node <skill目录>/scripts/ferret.js execute "ls -la"
node <skill目录>/scripts/ferret.js execute "kubectl get pods -n dsp" --server testbed
```

### 5. 同步并构建

```bash
node <skill目录>/scripts/ferret.js build --command "go build && go test ./..." --local ./src
```

### 6. 仅同步

```bash
node <skill目录>/scripts/ferret.js sync --local ./dist --remote /data/app/dist
```

## 默认配置

`bin/config.json` 预置了默认服务器（可通过 `add-server` / 直接编辑修改）：

```json
{
  "defaultServer": "mcp-server",
  "servers": {
    "mcp-server": {
      "host": "10.72.6.212",
      "port": 22,
      "username": "root",
      "auth": { "password": "dsp@321" },
      "localRootDir": ".",
      "remoteRootDir": "/data/dsp_mcp_server"
    }
  }
}
```

## 与其他 skill 集成

本 skill 被以下 skill 依赖，作为远程命令执行通道：

- **auto-test** — 闭环启动前验证测试床连通性，部署后执行 kubectl 操作
- **dsp-code-deploy** — 更新 K8s Deployment 镜像、验证 Pod 状态
- **tp-failure-analyzer** — 查询远程 MCP Server 日志

**集成示例**：

```bash
# 验证测试床连通性
node <skill目录>/scripts/ferret.js test --server testbed

# 更新 K8s Deployment 镜像
node <skill目录>/scripts/ferret.js execute \
  "kubectl set image deployment/dsp-apollo-api-deploy apollo-api=docker.sangfor.com/local-dsp/apollo_api:tag -n dsp" \
  --server testbed

# 检查部署状态
node <skill目录>/scripts/ferret.js execute \
  "kubectl rollout status deployment/dsp-apollo-api-deploy -n dsp --timeout=120s" \
  --server testbed
```

## 注意事项

- 所有远程操作通过此脚本执行，禁止直接使用 ssh/scp 命令（避免交互式密码输入导致流程中断）
- 命令超时默认 2 分钟，长时间运行的命令可能需要拆分
- `add-server` 写入 `bin/config.json`，在当前会话内持久生效
