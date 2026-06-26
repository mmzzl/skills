'use strict';

/**
 * 深信服 DevOps CI 平台 API 客户端
 * 平台地址: http://devops.sangfor.com
 * Token 从 ~/.qianliu/config.json 读取（复用 ipd.token 字段）
 */

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { URL } = require('url');

const CI_BASE = 'http://devops.sangfor.com';
const API_BASE = `${CI_BASE}/api/cicd`;
const GITLAB_API_BASE = 'http://code.sangfor.org/api/cicd';

// ── 读取 Token ───────────────────────────────────────────────
function loadToken() {
  const configPath = path.join(os.homedir(), '.qianliu', 'config.json');
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    throw new Error(`无法读取配置文件 ${configPath}: ${e.message}`);
  }
  const cfg = JSON.parse(raw);
  const token = cfg?.ipd?.token;
  if (!token) throw new Error(`配置文件 ${configPath} 中缺少 ipd.token 字段`);
  return token;
}

const TOKEN = loadToken();

/**
 * 根据 pipelineId 构建 referer
 * @param {number|string} pipelineId
 * @param {string} [queryPart] 可选，如 'versionId=7237&pipelineIndex=15557'
 */
function buildReferer(pipelineId, queryPart = '') {
  const base = `${CI_BASE}/ci/pipeline/${pipelineId}`;
  return queryPart ? `${base}?${queryPart}` : base;
}

// ── HTTP 请求封装 ────────────────────────────────────────────
function doRequest(urlStr, method = 'GET', body = null, redirectCount = 0, referer = '') {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('重定向次数过多'));
    const parsed  = new URL(urlStr);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const headers = {
      'token': TOKEN,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(referer ? { 'Referer': referer } : {}),
      ...(payload ? { 'Content-Length': payload.length } : {}),
    };
    const options = {
      hostname: parsed.hostname,
      ...(parsed.port ? { port: Number(parsed.port) } : {}),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };
    const req = lib.request(options, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error('重定向缺少 Location 头'));
        res.resume();
        resolve(doRequest(loc, 'GET', null, redirectCount + 1, referer));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 401) return reject(new Error('认证失败（401）：请检查 ipd.token 是否有效'));
        if (res.statusCode === 404) return reject(new Error(`资源不存在（404）：${text.slice(0, 200)}`));
        if (res.statusCode >= 400) return reject(new Error(`API Error (${res.statusCode}): ${text.slice(0, 300)}`));
        try { resolve(text ? JSON.parse(text) : {}); } catch { resolve(text); }
      });
    });
    req.on('error', e => reject(new Error(`Network Error: ${e.message}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

function request(endpoint, method = 'GET', body = null, extraQuery = {}, referer = '') {
  const qs = { ...extraQuery, _t: extraQuery._t || Date.now() };
  const qsStr = Object.entries(qs)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const base = endpoint.startsWith('http') ? endpoint : `${API_BASE}/${endpoint}`;
  const fullUrl = base + (base.includes('?') ? '&' : '?') + qsStr;
  return doRequest(fullUrl, method, body, 0, referer);
}

// ── API 函数 ─────────────────────────────────────────────────

/**
 * 获取所有流水线列表（自动分页获取完整列表）
 * @param {number} [pageSize=20] 每页数量，默认20
 */
async function getPipelines(pageSize = 20) {
  const firstRes = await request('pipelines/list', 'GET', null, { page_size: pageSize });
  const total = firstRes.total || 0;
  const firstPageData = firstRes.data || [];
  if (total <= firstPageData.length) return firstPageData;

  const totalPages = Math.ceil(total / pageSize);
  const allPipelines = [...firstPageData];
  for (let page = 2; page <= totalPages; page++) {
    const res = await request('pipelines/list', 'GET', null, { page, page_size: pageSize });
    if (res.data) allPipelines.push(...res.data);
  }
  return allPipelines;
}

/**
 * 通过 ID 获取单条流水线信息（包含最近执行状态）
 * @param {number} pipelineId
 */
async function getPipelineById(pipelineId) {
  const list = await getPipelines();
  const p = list.find(p => p.id === pipelineId);
  if (!p) throw new Error(`未找到 pipeline ID=${pipelineId}，请确认 ID 是否正确`);
  return p;
}

/**
 * 获取某次运行的阶段/任务详情
 * @param {number} historyId   last_pipeline_history_id
 * @param {number} pipelineId  流水线 ID（用于构造 referer）
 * @param {object} [opts]     可选参数
 * @param {number} [opts._t]  时间戳（可选，默认自动生成）
 * @param {string} [opts.queryPart] referer 的查询参数部分（可选，如 'versionId=7237&pipelineIndex=15557'）
 */
async function getPipelineDetail(historyId, pipelineId, opts = {}) {
  const { queryPart = '' } = opts;
  const referer = buildReferer(pipelineId, queryPart);
  const extraQuery = opts._t ? { fromdb: 'true', _t: opts._t } : { fromdb: 'true' };
  const res = await request(`pipelines/history/${historyId}/detail`, 'GET', null, extraQuery, referer);
  return res.data || {};
}

/**
 * 获取版本下的仓库列表（触发构建第一步）
 * @param {number} versionId  pipeline.version_id
 */
async function getRepos(versionId) {
  const res = await request(`version/${versionId}/repos`);
  return res.data || [];
}

/**
 * 获取仓库的分支列表（触发构建第三步 - 分支模式）
 * @param {string} gitUrl  仓库 URL，如 https://git.sangfor.com/vs/VSAI-playground.git
 * @param {string} search  搜索关键词（可选）
 */
async function getBranches(gitUrl, search = '') {
  const res = await request('version/list/branches', 'GET', null, {
    namespace: gitUrl,
    search,
  });
  return res.data || [];
}

/**
 * 获取仓库的标签列表（触发构建第三步 - 标签模式）
 * @param {string} gitUrl  仓库 URL
 */
async function getTags(gitUrl) {
  const res = await request('version/list/tags', 'GET', null, { namespace: gitUrl });
  return res.data || [];
}

/**
 * 获取流水线变量列表（触发构建第四步）
 * @param {number} pipelineId
 */
async function getPipelineVariables(pipelineId) {
  const res = await request('pipeline_variable/list', 'GET', null, {
    is_ask: 'false',
    pipeline_id: pipelineId,
    paginate: 'false',
  });
  return res.data || [];
}

/**
 * 触发构建（触发构建第五步）
 * @param {number} pipelineId
 * @param {object} params
 * @param {string} params.gitUrl        仓库 URL
 * @param {string} [params.gitBranch]   分支名（与 gitTag 二选一）
 * @param {string} [params.gitTag]      标签名（与 gitBranch 二选一）
 * @param {Array}  [params.variables]   变量列表 [{key,value}, ...]
 */
async function startPipeline(pipelineId, params) {
  const { gitUrl, gitBranch = '', gitTag = '', variables = [] } = params;
  const body = {
    git_url:           gitUrl,
    git_branch:        gitBranch,
    git_tag:           gitTag,
    variables,
    merge_request_id:  null,
    source_branch:     null,
    target_branch:     null,
    target_project_id: null,
    target_gitlab_url: null,
  };
  const res = await request(`pipelines/${pipelineId}/start`, 'POST', body);
  return res;
}

/**
 * 触发单个任务
 * @param {number} taskId
 * @param {object} [opts]
 * @param {boolean} [opts.isRetry=false] 首次触发为 false，重试时传 true
 */
async function startTask(taskId, opts = {}) {
  const { isRetry = false } = opts;
  return request(`tasks/${taskId}/start`, 'POST', {
    is_retry: isRetry,
  });
}

// ── 格式化输出 ──────────────────────────────────────────────

const STATUS_ICON = {
  success:    '✅',
  fail:       '❌',
  failed:     '❌',
  running:    '🔄',
  ongoing:    '🔄',
  pending:    '⏳',
  unexecuted: '⬜',
  skipped:    '⏭️',
  canceled:   '🚫',
  cancelled:  '🚫',
};
function statusIcon(s) { return STATUS_ICON[s] || `[${s}]`; }

function formatPipeline(p) {
  return {
    id:            p.id,
    name:          p.name,
    desc:          p.desc || '',
    last_status:   p.last_status,
    last_status_icon: statusIcon(p.last_status),
    last_execution_time: p.last_execution_time || '',
    last_executor: p.last_executor || '',
    last_cost:     p.last_cost_seconds_str || '',
    last_history_id: p.last_pipeline_history_id || null,
    version_id:    p.version_id,
    url:           `${CI_BASE}/ci/pipeline/${p.id}`,
  };
}

function formatDetail(detail) {
  const stages = detail.stage || [];
  return stages.map(s => ({
    index:  s.index,
    name:   s.name,
    status: s.status,
    status_icon: statusIcon(s.status),
    cost:   s.cost_second || '',
    tasks:  (s.task || []).flat().map(t => ({
      id:     t.id,          // 用于查日志：getTaskLogs(task.id)
      name:   t.name,
      status: t.last_status || t.status,
      status_icon: statusIcon(t.last_status || t.status),
      cost:   t.cost_second || '',
    })),
  }));
}

function formatRepos(repos) {
  // repos 是字符串数组（git URL 列表）
  return repos.map((url, i) => ({
    index:   i + 1,
    name:    url.replace(/^https?:\/\/[^/]+\//, '').replace(/\.git$/, ''),
    git_url: url,
  }));
}

function formatVariables(vars) {
  return vars.map(v => ({
    key:         v.name,
    value:       v.value ?? v.default_value ?? '',
    description: v.describe || '',
    is_ask:      v.is_ask === true,
  }));
}

/**
 * 获取任务日志
 * @param {number} taskId   task.id（来自 formatDetail 的 tasks[i].id）
 * @param {object} opts
 * @param {number} [opts.start=0]       日志起始偏移（分页用）
 * @param {string} [opts.lastStatus=''] 任务当前状态（ongoing/success/fail）
 * @param {string} [opts.script='main'] 脚本段（main / before / after）
 * @param {boolean} [opts.full=false]   true 时获取完整全量日志（full=1&raw=1&detail=1），返回纯文本
 * @param {number} [opts.pipelineId]   流水线 ID（用于构造 referer）
 * @returns {{ log, isCompleted, isCut, nextStart, lastStatus }}
 */
async function getTaskLogs(taskId, opts = {}) {
  const { start = 0, lastStatus = '', script = 'main', full = false, pipelineId = 0 } = opts;
  const referer = pipelineId ? buildReferer(pipelineId) : '';

  if (full) {
    // 全量日志模式：返回纯文本，不经过 JSON 解析
    const res = await request(`tasks/${taskId}/logs`, 'GET', null, {
      start,
      full: 1,
      raw: 1,
      detail: 1,
    }, referer);
    // full/raw 模式下 doRequest 的 catch 会将纯文本直接 resolve，res 是字符串
    const text = typeof res === 'string' ? res : (res.data?.log || JSON.stringify(res));
    return {
      log:         text,
      isCompleted: true,
      isCut:       false,
      nextStart:   null,
      lastStatus:  lastStatus,
      taskName:    '',
    };
  }

  const res = await request(`tasks/${taskId}/logs`, 'GET', null, {
    start,
    last_status: lastStatus,
    script,
  }, referer);
  const d = res.data || {};
  return {
    log:         d.log || '',
    isCompleted: d.is_completed || false,
    isCut:       d.is_cuted || false,
    nextStart:   d.next_start ?? null,
    lastStatus:  d.last_status || '',
    taskName:    d.task_name || '',
  };
}

/**
 * 通过 GitLab 合并请求信息查询关联的流水线列表
 * @param {number} projectId   GitLab 项目 ID
 * @param {number} mergeIid    合并请求 IID（MR 页面 URL 中的编号）
 * @param {string} [gitlabApp='code.sangfor.org']  GitLab 实例域名
 * @returns {Array<{name, pipeline_url}>}  仅返回流水线名称和访问链接
 */
async function getMergeRequestPipelines(projectId, mergeIid, gitlabApp = 'code.sangfor.org') {
  const body = {
    gitlab_app: gitlabApp,
    project_id: projectId,
    merge_iid:  mergeIid,
  };
  const res = await doRequest(`${GITLAB_API_BASE}/merge_rel/pipeline`, 'POST', body);
  const pipelines = res.data || [];
  return pipelines.map(p => ({
    name:         p.name,
    pipeline_url: p.pipeline_url,
    stages: (p.stage || []).map(s => ({
      name:                s.name,
      stage_id:            s.stage_id,
      pipeline_history_id: s.pipeline_history_id,
      status:              s.status,
    })),
  }));
}

/**
 * 获取任务运行时变量（实际执行时注入的环境变量）
 * @param {number} taskId   task.id
 * @returns {Array<{key, value, description}>}
 */
async function getTaskRunVariables(taskId) {
  const res = await request(`task_history_variable/list_history/${taskId}`);
  return (res.data || []).map(v => ({
    key:         v.name,
    value:       v.value || '',
    description: v.describe || '',
  }));
}

module.exports = {
  CI_BASE,
  getPipelines,
  getPipelineById,
  getPipelineDetail,
  getRepos,
  getBranches,
  getTags,
  getPipelineVariables,
  startPipeline,
  startTask,
  getMergeRequestPipelines,
  getTaskLogs,
  getTaskRunVariables,
  formatPipeline,
  formatDetail,
  formatRepos,
  formatVariables,
  statusIcon,
};
