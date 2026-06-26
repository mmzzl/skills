# 闭环启动确认（固定格式）

```
闭环启动确认：

1. 远程服务器 IP：{config.testbed.ip}
2. SSH 账号：{config.testbed.ssh_user，默认 root}
3. SSH 密码：{已设置/未设置，默认使用 ferret 已存储凭据}
4. SSH 端口：{config.testbed.ssh_port，默认 22}
5. 远程工作目录：{config.testbed.root_dir}
6. RF 测试目录：{config.workflow.casedir}

以上信息正确请确认，需修改请指出。
```

## 规则

- 使用 `AskUserQuestion` 向用户确认，将已有值显示为默认
- 启动确认仅包含测试环境、RF 参数
- **若 `config.yaml` 已存在且所有必填字段（testbed.ip、workflow.casedir）非空，且连通性验证已通过 → 跳过确认，直接执行**
- 若 `config.yaml` 已存在且关键字段非空，但连通性未验证 → 验证通过后跳过确认
- 若 `config.yaml` 不存在或关键字段为空 → 展示确认清单，逐项引导用户填写
- 用户确认或手动修改后，将最终值回写 `.cospowers/auto-test/config.yaml`（`rf:` 段），下次启动直接复用
- ferret 服务器凭据由 ferret 自身管理，不在本配置中存储
