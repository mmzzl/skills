---
name: qianliu-tp
description: 深信服 TP 测试平台 - 获取/修改用例详情、按关键词搜索用例、按目录节点查子用例、查看修改历史、查询用例执行进度、按执行人查看执行分布、按计划目录查询执行情况。支持深圳TP（tp.sangfor.com）和长沙CSTP（cs.tp.sangfor.com）双平台。当用户需要查询或修改 TP 用例信息、查看用例步骤/预期结果、搜索用例、查看今天/本版本/指定计划目录执行进度、按人统计执行情况时使用此 skill。
version: 1.6.0
---

# 深信服 TP 测试平台 (qianliu-tp)

## 能做什么

帮你在对话中直接操作 TP 测试平台的用例，无需打开浏览器：

- **查用例详情**：通过用例 ID 或 case_code 获取完整信息（内容原文输出，不做简化）
- **搜索用例**：通过关键词搜索相关用例，快速定位
- **按目录节点查子用例**：通过 path_list（目录节点 ID）查询该节点下的所有子用例
- **修改用例**：更新用例的名称、优先级、测试方式、前置条件、步骤、预期结果、标签、自动化标记等字段
- **查修改历史**：获取用例的变更记录
- **查执行进度**：查询今天/本版本各计划的用例执行情况（通过/失败/未执行数量及通过率）
- **按计划目录查执行情况**：传入 TP 目录路径（如 "02-集成测试/3.0.34"），通过 `plan_name` 字段精准过滤，汇总整体统计并按人列出执行明细（含首次/最近执行时间、失败/阻塞用例清单）
- **按人查执行分布**：统计今天/指定日期每位执行人的用例数量、通过率，并列出失败/阻塞用例清单
- **今日执行全览**：当用户问"今天用例执行情况"时，**一次性返回**：整体执行统计 + 每人执行分布 + 失败/阻塞用例清单

## 支持的平台

| 平台 | 标识 | 地址 | 说明 |
|------|------|------|------|
| 深圳 TP | `tp` | https://tp.sangfor.com | 默认平台 |
| 长沙 CSTP | `cstp` | https://cs.tp.sangfor.com | SSL证书自签，自动跳过校验 |

> 两套系统用户体系独立，token 互不通用，按需配置。

## 使用场景示例

> "帮我查一下 TP 用例 207798 的详情"
> "搜一下关于创建客户页面加载性能的用例"
> "帮我把用例 testscase002 的优先级改为 BVT"
> "帮我更新用例 testscase002 的前置条件和测试步骤"
> "帮我给用例 testscase002 增加一个标签：AI测试"
> "查一下用例 testscase002 的修改历史"
> "查一下 cstp 用例 12345 的详情"
> "查一下今天的用例执行进度"
> "今天跑了多少用例，通过率是多少"
> "帮我按人查看今天的执行情况分布"
> "今天每个人分别跑了多少用例，谁有失败的"
> "查一下今天用例执行情况" ← **触发全览模式：整体统计 + 每人分布 + 失败/阻塞清单**
> "查一下 02-集成测试/3.0.34 用例的执行情况" ← **按 TP 目录路径查询（plan_name 精准过滤）**
> "集成测试/3.0.34迭代的用例执行情况怎么样"
> "3.0.35迭代的用例执行情况怎么样"
> "apex2.0合入这个计划执行了多少用例"

## 配置

Token、project_id、version_id 配置在本地文件中，配置一次永久生效。

### 配置文件路径

| 操作系统      | 路径                                          |
|--------------|----------------------------------------------|
| Windows      | `C:\Users\<用户名>\.qianliu\config.json`      |
| macOS/Linux  | `~/.qianliu/config.json`                     |

### 配置文件内容

```json
{
  "tp": {
    "token": "your-tp-token",
    "project_id": 64,
    "version_id": 153
  },
  "cstp": {
    "token": "your-cstp-token",
    "project_id": 10,
    "version_id": 20
  }
}
```

> 两个平台按需配置，只用其中一个时可以省略另一个。

### 配置字段说明

| 字段         | 说明                                      |
|-------------|-------------------------------------------|
| `token`     | TP 平台个人 Token，从右上角头像处获取       |
| `project_id`| 产品 ID（URL 中的productId）           |
| `version_id`| 项目 ID（URL 中的projectId）          |

### 如何获取 Token

打开 [tp.sangfor.com](https://tp.sangfor.com) → 右上角头像 → 复制用户 Token。

## 用例信息字段说明

| 字段           | 说明                                      |
|---------------|-------------------------------------------|
| `id`          | 用例内部 ID（URL 中的数字）                |
| `name`        | 用例名称                                  |
| `case_code`   | 用例编码（如 tc_control_rt_442）           |
| `priority`    | 优先级（BVT / Level 1 / Level 2 等）       |
| `test_method` | 测试方式（手工测试 / 自动化测试 / 接口测试等）|
| `case_type`   | 用例类型（功能用例 / 性能用例等）           |
| `case_status` | 执行状态（No Run / Pass / Failed / Blocked / N/A）|
| `isautomated` | 是否自动化（0=否 / 1=是）                  |
| `author`      | 创建人                                    |
| `tags`        | 标签列表                                  |
| `doc_pre`     | 前置条件（原文，已清除 HTML 标签）          |
| `doc_step`    | 测试步骤（原文，已清除 HTML 标签）          |
| `doc_post`    | 后置条件（原文，已清除 HTML 标签）          |
| `doc_except`  | 预期结果（原文，已清除 HTML 标签）          |
| `url`         | 用例直达链接                              |

## ID 识别规则

**用户说"用例ID"，指的是 `case_code`（字母+数字编码，如 `tc_control_rt_442`），不是系统内部数字 ID。**

| 用户输入示例 | 类型 | 处理方式 |
|-------------|------|---------|
| `tc_control_rt_442` | case_code | 先搜索获取系统 ID，再查详情 |
| `testcase002` | case_code | 先搜索获取系统 ID，再查详情 |
| `207798`（纯数字）| 系统内部 ID | 直接查详情 |
| `2f139b6c9c754bbc9de4adb443a0015b`（UUID）| path_list | 查询用例列表 |

## 在对话中调用

```javascript
const path = require('path');
const os   = require('os');
const { createApi } = require(path.join(os.homedir(), '.claude/skills/qianliu-tp/scripts/tp_api'));

// 深圳 TP（默认）
const api = createApi('tp');
// 长沙 CSTP
// const api = createApi('cstp');

// ✅ 通过 case_code 查用例详情（推荐方式）
// 自动分页搜索获取系统 ID（node_id=-1 搜索所有节点，每页100条，最多翻20页），再查完整详情
const raw = await api.getCaseByCaseCode('tc_control_rt_442');
// 可选参数：{ pageSize: 100, maxPages: 20 }
const tc  = api.formatCase(raw);

// 通过系统内部数字 ID 查用例详情（已知数字 ID 时使用）
const raw2 = await api.getCase(207798);
const tc2  = api.formatCase(raw2);

// 按关键词搜索用例
const result = await api.searchCases('创建客户', { pageSize: 10 });
const list   = api.formatCaseList(result);

// ✅ 按 path_list 查询用例列表（通过目录节点 ID 查询子用例）
const pathResult = await api.getPathListCode(['fa4b51b132d64fe6abc60ad03ade6f8d']);
const pathList   = api.formatPathListCode(pathResult);
// pathList.total              — 总数
// pathList.cases[]            — 用例列表（id/name/case_code/priority/test_method/case_status/isautomated/author）

// 修改用例字段（支持部分更新，caseId 为系统内部数字 ID）
// 若只有 case_code，先调 getCaseByCaseCode 获取 raw.id，再传入
await api.updateCase(261949, {
  name:        '新名称',
  priority:    'BVT',
  test_method: '接口测试',
  isautomated: 0,           // 0=否, 1=是
  doc_pre:     '前置条件',
  doc_step:    '测试步骤',
  doc_post:    '后置条件',
  doc_except:  '预期结果',
  tags:        ['标签1', '标签2'],  // 全量替换，追加需先 getCase 取当前标签再合并
  case_code:   'new_code',
});

// ✅ 通过 case_code 获取修改历史（推荐方式）
// 同样支持分页搜索，参数同 getCaseByCaseCode
const history = await api.getCaseHistoryByCaseCode('tc_control_rt_442');
// 可选参数：{ pageSize: 100, maxPages: 20 }

// 通过系统内部数字 ID 获取修改历史
const history2 = await api.getCaseHistory(261949);
// history[].action[].field  — 修改字段
// history[].action[].old    — 修改前
// history[].action[].new    — 修改后
// history[].username        — 操作人
// history[].create_at       — 修改时间

// ✅ 按 TP 目录路径查询执行统计 + 按人明细（plan_name 精准过滤）
// 并发调用两个接口，一次性返回：整体汇总 + 每人执行明细 + 失败/阻塞用例清单
const planPath = '02-集成测试/3.0.34';
const [planResult, rawByUser] = await Promise.all([
  api.getPlanStatsByPath(planPath),
  api.getExecutionByUser({ dateRange: 'all', planName: planPath, pageSize: 1000 }),
]);
const byUser = api.formatExecutionByUser(rawByUser);
// planResult.found            — 匹配到的计划数量
// planResult.summary          — 整体汇总
//   .total / .passed / .failed / .blocked / .no_run
//   .pass_rate / .exec_rate / .auto_count / .auto_percent / .first_pass_rate
// byUser.users[]              — 按执行人排列（总数降序）
//   .user                     — 执行人用户名
//   .total / .passed / .failed / .blocked / .pass_rate
//   .first_run_at             — 首次执行时间（格式 "MM-DD HH:mm"）
//   .last_run_at              — 最近执行时间（格式 "MM-DD HH:mm"）
//   .bad_cases[]              — 失败/阻塞用例列表 { status, name, case_code, id }

// 也可以只按版本或计划名查
// api.getPlanStatsByPath('3.0.35迭代')
// api.getPlanStatsByPath('apex2.0合入')

// getPlanStatistics 现在也支持 planName 参数（直接用于整体汇总）
const rawStat = await api.getPlanStatistics({ planName: '02-集成测试/3.0.34', dateRange: 'all' });
// rawStat.kwargs.plan_id     — 匹配的计划 ID 列表

// ✅ 查询今天的用例执行进度（默认 today）
const raw  = await api.getPlanStatistics();
const stat = api.formatPlanStatistics(raw);
// stat.plan_count            — 计划总数
// stat.summary.total         — 总用例数
// stat.summary.passed        — 通过数
// stat.summary.failed        — 失败数
// stat.summary.blocked       — 阻塞数
// stat.summary.no_run        — 未执行数
// stat.summary.pass_rate     — 整体通过率（如 "72%"）
// stat.summary.exec_rate     — 整体执行率
// stat.plans[].plan_name     — 计划名称
// stat.plans[].pass_rate     — 该计划通过率

// 查询全部（不限日期）
const rawAll = await api.getPlanStatistics({ dateRange: 'all' });

// 自定义日期范围（毫秒时间戳）
const rawRange = await api.getPlanStatistics({
  dateRange: { gte: 1774656000000, lte: 1774742399999 },
  pageSize: 50,
});

// ✅ 按执行人查看执行分布（默认今天）
const rawByUser = await api.getExecutionByUser();
const byUser    = api.formatExecutionByUser(rawByUser);
// byUser.total              — 总用例数
// byUser.passed             — 通过数
// byUser.failed             — 失败数
// byUser.blocked            — 阻塞数
// byUser.pass_rate          — 整体通过率（如 "96%"）
// byUser.users[]            — 按执行人排列（总数降序）
//   .user                   — 执行人用户名
//   .total / .passed / .failed / .blocked / .na / .no_run
//   .pass_rate              — 该执行人通过率
//   .last_run_at            — 最近执行时间（格式 "MM-DD HH:mm"）
//   .first_run_at           — 首次执行时间（格式 "MM-DD HH:mm"）
//   .bad_cases[]            — 失败/阻塞用例列表
//     .status / .name / .case_code / .id

// 查全部（不限日期）
const rawAllByUser = await api.getExecutionByUser({ dateRange: 'all' });

// 按计划目录过滤执行人统计
const rawByUserPlan = await api.getExecutionByUser({
  dateRange: 'all',
  planName: '02-集成测试/3.0.34',
  pageSize: 1000
});

// ✅ 今日执行全览（用户问"今天用例执行情况"时使用）
// 并发调用两个接口，一次性返回：整体统计 + 每人分布 + 失败/阻塞清单
const [rawStat, rawByUser] = await Promise.all([
  api.getPlanStatistics(),
  api.getExecutionByUser(),
]);
const stat   = api.formatPlanStatistics(rawStat);
const byUser = api.formatExecutionByUser(rawByUser);
// 输出格式：
// 1. 整体执行情况（总数/通过/失败/阻塞/通过率/执行率/自动化占比）
// 2. 每人执行分布（姓名、总数、通过数、通过率）
// 3. 失败/阻塞用例清单（汇总 byUser.users[].bad_cases，列出执行人、用例名、case_code）
```

## 注意事项

- **用户问"今天用例执行情况"时，必须同时调用 `getPlanStatistics` 和 `getExecutionByUser`（可并发），一次性输出：整体执行统计、每人执行分布、失败/阻塞用例清单，不得只返回其中一项**
- **用户指定计划目录（如"集成测试/3.0.34迭代"）时，并发调用 `getPlanStatsByPath(path)` 和 `getExecutionByUser({ dateRange: 'all', planName: path, pageSize: 1000 })`；输出格式：整体汇总统计 + 每人执行明细（姓名、总数/通过/失败/阻塞、通过率、首次/最近执行时间）+ 失败/阻塞用例清单**
- **用户说"用例ID"时，指的是 `case_code`（字母编码），需先调 `getCaseByCaseCode` 搜索获取系统数字 ID，再查详情**
- 纯数字（如 207798）才是系统内部 ID，可直接调 `getCase`
- 未指定平台时默认使用深圳 TP；查长沙用例需在描述中注明 "cstp" 或 "长沙"
- `version_id` 和 `project_id` 需提前在 config.json 中配置好，对应当前使用的版本迭代
- 用例内容（测试步骤、预期结果等）**原文输出，不做任何简化**，保留工具调用等完整细节
- 修改标签时为**全量替换**，追加标签需先 `getCase`/`getCaseByCaseCode` 获取当前标签再合并后传入
- 搜索结果按相关性排序，默认返回前 10 条（searchCases 使用 node_id=-1 搜索所有节点，确保不遗漏）
- CSTP 如使用 HTTPS 且证书自签，已自动配置跳过证书校验
