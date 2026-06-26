'use strict';

/**
 * 深信服 TP 测试平台 API 客户端
 * 支持多平台：tp (tp.sangfor.com) 和 cstp (cs.tp.sangfor.com)
 * Token / project_id / version_id 从 ~/.qianliu/config.json 读取
 * 格式: {"tp":{"token":"...","project_id":64,"version_id":153},"cstp":{"token":"...","project_id":...,"version_id":...}}
 */

const http    = require('http');
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { URL } = require('url');

// ── 平台配置 ──────────────────────────────────────────────────
const PLATFORM_CONFIG = {
  tp:   { baseUrl: 'https://tp.sangfor.com',    directBaseUrl: 'https://tp.sangfor.com',       configKey: 'tp'   },
  cstp: { baseUrl: 'https://cs.tp.sangfor.com',  directBaseUrl: 'https://cs.tp.sangfor.com',    configKey: 'cstp', insecure: true },
};

// ── 读取本地配置文件 ──────────────────────────────────────────
function loadConfigFile() {
  const configPath = path.join(os.homedir(), '.qianliu', 'config.json');
  let raw;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch (e) {
    throw new Error(`无法读取配置文件 ${configPath}: ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`配置文件 JSON 解析失败: ${e.message}`);
  }
}

// ── 创建平台专属 API 实例 ─────────────────────────────────────
function createApi(platform = 'tp') {
  const platformCfg = PLATFORM_CONFIG[platform];
  if (!platformCfg) {
    const supported = Object.keys(PLATFORM_CONFIG).join(', ');
    throw new Error(`未知平台: "${platform}"，支持的平台: ${supported}`);
  }

  const cfg = loadConfigFile();
  const tp  = cfg?.[platformCfg.configKey];
  if (!tp?.token)      throw new Error(`配置文件中缺少 ${platformCfg.configKey}.token 字段`);
  if (!tp?.project_id) throw new Error(`配置文件中缺少 ${platformCfg.configKey}.project_id 字段`);
  if (!tp?.version_id) throw new Error(`配置文件中缺少 ${platformCfg.configKey}.version_id 字段`);

  const TP_BASE_URL = platformCfg.baseUrl;
  const API_BASE    = `${TP_BASE_URL}/api/v1`;
  const CONFIG      = { token: tp.token, projectId: tp.project_id, versionId: tp.version_id };

  // ── HTTP 请求封装（支持 301/302 重定向） ────────────────────
  function doRequest(urlStr, method, payload, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      if (redirectCount > 5) return reject(new Error('重定向次数过多'));
      const parsed  = new URL(urlStr);
      const isHttps = parsed.protocol === 'https:';
      const lib     = isHttps ? https : http;
      const options = {
        hostname: parsed.hostname,
        ...(parsed.port ? { port: Number(parsed.port) } : {}),
        path:     parsed.pathname + parsed.search,
        method,
        ...(isHttps && platformCfg.insecure ? { rejectUnauthorized: false } : {}),
        headers: {
          'token':          CONFIG.token,
          'project-id':     String(CONFIG.projectId),
          'version-id':     String(CONFIG.versionId),
          'Accept':         'application/json',
          'Content-Type':   'application/json',
          ...(payload ? { 'Content-Length': payload.length } : {}),
        },
      };
      const req = lib.request(options, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (!location) return reject(new Error('重定向缺少 Location 头'));
          res.resume();
          // 保留原始 method，POST 重定向仍发 POST
          resolve(doRequest(location, method, payload, redirectCount + 1));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode === 401) {
            return reject(new Error(`认证失败（401）：请检查 ${platformCfg.configKey}.token 是否有效`));
          }
          if (res.statusCode === 404) {
            return reject(new Error('资源不存在（404）：请检查 case_id 是否正确'));
          }
          if (res.statusCode >= 400) {
            return reject(new Error(`API Error (${res.statusCode}): ${text.slice(0, 200)}`));
          }
          try {
            resolve(text ? JSON.parse(text) : {});
          } catch {
            resolve(text);
          }
        });
      });
      req.on('error', (e) => reject(new Error(`Network Error: ${e.message}`)));
      if (payload) req.write(payload);
      req.end();
    });
  }

  function request(endpoint, method = 'GET', body = null, extraQuery = {}, omitProjectId = false) {
    const baseQs = {
      ...(omitProjectId ? {} : { project_id: CONFIG.projectId }),
      _t:              Date.now(),
      sf_request_type: 'ajax',
      ...extraQuery,
    };
    const qsStr = Object.entries(baseQs)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    let fullUrl = endpoint.startsWith('http') ? endpoint : `${API_BASE}/${endpoint}`;
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + qsStr;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    return doRequest(fullUrl, method, payload);
  }

  // ── API 函数 ────────────────────────────────────────────────

  /**
   * 获取用例详情
   * @param {number|string} caseId  用例内部 ID（URL 中的数字，如 207798）
   */
  async function getCase(caseId) {
    return request(`versions/${CONFIG.versionId}/cases/${caseId}/`);
  }

  /**
   * 按关键词搜索用例
   * @param {string} keyword
   * @param {object} opts
   * @param {number} [opts.page=1]
   * @param {number} [opts.pageSize=30]
   */
  async function searchCases(keyword, opts = {}) {
    const { page = 1, pageSize = 30 } = opts;
    const body = {
      path_list:   ['-1'],
      sortBy:      'create_at',
      order:       false,
      page_size:   pageSize,
      page,
      last_run_at: '',
      create_at:   '',
      node_id:     -1,
      case_code:   keyword,
    };
    return request(`versions/${CONFIG.versionId}/cases/search/`, 'POST', body, {}, true);
  }

  /**
   * 修改用例字段（支持部分更新）
   * @param {number|string} caseId  用例内部 ID
   * @param {object}        fields  要修改的字段，如 { name, doc_step, doc_except, doc_pre, priority }
   */
  async function updateCase(caseId, fields) {
    return request(`versions/${CONFIG.versionId}/cases/${caseId}/`, 'PATCH', fields);
  }

  /**
   * 通过 case_code 获取用例详情（自动分页搜索取系统 ID，再获取详情）
   * @param {string} caseCode  用例编码（如 tc_control_rt_442）
   * @param {object} [opts]
   * @param {number} [opts.pageSize=100]  每页条数
   * @param {number} [opts.maxPages=20]   最多翻页次数（防止无限循环）
   */
  async function getCaseByCaseCode(caseCode, opts = {}) {
    const { pageSize = 100, maxPages = 20 } = opts;
    for (let page = 1; page <= maxPages; page++) {
      const result = await searchCases(caseCode, { pageSize, page });
      const list = result.results || [];
      if (list.length === 0) break;  // 没有更多结果
      const matched = list.find(c => c.case_code === caseCode);
      if (matched) return getCase(matched.id);
      // 当前页已不足一页，说明没有更多数据
      if (list.length < pageSize) break;
    }
    throw new Error(`未找到 case_code 为 "${caseCode}" 的用例，已搜索最多 ${maxPages * pageSize} 条，请检查编码是否正确`);
  }

  /**
   * 获取用例修改历史
   * @param {number|string} caseId  用例内部 ID
   */
  async function getCaseHistory(caseId) {
    return request(`versions/${CONFIG.versionId}/cases/${caseId}/modification/`);
  }

  /**
   * 按 path_list 查询用例列表
   * @param {string[]} pathList  目录路径列表，如 ['-1'] 或 ['02-集成测试', '3.0.34']
   * @param {object}   opts
   * @param {number}   [opts.page=1]
   * @param {number}   [opts.pageSize=100]
   */
  async function getPathListCode(pathList = ['-1'], opts = {}) {
    const { page = 1, pageSize = 100 } = opts;
    const body = {
      path_list:   pathList,
      sortBy:      'create_at',
      order:       false,
      page_size:   pageSize,
      page,
      last_run_at: '',
      create_at:   '',
      node_id:     -1,
      case_code:   '',
    };
    return request(`versions/${CONFIG.versionId}/cases/search/`, 'POST', body, {}, true);
  }

  /**
   * 通过 case_code 获取用例修改历史（自动分页搜索取系统 ID）
   * @param {string} caseCode  用例编码（如 tc_control_rt_442）
   * @param {object} [opts]
   * @param {number} [opts.pageSize=100]  每页条数
   * @param {number} [opts.maxPages=20]   最多翻页次数
   */
  async function getCaseHistoryByCaseCode(caseCode, opts = {}) {
    const { pageSize = 100, maxPages = 20 } = opts;
    for (let page = 1; page <= maxPages; page++) {
      const result = await searchCases(caseCode, { pageSize, page });
      const list = result.results || [];
      if (list.length === 0) break;
      const matched = list.find(c => c.case_code === caseCode);
      if (matched) return getCaseHistory(matched.id);
      if (list.length < pageSize) break;
    }
    throw new Error(`未找到 case_code 为 "${caseCode}" 的用例，请检查编码是否正确`);
  }

  /**
   * 获取所有计划列表，支持按阶段/版本/名称过滤
   * @param {object} opts
   * @param {number} [opts.pageSize=200]  每页条数（计划数量通常不超过 200）
   * @param {string} [opts.stage]         按 ipd_stage_name 模糊匹配（如 "集成测试"）
   * @param {string} [opts.version]       按 ipd_version_name 模糊匹配（如 "3.0.34"）
   * @param {string} [opts.name]          按计划名称模糊匹配
   */
  async function listPlans(opts = {}) {
    const { pageSize = 200, stage, version, name } = opts;
    const directBase = platformCfg.directBaseUrl || TP_BASE_URL;
    const qs  = `_t=${Date.now()}&sf_request_type=ajax&project_id=${CONFIG.projectId}&version_id=${CONFIG.versionId}&page_size=${pageSize}`;
    const url = `${directBase}/api/v1/plans/?${qs}`;
    const result = await doRequest(url, 'GET', null);
    const plans  = Array.isArray(result) ? result : (result.results || []);

    return plans.filter(p => {
      if (stage   && !(p.ipd_stage_name   || '').includes(stage))   return false;
      if (version && !(p.ipd_version_name || '').includes(version)) return false;
      if (name    && !(p.name             || '').includes(name))    return false;
      return true;
    });
  }

  /**
   * 按目录路径查询计划执行统计
   *
   * 核心逻辑：
   *   1. 调用 statistics API（plan_name 过滤）→ 正确的整体汇总 + 匹配的 plan_id 列表
   *   2. 结合本地 listPlans 拿到计划名称 / 团队信息
   *   3. 按 ipd_team_name 分组，团队内计划数 ≤ PER_PLAN_LIMIT 时再并发拉各计划用例明细
   *      团队计划数过多时仅展示计划列表，不做逐计划统计（避免请求爆炸）
   *
   * @param {string} pathStr  目录路径，如 "02-集成测试/3.0.34" 或 "集成测试/3.0.34迭代"
   *                          直接透传给 statistics 接口的 plan_name 字段（后端支持前缀模糊匹配）
   * @param {object} opts
   * @param {'today'|'all'|object} [opts.dateRange='all']  日期范围，默认不限日期
   * @param {number}  [opts.perPlanLimit=20]  每个团队组内，允许逐计划拉明细的最大计划数
   */
  async function getPlanStatsByPath(pathStr, opts = {}) {
    const { dateRange = 'all', perPlanLimit = 20 } = opts;

    // ── Step 1: 用 plan_name 拿整体统计 + 匹配计划 ID 列表 ──────
    const rawStat = await getPlanStatistics({ planName: pathStr, dateRange });
    const matchedIds = new Set((rawStat.kwargs && rawStat.kwargs.plan_id) || []);

    if (matchedIds.size === 0) {
      return { found: 0, planName: pathStr, summary: null, groups: [] };
    }

    const summary = formatPlanStatistics(rawStat);

    // ── Step 2: 拉计划列表，按匹配 ID 过滤，取名称和团队信息 ────
    const allPlans   = await listPlans();
    const matched    = allPlans.filter(p => matchedIds.has(p.id));

    // ── Step 3: 按 ipd_team_name 分组 ──────────────────────────
    const teamMap = {};
    for (const p of matched) {
      const team = p.ipd_team_name || '(未分配团队)';
      if (!teamMap[team]) teamMap[team] = [];
      teamMap[team].push(p);
    }

    // ── Step 4: 逐团队拉明细（计划数在阈值内才拉） ──────────────
    const directBase = platformCfg.directBaseUrl || TP_BASE_URL;

    // 计算日期过滤范围
    let dateFilter = null;
    if (dateRange === 'today') {
      const now = new Date();
      const gte = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime();
      const lte = gte + 86400000 - 1;
      dateFilter = { gte, lte };
    } else if (dateRange !== 'all' && dateRange !== '') {
      dateFilter = dateRange;
    }

    async function fetchPlanStats(plan) {
      const qs  = `_t=${Date.now()}&sf_request_type=ajax&project_id=${CONFIG.projectId}&page_size=2000`;
      const url = `${directBase}/api/v1/plans/${plan.id}/cases/?${qs}`;
      try {
        const raw   = await doRequest(url, 'GET', null);
        const cases = Array.isArray(raw) ? raw : (raw.results || []);
        const scope = dateFilter
          ? cases.filter(c => {
              if (!c.last_run_at) return false;
              const t = new Date(c.last_run_at).getTime();
              return t >= dateFilter.gte && t <= dateFilter.lte;
            })
          : cases;
        const s = { total: scope.length, passed: 0, failed: 0, blocked: 0, no_run: 0, na: 0, auto_count: 0 };
        for (const c of scope) {
          const st = c.case_status || 'No Run';
          if      (st === 'Passed')  s.passed++;
          else if (st === 'Failed')  s.failed++;
          else if (st === 'Blocked') s.blocked++;
          else if (st === 'N/A')     s.na++;
          else                       s.no_run++;
          if (c.isautomated === 1) s.auto_count++;
        }
        s.pass_rate = s.total > 0 ? Math.round(s.passed / s.total * 100) + '%' : '-';
        s.exec_rate = s.total > 0 ? Math.round((s.total - s.no_run) / s.total * 100) + '%' : '-';
        return { plan, stats: s };
      } catch (e) {
        return { plan, error: e.message };
      }
    }

    const groups = await Promise.all(
      Object.entries(teamMap).map(async ([team, plans]) => {
        if (plans.length <= perPlanLimit) {
          const planResults = await Promise.all(plans.map(fetchPlanStats));
          return { team, planCount: plans.length, plans: planResults };
        }
        // 计划数超过阈值：只列计划名，不拉明细
        return {
          team,
          planCount: plans.length,
          plans: plans.map(p => ({ plan: p, stats: null })),
          tooMany: true,
        };
      })
    );

    // 按团队计划数降序排列
    groups.sort((a, b) => b.planCount - a.planCount);

    return { found: matchedIds.size, planName: pathStr, summary, groups };
  }

  /**
   * 查询计划用例执行统计（执行进度）
   * @param {object} opts
   * @param {number|string} [opts.planId=-2]            计划 ID，-2 表示当前版本所有计划
   * @param {number|string} [opts.nodeId=-2]            节点 ID
   * @param {'today'|'all'|object} [opts.dateRange='today']
   *        'today' : 今天 00:00:00 ~ 23:59:59（本地时间）
   *        'all'   : 不限日期（last_run_at 留空）
   *        {gte, lte}: 自定义毫秒时间戳范围
   * @param {string[]} [opts.pathList=['-1']]           路径过滤
   * @param {string}   [opts.planName]                  按目录路径过滤，如 "02-集成测试/3.0.34"
   * @param {number}   [opts.pageSize=30]
   * @param {number}   [opts.page=1]
   */
  async function getPlanStatistics(opts = {}) {
    const {
      planId    = -2,
      nodeId    = -2,
      dateRange = 'today',
      pathList  = ['-1'],
      planName,
      pageSize  = 30,
      page      = 1,
    } = opts;

    let lastRunAt;
    if (dateRange === 'today') {
      const now   = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      lastRunAt   = { gte: start.getTime(), lte: end.getTime() };
    } else if (dateRange === 'all') {
      lastRunAt = '';
    } else {
      lastRunAt = dateRange;  // { gte: ms, lte: ms }
    }

    const query = {
      path_list:   pathList,
      sortBy:      'create_at',
      order:       false,
      page_size:   pageSize,
      page,
      last_run_at: lastRunAt,
      create_at:   '',
      node_id:     nodeId,
    };
    if (planName) query.plan_name = planName;

    const body = {
      version_id: CONFIG.versionId,
      node_id:    nodeId,
      query,
    };

    // 此端点网关不支持 POST，直连 tp.sangfor.com
    const directBase = platformCfg.directBaseUrl || TP_BASE_URL;
    const qs = `_t=${Date.now()}&sf_request_type=ajax`;
    const fullUrl = `${directBase}/api/v1/plans/${planId}/statistics/?${qs}`;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    return doRequest(fullUrl, 'POST', payload);
  }

  /**
   * 按执行人统计今天/指定日期的用例执行情况
   * @param {object} opts
   * @param {'today'|'all'|object} [opts.dateRange='today']
   *        'today' : 今天 00:00:00 ~ 23:59:59（本地时间）
   *        'all'   : 不限日期
   *        {gte, lte}: 自定义毫秒时间戳范围
   * @param {string}  [opts.planName]    按 TP 目录路径过滤，如 "02-集成测试/3.0.34"
   * @param {number}  [opts.pageSize=200]  最多返回条数（含未执行用例时需设大）
   */
  async function getExecutionByUser(opts = {}) {
    const { dateRange = 'today', pageSize = 200, planName } = opts;

    let lastRunAt;
    if (dateRange === 'today') {
      const now   = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      lastRunAt   = { gte: start.getTime(), lte: end.getTime() };
    } else if (dateRange === 'all') {
      lastRunAt = '';
    } else {
      lastRunAt = dateRange;
    }

    const body = {
      path_list:   ['-1'],
      sortBy:      'create_at',
      order:       false,
      page_size:   pageSize,
      page:        1,
      last_run_at: lastRunAt,
      create_at:   '',
      node_id:     -2,   // -2 才能返回 executor / last_username
    };
    if (planName) body.plan_name = planName;

    // 此端点网关会把 POST 重定向为 GET，必须直连
    const directBase = platformCfg.directBaseUrl || TP_BASE_URL;
    const qs      = `_t=${Date.now()}&sf_request_type=ajax`;
    const fullUrl = `${directBase}/api/v1/versions/${CONFIG.versionId}/cases/search/?${qs}`;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    return doRequest(fullUrl, 'POST', payload);
  }

  /**
   * 格式化按执行人分组的统计结果
   * @param {object} raw  getExecutionByUser 的原始返回值
   */
  function formatExecutionByUser(raw) {
    const cases = raw.results || [];
    const byUser = {};

    for (const c of cases) {
      const user   = c.executor || c.last_username || '(未知)';
      const status = c.case_status || 'Unknown';
      if (!byUser[user]) {
        byUser[user] = {
          total: 0, passed: 0, failed: 0, blocked: 0, na: 0, no_run: 0,
          cases: [],
          last_run_at: null,   // 最近执行时间
          first_run_at: null,  // 最早执行时间
        };
      }
      byUser[user].total++;
      if      (status === 'Passed')  byUser[user].passed++;
      else if (status === 'Failed')  byUser[user].failed++;
      else if (status === 'Blocked') byUser[user].blocked++;
      else if (status === 'N/A')     byUser[user].na++;
      else if (status === 'No Run')  byUser[user].no_run++;

      // 追踪最近/最早执行时间（仅已执行用例）
      if (c.last_run_at) {
        const t = c.last_run_at;
        if (!byUser[user].last_run_at  || t > byUser[user].last_run_at)  byUser[user].last_run_at  = t;
        if (!byUser[user].first_run_at || t < byUser[user].first_run_at) byUser[user].first_run_at = t;
      }

      if (status === 'Failed' || status === 'Blocked') {
        byUser[user].cases.push({ status, name: c.name, case_code: c.case_code, id: c.id });
      }
    }

    // 格式化时间为 "MM-DD HH:mm" 便于展示
    function fmtTime(isoStr) {
      if (!isoStr) return null;
      const d = new Date(isoStr);
      const MM = String(d.getMonth() + 1).padStart(2, '0');
      const DD = String(d.getDate()).padStart(2, '0');
      const HH = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${MM}-${DD} ${HH}:${mm}`;
    }

    const users = Object.entries(byUser)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([user, s]) => ({
        user,
        total:         s.total,
        passed:        s.passed,
        failed:        s.failed,
        blocked:       s.blocked,
        na:            s.na,
        no_run:        s.no_run,
        pass_rate:     s.total > 0 ? Math.round(s.passed / s.total * 100) + '%' : '-',
        last_run_at:   fmtTime(s.last_run_at),   // 最近执行时间
        first_run_at:  fmtTime(s.first_run_at),  // 最早执行时间
        bad_cases:     s.cases,
      }));

    const total   = cases.length;
    const passed  = users.reduce((n, u) => n + u.passed,  0);
    const failed  = users.reduce((n, u) => n + u.failed,  0);
    const blocked = users.reduce((n, u) => n + u.blocked, 0);
    return {
      total,
      passed,
      failed,
      blocked,
      pass_rate: total > 0 ? Math.round(passed / total * 100) + '%' : '-',
      users,
    };
  }

  // ── 格式化输出 ──────────────────────────────────────────────

  function formatCase(raw) {
    function clean(html) {
      if (!html) return '';
      return html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim();
    }

    return {
      id:          raw.id,
      name:        raw.name || '[无标题]',
      case_code:   raw.case_code || '',
      priority:    raw.priority || '',
      test_method: raw.test_method || '',
      case_type:   raw.case_type || '',
      case_status: raw.case_status || '',
      isautomated: raw.isautomated === 1,
      author:      raw.author_username || '',
      created_at:  raw.create_at || '',
      updated_at:  raw.update_at || '',
      tags:        (raw.tags || []).map(t => t.name || t),
      doc_pre:     clean(raw.doc_pre),
      doc_step:    clean(raw.doc_step),
      doc_post:    clean(raw.doc_post),
      doc_except:  clean(raw.doc_except),
      doc:         clean(raw.doc),
      url:         `${TP_BASE_URL}/project/${CONFIG.projectId}/version/${CONFIG.versionId}/case/${raw.id}/`,
    };
  }

  function formatCaseList(raw) {
    const results = raw.results || [];
    const total   = typeof raw.count === 'object' ? raw.count.value : (raw.count || 0);
    return {
      total,
      cases: results.map(c => ({
        id:          c.id,
        name:        c.name || '[无标题]',
        case_code:   c.case_code || '',
        priority:    c.priority || '',
        test_method: c.test_method || '',
        case_status: c.case_status || '',
        isautomated: c.isautomated === 1,
        author:      c.author_username || '',
      })),
    };
  }

  /**
   * 格式化 path_list 查询结果
   * @param {object} raw  getPathListCode 的原始返回值
   */
  function formatPathListCode(raw) {
    const results = raw.results || [];
    const total   = typeof raw.count === 'object' ? raw.count.value : (raw.count || 0);
    return {
      total,
      cases: results.map(c => ({
        id:          c.id,
        name:        c.name || '[无标题]',
        case_code:   c.case_code || '',
        priority:    c.priority || '',
        test_method: c.test_method || '',
        case_status: c.case_status || '',
        isautomated: c.isautomated === 1,
        author:      c.author_username || '',
      })),
    };
  }

  /**
   * 格式化计划执行统计结果
   * 接口返回的是汇总对象，非列表
   * @param {object} raw  getPlanStatistics 的原始返回值
   */
  function formatPlanStatistics(raw) {
    const s       = raw.case_count_by_status || {};
    const total   = raw.case_count           || 0;
    const passed  = s['Passed']              || 0;
    const failed  = s['Failed']              || 0;
    const blocked = s['Blocked']             || 0;
    const noRun   = s['No Run']              || 0;
    const na      = s['N/A']                 || 0;
    const error   = s['Error']               || 0;
    const executed = passed + failed + blocked + na + error;
    const passRate  = total > 0 ? Math.round(passed  / total * 100) + '%' : '-';
    const execRate  = total > 0 ? Math.round(executed / total * 100) + '%' : '-';

    return {
      total,
      passed,
      failed,
      blocked,
      no_run:          noRun,
      na,
      error,
      pass_rate:       passRate,
      exec_rate:       execRate,
      auto_count:      raw.auto_case_count    || 0,
      auto_percent:    raw.auto_case_percent  != null ? Math.round(raw.auto_case_percent * 100) + '%' : '-',
      first_pass_rate: raw.first_pass_percent != null ? Math.round(raw.first_pass_percent * 100) + '%' : '-',
    };
  }

  return {
    TP_BASE_URL,
    API_BASE,
    CONFIG,
    getCase,
    getCaseByCaseCode,
    searchCases,
    getPathListCode,
    updateCase,
    getCaseHistory,
    getCaseHistoryByCaseCode,
    listPlans,
    getPlanStatsByPath,
    getPlanStatistics,
    getExecutionByUser,
    formatCase,
    formatCaseList,
    formatPathListCode,
    formatPlanStatistics,
    formatExecutionByUser,
  };
}

// ── 默认实例（tp 平台，向下兼容） ─────────────────────────────
const _default = createApi('tp');

module.exports = {
  // 向下兼容：直接导出 tp 平台的所有函数
  TP_BASE_URL:              _default.TP_BASE_URL,
  API_BASE:                 _default.API_BASE,
  CONFIG:                   _default.CONFIG,
  getCase:                  _default.getCase,
  getCaseByCaseCode:        _default.getCaseByCaseCode,
  searchCases:              _default.searchCases,
  getPathListCode:          _default.getPathListCode,
  updateCase:               _default.updateCase,
  getCaseHistory:           _default.getCaseHistory,
  getCaseHistoryByCaseCode: _default.getCaseHistoryByCaseCode,
  listPlans:                _default.listPlans,
  getPlanStatsByPath:       _default.getPlanStatsByPath,
  getPlanStatistics:        _default.getPlanStatistics,
  getExecutionByUser:       _default.getExecutionByUser,
  formatCase:               _default.formatCase,
  formatCaseList:           _default.formatCaseList,
  formatPathListCode:       _default.formatPathListCode,
  formatPlanStatistics:     _default.formatPlanStatistics,
  formatExecutionByUser:    _default.formatExecutionByUser,
  // 多平台支持
  createApi,
  PLATFORM_CONFIG,
};
