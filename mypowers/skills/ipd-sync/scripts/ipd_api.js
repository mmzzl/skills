'use strict';

/**
 * 千流 IPD 系统 API 客户端
 * 直接调用 IPD REST API，不依赖第三方库
 * Token 从 ~/.cospowers/ipd.json 读取（格式: {"ipd":{"token":"..."}}）
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const os    = require('os');
const path  = require('path');
const { URL } = require('url');

// ── 固定配置 ─────────────────────────────────────────────────
const IPD_BASE_URL    = 'http://ipd.sangfor.com';
const IPD_PORTAL_URL  = 'https://ipd.atrust.sangfor.com';   // 用户可见的平台链接
const API_BASE        = `${IPD_BASE_URL}/api`;

/** 拼接需求详情 URL（带产品 ID） */
function buildIssueUrl(issueId, productId) {
  if (productId) return `${IPD_PORTAL_URL}/ipd/product/${productId}/issue/${issueId}`;
  return `${IPD_PORTAL_URL}/ipd/issue/${issueId}`;
}

// ── 读取配置 ───────────────────────────────────────────────────
function loadConfig() {
  const userCfgPath = path.join(os.homedir(), '.cospowers', 'ipd.json');
  if (fs.existsSync(userCfgPath)) {
    let raw;
    try { raw = fs.readFileSync(userCfgPath, 'utf8'); }
    catch (e) { /* fall through */ }
    if (raw) {
      let cfg;
      try { cfg = JSON.parse(raw); }
      catch (e) { /* fall through */ }
      const token = cfg?.ipd?.token;
      if (token) return { token, productName: cfg?.ipd?.product ?? null };
    }
  }

  throw new Error(
    '未找到 IPD token。请在 ~/.cospowers/ipd.json 中配置：{"ipd":{"token":"你的token"}}（可由 AI 协助配置）\n' +
    '获取 token：打开 http://ipd.sangfor.com → 左下角个人头像 → 复制用户 token'
  );
}

const _cfg               = loadConfig();
const IPD_TOKEN          = process.env.IPD_TOKEN || _cfg.token;
const DEFAULT_PRODUCT_NAME = _cfg.productName;

// 懒加载缓存：首次调用时通过产品名称查找 ID，后续复用
let _resolvedProductId = null;
async function resolveDefaultProductId() {
  if (_resolvedProductId !== null) return _resolvedProductId;
  if (!DEFAULT_PRODUCT_NAME) {
    throw new Error('未设置默认产品，请在 ~/.qianliu/config.json 的 ipd.product 字段中配置产品名称');
  }
  const products = await getProducts(DEFAULT_PRODUCT_NAME);
  if (!products.length) {
    throw new Error(`未找到产品「${DEFAULT_PRODUCT_NAME}」，请检查 ipd.product 配置是否正确`);
  }
  _resolvedProductId = products[0].id;
  return _resolvedProductId;
}

// ── HTTP 请求封装 ────────────────────────────────────────────
function request(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${API_BASE}/${endpoint}`;
    const parsed  = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;
    const payload = body ? Buffer.from(JSON.stringify(body), 'utf8') : null;

    const options = {
      hostname: parsed.hostname,
      ...(parsed.port ? { port: Number(parsed.port) } : {}),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'token':        IPD_TOKEN,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        ...(payload ? { 'Content-Length': payload.length } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error(`API Error (${res.statusCode}): ${text}`));
        }
        try {
          resolve(text ? JSON.parse(text) : {});
        } catch {
          resolve(text);
        }
      });
    });

    req.on('error', (e) => reject(new Error(`网络错误: ${e.message}`)));
    if (payload) req.write(payload);
    req.end();
  });
}

// ── API 函数 ─────────────────────────────────────────────────

/**
 * 按名称关键词搜索 IPD 项目
 * 通过 plan_version_v2/team/rel 接口间接搜索：
 *   1. 先搜需求找到项目 ID
 *   2. 再通过 team/rel 获取项目版本和团队信息
 * @param {string} keyword 项目名称关键词
 * @returns {Promise<Array<{id:number, name:string, planStartAt:string, planEndAt:string}>>}
 */
async function searchProjects(keyword) {
  // 先通过需求搜索找到项目信息（issue 返回 ipd_project 字段）
  const { list } = await searchIssues(keyword);
  const projectMap = new Map();
  for (const issue of list) {
    const detail = await getIssue(issue.id);
    const proj = detail.data?.ipd_project;
    if (proj && !projectMap.has(proj.id)) {
      projectMap.set(proj.id, {
        id:          proj.id,
        name:        proj.name,
        planStartAt: '',
        planEndAt:   '',
      });
    }
  }
  return [...projectMap.values()];
}

/**
 * 根据项目 ID 和版本名称查询版本是否已存在
 * @param {number}  ipdProjectId  项目 ID（ipd_project_id）
 * @param {string}  versionName   版本名称，如 "IPD260430"
 * @returns {Promise<{id:number, name:string, status:string, planStartAt:string, planEndAt:string}|null>}
 *          匹配到的版本对象，不存在则返回 null
 */
async function checkVersionExists(ipdProjectId, versionName) {
  const versions = await getProjectVersions(ipdProjectId);
  return versions.find(v => v.name === versionName) || null;
}

/**
 * 获取项目下的版本列表
 * 通过 plan_version_v2/team/rel 接口获取（/api/plan_version_v2 GET 返回 405）
 * @param {number} ipdProjectId 项目 ID（ipd_project_id）
 * @returns {Promise<Array<{id:number, name:string, status:string, planStartAt:string, planEndAt:string}>>}
 */
async function getProjectVersions(ipdProjectId) {
  const res = await request(`plan_version_v2/team/rel?per=100&paginate=false&ipd_project_id=${ipdProjectId}`);
  // 版本状态中文映射
  const STATUS_ZH = {
    PLANNING:      '规划中',
    TO_BE_PLANNED: '待规划',
    EXECUTING:     '执行中',
    DONE:          '已完成',
  };
  const seen = new Set();
  const versions = [];
  for (const pv of (res.data || [])) {
    if (!seen.has(pv.id)) {
      seen.add(pv.id);
      versions.push({
        id:          pv.id,
        name:        pv.name,
        status:      STATUS_ZH[pv.version_status] || pv.version_status || '',
        planStartAt: pv.plan_start_at || '',
        planEndAt:   pv.plan_end_at   || '',
      });
    }
  }
  return versions;
}

/**
 * 获取项目下各版本关联的团队列表
 * @param {number} ipdProjectId  所属项目 ID（ipd_project_id）
 * @returns {Promise<Array<{planVersionId:number, planVersionName:string, teamId:number, teamName:string}>>}
 */
async function getTeamsByProject(ipdProjectId) {
  const res = await request(`plan_version_v2/team/rel?per=100&paginate=false&ipd_project_id=${ipdProjectId}`);
  const result = [];
  for (const pv of (res.data || [])) {
    for (const team of (pv.version || [])) {
      result.push({
        planVersionId:   pv.id,
        planVersionName: pv.name,
        teamId:          team.id,
        teamName:        team.name,
      });
    }
  }
  return result;
}

/**
 * 获取团队下的迭代列表
 * @param {number} teamVersionId 团队版本 ID（version_id，通过 getTeamsByProject 获取的 teamId）
 * @returns {Promise<Array<{id:number, name:string, state:string, planStartAt:string, planEndAt:string}>>}
 */
async function getSprints(teamVersionId) {
  const res = await request(`versions/${teamVersionId}/sprints?per=100&paginate=false`);
  const list = res.data || [];
  return list.map(s => ({
    id:          s.id,
    name:        s.name,
    state:       s.state || '',
    planStartAt: s.plan_start_at || '',
    planEndAt:   s.plan_end_at   || '',
  }));
}

/**
 * 获取产品列表
 * @param {string} [keyword] 按产品名称过滤（可选）
 * @returns {Promise<Array<{id:number,name:string}>>}
 */
async function getProducts(keyword) {
  const res = await request('products?per=500&page=1');
  const list = (res.data || []).map(p => ({ id: p.id, name: p.name }));
  if (!keyword) return list;
  return list.filter(p => p.name && p.name.includes(keyword));
}

/**
 * 按需求标题关键词搜索需求
 * @param {string} name 标题关键词
 * @param {object} [options]
 * @param {number[]} [options.productIds] 产品ID列表，不传则自动搜索全部产品
 * @param {number}   [options.per=20]     每页数量
 * @param {number}   [options.page=1]     页码
 * @returns {Promise<{total:number, list:Array}>}
 */
async function searchIssues(name, { productIds, per = 20, page = 1 } = {}) {
  let ids = productIds;
  if (!ids || ids.length === 0) {
    const products = await getProducts();
    ids = products.map(p => p.id);
  }
  const idParams = ids.map(id => `product_ids=${id}`).join('&');
  const nameParam = `name=${encodeURIComponent(name)}`;
  const res = await request(`issues?${idParams}&${nameParam}&per=${per}&page=${page}`);
  const list = (res.data || []).map(d => ({
    id:       d.id,
    name:     d.name,
    status:   d.status?.name   || '（未知）',
    priority: d.custom_fields?.priority || '（未知）',
    assignee: d.assigner?.display_name  || '（未分配）',
    url:      buildIssueUrl(d.id, d.product?.id),
  }));
  return { total: res.total || list.length, list };
}

/**
 * 按需求标题获取需求详情（取第一条匹配结果）
 * @param {string} name 标题关键词
 * @param {object} [options] 同 searchIssues options
 */
async function getIssueDetailByName(name, options = {}) {
  const { list } = await searchIssues(name, { ...options, per: 1 });
  if (!list.length) throw new Error(`未找到标题包含「${name}」的需求`);
  return getIssueDetail(list[0].id);
}

/**
 * 获取需求详情（原始数据）
 * @param {number|string} issueId
 */
function getIssue(issueId) {
  return request(`issues/${issueId}`);
}

/**
 * 获取需求详情（简化接口）
 * @param {number|string} issueId
 */
async function getIssueDetail(issueId) {
  const res = await getIssue(issueId);
  const d   = res.data || res;
  return {
    id:            d.id                          || issueId,
    name:          d.name                        || '（未设置）',
    desc:          d.desc                        || '（未设置）',
    status:        d.status?.name                || '（未知）',
    statusKey:     d.status?.key                 || '',
    priority:      d.custom_fields?.priority     || '（未知）',
    assignee:      d.assigner?.display_name      || '（未分配）',
    issueType:     d.issue_type?.key             || '',
    issueCategory: d.issue_category?.key         || '',
    createdAt:     d.create_at                   || '',
    updatedAt:     d.update_at                   || '',
    url:           buildIssueUrl(d.id || issueId, d.product?.id),
  };
}

/** 拼接需求详情 URL */
function getIssueUrl(issueId) {
  return buildIssueUrl(issueId);
}

/**
 * 获取当前登录用户信息（通过 token 过滤 /api/users）
 * @returns {Promise<{id:number, name:string, username:string}>}
 */
async function getCurrentUser() {
  const res = await request(`users?token=${encodeURIComponent(IPD_TOKEN)}`);
  const list = res.data || [];
  if (!list.length) throw new Error('无法获取当前用户信息，请检查 token 是否有效');
  const d = list[0];
  return { id: d.id, name: d.display_name || d.name || '', username: d.username || '' };
}

/**
 * 按关键词搜索用户（支持工号、姓名、邮箱）
 * 工号格式：纯数字（如 34385）或字母+数字（如 w22064）
 * 纯数字工号对应 email 前缀，如 34385 -> 34385@sangfor.com
 * 字母+数字工号按 username 精确匹配
 * 中文姓名按 display_name 精确匹配
 * @param {string|number} keyword  工号（如 34385、w22064）或姓名关键词
 * @returns {Promise<Array<{id:number, name:string, username:string}>>}
 */
async function searchUsers(keyword) {
  const kw = String(keyword).trim();
  // 纯数字工号：按 email 精确匹配
  const isNumericId = /^\d+$/.test(kw);
  // 字母+数字工号（如 w22064）：按 username 精确匹配
  const isAlphanumId = /^[a-zA-Z]+\d+$/.test(kw);
  // 中文姓名：按 display_name 精确匹配
  const isChineseName = /[\u4e00-\u9fa5]/.test(kw);
  let param;
  if (isNumericId) {
    param = `email=${encodeURIComponent(kw + '@sangfor.com')}`;
  } else if (isAlphanumId) {
    param = `username=${encodeURIComponent(kw)}`;
  } else if (isChineseName) {
    param = `display_name=${encodeURIComponent(kw)}`;
  } else {
    param = `keyword=${encodeURIComponent(kw)}`;
  }
  const res = await request(`users?${param}&per=20`);
  const list = res.data || [];
  return list.map(d => ({ id: d.id, name: d.display_name || d.username || '', username: d.username || '' }));
}

/**
 * 按工号或姓名解析出 IPD 用户内部 ID
 * @param {string|number} assignerKeyword  工号（如 34385）或姓名（如 汪家宝）
 * @returns {Promise<number>}
 */
async function resolveAssignerId(assignerKeyword) {
  const list = await searchUsers(assignerKeyword);
  if (!list.length) {
    throw new Error(`未找到用户「${assignerKeyword}」，请确认工号或姓名是否正确`);
  }
  return list[0].id;
}

// 价值分类映射
const VALUE_CLASS_MAP = {
  '基本可用':     'base',
  '满足主流体验': 'main',
  '构建竞争优势': 'competitive',
};

// 需求来源映射（ID 来自 /api/issues/demand_sources）
const DEMAND_SOURCE_MAP = {
  '客户反馈': 1,
  '技服反馈': 2,
  '市场反馈': 3,
  '产品规划': 4,
  '大客户需求': 5,
  '运营平台': 6,
  '技术需求': 7,
  '网上问题': 8,
  '竞品分析': 9,
  '展会':    10,
  '运营反馈': 11,
  '历史债务': 12,
};

/**
 * 创建 IPD 需求（支持 Epic / Feature / Story / Tech 四级层级）
 *
 * 层级与父级约束：
 *   epic    — 无父级限制
 *   feature — 父级必须是 Epic
 *   story   — 父级必须是 Feature 或 Story
 *   tech    — 父级必须是 Feature、Story 或 Tech
 *
 * @param {'epic'|'feature'|'story'|'tech'} category  需求层级
 * @param {string}  name                              需求名称
 * @param {object}  [opts]
 * @param {string}  [opts.desc]                       需求描述（支持 HTML 格式）
 * @param {number}  [opts.productId]                  产品 ID（可选，默认按 ~/.qianliu/config.json 的 ipd.product 名称自动查找）
 * @param {number}  [opts.parentId]                   父级需求 ID
 * @param {number}  [opts.assignerId]                 负责人内部 ID（与 assignerKeyword 二选一）
 * @param {string|number} [opts.assignerKeyword]      负责人工号（如 34385）或姓名（与 assignerId 二选一，默认当前登录用户）
 * @param {number[]}[opts.originatorIds]              发起人 ID 列表（默认当前登录用户）
 * @param {string}  [opts.priority='中']              优先级：高 / 中 / 低
 * @param {string}  [opts.valueClass='满足主流体验']   价值分类：基本可用 / 满足主流体验 / 构建竞争优势
 * @param {string}  [opts.demandSource='产品规划']     需求来源：客户反馈 / 技服反馈 / 市场反馈 / 产品规划 / 大客户需求 / 运营平台 / 技术需求 / 网上问题 / 竞品分析 / 展会 / 运营反馈 / 历史债务
 * @param {number}  [opts.ipdProjectId]               所属项目 ID（ipd_project_id）
 * @param {number}  [opts.planVersionId]              所属版本 ID（plan_version_v2_id）
 * @param {number}  [opts.teamVersionId]              所属团队 ID（version_id，通过 getTeamsByProject 获取）
 * @param {number}  [opts.sprintId]                   迭代 ID（sprint_id）
 * @param {number}  [opts.estimatedDay]                预计工作量（天），仅 Tech 类型有效，最小单位 0.5 天
 * @returns {Promise<{id:number, name:string, issueType:string, issueCategory:string, status:string, url:string}>}
 */
async function createIssue(category, name, {
  desc          = '',
  productId,
  parentId,
  assignerId,
  assignerKeyword,
  originatorIds,
  priority      = '中',
  valueClass    = '满足主流体验',
  demandSource  = '产品规划',
  ipdProjectId,
  planVersionId,
  teamVersionId,
  sprintId,
  estimatedDay,  // 预计工作量（天）
} = {}) {
  const resolvedProductId = productId ?? await resolveDefaultProductId();
  const TYPE_MAP = {
    epic:    { issue_type: 'story', issue_category: 'epic'    },
    feature: { issue_type: 'story', issue_category: 'feature' },
    story:   { issue_type: 'story', issue_category: 'story'   },
    tech:    { issue_type: 'story', issue_category: 'tech'    },
  };
  const typeConfig = TYPE_MAP[category];
  if (!typeConfig) {
    throw new Error(`不支持的需求类型: "${category}"，支持: epic / feature / story / tech`);
  }

  // 优先用 assignerKeyword（工号/姓名）解析出 ID
  if (!assignerId && assignerKeyword) {
    assignerId = await resolveAssignerId(assignerKeyword);
  }

  // 未传负责人或发起人时，自动获取当前登录用户
  if (!assignerId || !originatorIds) {
    const user = await getCurrentUser();
    if (!assignerId)    assignerId    = user.id;
    if (!originatorIds) originatorIds = [user.id];
  }

  const body = {
    name,
    product_id:       resolvedProductId,
    issue_type:       typeConfig.issue_type,
    issue_category:   typeConfig.issue_category,
    assigner_id:      assignerId,
    originator:       originatorIds,
    priority,
    label_ids:        [],
    status_key:       'story_demand_backlog',
    value_class:      VALUE_CLASS_MAP[valueClass]    ?? 'main',
    demand_source_id: DEMAND_SOURCE_MAP[demandSource] ?? 3,
  };
  if (desc)           body.desc               = desc;
  if (parentId)       body.parent_id          = parentId;
  if (ipdProjectId)   body.ipd_project_id     = ipdProjectId;
  if (planVersionId)  body.plan_version_v2_id = planVersionId;
  if (teamVersionId)  body.version_id         = teamVersionId;
  if (sprintId)       body.sprint_id          = sprintId;
  // 预计工作量（仅 Tech 类型有效）
  if (estimatedDay !== undefined && category === 'tech') {
    body.custom_fields = { ...body.custom_fields, estimated_day: estimatedDay };
    body.effort_estimation = estimatedDay;  // 直接使用天为单位
  }

  const res = await request('issues', 'POST', body);
  const d = res.data || res;
  if (!d || !d.id) {
    throw new Error(res.message || '创建失败');
  }

  return {
    id:            d.id,
    name:          d.name,
    issueType:     d.issue_type?.key     || '',
    issueCategory: d.issue_category?.key || '',
    status:        d.status?.name        || '',
    url:           buildIssueUrl(d.id, d.product?.id || resolvedProductId),
  };
}

/**
 * 在需求下创建任务（task）
 *
 * @param {string}  name                 任务名称
 * @param {number}  parentId             父级需求 ID
 * @param {object}  [opts]
 * @param {string}  [opts.desc]          任务描述（支持 HTML 格式）
 * @param {string}  [opts.priority='中'] 优先级：高 / 中 / 低
 * @param {number}  [opts.teamVersionId] 所属团队 ID（version_id）
 * @param {string}  [opts.planStartAt]   计划开始时间，如 "2026-04-01"
 * @param {string}  [opts.planEndAt]     计划结束时间，如 "2026-04-30"
 * @returns {Promise<{id:number, name:string, status:string, url:string}>}
 */
async function createTask(name, parentId, {
  desc        = '',
  priority    = '中',
  teamVersionId,
  planStartAt = null,
  planEndAt   = null,
} = {}) {
  const body = {
    name,
    issue_type:     'task',
    parent_id:      parentId,
    priority,
    label_ids:      [],
    need_approval:  false,
    plan_start_at:  planStartAt,
    plan_end_at:    planEndAt,
    sprint_id:      null,
    func_module_id: null,
  };
  if (desc)          body.desc       = desc;
  if (teamVersionId) body.version_id = teamVersionId;

  const res = await request('issues', 'POST', body);
  const d = res.data || res;
  if (!d || !d.id) {
    throw new Error(res.message || '创建任务失败');
  }
  return {
    id:     d.id,
    name:   d.name,
    status: d.status?.name || '',
    url:    buildIssueUrl(d.id, d.product?.id),
  };
}

/**
 * 在项目下创建计划版本（plan_version_v2）
 *
 * @param {string}  name           版本名称，如 "IPD260430"
 * @param {number}  ipdProjectId   所属项目 ID（ipd_project_id）
 * @param {object}  [opts]
 * @param {string}  [opts.planStartAt]              计划开始时间，如 "2026-04-01"
 * @param {string}  [opts.planEndAt]                计划结束时间，如 "2026-04-30"
 * @param {number[]}[opts.teamIds]                  关联团队 ID 列表（未指定时自动继承项目最新版本的团队）
 * @param {number[]}[opts.relateIpdProjectIds=[]]   关联项目 ID 列表
 * @param {string}  [opts.versionStatus='PLANNING'] 版本状态：PLANNING / EXECUTING / DONE
 * @param {string}  [opts.worth]                    版本 worth 字段（默认与 name 相同）
 * @param {object}  [opts.customFields]             定制项目集自定义字段，如：
 *   {
 *     custom_properties_project_type:               'KA定制',         // 项目类型
 *     custom_properties_software_sustainable_upgrades: '否',          // 软件可持续升级
 *     custom_properties_software_order_number:      '123123',         // 软件订单号
 *     custom_properties_basic_version_number:       '123131',         // 基础版本号
 *     custom_properties_integrated_into_main:       '否',            // 是否集成入主干
 *     custom_properties_outsourced_personnel_demand: 1,              // 外包人员需求数
 *   }
 * @returns {Promise<{id:number, name:string, status:string, url:string}>}
 */
async function createPlanVersion(name, ipdProjectId, {
  planStartAt            = null,
  planEndAt              = null,
  teamIds,
  relateIpdProjectIds    = [],
  versionStatus          = 'PLANNING',
  worth,
  customFields           = {},
} = {}) {
  // 未指定 teamIds 时，自动获取项目最新版本的团队关联
  let resolvedTeamIds = teamIds ?? [];
  if (teamIds === undefined) {
    const teams = await getTeamsByProject(ipdProjectId);
    if (teams.length > 0) {
      const latestVersion = teams.reduce((max, t) =>
        t.planVersionId > max ? t.planVersionId : max, 0);
      resolvedTeamIds = teams
        .filter(t => t.planVersionId === latestVersion)
        .map(t => t.teamId);
    }
  }

  const body = {
    name,
    ipd_project_id:          ipdProjectId,
    plan_start_at:           planStartAt,
    plan_end_at:             planEndAt,
    team_ids:                resolvedTeamIds,
    relate_ipd_project_ids:  relateIpdProjectIds,
    version_status:          versionStatus,
    worth:                   worth ?? name,
    custom_fields:           customFields,
  };

  const res = await request('plan_version_v2', 'POST', body);
  const d = res.data || res;
  if (!d || !d.id) {
    throw new Error(res.message || '创建版本失败');
  }
  return {
    id:     d.id,
    name:   d.name,
    status: d.version_status || versionStatus,
    url:    `${IPD_PORTAL_URL}/ipd/project/${ipdProjectId}`,
  };
}

/**
 * 更新 IPD 需求字段
 * @param {number|string} issueId
 * @param {object} fields  要更新的字段，如 { name, desc, priority, assigner_id }
 * @returns {Promise<{id, name, status, url}>}
 */
async function updateIssue(issueId, fields) {
  const res = await request(`issues/${issueId}`, 'PUT', fields);
  const d = res.data || res;
  if (!d || !d.id) {
    throw new Error(res.message || '更新失败');
  }
  return {
    id:     d.id,
    name:   d.name,
    status: d.status?.name || '',
    url:    buildIssueUrl(d.id, d.product?.id),
  };
}

/**
 * 删除需求（HTTP DELETE）
 * @param {number|string} issueId
 * @returns {Promise<{success:boolean, message:string}>}
 */
async function deleteIssue(issueId) {
  const res = await request(`issues/${issueId}`, 'DELETE');
  return { success: res.success !== false, message: res.message || '删除成功' };
}

/**
 * 获取需求评论列表
 * @param {number|string} issueId
 * @param {object} [opts]
 * @param {number} [opts.per=20]  每页数量
 * @returns {Promise<{total:number, list:Array<{id,content,author,createdAt,children}>}>}
 */
async function getComments(issueId, { per = 20 } = {}) {
  const res = await request(`issues/${issueId}/comments?per=${per}&paginate=false`);
  const list = (res.data || []).map(c => ({
    id:        c.id,
    content:   c.content?.replace(/<[^>]+>/g, '').trim() || '',
    author:    c.user?.display_name || '（未知）',
    createdAt: c.create_at || '',
    children:  (c.children || []).map(r => ({
      id:        r.id,
      content:   r.content?.replace(/<[^>]+>/g, '').trim() || '',
      author:    r.user?.display_name || '（未知）',
      createdAt: r.create_at || '',
    })),
  }));
  return { total: res.total || list.length, list };
}

/**
 * 添加需求评论
 * @param {number|string} issueId
 * @param {string} content  评论内容（纯文本，自动转为 HTML）
 * @param {number[]} [referUserIds]  @提及的用户 ID 列表
 * @returns {Promise<{id, content, url}>}
 */
async function addComment(issueId, content, referUserIds = []) {
  const body = {
    show_content: content,
    content:      `<p>${content}</p>`,
    refer_user_ids: referUserIds,
  };
  const res = await request(`issues/${issueId}/comments`, 'POST', body);
  if (!res.success) {
    throw new Error(res.message || '评论失败');
  }
  return {
    content: content,
    url:     buildIssueUrl(issueId),
  };
}

/**
 * 获取需求的子需求列表
 * @param {number|string} issueId  父级需求 ID
 * @param {object} [opts]
 * @param {number} [opts.per=100]  每页数量
 * @param {number} [opts.productId]  产品 ID（不传则自动从需求详情中获取）
 * @returns {Promise<Array<{id:number, name:string, status:string, priority:string, assignee:string, url:string, issueCategory:string}>>}
 */
async function getSubIssues(issueId, { per = 100, productId } = {}) {
  if (!productId) {
    const issueRes = await getIssue(issueId);
    const issueData = issueRes.data || issueRes;
    productId = issueData.product?.id;
  }
  const res = await request(`issues/${issueId}/children/v2?per=${per}&paginate=false&product_id=${productId}&issue_type=original,story,task,risk`);
  const list = (res.data || []).map(d => ({
    id:           d.id,
    name:         d.name || '（未设置）',
    status:       d.status?.name || '（未知）',
    priority:     d.custom_fields?.priority || '（未知）',
    assignee:     d.assigner?.display_name || '（未分配）',
    issueCategory: d.issue_category?.key  || '',
    url:          buildIssueUrl(d.id, d.product?.id),
  }));
  return list;
}

/**
 * 按项目/版本/团队/迭代范围查询需求列表
 *
 * 筛选维度（从左到右递进，全部可选）：
 *   - projectId        项目 ID（ipd_project_id）
 *   - planVersionId    版本 ID（plan_version_v2_id）
 *   - teamVersionId    团队版本 ID（version_id，即 getTeamsByProject 返回的 teamId）
 *   - sprintId         迭代 ID（sprint_id）
 *
 * 调用方式：
 *   getIssuesByScope({ projectId })                    → 按项目查
 *   getIssuesByScope({ projectId, planVersionId })     → 按项目+版本查
 *   getIssuesByScope({ projectId, planVersionId, teamVersionId })  → 按项目+版本+团队查
 *   getIssuesByScope({ teamVersionId, sprintId })       → 按团队+迭代查
 *
 * @param {object}  [opts]
 * @param {number}  [opts.projectId]     项目 ID（ipd_project_id）
 * @param {number}  [opts.planVersionId] 版本 ID（plan_version_v2_id）
 * @param {number}  [opts.teamVersionId] 团队版本 ID（version_id，通过 getTeamsByProject 获取的 teamId）
 * @param {number}  [opts.sprintId]      迭代 ID（sprint_id，通过 getSprints 获取）
 * @param {number}  [opts.per=50]        每页数量
 * @param {number}  [opts.page=1]       页码
 * @param {string}  [opts.issueCategory] 过滤类型：epic / feature / story / tech（可选）
 * @returns {Promise<{total:number, list:Array<{id:number, name:string, status:string, priority:string, assignee:string, url:string, issueCategory:string}>}>}
 */
async function getIssuesByScope({ projectId, planVersionId, teamVersionId, sprintId, per = 50, page = 1, issueCategory } = {}) {
  const params = new URLSearchParams();
  if (projectId)     params.set('ipd_project_id',      projectId);
  if (planVersionId) params.set('plan_version_v2_id',  planVersionId);
  if (teamVersionId) params.set('version_id',          teamVersionId);
  if (sprintId)      params.set('sprint_id',           sprintId);
  params.set('per',  per);
  params.set('page', page);

  const res  = await request(`issues/list?${params.toString()}`);
  let list   = (res.data || []).map(d => ({
    id:           d.id,
    name:         d.name         || '（未设置）',
    status:       d.status?.name || '（未知）',
    priority:     d.custom_fields?.priority || '（未知）',
    assignee:     d.assigner?.display_name || '（未分配）',
    issueCategory: d.issue_category?.key  || '',
    url:          buildIssueUrl(d.id, d.product?.id),
  }));

  // issues/list 接口返回的 status/priority/assigner 为空时，批量拉取详情补全
  const needsDetail = list.some(i => i.status === '（未知）' && i.priority === '（未知）');
  if (needsDetail) {
    const ids = list.map(i => i.id);
    const detailMap = {};
    // 每次最多并发 20 个 ID 查询，避免请求过大
    const batchSize = 20;
    for (let start = 0; start < ids.length; start += batchSize) {
      const batch = ids.slice(start, start + batchSize);
      await Promise.all(batch.map(async id => {
        try {
          const r = await getIssue(id);
          const d = r.data || r;
          detailMap[id] = {
            priority: d.custom_fields?.priority || '（未知）',
            assignee: d.assigner?.display_name || '（未分配）',
            status:   d.status?.name || '（未知）',
          };
        } catch {}
      }));
    }
    list = list.map(i => ({
      ...i,
      priority: detailMap[i.id]?.priority ?? i.priority,
      assignee: detailMap[i.id]?.assignee ?? i.assignee,
      status:   detailMap[i.id]?.status   ?? i.status,
    }));
  }

  if (issueCategory) {
    list = list.filter(i => i.issueCategory === issueCategory);
  }

  return { total: res.total || list.length, list };
}

// ── 项目活动计划（IPD 流程管理）────────────────────────────────

/**
 * 获取项目下某个版本的阶段信息
 * @param {number} ipdProjectId    项目 ID（ipd_project_id），必填
 * @param {number} planVersionId  版本 ID（plan_version_v2_id），必填
 * @returns {Promise<Array<{id:number, name:string, status:string, progress:number}>>}
 */
async function getProjectStages(ipdProjectId, planVersionId) {
  const res = await request(
    `ipd/project_stage_progress/project/${ipdProjectId}?plan_version_v2_id=${planVersionId}`
  );
  const list = res.data || [];
  return list.map(s => ({
    id:       s.id,
    name:     s.name     || s.stage_name || '',
    status:   s.status   || s.stage_status || '',
    progress: s.progress ?? 0,
  }));
}

/**
 * 获取阶段下的流程活动列表
 * @param {number} stageId         阶段 ID，必填
 * @param {number} planVersionId   版本 ID（plan_version_v2_id），必填
 * @returns {Promise<Array<{id:number, name:string, status:string}>>}
 */
async function getStageActivities(stageId, planVersionId) {
  const res = await request(
    `ipd/project_activity_plan/stage/${stageId}?plan_version_v2_id=${planVersionId}`
  );
  const list = res.data || [];
  return list.map(a => ({
    id:     a.id,
    name:   a.name   || '',
    status: a.status || a.state || '',
  }));
}

/**
 * 获取阶段下的评审活动列表
 * @param {number} stageId         阶段 ID，必填
 * @param {number} planVersionId   版本 ID（plan_version_v2_id），必填
 * @returns {Promise<Array<{id:number, name:string, status:string}>>}
 */
async function getStageReviewActivities(stageId, planVersionId) {
  const res = await request(
    `ipd/project_activity_plan/review/stage/${stageId}?plan_version_v2_id=${planVersionId}`
  );
  const list = res.data || [];
  return list.map(a => ({
    id:     a.id,
    name:   a.name   || '',
    status: a.status || a.state || '',
  }));
}

/**
 * 获取活动详情
 * @param {number} activityId 活动ID，必填
 * @returns {Promise<object>} 活动详情原始数据
 */
async function getActivityDetail(activityId) {
  const res = await request(`ipd/project_activity_plan/${activityId}`);
  return res.data || res;
}

/**
 * 获取活动的质量标准
 * @param {number} activityId     活动ID，必填
 * @param {number} planVersionId  版本 ID（plan_version_v2_id），必填
 * @returns {Promise<Array>} 质量标准列表
 */
async function getActivityQualityStandards(activityId, planVersionId) {
  const res = await request(
    `ipd/project_quality_standard/list/${activityId}?plan_version_v2_id=${planVersionId}`
  );
  return res.data || [];
}

/**
 * 获取活动的交付物信息
 * @param {number} activityId 活动ID，必填
 * @returns {Promise<Array<{id:number, name:string, type:string, state:string, fileLink:string}>>}
 */
async function getActivityDeliverables(activityId) {
  const res = await request(`ipd/project_activity_plan/${activityId}/deliverables`);
  const list = res.data || [];
  return list.map(d => ({
    id:       d.id,
    name:     d.name    || '',
    type:     d.type    || '',
    state:    d.state   || '',
    fileLink: d.file_link || '',
    filePath: d.deliverable_details || '',
  }));
}

/**
 * 获取活动前置依赖列表
 * @param {number} activityId 活动ID，必填
 * @returns {Promise<Array<{id:number, name:string, status:string}>>}
 */
async function getActivityDependencies(activityId) {
  const res = await request(`ipd/project_activity_plan/${activityId}/dependencies`);
  const list = res.data || [];
  return list.map(d => ({
    id:     d.id,
    name:   d.name   || '',
    status: d.status || d.state || '',
  }));
}

/**
 * 获取活动评审记录（当活动属于评审活动时才有评审记录）
 * @param {number} activityId 活动ID，必填
 * @returns {Promise<object>} 评审记录数据
 */
async function getActivityReviewRecords(activityId) {
  const res = await request(`ipd/project_itsm_review/activity_plan/${activityId}`);
  return res.data || res;
}

/**
 * 更新质量标准、质量要求信息
 * @param {number} qualityRequirementId  质量要求ID，必填
 * @param {object} [opts]
 * @param {string} [opts.result='通过']   质量要求结果，默认"通过"，必填
 * @param {string} [opts.description='1'] 描述信息，默认"1"，必填
 * @returns {Promise<object>} 更新后的质量要求数据
 */
async function updateQualityRequirement(qualityRequirementId, { result = '通过', description = '1' } = {}) {
  const body = { result, description };
  const res = await request(`ipd/project_quality_requirement/activity/${qualityRequirementId}`, 'PUT', body);
  return res.data || res;
}

// ── 交付物文件上传 ────────────────────────────────────────────

/**
 * 上传附件文件（multipart/form-data）
 * 用于交付物上传的第一步：先上传文件获取 file_path
 * @param {Buffer|Stream} fileBuffer  文件二进制内容
 * @param {string}        filename   文件名，必填
 * @returns {Promise<{filePath:string}>} 返回 file_path 用于后续更新交付物
 */
function uploadAttachment(fileBuffer, filename) {
  return new Promise((resolve, reject) => {
    const fullUrl  = `${API_BASE}/attachments`;
    const parsed   = new URL(fullUrl);
    const isHttps  = parsed.protocol === 'https:';
    const lib      = isHttps ? https : http;

    // 构造 multipart/form-data boundary
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const header   = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer   = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${filename}\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const payload   = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const options = {
      hostname: parsed.hostname,
      ...(parsed.port ? { port: Number(parsed.port) } : {}),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'token':          IPD_TOKEN,
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Accept':         'application/json',
        'Content-Length':  payload.length,
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error(`上传文件失败 (${res.statusCode}): ${text}`));
        }
        try {
          const json = JSON.parse(text);
          const filePath = json?.jsonData?.data?.file_path || json?.data?.file_path || json?.file_path || '';
          if (!filePath) {
            return reject(new Error(`上传文件成功但未获取到 file_path，响应: ${text}`));
          }
          resolve({ filePath });
        } catch {
          reject(new Error(`上传文件响应解析失败: ${text}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`上传文件网络错误: ${e.message}`)));
    req.write(payload);
    req.end();
  });
}

/**
 * 更新交付物（上传交付物文件的第二步）
 * @param {number} deliverableId  交付物 ID，必填
 * @param {object} opts
 * @param {string} opts.filePath       上传文件后获取的 file_path，必填
 * @param {number} opts.activityId     活动ID，必填
 * @param {string} [opts.type='file']  交付物类型，默认 file
 * @param {string} [opts.state='submitted'] 交付物状态，默认 submitted
 * @returns {Promise<object>} 更新后的交付物数据
 */
async function updateDeliverable(deliverableId, { filePath, activityId, type = 'file', state = 'submitted' }) {
  const body = {
    type,
    deliverable_details: filePath,
    state,
    activity_id: activityId,
  };
  const res = await request(`ipd/project_activity_plan_deliverable/${deliverableId}`, 'PUT', body);
  return res.data || res;
}

/**
 * 上传交付物文件（一步完成：上传文件 + 更新交付物）
 * @param {number} deliverableId  交付物 ID，必填
 * @param {number} activityId     活动ID，必填
 * @param {Buffer} fileBuffer     文件二进制内容，必填
 * @param {string} filename       文件名，必填
 * @returns {Promise<{filePath:string, deliverable:object}>}
 */
async function uploadDeliverableFile(deliverableId, activityId, fileBuffer, filename) {
  // 第一步：上传文件获取 file_path
  const { filePath } = await uploadAttachment(fileBuffer, filename);
  // 第二步：更新交付物
  const deliverable = await updateDeliverable(deliverableId, {
    filePath,
    activityId,
  });
  return { filePath, deliverable };
}

/**
 * 下载交付物文件到本地
 * @param {number} deliverableId  交付物 ID
 * @param {number} activityId     活动 ID
 * @param {string} destPath       目标文件路径（含文件名）
 * @returns {Promise<{destPath:string, fileName:string, fileSize:number}>}
 */
function downloadDeliverableFile(deliverableId, activityId, destPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 先查交付物列表，找到目标交付物的 fileLink
      const deliverables = await getActivityDeliverables(activityId);
      const deliverable = deliverables.find(d => d.id === deliverableId);
      if (!deliverable) {
        return reject(new Error(`未在活动 ${activityId} 中找到交付物 ${deliverableId}`));
      }
      if (!deliverable.filePath && !deliverable.fileLink) {
        return reject(new Error(`交付物 ${deliverableId}（${deliverable.name}）没有可下载的文件`));
      }

      // 优先使用上传后的文件路径，其次模板链接
      const filePath = deliverable.filePath || deliverable.fileLink;
      const fileName = deliverable.name || path.basename(destPath);
      const fileUrl = `${IPD_BASE_URL}${filePath}`;
      const parsed = new URL(fileUrl);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        ...(parsed.port ? { port: Number(parsed.port) } : {}),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'token': IPD_TOKEN },
      };

      const req = lib.request(options, (httpRes) => {
        if (httpRes.statusCode >= 400) {
          return reject(new Error(`下载交付物文件失败 (${httpRes.statusCode})`));
        }
        const chunks = [];
        httpRes.on('data', (c) => chunks.push(c));
        httpRes.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(destPath, buf);
            resolve({ destPath, fileName, fileSize: buf.length });
          } catch (e) {
            reject(new Error(`保存交付物文件失败: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`下载交付物网络错误: ${e.message}`)));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ── 需求附件上传 / 下载 ────────────────────────────────────────

/**
 * 获取需求下的附件列表（含文件名、类型、下载地址等详细信息）
 * @param {number|string} issueId
 * @returns {Promise<Array<{id:number, fileName:string, filePath:string, fileType:string, fileUrl:string, createdAt:string}>>}
 */
async function getIssueAttachments(issueId) {
  const issue = await getIssue(issueId);
  const d = issue.data || issue;
  const attachments = d.attachments || [];
  if (!attachments.length) return [];

  // 批量获取附件详情
  const details = await Promise.all(attachments.map(async (a) => {
    try {
      const res = await request(`attachments/${a.id}`);
      const ad = (res.data || res);
      return {
        id:        ad.id,
        fileName:  ad.file_name  || '',
        filePath:  ad.file_path  || '',
        fileType:  ad.file_type  || '',
        fileUrl:   ad.file_path ? `${IPD_BASE_URL}${ad.file_path}` : '',
        createdAt: ad.create_at  || '',
      };
    } catch {
      return { id: a.id, fileName: '', filePath: '', fileType: '', fileUrl: '', createdAt: '' };
    }
  }));

  return details;
}

/**
 * 上传附件到需求（自动关联到需求附件列表）
 * @param {number|string} issueId   需求 ID
 * @param {Buffer}        fileBuffer  文件二进制内容
 * @param {string}        filename    文件名
 * @returns {Promise<{attachmentId:number, issueId:number|string, filename:string, url:string}>}
 */
async function uploadIssueAttachment(issueId, fileBuffer, filename) {
  // Step 1: 上传文件获取 attachment_id
  const { attachmentId } = await new Promise((resolve, reject) => {
    const fullUrl = `${API_BASE}/attachments`;
    const parsed   = new URL(fullUrl);
    const isHttps  = parsed.protocol === 'https:';
    const lib      = isHttps ? https : http;

    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
    const header   = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
    const footer   = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="filename"\r\n\r\n${filename}\r\n--${boundary}--\r\n`;

    const headerBuf = Buffer.from(header, 'utf8');
    const footerBuf = Buffer.from(footer, 'utf8');
    const payload   = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const options = {
      hostname: parsed.hostname,
      ...(parsed.port ? { port: Number(parsed.port) } : {}),
      path:     parsed.pathname + parsed.search,
      method:   'POST',
      headers: {
        'token':          IPD_TOKEN,
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Accept':         'application/json',
        'Content-Length':  payload.length,
      },
    };

    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error(`上传附件失败 (${res.statusCode}): ${text}`));
        }
        try {
          const json = JSON.parse(text);
          const id = json?.jsonData?.data?.id || json?.data?.id || json?.id || null;
          if (!id) {
            return reject(new Error(`上传附件成功但未获取到 attachment_id，响应: ${text}`));
          }
          resolve({ attachmentId: id });
        } catch {
          reject(new Error(`上传附件响应解析失败: ${text}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`上传附件网络错误: ${e.message}`)));
    req.write(payload);
    req.end();
  });

  // Step 2: 获取需求现有附件 ID 列表
  const issue = await getIssue(issueId);
  const d = issue.data || issue;
  const existingIds = (d.attachments || []).map(a => a.id);

  // Step 3: 合并新附件 ID 并更新需求
  const newIds = [...existingIds, attachmentId];
  await request(`issues/${issueId}`, 'PUT', { attachment_ids: newIds });

  return {
    attachmentId,
    issueId,
    filename,
    url: buildIssueUrl(issueId, d.product?.id),
  };
}

/**
 * 下载附件到本地文件
 * @param {number|string} attachmentId  附件 ID
 * @param {string}        destPath      目标文件路径（含文件名）
 * @returns {Promise<{destPath:string, fileName:string, fileSize:number}>}
 */
function downloadAttachment(attachmentId, destPath) {
  return new Promise(async (resolve, reject) => {
    try {
      // 先获取附件详情，拿到文件名和文件路径
      const res = await request(`attachments/${attachmentId}`);
      const ad = res.data || res;
      const filePath = ad.file_path;
      const fileName = ad.file_name || path.basename(destPath);

      if (!filePath) {
        return reject(new Error(`未找到附件 ${attachmentId} 的文件路径`));
      }

      const fileUrl = `${IPD_BASE_URL}${filePath}`;
      const parsed = new URL(fileUrl);
      const isHttps = parsed.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: parsed.hostname,
        ...(parsed.port ? { port: Number(parsed.port) } : {}),
        path: parsed.pathname,
        method: 'GET',
        headers: {
          'token': IPD_TOKEN,
        },
      };

      const req = lib.request(options, (httpRes) => {
        if (httpRes.statusCode >= 400) {
          return reject(new Error(`下载附件失败 (${httpRes.statusCode})`));
        }
        const chunks = [];
        httpRes.on('data', (c) => chunks.push(c));
        httpRes.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            // 确保目标目录存在
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(destPath, buf);
            resolve({ destPath, fileName, fileSize: buf.length });
          } catch (e) {
            reject(new Error(`保存附件文件失败: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => reject(new Error(`下载附件网络错误: ${e.message}`)));
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  IPD_BASE_URL,
  getProducts,
  searchProjects,
  getProjectVersions,
  checkVersionExists,
  getTeamsByProject,
  getSprints,
  getCurrentUser,
  searchUsers,
  resolveAssignerId,
  searchIssues,
  getIssueDetailByName,
  getIssue,
  getIssueDetail,
  getIssueUrl,
  createIssue,
  createTask,
  createPlanVersion,
  updateIssue,
  deleteIssue,
  getComments,
  addComment,
  getSubIssues,
  getIssuesByScope,
  // ── 项目活动计划
  getProjectStages,
  getStageActivities,
  getStageReviewActivities,
  getActivityDetail,
  getActivityQualityStandards,
  getActivityDeliverables,
  getActivityDependencies,
  getActivityReviewRecords,
  // ── 质量要求
  updateQualityRequirement,
  // ── 交付物文件上传 / 下载
  uploadAttachment,
  updateDeliverable,
  uploadDeliverableFile,
  downloadDeliverableFile,
  // ── 需求附件上传 / 下载
  getIssueAttachments,
  uploadIssueAttachment,
  downloadAttachment,
};
