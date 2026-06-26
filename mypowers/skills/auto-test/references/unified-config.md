# auto-test 统一配置定义

> **这是 `auto-test`、`auto-test-rf`、`auto-test-mcp` 三个技能的唯一定义来源。**
> 所有目录结构、文件命名、数据 schema 在此定义。各子技能的 references/ 文件仅作索引存根。

## 1. 项目级统一配置

**存储路径**: `.cospowers/auto-test/config.yaml`（项目级配置，运行前一次性填写）

```yaml
# =============================================================================
# auto-test 统一配置
# 路径: .cospowers/auto-test/config.yaml
# 首次使用前填写，运行过程中直接读取，无需交互询问
# =============================================================================

# --- 全局设置 ---
framework: auto            # auto（自动识别）| rf（强制RF）| mcp（强制MCP/TP）

# --- Robot Framework 配置（framework=rf 或 auto-detect=rf 时读取）---
rf:
  testbed:
    ip: ""                  # 测试床 IP（自动检查并注册到 ferret，无需手动 add-server）
    ssh_user: "root"        # SSH 用户名
    ssh_password: "sangfor"  # SSH 密码
    ssh_port: 22            # SSH 端口
    root_dir: "/root/at_os" # 远程工作目录
  workflow:                  # build_config.yaml 中 workflow 项的参数
    testbed_path: "/root/at_os/config/testbed/sfos/local/1dut4pc.sfos-docker"  # 测试床配置文件路径
    gitrepo: "git@code.sangfor.org:autotest/at_os.git"  # Git 仓库地址
    branch: ""               # 分支名
    casedir: ""              # 用例目录（必填）
    include: "拓扑-1dut4pc-ws,状态-调试通过"  # 包含标签（逗号分隔）
    exclude: ""              # 排除标签（逗号分隔）

# --- TP/MCP 配置（framework=mcp 或 auto-detect=mcp 时读取）---
mcp:
  testbed:
    ip: ""                  # 从 testbed_name 自动提取，或用户指定
    ssh_user: "admin"       # SSH 用户名
    ssh_password: "Sangfor@123"  # SSH 密码
    ssh_port: 22            # SSH 端口
    root_dir: "/root/at_os" # 远程工作目录
  tp_task:
    project_id: ""
    version_id: ""
    ai_testcase_task_id: ""
    testbed_name: ""
    exec_host_name: ""
    agent_version: "v2"
    tp_base_url: "https://tp.sangfor.com"
  strategy:
    case_fix: "auto_high"   # auto_high（高置信度自动修改）| skip（全部跳过）
    code_fix: "auto_deploy" # auto_deploy（自动修复并提交部署）| analyze_only（仅分析）

# --- 重试策略（共享）---
strategy:
  max_rounds: 3             # 最大重试轮数
```

### 配置优先级（自动检测时）

1. `framework` 字段（若为 `rf` 或 `mcp`，直接使用，跳过自动识别）
2. 用户命令行参数（URL、`--server --dir` 等）
3. 工作目录下的 `.auto-test-framework` 文件
4. 关键词匹配（见 `framework-detection.md`）
5. 若仍无法确定 → 询问用户

## 2. 统一运行时目录结构

**根目录**: `.cospowers/auto-test/tasks/`（相对于 CWD）

```
.cospowers/auto-test/tasks/{task_dir}/
├── dashboard.html                   # 统一 Dashboard 报告
├── dashboard_data.json              # 统一仪表盘数据
├── case_status.json                 # 统一用例执行状态快照（每轮覆盖）
├── round_stats.json                 # 每轮统计（累计追加，含ABCD分类）
├── execution_timing.json            # 每轮执行耗时记录
├── task_config.yaml                 # 任务配置（framework + 用户输入）
├── run.log                          # 运行日志
│
├── output.xml                       # [RF] Robot Framework 原始输出（每轮覆盖）
├── log.html                         # [RF] RF 日志（每轮覆盖）
├── report.html                      # [RF] RF 报告（每轮覆盖）
├── failed_tests.json                # [RF] 失败用例详情（每轮覆盖）
│
├── {caseCode}_detail.json           # [MCP] 各失败用例详情（每轮覆盖）
├── mcp_logs_{caseCode}.log          # [MCP] MCP Server 日志
│
├── logs/                            # 产品运行日志（auto-fix 分类时必有）
│
└── analysis/
    ├── summary.md                   # 分类汇总报告（每轮覆盖）
    ├── {caseCode}.md                # 各失败用例独立分析报告（每轮覆盖）
    ├── code_fixes.md                # 代码修复记录（auto-fix 产出）
    └── screenshots/                 # [MCP] 截图
        └── {caseCode}/
```

### 框架特定文件说明

| 文件 | 适用框架 | 说明 |
|------|---------|------|
| `output.xml` / `log.html` / `report.html` | RF | `parse_rf_output.js` 解析源 |
| `failed_tests.json` | RF | 每个失败用例的完整关键字调用链 |
| `{caseCode}_detail.json` | MCP | 单个用例的步骤-操作详情（`fetch_failed_details.js` 产出） |
| `mcp_logs_{caseCode}.log` | MCP | 涉及"调用工具"步骤的 MCP Server 日志 |
| `analysis/screenshots/` | MCP | 失败步骤截图 |

### task_config.yaml

```yaml
framework: rf              # rf | mcp
task_dir: "{task_dir}"     # 任务目录名
created_at: "2026-06-10T14:30:00+08:00"
user_input: "/auto-test ..."  # 用户原始输入
# ====== 以下字段按框架写入 ======
server: {server_name}      # [RF] ferret 服务器名
casedir: {casedir}         # [RF] 远程测试用例目录
tp_url: "{TP链接}"         # [MCP] TP 平台链接
```

### 任务目录命名规范

`{framework}-{purpose}-{YYYYMMDD}-{HHmmss}`

- `framework`: `rf` 或 `mcp`
- `purpose`: 可选，kebab-case 简短描述
- 时间戳: 本地时间，到秒

示例: `rf-regression-20260610-143000`、`mcp-smoke-20260610-143000`

`dashboard_data.json` 中的 `taskId` 字段使用 `{task_dir}` 名称。

## 3. case_status.json（统一 Schema）

```json
{
  "task_dir": "{task_dir}",
  "framework": "rf | mcp",
  "executed_at": "2026-06-10T14:30:00+08:00",
  "total": 10,
  "passed": 7,
  "failed": 3,
  "skipped": 0,
  "passRate": 70.0,
  "cases": [
    {
      "id": "s1-t1",
      "name": "Login With Valid Credentials",
      "status": "PASS | FAIL | SKIP",
      "elapsed": 15500,
      "message": "",
      "framework_specific": {
        "rf": {
          "suite": "Login Tests",
          "suiteSource": "tests/login.robot",
          "tags": ["smoke", "login"]
        },
        "mcp": {
          "caseId": 167540
        }
      }
    }
  ]
}
```

### 字段对照

| 统一下字段 | RF 来源 | MCP 来源 | 说明 |
|-----------|---------|---------|------|
| `id` | 测试名称（空格→`_`） | `caseCode`（如 `tc_xxx`） | 唯一标识，用于关联分析报告 |
| `name` | RF test name 原始值 | TP `caseName` | 可读名称 |
| `status` | `PASS` / `FAIL` / `SKIP` | `PASS` / `FAIL` / `SKIP` | 统一状态值 |
| `elapsed` | RF `elapsed` (ms) | action `actionCostTime` 求和 | 执行耗时（毫秒） |
| `message` | RF `message` 字段 | 最后一个 fail action 的 `actionResult` | 错误信息 |
| `framework_specific.rf.suite` | RF `<suite>` name | — | RF 专用 |
| `framework_specific.rf.suiteSource` | RF suite 文件名 | — | RF 专用 |
| `framework_specific.rf.tags` | RF tags | — | RF 专用 |
| `framework_specific.mcp.caseId` | — | TP 用例数字 ID | MCP 专用 |

## 4. dashboard_data.json（统一 Schema）

```json
{
  "taskId": "{task_dir}",
  "taskName": "{task_dir 或用户指定}",
  "framework": "rf | mcp",
  "status": "running | completed | failed | stopped",
  "startTime": "2026-06-10T10:00:00+08:00",
  "endTime": "2026-06-10T11:42:36+08:00 | null",
  "config": {
    "maxRounds": 3,
    "targetSuccessRate": 95,
    "framework_specific": {
      "rf": { "testPlatform": "Robot Framework" },
      "mcp": { "testPlatform": "TP" }
    }
  },
  "summary": {
    "totalRounds": 2,
    "totalCases": 20,
    "initialPassRate": 60.00,
    "finalPassRate": 95.00,
    "fixedCases": 7,
    "codeChanges": 4,
    "framework_specific": {
      "mcp": { "caseChanges": 3 }
    }
  },
  "rounds": [
    {
      "round": 1,
      "startTime": "2026-06-10T10:00:00+08:00",
      "endTime": "2026-06-10T10:18:30+08:00",
      "totalCases": 20,
      "passed": 12,
      "failed": 8,
      "skipped": 0,
      "fixes": [
        {
          "caseId": "{id}",
          "caseName": "{name}",
          "fixType": "code | case | null",
          "description": "{具体变更描述，不可为空，见下方描述规范}",
          "files": ["path/to/file"]
        }
      ]
    }
  ],
  "cases": [
    {
      "id": "{id}",
      "name": "{name}",
      "module": "{从 suite 或 caseName 前缀提取}",
      "finalStatus": "passed | failed",
      "firstFailRound": 1,
      "fixedInRound": 2,
      "fixType": "code | case | null",
      "history": [
        { "round": 1, "status": "failed", "error": "...", "duration": 1500 },
        { "round": 2, "status": "passed", "error": null, "duration": 800 }
      ],
      "fixes": [
        {
          "round": 1,
          "type": "code",
          "description": "{具体变更描述}",
          "files": ["..."]
        }
      ],
      "framework_specific": {
        "rf": { "suite": "Login Tests" },
        "mcp": {}
      }
    }
  ]
}
```

### fixes[].description 规范

- **代码修复**: "修复 {文件名} 中的 {具体问题描述}"（如 "修复 token_handler.py 中 Token 刷新接口缺少 refresh_token 参数校验"）
- **用例修改**: "步骤{N}: {原文摘要} → {修改后摘要}" 或 "预期结果{N}: {原文摘要} → {修改后摘要}"
- **禁止**空字符串或通用描述（如 "修复 bug"）

### 字段数据来源

| 字段 | 数据来源 |
|------|---------|
| `taskId` | `{task_dir}` 目录名 |
| `framework` | `task_config.yaml` 的 `framework` 字段 |
| `status` | 闭环状态机: 启动→`running`，完成→`completed`，异常→`failed` |
| `startTime` / `endTime` | 闭环启动/结束时间（ISO 8601） |
| `config.maxRounds` | `config.yaml` → `strategy.max_rounds` |
| `config.targetSuccessRate` | 100 |
| `config.framework_specific.*.testPlatform` | 固定值 |
| `summary.*` | 从 `rounds[]` 和 `cases[]` 汇总计算 |
| `rounds[]` | 每轮 `case_status.json` 统计 |
| `cases[].id` | `case_status.json` → `cases[].id` |
| `cases[].name` | `case_status.json` → `cases[].name` |
| `cases[].module` | RF: 从 `suite` 提取；MCP: 从 `caseName` 前缀提取 |
| `cases[].history[].error` | `case_status.json` → `cases[].message` |
| `cases[].history[].duration` | `case_status.json` → `cases[].elapsed` |
| `cases[].fixes (code)` | `analysis/code_fixes.md` 变更记录 |
| `cases[].framework_specific.rf.suite` | RF suite name |

### 更新时序

```
闭环启动 → 创建文件，写入 round 1 + cases 初始数据
  → 阶段一完成 → 补充 cases[].history[].error / duration
  → 阶段二完成 → 补充 analysis 分类信息
  → 修复完成 → 写入 fixes 记录
  → 重试完成 → 写入 round N + 更新 finalStatus + summary + status
```

## 5. analysis/summary.md（统一格式）

```markdown
# 失败用例分析汇总

**任务目录**: {task_dir}
**框架**: {RF | MCP/TP}
**分析时间**: {yyyy-MM-dd HH:mm:ss}
**本轮失败用例数**: {N}
**本轮通过用例数**: {M}

## 分类结果

| 用例标识 | 根因分类 | 置信度 | 一句话结论 | 关键错误 | 建议操作 | 详情 |
|:---|:---|:---|:---|:---|:---|:---|
| {id} | A/B/C/D | 高(90%) | ... | ... | ... | [查看](./{caseCode}.md) |

## 按分类统计

| 分类 | 数量 | 用例 |
|:---|:---|:---|
| A类—用例编写错误 | N | {id} 列表 |
| B类—业务代码缺陷 | N | {id} 列表 |
| C类—环境/数据问题 | N | {id} 列表 |
| D类—MCP工具问题 | N | {id} 列表（仅 MCP 框架出现） |

## 处置建议

1. 【自动修复】N 个 B 类问题，由 `auto-fix` 处理
2. 【需人工】N 个 A 类问题，需手动修正用例
3. 【需人工】N 个 C 类问题，需排查环境后重试
4. 【需人工】N 个 D 类问题，需排查 MCP Server（仅 MCP 框架）

```

### 分类标准

| 分类 | 说明 | 典型特征 | 辅助证据（auto-fix 分类时使用） | 处理方式 | 适用框架 |
|------|------|---------|-------------------------------|---------|---------|
| A类—用例编写错误 | 步骤描述不准确、定位器错误、参数传错 | Element not found、locator 不匹配、MCP 工具传参错误 | **产品日志**：服务正常无异常；**设计文档**：预期行为与测试断言不一致 | 记录报告，人工修改用例 | RF / MCP |
| B类—业务代码缺陷 | 被测系统逻辑 bug、接口返回异常 | 接口错误码、页面渲染异常、数据错乱 | **产品日志**：有异常堆栈/panic/error；**设计文档**：预期行为明确但代码实现不符；**源代码**：逻辑缺陷可定位 | auto-fix TDD 修复 | RF / MCP |
| C类—环境/数据问题 | 服务不可用、超时、数据污染 | 502/503、timeout、connection refused | **产品日志**：服务未启动/资源不足/依赖异常 | 记录报告，人工排查 | RF / MCP |
| D类—MCP工具问题 | MCP工具内部逻辑异常 | 入参正确但内部执行失败 | **MCP日志**：工具内部错误/异常堆栈 | 记录报告，排查 MCP Server | 仅 MCP |

### 处置规则

| 根因分类 | 建议操作 | 自动化 | 下游 |
|:---|:---|:---|:---|
| A类—用例编写错误 | 报告中标注，人工修正 | 否 | 无 |
| B类—业务代码缺陷 | 交由 `auto-fix` TDD 修复 | 是 | auto-fix |
| C类—环境/数据问题 | 报告中标注，人工排查 | 否 | 无 |
| D类—MCP工具问题 | 报告中标注，排查 MCP Server | 否 | 无 |


## 6. 结果摘要展示

```
Auto-Test 闭环完成 ({framework})

  测试框架: {Robot Framework | MCP/TP}
  任务目录: .cospowers/auto-test/tasks/{task_dir}/
  总轮次:   {N} 轮
  总用例:   {total}
  最终通过率: {passRate}%
  分类统计:
    A类(用例): {aCount} → 需人工修改用例
    B类(代码): {bCount} → 已自动修复 {fixedCount} 个
    C类(环境): {cCount} → 需人工排查环境
    D类(MCP): {dCount} → 需排查MCP Server

  Dashboard: .cospowers/auto-test/tasks/{task_dir}/dashboard.html
```

## 7. round_stats.json（每轮统计）

**存储路径**: `.cospowers/auto-test/tasks/{task_dir}/round_stats.json`

每轮测试执行 + 分类完成后由 auto-test 主编排器追加数据。该文件是唯一的全量轮次追踪来源，Dashboard 生成时读取此文件补充 ABCD 分类数据。

```json
{
  "task_dir": "{task_dir}",
  "framework": "rf | mcp",
  "rounds": [
    {
      "round": 1,
      "executed_at": "2026-06-25T10:00:00+08:00",
      "total": 20,
      "passed": 12,
      "failed": 8,
      "skipped": 0,
      "passRate": 60.0,
      "classification": {
        "A": 3,
        "B": 3,
        "C": 1,
        "D": 1
      },
      "fixed": 0,
      "fixes": [
        {
          "caseId": "{id}",
          "fixType": "code",
          "description": "{具体变更描述}"
        }
      ]
    },
    {
      "round": 2,
      "executed_at": "2026-06-25T10:30:00+08:00",
      "total": 20,
      "passed": 16,
      "failed": 4,
      "skipped": 0,
      "passRate": 80.0,
      "classification": {
        "A": 3,
        "B": 0,
        "C": 1,
        "D": 0
      },
      "fixed": 3,
      "fixes": []
    }
  ]
}
```

### 字段说明

| 字段 | 说明 | 数据来源 |
|------|------|---------|
| `rounds[].round` | 轮次编号，从 1 开始 | auto-test 编排器 |
| `rounds[].executed_at` | 该轮执行完成时间 | `case_status.json` → `executed_at` |
| `rounds[].total/passed/failed/skipped` | 该轮用例统计 | `case_status.json` |
| `rounds[].passRate` | 通过率百分比 | `case_status.json` → `passRate` |
| `rounds[].classification` | ABCD 分类计数 | `analysis/summary.md` 解析 |
| `rounds[].fixed` | 该轮 auto-fix 实际修复的 B 类数量 | `analysis/code_fixes.md` 解析 |
| `rounds[].fixes` | 该轮修复记录 | `analysis/code_fixes.md` 解析 |

### 更新时序

```
每轮测试执行完成 → 从 case_status.json 写入 round/passRate 等字段（classification 暂为空）
  → auto-fix 分类完成 → 从 summary.md 补充 classification 字段
  → auto-fix 修复完成 → 从 code_fixes.md 补充 fixed 和 fixes 字段
```

### 文件覆盖策略

每轮测试执行时，以下文件使用**覆盖式**命名（不再使用 `_r{N}` 后缀）：

| 文件 | 说明 |
|------|------|
| `output.xml` | 每轮覆盖，仅保留最后一轮 |
| `log.html` | 每轮覆盖，仅保留最后一轮 |
| `report.html` | 每轮覆盖，仅保留最后一轮 |
| `case_status.json` | 每轮覆盖，仅保留最后一轮 |
| `failed_tests.json` | 每轮覆盖，仅保留最后一轮 |
| `{caseCode}_detail.json` | 每轮覆盖，仅保留最后一轮 |
| `analysis/summary.md` | 每轮覆盖，仅保留最后一轮 |
| `analysis/{caseCode}.md` | 每轮覆盖，仅保留最后一轮 |

轮次间的统计数据通过 `round_stats.json` 追踪，无需保留每轮的原始报告文件。
