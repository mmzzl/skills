'use strict';

/**
 * TP平台HTTP客户端模块
 *
 * 使用 Node.js 内置 https/http 模块，无需外部依赖
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { getConfig, getHost, getHeaders } = require('./tp_config');

// ==================== 常量定义 ====================

const DEFAULT_TIMEOUT = 30000;   // 默认超时时间（毫秒）
const DEFAULT_MAX_RETRIES = 3;   // 默认重试次数
const RETRY_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRY_BACKOFF_FACTOR = 1000; // 重试退避基础时间（毫秒）


// ==================== 内部：等待函数 ====================

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ==================== 内部：HTTP 请求函数 ====================

function _httpRequest(url, options, postData) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || DEFAULT_TIMEOUT,
      rejectUnauthorized: false  // 禁用 SSL 验证
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const response = {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data
        };

        // 尝试解析 JSON
        if (data) {
          try {
            response.data = JSON.parse(data);
          } catch (_) {
            // 保持原始字符串
          }
        }

        resolve(response);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}


// ==================== HTTP客户端类 ====================

class TPClient {
  /**
   * @param {object} options
   * @param {string} [options.env]
   * @param {number|string} [options.projectId]
   * @param {number|string} [options.versionId]
   * @param {string} [options.tpToken]
   * @param {boolean} [options.verifySsl=false]
   * @param {number} [options.timeout=30000]
   */
  constructor(options = {}) {
    this.env = options.env || null;
    this.projectId = options.projectId != null ? options.projectId : null;
    this.versionId = options.versionId != null ? options.versionId : null;
    this.tpToken = options.tpToken || null;
    this.agentVersion = options.agentVersion || null;
    this.verifySsl = options.verifySsl !== undefined ? options.verifySsl : false;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this._configCache = null;
  }

  _getConfig() {
    if (this._configCache === null) {
      this._configCache = getConfig(this.env, this.projectId, this.versionId, this.tpToken, this.agentVersion);
    }
    return this._configCache;
  }

  _getHeaders() {
    return getHeaders(this.env, this.projectId, this.versionId, this.tpToken, this.agentVersion);
  }

  _getUrl(path) {
    const host = getHost(this.env);
    return `${host}${path}`;
  }

  /**
   * 发送HTTP请求（带重试）
   * @param {string} method - HTTP方法
   * @param {string} path - 请求路径
   * @param {object} [options]
   * @param {object} [options.params] - URL查询参数
   * @param {object} [options.data] - 请求体数据（JSON）
   * @param {object} [options.headers] - 额外请求头
   * @param {number} [options.timeout] - 超时时间（毫秒）
   * @returns {Promise<object>} 响应对象
   */
  async request(method, path, options = {}) {
    let url = this._getUrl(path);

    // 添加查询参数
    if (options.params) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.params)) {
        params.append(key, String(value));
      }
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    const requestHeaders = Object.assign(this._getHeaders(), options.headers || {});
    const requestTimeout = options.timeout || this.timeout;

    let postData = null;
    if (options.data !== undefined) {
      postData = JSON.stringify(options.data);
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const reqOptions = {
      method: method.toUpperCase(),
      headers: requestHeaders,
      timeout: requestTimeout
    };

    let lastError;
    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
      try {
        const response = await _httpRequest(url, reqOptions, postData);
        return response;
      } catch (err) {
        lastError = err;
        const status = err.response ? err.response.status : null;
        const shouldRetry = (
          attempt < DEFAULT_MAX_RETRIES &&
          (status == null || RETRY_STATUS_CODES.has(status))
        );

        if (!shouldRetry) {
          break;
        }

        const backoffMs = RETRY_BACKOFF_FACTOR * Math.pow(2, attempt);
        await _sleep(backoffMs);
      }
    }

    throw lastError;
  }

  async get(path, params, options = {}) {
    return this.request('GET', path, Object.assign({ params }, options));
  }

  async post(path, data, options = {}) {
    return this.request('POST', path, Object.assign({ data }, options));
  }

  async put(path, data, options = {}) {
    return this.request('PUT', path, Object.assign({ data }, options));
  }

  async delete(path, options = {}) {
    return this.request('DELETE', path, options);
  }
}


// ==================== 便捷函数 ====================

function createClient(options = {}) {
  return new TPClient(options);
}

function cleanup() {
  // Node.js 内置模块不需要显式清理
}


module.exports = {
  TPClient,
  createClient,
  cleanup
};
