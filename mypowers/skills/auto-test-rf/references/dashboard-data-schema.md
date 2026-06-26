# Dashboard 数据规范（存根）

> **统一 Schema 定义已迁移至 `auto-test/references/unified-config.md` §4。本文件仅作索引。**

## 文件位置

`.cospowers/auto-test/tasks/{task_dir}/dashboard_data.json`

## 生成方式

```bash
node skills/auto-test-rf/scripts/gen_dashboard_data.js {task_dir}
```

可选参数：
- `--name "任务名称"` — 自定义任务名
- `--max-rounds 3` — 最大重试轮数（默认 3）
- `--target-rate 95` — 目标通过率（默认 95）

## Dashboard HTML 生成

闭环完成后，读取模板 `skills/auto-test/auto-test-dashboard.html`，将 `__DASHBOARD_DATA__` 占位符替换为 `dashboard_data.json` 内容后写入 `.cospowers/auto-test/tasks/{task_dir}/dashboard.html`。详见 unified-config.md §6。
