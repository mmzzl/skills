'use strict';

/**
 * TP平台测试报告生成模块
 *
 * 负责从TP平台获取测试数据并生成Markdown格式的测试报告。
 * 支持多种报告压缩模式和状态过滤。
 */

const { getHost } = require('./tp_config');
const { createClient } = require('./tp_client');


// ==================== 任务状态枚举 ====================

const TaskStatus = Object.freeze({
  WAITING: 0,
  RUNNING: 1,
  SUCCESS: 2,
  FAILED: 3,
  TERMINATED: 4,

  getName(status) {
    const map = {
      0: '等待中',
      1: '进行中',
      2: '执行成功',
      3: '执行失败',
      4: '终止'
    };
    return map[status] !== undefined ? map[status] : '未知状态';
  },

  getIcon(status) {
    const map = {
      'fail': '❌',
      'success': '✅'
    };
    return map[status] !== undefined ? map[status] : String(status);
  }
});


// ==================== 时间处理工具函数 ====================

/**
 * 将时间值转换为秒数
 * @param {string|number|null} timeValue
 * @returns {number}
 */
function parseDurationToSeconds(timeValue) {
  if (timeValue == null) return 0;

  if (typeof timeValue === 'string') {
    const parts = timeValue.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      const seconds = parseInt(parts[2], 10);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  }

  const num = parseFloat(timeValue);
  if (isNaN(num)) return 0;
  // 大于100认为是毫秒
  return num > 100 ? num / 1000 : num;
}

/**
 * 格式化时间值为可读格式
 * @param {string|number|null} timeValue
 * @returns {string}
 */
function formatDuration(timeValue) {
  if (timeValue == null) return 'N/A';

  const seconds = parseDurationToSeconds(timeValue);
  if (seconds === 0) return '0秒';
  if (seconds < 60) return `${seconds.toFixed(1)}秒`;

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}分${Math.round(remaining)}秒`;
}


// ==================== 数据获取函数 ====================

/**
 * 获取任务数据
 */
async function getTaskData(env = 'test', reportId, perPage = 1000, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const url = `/api/v1/versions/ai_auto/build/${reportId}/tasks?page=1&per=${perPage}`;
  const response = await client.get(url);
  return response.data;
}

/**
 * 获取任务执行进度
 */
async function getTaskProgress(env = 'test', reportId, perPage = 1000, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const responseData = await getTaskData(env, reportId, perPage, projectId, versionId, tpToken, agentVersion);
  const tasks = responseData.tasks || [];

  let waiting = 0, running = 0, success = 0, failed = 0, terminated = 0;

  for (const task of tasks) {
    const status = task.status;
    if (status === TaskStatus.WAITING) waiting++;
    else if (status === TaskStatus.RUNNING) running++;
    else if (status === TaskStatus.SUCCESS) success++;
    else if (status === TaskStatus.FAILED) failed++;
    else if (status === TaskStatus.TERMINATED) terminated++;
  }

  const total = tasks.length;
  const unfinished = waiting + running;
  const completed = success + failed + terminated;
  const totalExecuted = success + failed;

  const successRate = totalExecuted > 0 ? Math.round(success / totalExecuted * 10000) / 100 : 0;
  const completionRate = total > 0 ? Math.round(completed / total * 10000) / 100 : 0;

  return {
    reportId,
    total,
    unfinished,
    success,
    failed,
    terminated,
    successRate,
    completionRate
  };
}

/**
 * 获取单个用例执行过程结果
 */
async function getTaskDetail(env = 'test', caseId, taskId, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  if (caseId == null || taskId == null) {
    throw new Error('caseId 和 taskId 参数必须提供');
  }

  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const url = '/api/v1/versions/ai_auto/tasks';
  const response = await client.get(url, { case_id: caseId, task_id: taskId });
  const responseData = response.data;

  const task = responseData.task || {};
  const result = task.result || [];
  const taskConfig = task.task_config || {};
  const hostTag = task.host_tag;
  const hostName = task.host_name;
  const caseCode = task.case_code;

  const caseSteps = [];
  for (const step of result) {
    const actions = [];
    for (const action of (step.response || [])) {
      const actionDesc = action.response_text;
      if (!action.done && !actionDesc) continue;
      if (action.done && !actionDesc) {
        action.status = 'success';
        continue;
      }
      actions.push({
        actionDesc,
        actionStatus: action.status,
        actionCostTime: action.execution_time,
        actionResult: (action.state && action.state.model_debug_info && action.state.model_debug_info.result) || ''
      });
    }

    caseSteps.push({
      stepIndex: step.step_index,
      stepType: step.plan_type,
      stepContent: (step.extended_attributes && step.extended_attributes.actual_plan_content) || '',
      actions
    });
  }

  return {
    testbedId: taskConfig.testbed_id,
    testbedName: taskConfig.testbed_name,
    hostTag,
    hostName,
    taskId,
    caseId,
    caseCode,
    caseName: responseData.case_name || 'N/A',
    caseStatus: TaskStatus.getName(task.status),
    caseSteps
  };
}

async function _getTaskDetailSafe(env, caseId, taskId, projectId, versionId, tpToken, agentVersion) {
  try {
    return await getTaskDetail(env, caseId, taskId, projectId, versionId, tpToken, agentVersion);
  } catch (e) {
    return {
      taskId,
      caseId,
      caseName: '获取失败',
      caseStatus: '错误',
      error: String(e)
    };
  }
}


// ==================== 报告生成内部辅助函数 ====================

function _getStepStatus(actions) {
  if (!actions || actions.length === 0) return ['⏳', '未执行'];
  const lastAction = actions[actions.length - 1];
  const status = lastAction.actionStatus;

  if (typeof status === 'string') {
    const icon = TaskStatus.getIcon(status);
    let name;
    if (status === 'success') name = '执行成功';
    else if (status === 'fail') name = '执行失败';
    else name = status;
    return [icon, name];
  }

  const icon = status != null ? TaskStatus.getIcon(status) : '❓';
  const name = status != null ? TaskStatus.getName(status) : '未知状态';
  return [icon, name];
}

function _formatStepInfo(step) {
  const stepIndex = step.stepIndex != null ? step.stepIndex : 'N/A';
  const stepType = step.stepType || 'N/A';
  const stepContent = step.stepContent || 'N/A';
  const actions = step.actions || [];
  const [statusIcon, statusName] = _getStepStatus(actions);
  const stepName = stepContent.length > 50 ? stepContent.slice(0, 50) + '...' : stepContent;

  return { index: stepIndex, name: stepName, type: stepType, statusIcon, statusName, actions };
}

function _shouldShowStep(stepInfo, compressMode) {
  if (compressMode === 'none' || compressMode === 'action_only') return true;
  if (compressMode === 'step_only' || compressMode === 'both') {
    return stepInfo.statusName === '执行失败';
  }
  return true;
}

function _shouldShowAction(actionIndex, totalActions, compressMode) {
  if (compressMode === 'none' || compressMode === 'step_only') return true;
  if (compressMode === 'action_only' || compressMode === 'both') {
    return actionIndex === totalActions;
  }
  return true;
}

function _extractFailureReason(action) {
  const actionResult = action.actionResult;
  if (!actionResult || actionResult === 'N/A' || actionResult === '"null"' || actionResult === '"{}"') return '';

  let resultStr;
  if (typeof actionResult === 'object') {
    const toolResult = actionResult.tool_result;
    if (!toolResult || toolResult === 'N/A') return '';
    resultStr = String(toolResult).trim();
  } else {
    resultStr = String(actionResult).trim();
  }

  // 去除首尾引号
  if ((resultStr.startsWith('"') && resultStr.endsWith('"')) ||
      (resultStr.startsWith("'") && resultStr.endsWith("'"))) {
    resultStr = resultStr.slice(1, -1);
  }

  // 尝试解析JSON
  try {
    const parsed = JSON.parse(resultStr);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const msg = parsed.msg;
      if (msg) return msg;
    } else if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (first && typeof first === 'object') {
        const reason = first.extracted_content || first.error || first.msg;
        if (reason) return reason;
      }
    }
  } catch (_) {
    // not JSON, use raw
  }

  return resultStr.length > 1200 ? resultStr.slice(0, 1200) + '...' : resultStr;
}

function _getLastNonDoneActionFailureReason(actions) {
  for (let i = actions.length - 1; i >= 0; i--) {
    const action = actions[i];
    const status = action.actionStatus;
    if (status !== 'success' && status !== 'done') {
      const reason = _extractFailureReason(action);
      if (reason) return reason;
    }
  }
  return '';
}

function _getSuccessSummary(task) {
  const caseStatus = task.caseStatus || '';
  const steps = task.caseSteps || [];
  if (!steps.length) return '无步骤信息';
  const totalSteps = steps.length;

  if (caseStatus === '执行成功') {
    return `执行成功，共 ${totalSteps} 个步骤，无失败步骤`;
  } else if (caseStatus === '进行中') {
    const completedSteps = steps.filter(step => {
      const actions = step.actions || [];
      return actions.length > 0 && actions[actions.length - 1].actionStatus === 'success';
    }).length;
    return `进行中，已完成 ${completedSteps}/${totalSteps} 个步骤`;
  }
  return `共 ${totalSteps} 个步骤`;
}

function _formatCaseSteps(task, nameLimit = 1200, compressMode = 'none') {
  const stepLines = [];
  let hasFailureReason = false;

  if (!task.caseSteps || task.caseSteps.length === 0) return stepLines;

  // Step压缩模式：对成功/进行中用例显示摘要
  if (compressMode === 'step_only' || compressMode === 'both') {
    const caseStatus = task.caseStatus || '';
    if (caseStatus === '执行成功' || caseStatus === '进行中') {
      stepLines.push(`*${_getSuccessSummary(task)}*`);
      stepLines.push('');
      return stepLines;
    }
  }

  for (const step of task.caseSteps) {
    const info = _formatStepInfo(step);
    if (!_shouldShowStep(info, compressMode)) continue;

    const stepName = info.name.length > nameLimit
      ? info.name.slice(0, nameLimit) + '...'
      : info.name;
    stepLines.push(`**${info.type} 步骤 ${info.index}**: ${stepName}`);

    const actions = info.actions;

    if (compressMode === 'step_only' || compressMode === 'both') {
      if (actions.length > 0 && info.statusName === '执行失败') {
        const failureReason = _getLastNonDoneActionFailureReason(actions);
        if (failureReason) {
          stepLines.push('```');
          stepLines.push(`失败原因: ${failureReason}`);
          stepLines.push('```');
          hasFailureReason = true;
        }
      }
      stepLines.push('');
    } else {
      if (actions.length > 0) {
        const totalActions = actions.length;
        for (let idx = 1; idx <= totalActions; idx++) {
          if (!_shouldShowAction(idx, totalActions, compressMode)) continue;
          const action = actions[idx - 1];
          const actionDesc = action.actionDesc || 'N/A';
          const actionStatus = action.actionStatus;
          const statusIcon = actionStatus != null ? TaskStatus.getIcon(actionStatus) : '❓';
          const costTime = formatDuration(action.actionCostTime);
          stepLines.push(`> - Action ${idx} ${statusIcon}: ${actionDesc}`);
          stepLines.push(`>   耗时: ${costTime}`);
        }
        stepLines.push('');
      } else {
        stepLines.push('');
      }
    }
  }

  if (!hasFailureReason) {
    stepLines.push('```');
    stepLines.push('失败原因: 未能获取到具体失败原因，可能在执行过程中提前终止（未到达断言步骤）');
    stepLines.push('```');
    stepLines.push('');
  }

  return stepLines;
}


// ==================== 主报告生成函数 ====================

/**
 * 获取实时任务报告（Markdown 格式）
 * @param {object} options
 * @param {string} [options.env='test']
 * @param {number} options.reportId
 * @param {boolean} [options.verbose=false]
 * @param {number[]|null} [options.statusFilter]
 * @param {number} [options.maxWorkers=5]
 * @param {string} [options.compressMode='none']
 * @param {number|null} [options.projectId]
 * @param {number|null} [options.versionId]
 * @param {string|null} [options.tpToken]
 * @returns {Promise<{markdown: string, progress: object, summary: object}>}
 */
async function getRealtimeTaskReport({
  env = 'test',
  reportId,
  verbose = false,
  statusFilter = null,
  maxWorkers = 5,
  compressMode = 'none',
  projectId = null,
  versionId = null,
  tpToken = null,
  agentVersion = null
} = {}) {
  if (reportId == null) throw new Error('reportId 参数必须提供');

  const defaultFilter = [TaskStatus.FAILED, TaskStatus.SUCCESS, TaskStatus.RUNNING];
  const activeFilter = statusFilter || defaultFilter;

  const [responseData, progress] = await Promise.all([
    getTaskData(env, reportId, 1000, projectId, versionId, tpToken, agentVersion),
    getTaskProgress(env, reportId, 1000, projectId, versionId, tpToken, agentVersion)
  ]);

  const tasks = responseData.tasks || [];

  // 并发获取任务详情（分批，最多maxWorkers并发）
  const taskDetails = [];
  for (let i = 0; i < tasks.length; i += maxWorkers) {
    const batch = tasks.slice(i, i + maxWorkers);
    const batchResults = await Promise.all(
      batch.map(t => _getTaskDetailSafe(env, t.case_id, t.task_id, projectId, versionId, tpToken, agentVersion))
    );
    taskDetails.push(...batchResults);
  }

  // 按 status 分组
  const filterNames = activeFilter.map(s => TaskStatus.getName(s));

  const waitingTasks = taskDetails.filter(t => !t.error && t.caseStatus === '等待中' && filterNames.includes(t.caseStatus));
  const runningTasks = taskDetails.filter(t => !t.error && t.caseStatus === '进行中' && filterNames.includes(t.caseStatus));
  const successTasks = taskDetails.filter(t => !t.error && t.caseStatus === '执行成功' && filterNames.includes(t.caseStatus));
  const failedTasks = taskDetails.filter(t => !t.error && t.caseStatus === '执行失败' && filterNames.includes(t.caseStatus));
  const terminatedTasks = taskDetails.filter(t => !t.error && t.caseStatus === '终止' && filterNames.includes(t.caseStatus));

  // 生成 Markdown 报告
  const lines = [];

  // ============== 一、执行概览 ==============
  lines.push('## 一、执行概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 用例总数 | ${progress.total} |`);
  lines.push(`| 执行成功 | ${progress.success} ✅ |`);
  lines.push(`| 执行失败 | ${progress.failed} ❌ |`);
  lines.push(`| 进行中 | ${progress.unfinished} 🔄 |`);
  lines.push(`| 终止 | ${progress.terminated} ⛔ |`);
  lines.push(`| **执行成功率** | **${progress.successRate}%** |`);
  lines.push(`| **完成度** | **${progress.completionRate}%** |`);
  lines.push('');

  // ============== 二、全部用例状态（可选）==============
  if (verbose) {
    lines.push('## 二、全部用例状态');
    lines.push('');
    lines.push('| 序号 | 用例名称 | 状态 |');
    lines.push('|------|----------|------|');

    const allTasksDisplay = [];
    for (const task of taskDetails) {
      if (task.error) continue;
      const caseStatus = task.caseStatus || '';
      let statusIcon = '';
      if (caseStatus === '执行成功') statusIcon = '✅';
      else if (caseStatus === '执行失败') statusIcon = '❌';
      else if (caseStatus === '进行中') statusIcon = '🔄';
      else if (caseStatus === '等待中') statusIcon = '⏳';
      else if (caseStatus === '终止') statusIcon = '⛔';

      const caseCode = task.caseCode || '';
      const caseName = task.caseName || 'N/A';
      const displayName = caseCode ? `${caseCode} ${caseName}` : caseName;
      allTasksDisplay.push({ displayName, statusIcon, caseStatus });
    }

    allTasksDisplay.forEach((item, idx) => {
      lines.push(`| ${idx + 1} | ${item.displayName} | ${item.statusIcon} |`);
    });
    lines.push('');
  }

  // ============== 三、失败用例详情 ==============
  const sectionNum = verbose ? '三' : '二';
  lines.push(`## ${sectionNum}、失败用例详情`);
  lines.push('');

  if (failedTasks.length === 0) {
    lines.push('*无失败用例*');
    lines.push('');
  } else {
    const baseUrl = getHost(env);
    failedTasks.forEach((task, idx) => {
      const caseId = task.caseId;
      const tid = task.taskId;
      const caseDetailUrl = `${baseUrl}/testcase/ai-auto?productId=${projectId || ''}&projectId=${versionId || ''}&case_id=${caseId}&task_id=${tid}${agentVersion ? `&agentVersion=${agentVersion}` : ''}`;
      lines.push(`### 用例${idx + 1} ❌ ${task.caseName || 'N/A'}`);
      lines.push('');
      lines.push(`\`用例ID: ${caseId}\` | \`任务ID: ${tid}\` | 测试床: \`${task.testbedName || 'N/A'}\``);
      lines.push('');
      const statusText = task.caseStatus === '执行成功' ? '成功' : '失败';
      lines.push(`[查看${statusText}用例详情](${caseDetailUrl})`);
      lines.push('');
      const stepLines = _formatCaseSteps(task, 120, compressMode);
      lines.push(...stepLines);
    });
  }

  const markdownContent = lines.join('\n');

  return {
    markdown: markdownContent,
    progress,
    summary: {
      total: progress.total,
      success: progress.success,
      failed: progress.failed,
      terminated: progress.terminated,
      running: progress.unfinished,
      successRate: progress.successRate,
      completionRate: progress.completionRate
    }
  };
}


module.exports = {
  TaskStatus,
  parseDurationToSeconds,
  formatDuration,
  getTaskData,
  getTaskProgress,
  getTaskDetail,
  getRealtimeTaskReport
};
