# tdd-loop 配置说明

 **目的**：提前配置好所有执行过程中需要的参数，避免过程中断

>本地调试完整配置请参考：https://doc.weixin.qq.com/doc/w3_AY4AaQYhAAkCNoff31VUuRbq86yVi?scode=AI4AagdpABEfi0N4NaAY4AaQYhAAk

配置文件路径 `<project-dir>/.cospowers/auto-test/config.yaml`，内容示例：

```
# --- 全局设置 ---
framework: mcp            # auto（自动识别）| rf（强制RF）| mcp（强制MCP/TP）

# --- Robot Framework 配置（framework=rf 或 auto-detect=rf 时读取）---
rf:
  testbed:
    server: "10.64.6.103"              # ferret 服务器名称（必填，通过 ferret add-server 添加）
    ssh_user: "root"        # SSH 用户名
    ssh_password: "sangfor"  # SSH 密码
    root_dir: "/root/at_os" # 远程工作目录
  workflow:                  # build_config.yaml 中 workflow 项的参数
    testbed_path: "/root/at_os/config/testbed/sfos/local/1dut4pc.sfos-docker"  # 测试床配置文件路径
    gitrepo: "git@code.sangfor.org:autotest/at_os.git"  # Git 仓库地址
    branch: ""               # 分支名
    casedir: "testcase_l4/ipv4/02-网络/02-路由/02-策略路由"              # 用例目录
    include: "BVT_test,拓扑-1dut4pc-ws,状态-调试通过"  # 包含标签（逗号分隔）
    exclude: ""              # 排除标签（逗号分隔）

# --- TP/MCP 配置（framework=mcp 或 auto-detect=mcp 时读取）---
mcp:
  testbed:
    ip: "10.107.10.42"                  # 从 testbed_name 自动提取，或用户指定
    ssh_user: "sangfor"       # SSH 用户名
    ssh_password: "123"  # SSH 密码
    ssh_port: "22345"
  tp_task:
    project_id: "17"
    version_id: "238"
    agent_version: "v2"
    ai_testcase_task_id: "19077"
    testbed_name: "47733-sla"
    exec_host_name: "郭虹"
    tp_base_url: "https://tp.sangfor.com"
  strategy:
    case_fix: "auto_high"   # auto_high（高置信度自动修改）| skip（全部跳过）
    code_fix: "auto_deploy" # auto_deploy（自动修复并提交部署）| analyze_only（仅分析）

# --- 重试策略（共享）---
strategy:
  max_rounds: 3             # 最大重试轮数
  target_success_rate: 95   # 目标通过率（百分比）
```
