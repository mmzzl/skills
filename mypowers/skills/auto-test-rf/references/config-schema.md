# 配置结构（存根）

> **统一配置定义已迁移至 `auto-test/references/unified-config.md`。本文件仅作索引。**

## 存储位置

- **项目级配置**: `.cospowers/auto-test/config.yaml` → `rf:` 段（详见 unified-config.md §1）
- **任务目录**: `.cospowers/auto-test/tasks/{task_dir}/`（详见 unified-config.md §2）

## RF 特定字段索引

| 字段路径 | 说明 | 默认值 |
|---------|------|-------|
| `rf.testbed.ip` | 测试床 IP（自动注册到 ferret） | "" |
| `rf.testbed.ssh_user` | SSH 用户名 | `root` |
| `rf.testbed.ssh_password` | SSH 密码 | `Sangfor@123` |
| `rf.testbed.ssh_port` | SSH 端口 | `22` |
| `rf.testbed.root_dir` | 远程工作目录 | `/root/at_os` |
| `rf.workflow.casedir` | 用例目录 | "" |
| `strategy.max_rounds` | 最大重试轮数 | 3 |

## 配置文件首次生成

首次运行时，若 `.cospowers/auto-test/config.yaml` 不存在，SKILL.md 引导用户填写后自动创建。
若配置文件已存在且关键字段（rf.testbed.ip、rf.workflow.casedir）非空，仅展示确认清单让用户一键确认。
