---
name: qianliu-ci
description: 深信服千流CI持续集成平台 - 查询流水线执行状态、查看任务日志并分析、触发构建、通过 GitLab 合并请求（MR）查询关联流水线。当用户需要查询 CI 流水线状态、分析构建/测试日志、触发构建，或者提供了 GitLab 项目 ID 和 MR IID 想查关联流水线时，使用此 skill。
version: 1.0.0
author: AI效能部-肖帅45597
---

# 深信服千流CI持续集成平台 (qianliu-ci)

## 能做什么

帮你在对话中直接操作 CI 流水线，无需打开浏览器：

- **查流水线状态**：通过流水线 ID 获取最近一次执行状态、各阶段/任务结果
- **查看并分析日志**：获取任务日志，自动分析错误原因并给出修复建议
- **触发构建**：引导用户选择仓库、分支/标签、填写参数，然后触发执行
- **触发单个任务**：按任务 ID 直接启动某个任务，或对失败任务执行重试
- **通过 MR 查流水线**：输入 GitLab 项目 ID 和合并请求 IID，查出该 MR 关联触发的所有流水线

## 配置

### 配置文件路径

| 操作系统 | 路径 |
|---------|------|
| Windows | `C:\Users\<用户名>\.qianliu\config.json` |
| macOS | `~/.qianliu/config.json` |
| Linux | `~/.qianliu/config.json` |

### 配置文件内容

```json
{
  "ipd": {
    "token": "your-ipd-token"
  }
}
```

### 如何获取 Token

打开 [ipd.sangfor.com](http://ipd.sangfor.com) → 右上角个人头像 → 复制用户 token

详细图文说明：[千流平台token认证获取入口指南](https://wiki.sangfor.com/x/oIFYDw)

## 使用场景示例

> "帮我查一下流水线 342229 的执行情况"
> "帮我触发流水线 342229 构建"
> "流水线 342229 最近跑成功了吗"
> "帮我看一下流水线 342229 的自动化测试日志，分析一下为什么失败"
> "帮我查一下项目 26932 的第 790 号 MR 触发了哪些流水线"

## 在对话中调用

```javascript
const path = require('path');
const os   = require('os');
const ci   = require(path.join(os.homedir(), '.claude/skills/qianliu-ci/scripts/ci_api'));

// ── 查询流水线状态 ──
const p  = await ci.getPipelineById(342229);
const fp = ci.formatPipeline(p);
// fp.last_status_icon, fp.last_status, fp.last_execution_time, fp.last_executor, fp.last_cost

// 查各阶段/任务详情（需要 history_id 和 pipelineId）
if (fp.last_history_id) {
  const detail  = await ci.getPipelineDetail(fp.last_history_id, fp.id);  // 第二个参数为 pipelineId
  const stages  = ci.formatDetail(detail);
  // stages[i].index, stages[i].name, stages[i].status_icon, stages[i].cost
  // stages[i].tasks[j].id, stages[i].tasks[j].name, stages[i].tasks[j].status_icon
}
```

## 通过 MR 查询关联流水线

当用户提供 GitLab 项目 ID 和合并请求 IID（MR 编号）时，可以查出该 MR 触发的所有流水线：

```javascript
const pipelines = await ci.getMergeRequestPipelines(26932, 790);
// pipelines[i].name         — 流水线名称
// pipelines[i].pipeline_url — 流水线访问链接
// pipelines[i].stages[j].name                — 阶段名称
// pipelines[i].stages[j].stage_id            — 阶段 ID
// pipelines[i].stages[j].pipeline_history_id — 本次执行 history ID
// pipelines[i].stages[j].status              — 阶段状态（success/fail/running…）
```

如果 GitLab 实例不是默认的 `code.sangfor.org`，可传第三个参数：

```javascript
const pipelines = await ci.getMergeRequestPipelines(26932, 790, 'code.sangfor.org');
```

拿到结果后，以列表形式展示每条流水线的名称和可点击链接，例如：

- **DSP-SDL流水线** → http://devops.sangfor.com/ci/pipeline/338150?...
- **DSP-数据底座-主线** → http://devops.sangfor.com/ci/pipeline/332876?...

> MR IID 是合并请求 URL 中的编号，如 `http://code.sangfor.org/.../merge_requests/790` → IID 为 `790`

## 触发构建 - 完整交互流程

**必须严格按以下五步走，不能跳步：**

### 第一步：展示仓库列表，让用户选择

```javascript
const p     = await ci.getPipelineById(342229);
const fp    = ci.formatPipeline(p);
const repos = await ci.getRepos(fp.version_id);
const list  = ci.formatRepos(repos);
// 展示给用户：list[i].index, list[i].name, list[i].git_url
// 等用户选择一个仓库
```

### 第二步：询问用户使用「分支」还是「标签」

直接问用户："你想用分支构建，还是标签构建？"

### 第三步：展示分支或标签列表，让用户选择

```javascript
// 分支模式（可传搜索词 search）
const branches = await ci.getBranches('https://git.sangfor.com/vs/VSAI-playground.git', '');
// branches 是字符串数组，直接展示给用户

// 标签模式
const tags = await ci.getTags('https://git.sangfor.com/vs/VSAI-playground.git');
// tags 是字符串数组，直接展示给用户
```

### 第四步：查询流水线变量，如有需填写的则问用户

```javascript
const vars = await ci.getPipelineVariables(342229);
const fvars = ci.formatVariables(vars);
// fvars[i].key          — 变量名（原字段 name）
// fvars[i].value        — 当前值（优先取 value，其次取 default_value）
// fvars[i].description  — 描述（原字段 describe）
// fvars[i].is_ask       — true 表示需要用户填写
// 如有 is_ask=true 的变量，展示给用户确认/修改；如无，跳过此步
```

### 第五步：确认后触发构建

```javascript
// 分支构建
const res = await ci.startPipeline(342229, {
  gitUrl:    'https://git.sangfor.com/vs/VSAI-playground.git',
  gitBranch: 'feature-newapi-45597',
  gitTag:    '',
  variables: [],   // 如有变量: [{key:'FOO', value:'bar'}]
});

// 标签构建
const res = await ci.startPipeline(342229, {
  gitUrl:  'https://git.sangfor.com/vs/VSAI-playground.git',
  gitBranch: '',
  gitTag:  'v1.2.3',
});

if (res.success) {
  console.log('构建已触发，history_id:', res.data?.pipeline_history_id);
} else {
  console.log('触发失败:', res.message);
}
```

## 查看并分析任务日志

```javascript
// 1. 先从 formatDetail 拿到 task.id
const detail = await ci.getPipelineDetail(fp.last_history_id);
const stages = ci.formatDetail(detail);
// stages[i].tasks[j].id  ← 这就是 taskId

// 2. 获取日志
//    - 任务刚结束或日志较小：普通模式（支持分页）
const taskId = stages[0].tasks[0].id;
const result = await ci.getTaskLogs(taskId, {
  lastStatus: stages[0].tasks[0].status,  // ongoing / success / fail
  script: 'main',                          // main（默认）/ before / after
  pipelineId: fp.id,                       // 流水线 ID（用于构造 referer）
});
// result.log          — 日志文本（可能被截断）
// result.isCompleted  — 是否已结束
// result.isCut        — 日志是否被截断（超大日志）
// result.nextStart    — 下一页起始位置（isCut=true 时分页用）
// result.lastStatus   — 当前状态

//    - 任务失败/日志较大：全量模式（内容不截断，推荐用于分析失败原因）
const fullResult = await ci.getTaskLogs(taskId, { full: true });
// fullResult.log  — 完整纯文本日志

// 3. 分析日志：直接将 result.log 传给 AI 分析

// 4. 查运行时注入的环境变量（可选，辅助诊断）
const runVars = await ci.getTaskRunVariables(taskId);
// runVars[i].key / runVars[i].value
```

## 触发单个任务

当已经拿到某个 `task.id` 后，可以直接触发该任务：

```javascript
// 默认首次触发：is_retry = false
const res = await ci.startTask(123456);
// 等价于：
// const res = await ci.startTask(123456, { isRetry: false });

if (res.success) {
  console.log('任务已触发');
} else {
  console.log('触发失败:', res.message);
}
```

如果是重试同一个任务，显式传 `isRetry: true`：

```javascript
const retryRes = await ci.startTask(123456, { isRetry: true });

if (retryRes.success) {
  console.log('任务已重试');
} else {
  console.log('重试失败:', retryRes.message);
}
```

### 日志获取策略

- **优先使用全量模式**（`full: true`）分析失败任务，避免关键报错被截断
- 普通模式适合任务仍在运行时实时查看（`ongoing` 状态）
- 如普通模式返回 `isCut=true`，改用全量模式

### 日志分析要点

拿到日志后**直接分析内容**，重点关注：
- `ERROR`、`FAIL`、`panic`、`fatal`、`exit status` 等关键词
- 测试失败：列出失败的测试用例名称和失败原因
- 编译失败：列出具体报错文件和行号
- 超时/网络问题：如 `timeout`、`connection refused`

## 直接通过流水线地址获取详情

当用户直接提供流水线地址时（如 `http://devops.sangfor.com/ci/pipeline/319339?versionId=7237&pipelineIndex=15557`），按以下方式处理：

**重要**：`pipelineIndex` 不是 `history_id`，需要通过历史记录接口查找对应的 `history_id`。

```javascript
// 1. 先查询流水线历史记录，找到 pipelineIndex 对应的 history_id
const http = require('http');
const pipelineId = 319339;
const pipelineIndex = 15557;

const getHistory = (page) => new Promise((resolve, reject) => {
  const url = `http://devops.sangfor.com/api/cicd/pipelines/history/${pipelineId}/list?page=${page}&per=20&paginate=true&is_need_total=0&_t=${Date.now()}`;
  http.get(url, { headers: { token: TOKEN, Accept: 'application/json' } }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

// 2. 遍历查找 pipelineIndex 对应的记录
for (let page = 1; page <= 5; page++) {
  const res = await getHistory(page);
  const found = res.data.find(h => h.index === pipelineIndex);
  if (found) {
    console.log('history_id:', found.id);  // 这才是要用的 history_id
    console.log('status:', found.last_status);
    break;
  }
}

// 3. 用找到的 history_id 获取详情
const detail = await ci.getPipelineDetail(history_id, pipelineId, {
  queryPart: 'versionId=7237&pipelineIndex=15557'  // 完整的 URL 查询参数
});
const stages = ci.formatDetail(detail);
```

**获取任务日志**：
```javascript
const taskId = stages[0].tasks[0].id;
const fullResult = await ci.getTaskLogs(taskId, {
  full: true,
  pipelineId: pipelineId,
  pipelineUrl: 'http://devops.sangfor.com/ci/pipeline/319339?versionId=7237&pipelineIndex=15557'
});
```

## 查询不在列表中的流水线

如果 `getPipelineById` 提示流水线不存在（可能是其他 product 下的），但知道 pipelineId，可以直接查询历史记录：

```javascript
const http = require('http');
const pipelineId = 345210;

// 获取最新一条历史记录
const url = `http://devops.sangfor.com/api/cicd/pipelines/history/${pipelineId}/list?page=1&per=20&paginate=true&is_need_total=0&_t=${Date.now()}`;
http.get(url, { headers: { token: TOKEN, Accept: 'application/json' } }, (res) => {
  // ...
  const latest = json.data[0];
  console.log('最新 history_id:', latest.id);
  console.log('状态:', latest.last_status);
});
```

## 注意事项

- `pipelineIndex` 是流水线内部的执行序号，**不是** `history_id`，需要通过历史记录接口转换
- 流水线列表接口 `getPipelines()` 已支持自动分页，会获取完整的流水线列表
- 当用户直接提供 URL 时，`getPipelineDetail` 的 referer 使用完整的 URL（包含查询参数）
- 触发构建时**必须走完五步**，不能直接跳到第五步，必须先让用户选择仓库和分支/标签
