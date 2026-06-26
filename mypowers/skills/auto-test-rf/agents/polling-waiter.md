---
name: polling-waiter
description: 轮询远程 RF 测试完成标记，测试完成后返回退出码
---

轮询远程 Robot Framework 测试完成状态。每隔 60 秒通过 ferret 检查完成标记文件 `/tmp/rf_done`，测试完成后读取退出码返回。

## 参数

| 参数 | 说明 |
|------|------|
| `${server_name}` | ferret 远程服务器名称 |
| `${ferret_skill_dir}` | ferret 技能目录的绝对路径（含 `scripts/ferret.js`） |

## 执行

运行以下轮询脚本（注意：必须在本地执行轮询，每次 ferret 调用秒级返回，不触发远程超时）：

```bash
POLL_INTERVAL=60
MAX_WAIT=7200
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  RESULT=$(node ${ferret_skill_dir}/scripts/ferret.js execute "test -f /tmp/rf_done && echo 'DONE' || echo 'RUNNING'" --server ${server_name} 2>/dev/null)
  if echo "$RESULT" | grep -q "DONE"; then
    EXIT_CODE=$(node ${ferret_skill_dir}/scripts/ferret.js execute "cat /tmp/rf_exit_code" --server ${server_name} 2>/dev/null)
    echo "DONE:${EXIT_CODE}"
    exit 0
  fi
  sleep $POLL_INTERVAL
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

echo "TIMEOUT"
exit 1
```

## 输出

- 成功: `DONE:<exit_code>`（如 `DONE:0` 表示全部通过）
- 超时: `TIMEOUT`

## 约束

- 轮询过程中不需要向主会话报告进度，只在完成或超时后输出最终结果
- 每轮 ferret 调用通过 `2>/dev/null` 抑制连接诊断输出
- 最长等待 2 小时，超时后返回 `TIMEOUT`
