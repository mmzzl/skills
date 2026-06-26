# 闭环启动清单

## 环境
- 远程服务器：{server} ({host}) ✅ 已连通
- Robot Framework：{version} ✅ 可用
- 测试目录：{casedir}/ ✅ 存在（已确认 .robot 文件）

## 策略
- 代码修复：自动修复并同步到远程

## 被测系统
- 代码路径：{app.remote_dir}（若配置）
- 重启命令：{app.restart_cmd}（若配置）

## 数据存储
- 所有任务数据仅保存在本地 `.cospowers/auto-test/tasks/{task_dir}/` 目录
- 任务完成后在浏览器打开本地 Dashboard 查看概况

确认后开始执行闭环，过程中无需介入。
