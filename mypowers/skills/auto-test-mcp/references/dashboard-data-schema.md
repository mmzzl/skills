# Dashboard 数据规范（存根）

> **统一 Schema 定义已迁移至 `auto-test/references/unified-config.md` §4。本文件仅作索引。**

## 文件位置

`.cospowers/auto-test/tasks/{task_dir}/dashboard_data.json`

## Dashboard HTML 生成

闭环完成后，读取模板 `skills/auto-test/auto-test-dashboard.html`，将 `__DASHBOARD_DATA__` 占位符替换后写入 `.cospowers/auto-test/tasks/{task_dir}/dashboard.html`。详见 unified-config.md §6。
