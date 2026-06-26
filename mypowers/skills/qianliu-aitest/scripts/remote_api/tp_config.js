'use strict';

/**
 * TP平台配置管理模块
 *
 * 统一管理TP平台的环境配置、项目配置和认证信息。
 * 支持环境变量和配置文件两种方式。
 */

// ==================== 全局状态 ====================

let _currentEnv = 'prod';
let _defaultConfig = null;


// ==================== 内部：构建配置对象 ====================

function _createConfig(env, projectId, versionId, tpToken, agentVersion) {
  let host = '';
  if (env === 'test') {
    host = process.env.TP_TEST_HOST || 'http://10.61.67.105:31031';
  } else {
    host = process.env.TP_PROD_HOST || 'https://tp.sangfor.com';
  }

  return {
    env: env || 'test',
    host,
    projectId: projectId != null ? String(projectId) : '',
    versionId: versionId != null ? String(versionId) : '',
    tpToken: tpToken || '',
    agentVersion: agentVersion || '',
    origin: 'https://tp.sangfor.com',
    extraHeaders: {}
  };
}

function _configToDict(config) {
  const headers = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json;charset=UTF-8',
    'Origin': config.origin,
    'PROJECT-ID': config.projectId,
    'VERSION-ID': config.versionId,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  };

  if (config.tpToken) {
    headers['TOKEN'] = config.tpToken;
  }

  if (config.agentVersion) {
    headers['Res-Stack-Node-Version'] = config.agentVersion;
  }

  Object.assign(headers, config.extraHeaders);

  return {
    host: config.host,
    PROJECT_ID: config.projectId,
    VERSION_ID: config.versionId,
    ORIGIN: config.origin,
    headers,
    TOKEN: config.tpToken
  };
}

function _getConfigObject(env, projectId, versionId, tpToken, agentVersion) {
  const resolvedEnv = env != null ? env : _currentEnv;

  if (_defaultConfig !== null && _defaultConfig.env === resolvedEnv) {
    if (projectId == null && versionId == null && tpToken == null && agentVersion == null) {
      return _defaultConfig;
    }
  }

  const config = _createConfig(resolvedEnv, projectId, versionId, tpToken, agentVersion);

  if (projectId == null && versionId == null && tpToken == null && agentVersion == null) {
    _defaultConfig = config;
  }

  return config;
}


// ==================== 环境管理函数 ====================

function setEnv(env) {
  if (env !== 'test' && env !== 'prod') {
    throw new Error(`不支持的环境类型: ${env}，仅支持 'test' 或 'prod'`);
  }
  _currentEnv = env;
  _defaultConfig = null;
}

function getEnv() {
  return _currentEnv;
}


// ==================== 配置获取函数 ====================

function getConfig(env, projectId, versionId, tpToken, agentVersion) {
  const config = _getConfigObject(env, projectId, versionId, tpToken, agentVersion);
  return _configToDict(config);
}

function getHost(env) {
  const resolvedEnv = env != null ? env : _currentEnv;
  const config = _getConfigObject(resolvedEnv);
  return config.host;
}

function getHeaders(env, projectId, versionId, tpToken, agentVersion) {
  const configDict = getConfig(env, projectId, versionId, tpToken, agentVersion);
  return Object.assign({}, configDict.headers);
}

function getBaseUrl(env) {
  return getHost(env);
}


// ==================== 环境变量支持 ====================

function loadFromEnv() {
  let env = process.env.TP_ENV || 'prod';
  if (env !== 'test' && env !== 'prod') {
    env = 'test';
  }

  return _createConfig(
    env,
    process.env.TP_PROJECT_ID || null,
    process.env.TP_VERSION_ID || null,
    process.env.TP_TOKEN || ''
  );
}


// ==================== 初始化 ====================

function initConfig(env, projectId, versionId, tpToken, agentVersion) {
  setEnv(env || 'prod');
  _defaultConfig = _getConfigObject(env || 'test', projectId, versionId, tpToken, agentVersion);
}


module.exports = {
  setEnv,
  getEnv,
  getConfig,
  getHost,
  getHeaders,
  getBaseUrl,
  loadFromEnv,
  initConfig
};
