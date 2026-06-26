# 闭环启动确认（固定格式）

```
闭环启动确认：

1. 测试床 IP：{config.testbed.ip 或 "请填写"}
2. SSH 账号：{config.testbed.ssh_user，默认 admin}
3. SSH 密码：{config.testbed.ssh_password，默认 Sangfor@123}
4. SSH 端口：{config.testbed.ssh_port，默认 22}
5. 远程工作目录：{config.testbed.root_dir}

以上信息正确请确认，需修改请指出。
```

## 规则

- 使用 `AskUserQuestion` 向用户确认，将已有值显示为默认
- 启动确认仅包含测试环境和修复策略，代码仓库/分支/目标服务等信息不在此收集
- **若 `config.yaml` 已存在且所有必填字段（testbed.ip、tp_task.project_id）非空，且连通性验证已通过 → 跳过确认，直接执行**
- 若 `config.yaml` 已存在且关键字段非空，但连通性未验证 → 验证通过后跳过确认
- 若 `config.yaml` 不存在或关键字段为空 → 展示确认清单，逐项引导用户填写
- 用户确认后，将最终值回写 `.cospowers/auto-test/config.yaml`（`mcp:` 段），下次启动直接复用
- SSH 默认值 `admin / Sangfor@123` 始终作为预填值，用户不修改即采用
