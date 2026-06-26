---
name: qianliu-aitest
description: TP平台自动化测试调度工具，远端TP平台测试计划调度。支持：创建/停止/重试测试任务、自动后台轮询进度并生成Markdown报告、查看失败/成功用例详情。
metadata:
  version: "1.1.2"
  triggers:
    - TP大规模测试、TP回归测试、TP端到端测试
    - TP重试失败用例、查看TP报告
  agents: []
  tools: ["Read", "Write", "Bash"]
  model: sonnet
---

# 智能自动化测试工具
基于自然语言驱动的端到端测试解决方案，支持远端TP平台测试调度。

关键字触发：大规模测试、回归测试、TP平台测试、端到端测试、E2E测试、远端测试计划调度、查看报告、分析报告、报告结果、重试失败用例、失败重试、重跑失败、retry failed。

---

## 一、前置环境配置（引导检查）

> 注：当触发任务发现未配置 Token导致请求失败，此时触发配置引导检查

### 全局 Token 检查

Token **统一**存放在用户全局目录，不在项目目录中存储：

**路径**：`~/.qianliu/config.json`（Windows: `%USERPROFILE%\.qianliu\config.json`）

**检查逻辑：**

1. 读取全局配置文件，检查 `tp.token` 字段是否存在且非空
2. **若文件不存在或 Token 为空**，向用户展示以下引导提示，等待用户输入：

```
🔐 需要配置 TP 平台 Token（全局配置，只需设置一次）

请从 TP 平台获取您的访问 Token，然后粘贴到这里：
```

3. 用户粘贴 Token 后，将其写入全局配置文件：

```json
// ~/.qianliu/config.json
{
  "tp": {
    "token": "<用户输入的 token>"
  }
}
```

4. 写入成功后提示：`✅ Token 已保存到 ~/.qianliu/config.json`，继续下一步校验

---

## 二、任务配置

### 2.1 任务目录

**任务目录** = `{当前工作目录}/.qianliu/.qianliu-aitest/`

所有配置文件、日志、输出报告均存放在该目录下：

```
.qianliu/
└── .qianliu-aitest/
    ├── tp-aitest-config.yaml      # TP平台配置文件
    └── tp_tasks/                  # 任务执行记录
        └── task_xxx/
            ├── run.log                           # 执行日志
            ├── task_config.yaml                  # 任务配置快照
            ├── test_report_20260312_143052.md    # 测试报告（时间戳命名）
            └── case_status.json                  # 用例状态快照（--poll 完成后生成）
```

### 2.2 配置文件（引导检查）

> 注：当触发任务后提示缺失必要配置，此时触发配置引导检查


读取任务目录下的 `tp-aitest-config.yaml`，若文件不存在则先创建空模板，再逐项检查缺失字段并引导用户填入。

> 可参考 `<skill目录>/references/tp-aitest-config.example.yaml` 中的注释说明，将各配置项的值填写完毕，保存到任务目录 `{当前工作目录}/.qianliu/.qianliu-aitest/tp-aitest-config.yaml`。

**检查项 1：检查 project_id / version_id / ai_testcase_task_id**

若配置中 `project_id`、`version_id`、`ai_testcase_task_id` 任意一项缺失，向用户展示以下引导：

```
📋 需要配置测试任务信息

请打开 TP 平台，进入目标测试任务页面，然后将浏览器地址栏的完整链接粘贴到这里：

  链接格式：{tp_base_url}/PlanHome/{ai_testcase_task_id}?productId={project_id}&projectId={version_id}&agentVersion={agent_version}
  示例：https://tp.sangfor.com/PlanHome/1823?productId=8&projectId=286&agentVersion=v2&planPath=...
```

用户粘贴链接后，从 URL 中解析以下参数并写入配置文件：

| URL 组成部分 | 对应配置字段 |
|:---|:---|
| 路径中的数字（`/PlanHome/{数字}`） | `ai_testcase_task_id` |
| 查询参数 `productId` | `project_id` |
| 查询参数 `projectId` | `version_id` |
| 查询参数 `agentVersion` | `agent_version` |
| URL 的协议+主机+端口 | `tp_base_url`（用于后续步骤生成资源链接） |

写入后提示：`✅ 已从链接中提取：project_id={x}, version_id={x}, ai_testcase_task_id={x}`（若 URL 含 `agentVersion` 则一并提示）

---

**检查项 2：测试床与执行主机标签（testbed_name / exec_host_name）**

若 `testbed_name` 为空或未填写，向用户展示以下引导：

```
🖥️ 需要配置测试床名称

请访问以下链接，在「测试床（被测设备信息）」选项卡中，新建或选择一条测试床记录：

  {tp_base_url}/ResourceHome?productId={project_id}&projectId={version_id}

创建完成后，请将测试床名称粘贴到这里：
```

> `tp_base_url`、`project_id`、`version_id` 从检查项 1 已解析的值自动拼接。

若 `exec_host_name` 为空，继续引导（可与上一步合并展示）：

```
⚙️ 需要配置执行主机标签

在同一资源管理页面，进入「AI自动化执行主机」选项卡，查看或新建执行主机，
将对应的标签名称粘贴到这里：

  {tp_base_url}/ResourceHome?productId={project_id}&projectId={version_id}
```

用户填入后写入配置，并展示最终配置摘要：

```
✅ 任务配置已完成，当前配置：
......

```
---

## 三、调度使用

### 模式一：TP远端调度
> 注：脚本路径说明。所有脚本位于 **skill 目录的 `scripts/` 子目录**下。 即`scripts/xxx.js` 均为相对于 skill 目录的路径。 执行时必须使用完整路径：

> `node <skill目录>/scripts/run_tp_testplan.js --create`

#### 3.1 标准执行流程
**第一步：创建任务**

```bash
# 使用默认配置路径
node <skill目录>/scripts/run_tp_testplan.js --create

# 或指定配置文件路径
node <skill目录>/scripts/run_tp_testplan.js --create "./.qianliu/.qianliu-aitest/tp-aitest-config.yaml"
```

输出示例：
```
================================================================================
                         任务创建成功
================================================================================

📋 报告ID: 2078
📁 任务目录: ./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd

🔗 E2E报告链接: https://tp.sangfor.com/PlanHome/AIBuildDetail/2078?productId=29&projectId=268

💡 提示: 您可以打开上述链接查看执行过程
```

**第二步：在后台启动轮询（Agent 自动执行）**

从 `--create` 的输出中获取 `任务目录` 路径，**立即**在后台启动轮询进程：

```bash
node <skill目录>/scripts/run_tp_testplan.js --poll \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd"
```

> **Agent 执行注意**：必须使用后台执行模式（`run_in_background: true`），不阻塞主流程。轮询完成后将结果通知用户。


#### 3.2 单次查询任务进度（可选）

如需单独查询某个已创建任务的当前进度（不持续轮询）：

```bash
# 仅查询一次进度（不轮询）
node <skill目录>/scripts/run_tp_testplan.js --poll --once \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd"
```

> 注：`--create` 模式检测到相同任务正在运行时，会自动查询一次进度并报告。

#### 3.3 参数速查

| 参数 | 必填 | 说明 |
|:---|:---|:---|
| `--create` | 否* | 创建任务模式：指定配置文件路径（默认: `./.qianliu/.qianliu-aitest/tp-aitest-config.yaml`） |
| `--poll` | 否* | 轮询模式：持续查询任务进度直至完成，输出最终报告 |
| `--stop` | 否* | 停止模式：停止正在运行的构建任务 |
| `--retry` | 否* | 重试模式：重试指定构建中所有失败的用例 |
| `--case-ids` | 否 | 精准重试：逗号分隔的 `case_id` 列表（配合 `--retry` 使用，需先完成 `--poll`） |
| `--once` | 否 | 仅查询一次进度（配合 `--poll` 使用，用于单次状态检查） |
| `--task-dir` | poll/stop/retry必填 | 任务目录路径（由创建任务时输出） |
| `--poll-interval` | 否 | 轮询间隔（秒），默认自适应（20s/60s/120s） |

> `--create`、`--poll`、`--stop` 和 `--retry` 参数互斥，任选其一。

#### 3.4 停止正在运行的任务

```bash
# 停止指定任务
node <skill目录>/scripts/run_tp_testplan.js --stop \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd"
```

#### 3.5 重试失败用例

> 适用场景：任务已完成但存在失败用例，需要对失败用例发起重试。自动读取原构建配置，拉取失败用例列表，**就地更新原任务目录**（不新建目录）。

```bash
# 全量重试所有失败用例
node <skill目录>/scripts/run_tp_testplan.js --retry \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd"

# 精准重试指定 case_id（需先完成一次 --poll 以生成 case_status.json）
node <skill目录>/scripts/run_tp_testplan.js --retry \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd" \
  --case-ids 123,456,789
```

**重试后立即启动后台轮询（必须执行）：**

从输出中获取 `任务目录` 路径（与原任务目录相同），**立即**执行以下命令：

```bash
node <skill目录>/scripts/run_tp_testplan.js --poll \
  --task-dir "./.qianliu/.qianliu-aitest/tp_tasks/task_20260302_143052_ab12cd"
```

> **Agent 执行注意**：必须使用后台执行模式（`run_in_background: true`），不阻塞主流程。轮询完成后将结果通知用户。

**行为说明：**
- 自动从 `task_config.yaml` 读取原构建的认证信息、测试床配置
- 全量重试：通过 API 拉取原构建中所有 `status=3`（失败）的用例
- 精准重试：从 `case_status.json` 中按 `case_id` 查找对应 `task_id`
- 若无失败用例，输出 `✅ 没有失败用例，无需重试！` 并退出
- 成功创建重试构建后，**就地更新原任务目录**的 `task_config.yaml`（`status` 重置为 `running`）
  - **新建报告模式**：平台返回新 `report_id`，更新配置并轮询新报告
  - **原地重试模式**：平台返回 `{"data": "成功"}`，复用原 `report_id` 继续轮询

#### 3.6 查看用例状态

> 适用场景：任务完成后，查看各用例执行情况，无需发起任何网络请求。

**实现方式：**直接读取任务目录下的 `case_status.json`，按需过滤展示：

| 用户意图 | 过滤条件 |
|---------|---------|
| 查看失败用例 | `status === 3` |
| 查看成功用例 | `status === 2` |
| 查看全部用例 | 不过滤 |

`case_status.json` 由 `--poll` 完成时自动生成，重试后的轮询会覆盖为最新快照。`case_id` 可直接用于 `--case-ids` 精准重试。

#### 3.7 查询报告结果（传入报告链接）

> 适用场景：已有报告链接，直接拉取用例详情并打印，无需配置文件。

```bash
# 基本用法：打印失败用例详情（不保存文件）
node <skill目录>/scripts/get_tp_report.js "<report_url>"

# 保存为 .md 文件
node <skill目录>/scripts/get_tp_report.js "<report_url>" --save ./report_2115.md
```

**报告链接格式：**
```
{base_url}/PlanHome/AIBuildDetail/{reportId}?productId={projectId}&projectId={versionId}
示例: https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286
```

## 四、输出说明

任务完成后，将在任务目录下生成以下文件：

| 文件 | 说明 |
|------|------|
| `test_report_{yyyymmdd_hhmmss}.md` | Markdown 格式测试报告（时间戳命名，多次轮询累积，互不覆盖） |
| `case_status.json` | 全量用例状态快照（含 `case_id`、`task_id`、`status` 等，重试后覆盖为最新） |
| `run.log` | 完整执行日志（含时间戳） |
| `task_config.yaml` | 任务配置快照（含 `report_id`、`test_report_path`、`case_status_path` 等运行时信息） |

脚本特性：
- 彩色输出和进度显示
- 自适应轮询间隔（20s → 60s → 120s）
- 进度停滞检测（超过 1 小时自动告警）

---
