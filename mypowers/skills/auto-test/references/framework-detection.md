# 框架识别规则

> 此文件是 [SKILL.md](../SKILL.md) 的补充，包含框架自动识别的详细规则。
> 统一配置定义见 [unified-config.md](unified-config.md)。

## 识别流程

```
用户输入
  │
  ├─ .cospowers/auto-test/config.yaml framework 字段非 auto？
  │   └─ YES → framework=rf 或 mcp → 直接使用，跳过自动识别
  │
  ├─ 包含 TP 平台链接？（https://tp.）
  │   └─ YES → MCP/TP 路径
  │
  ├─ 包含 --server 参数？
  │   └─ YES → 检查是否同时有 --dir / --include / --test / --suite
  │       └─ YES → RF 路径
  │       └─ NO  → 再次检查其他特征
  │
  ├─ 包含 RF 关键词？（robot framework / rf test / .robot）
  │   └─ YES → RF 路径
  │
  ├─ 包含 TP 关键词？（千流平台 / TP测试 / tp.sangfor）
  │   └─ YES → MCP/TP 路径
  │
  ├─ 指定 --task-dir？
  │   └─ YES → 读取 .cospowers/auto-test/tasks/{task_dir}/task_config.yaml → 取 framework 字段
  │
  └─ 无法确定 → AskUserQuestion 确认
```

## 特征权重

特征按优先级从高到低：

| 优先级 | 特征 | 判断结果 | 置信度 |
|--------|------|---------|--------|
| 0 | `config.yaml` `framework` 字段非 `auto` | 直接使用 | 确定 |
| 1 | 包含完整 URL（`https://tp.sangfor.com/...`） | MCP/TP | 确定 |
| 2 | 包含 `--server` + `--dir` 组合 | RF | 确定 |
| 3 | 包含 `--include` / `--exclude` / `--suite`（Robot Framework 参数） | RF | 确定 |
| 4 | 用户明确说 "RF测试" / "robot" / ".robot" | RF | 确定 |
| 5 | 用户明确说 "TP测试" / "千流" / "tp.sangfor" | MCP/TP | 确定 |
| 6 | `--task-dir` 指向已有任务 | 读取配置 | 确定 |

## 无法确定时的确认

当所有特征都不匹配时，使用 `AskUserQuestion` 确认：

```
问题：无法自动识别测试框架，请选择：
选项：
  - "千流平台 TP（MCP）" — 使用 TP 平台执行测试
  - "Robot Framework（RF）" — 在远程环境执行 RF 测试
```

## task_config.yaml 中的 framework 字段

任务创建后，`task_config.yaml` 中写入 `framework` 字段：

```yaml
# MCP/TP 路径
framework: mcp

# RF 路径
framework: rf
```

后续通过 `--task-dir` 恢复时，直接读取此字段确定框架。

## 边界情况

- **用户同时提到 TP 和 RF**：按优先级 1（URL > 参数组合 > 关键词），先匹配到的为准
- **用户输入模糊**（如只说"跑测试"）：检查当前工作目录是否有 `tp-aitest-config.yaml`（→ MCP）或 `rf-test-config.yaml`（→ RF），若都没有则询问用户
- **subagent 内部不再做框架判断**：主会话确定框架后，subagent prompt 中已明确指定使用哪个技能
