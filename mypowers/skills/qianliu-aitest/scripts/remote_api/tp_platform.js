'use strict';

/**
 * TP平台自动化测试模块（统一入口）
 *
 * 本模块作为统一入口，导入并重新导出所有公共API。
 * 配置管理: tp_config.js
 * HTTP客户端: tp_client.js
 * 报告生成: tp_report.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ==================== 从子模块导入核心功能 ====================

const {
  getConfig,
  getHost,
  getHeaders,
  setEnv,
  getEnv
} = require('./tp_config');

const {
  TPClient,
  createClient,
  cleanup
} = require('./tp_client');

const {
  TaskStatus,
  parseDurationToSeconds,
  formatDuration,
  getTaskData,
  getTaskProgress,
  getTaskDetail,
  getRealtimeTaskReport
} = require('./tp_report');


// ==================== 测试床管理 ====================

/**
 * 通过测试床名称（精确匹配）查找测试床ID
 *
 * 策略：
 * 1. 先走模糊查询，从结果中精确匹配
 * 2. 若模糊查询返回空，则分批（每批500条）拉取全量列表做精确匹配
 *
 * @param {string} name - 测试床名称（精确匹配）
 * @param {string} [env] - 环境类型
 * @param {number} [projectId] - 项目ID
 * @param {number} [versionId] - 版本ID
 * @param {string} [tpToken] - TP平台认证Token
 * @returns {Promise<number>} 测试床ID
 */
async function getTestbedByName(name, env = null, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const path = '/api/v1/versions/ai_auto/testbed/';

  // 第一步：模糊查询
  const fuzzyParams = {
    name,
    page: 1,
    per: 20,
    _t: Date.now()
  };

  const fuzzyResp = await client.get(path, fuzzyParams);
  const fuzzyData = (fuzzyResp.data && fuzzyResp.data.data) || [];

  for (const testbed of fuzzyData) {
    if (testbed.name === name) return testbed.id;
  }

  // 第二步：分批拉取全量，精确匹配
  const batchSize = 500;
  let page = 1;
  let totalFetched = 0;

  while (true) {
    const batchResp = await client.get(path, { page, per: batchSize });
    const batch = (batchResp.data && batchResp.data.data) || [];

    for (const testbed of batch) {
      if (testbed.name === name) return testbed.id;
    }

    totalFetched += batch.length;
    if (batch.length < batchSize) break;
    page++;
  }

  throw new Error(
    `未找到名称完全匹配的测试床: '${name}'。` +
    `已搜索全量 ${totalFetched} 条记录（模糊查询返回 ${fuzzyData.length} 条），` +
    `请确认名称是否正确。`
  );
}

/**
 * 获取测试床列表
 */
async function getTestbed(page = 1, per = 9999, env = null, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const response = await client.get('/api/v1/versions/ai_auto/testbed/', { page, per });
  return response.data;
}

/**
 * 新增测试床
 */
async function createTestbed(name, testbed, env = null, projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const response = await client.post('/api/v1/versions/ai_auto/testbed/', { name, testbed });
  return response.data;
}


// ==================== 构建管理 ====================

/**
 * 格式化当前时间为 YYYYMMDD-HH:MM:SS
 */
function _formatNow() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}:${min}:${ss}`;
}

/**
 * 构建自动化测试任务
 *
 * @param {string} desc - 构建描述
 * @param {number} aiTestcaseTaskId - AI测试用例任务ID
 * @param {Array} [aiAutoConfig=[]] - AI自动配置列表
 * @param {string} [env='test'] - 环境类型
 * @param {number} [projectId] - 项目ID
 * @param {number} [versionId] - 版本ID
 * @param {string} [tpToken] - TP平台认证Token
 * @returns {Promise<object>} API响应
 */
async function createBuild(desc, aiTestcaseTaskId, aiAutoConfig = [], env = 'test', projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });

  const runnerInfo = { id: null, tag: [] };
  const buildArgs = { testbed: null, concurrent_num: 1, resource_pool: null };

  const data = {
    desc: desc == null ? _formatNow() : desc,
    plan_id: aiTestcaseTaskId,
    is_ai_auto: 'True',
    ai_auto_config: aiAutoConfig || [],
    runner_info: runnerInfo,
    build_args: buildArgs
  };

  const response = await client.post('/api/v1/builds/', data);
  return response.data;
}

/**
 * 查询自动化测试任务
 */
async function getBuild(reportId, env = 'test', projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const response = await client.get(`/api/v1/builds/${reportId}`);
  const data = response.data;

  const progress = data.progress || {};
  const error = progress.Error || 0;
  const failed = progress.Failed || 0;
  const noRun = progress['No Run'] || 0;
  const passed = progress.Passed || 0;
  const totalExecuted = error + failed + passed;
  const successRate = totalExecuted > 0 ? passed / totalExecuted : 0;

  return {
    rawData: data,
    progressSummary: {
      errorCount: error,
      failedCount: failed,
      noRunCount: noRun,
      passedCount: passed,
      successRate
    },
    totalCases: error + failed + noRun + passed,
    executedCases: totalExecuted,
    status: data.status
  };
}

/**
 * 停止/中断正在运行的构建任务
 */
async function interruptBuild(buildId, env = 'test', projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const data = { build_id: String(buildId) };
  const response = await client.post('/api/v1/builds/interrupt/', data);

  if (!response.data || (typeof response.data === 'string' && response.data.trim() === '')) {
    return { status: 'ok', code: response.status };
  }
  return response.data;
}

/**
 * 批量重试指定用例
 *
 * @param {string|number} buildId - 原构建报告ID
 * @param {number} planId - 测试计划ID（ai_testcase_task_id）
 * @param {Array} aiAutoConfig - AI自动配置列表，每项包含 { testbed_id, host_tag, testbed }
 * @param {Array} taskInfos - 需要重试的用例列表，每项包含 { case_id, task_id }
 * @param {string} [env='prod'] - 环境类型
 * @param {number} [projectId] - 项目ID
 * @param {number} [versionId] - 版本ID
 * @param {string} [tpToken] - TP平台认证Token
 * @param {string} [agentVersion] - Agent版本
 * @returns {Promise<object>} API响应（含新构建的 id）
 */
async function retryBuild(buildId, planId, aiAutoConfig = [], taskInfos = [], env = 'prod', projectId = null, versionId = null, tpToken = null, agentVersion = null) {
  const client = createClient({ env, projectId, versionId, tpToken, agentVersion });
  const data = {
    build_id: String(buildId),
    plan_id: planId,
    is_ai_auto: true,
    ai_auto_config: aiAutoConfig,
    task_infos: taskInfos
  };
  const response = await client.post('/api/v1/builds/task_retry/', data);
  return response.data;
}


// ==================== 导出所有公共API ====================

module.exports = {
  // 配置管理
  getConfig,
  getHost,
  getHeaders,
  setEnv,
  getEnv,

  // HTTP客户端
  TPClient,
  createClient,
  cleanup,

  // 报告生成
  TaskStatus,
  parseDurationToSeconds,
  formatDuration,
  getTaskData,
  getTaskProgress,
  getTaskDetail,
  getRealtimeTaskReport,

  // 测试床管理
  getTestbedByName,
  getTestbed,
  createTestbed,

  // 构建管理
  createBuild,
  getBuild,
  interruptBuild,
  retryBuild
};
