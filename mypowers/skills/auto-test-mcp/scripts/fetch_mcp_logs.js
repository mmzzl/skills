#!/usr/bin/env node
'use strict';

/**
 * 查询 MCP Server 日志，辅助分析用例失败原因
 *
 * 通过 ferret 技能连接远程服务器执行日志查询命令。
 * 无需自带二进制，零配置即可使用。
 *
 * 用法:
 *   node fetch_mcp_logs.js --keyword "reset_template" --lines 200
 *   node fetch_mcp_logs.js --recent --lines 100
 *   node fetch_mcp_logs.js --keyword "error" --exclude "timeout,retry"
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 复用 qianliu-aitest 的 yaml 解析
const QIANLIU_SKILL_DIR = path.resolve(__dirname, '../../qianliu-aitest');
const yaml = require(path.join(QIANLIU_SKILL_DIR, 'scripts/vendor/js-yaml'));

// ferret 技能脚本路径
const FERRET_SCRIPT = path.resolve(__dirname, '../../ferret/scripts/ferret.js');

// ============================================================================
// 默认 MCP Server 配置
// ============================================================================

const DEFAULT_MCP_CONFIG = {
  host: '10.72.6.212',
  port: 22,
  user: 'root',
  password: 'dsp@321',
  container: 'dsp-mcp-server',
  log_path: '/data/dsp_mcp_server/logs/app.log',
  code_path: '/data/dsp_mcp_server',
};

// ============================================================================
// 配置加载
// ============================================================================

function loadMcpConfig(configPath) {
  const candidates = configPath
    ? [configPath]
    : [
        path.join(process.cwd(), '.qianliu', 'mcp-config.yaml'),
        path.join(process.cwd(), '.qianliu', '.qianliu-aitest', 'mcp-config.yaml'),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.error(`加载 MCP 配置: ${p}`);
      const raw = yaml.load(fs.readFileSync(p, 'utf8'));
      const userConfig = raw.mcp_server || raw || {};
      return Object.assign({}, DEFAULT_MCP_CONFIG, userConfig);
    }
  }

  console.error('使用默认 MCP Server 配置');
  return Object.assign({}, DEFAULT_MCP_CONFIG);
}

// ============================================================================
// 配置 ferret 服务器（确保 ferret 的 config.json 与 MCP 配置同步）
// ============================================================================

let _ferretConfigured = false;

function ensureFerretServer(mcpConfig) {
  if (_ferretConfigured) return;
  _ferretConfigured = true;

  try {
    execFileSync('node', [
      FERRET_SCRIPT, 'add-server',
      '--name', 'mcp-server',
      '--host', mcpConfig.host,
      '--port', String(mcpConfig.port || 22),
      '--user', mcpConfig.user,
      '--password', mcpConfig.password,
      '--remote-root', mcpConfig.code_path || '/data/dsp_mcp_server',
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  } catch (e) {
    console.error(`配置 ferret 服务器失败: ${e.message}`);
  }
}

// ============================================================================
// 远程命令执行（通过 ferret 技能）
// ============================================================================

function remoteExec(mcpConfig, cmd, timeoutMs = 30000) {
  ensureFerretServer(mcpConfig);
  try {
    const result = execFileSync('node', [
      FERRET_SCRIPT, 'execute', cmd, '--server', 'mcp-server',
    ], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
    return result.trim();
  } catch (e) {
    if (e.stdout) return e.stdout.trim();
    throw new Error(`远程命令执行失败: ${e.message}`);
  }
}

/**
 * 需要 shell 解释管道的命令（grep | tail），用 sh -c
 * 日志查询在宿主机上执行，不走 docker exec
 */
function remoteExecShell(mcpConfig, cmd, timeoutMs = 30000) {
  const escaped = cmd.replace(/"/g, '\\"');
  const hostCmd = `sh -c "${escaped}"`;
  return remoteExec(mcpConfig, hostCmd, timeoutMs);
}

// ============================================================================
// 噪音过滤（本地 Node.js 端执行）
// ============================================================================

const DEFAULT_NOISE_PATTERNS = [
  'runtime_monitor',
  'health_check',
  'heartbeat',
  'keep.alive',
  /ping.*pong/,
];

function buildNoiseRegex(extraPatterns) {
  const patterns = [
    ...DEFAULT_NOISE_PATTERNS.map(p => p instanceof RegExp ? p.source : p),
    ...(extraPatterns || []),
  ];
  return new RegExp(patterns.join('|'), 'i');
}

function filterNoise(text, extraPatterns) {
  if (!text) return '';
  const regex = buildNoiseRegex(extraPatterns);
  return text
    .split('\n')
    .filter(line => line.trim() && !regex.test(line))
    .join('\n');
}

// ============================================================================
// 日志查询
// ============================================================================

function fetchLogs(config, keyword, options = {}) {
  const logPath = config.log_path;
  const lines = options.lines || 500;

  const cmd = `grep -a "${keyword}" ${logPath} | tail -n ${lines}`;
  const raw = remoteExecShell(config, cmd, 30000);
  const filtered = filterNoise(raw, options.extraNoise);

  const resultLines = filtered.split('\n').filter(l => l.trim());
  return resultLines.slice(-lines).join('\n');
}

function fetchRecentLogs(config, lines = 100, extraNoise) {
  const cmd = `tail -n ${lines * 5} ${config.log_path}`;
  const raw = remoteExec(config, cmd, 15000);
  const filtered = filterNoise(raw, extraNoise);

  const resultLines = filtered.split('\n').filter(l => l.trim());
  return resultLines.slice(-lines).join('\n');
}

// ============================================================================
// 参数解析
// ============================================================================

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

function main() {
  const args = process.argv.slice(2);

  const keyword = parseArg(args, '--keyword');
  const lines = parseInt(parseArg(args, '--lines') || '200', 10);
  const configPath = parseArg(args, '--config');
  const recent = args.includes('--recent');

  if (!keyword && !recent) {
    console.error([
      '用法: node fetch_mcp_logs.js [options]',
      '',
      '选项:',
      '  --keyword <text>    搜索关键词（如工具名、错误信息）',
      '  --lines <N>         返回最近 N 条匹配行（默认 200）',
      '  --recent            获取最近的日志（不过滤关键词）',
      '  --exclude <words>   追加过滤关键词，逗号分隔（默认已过滤 runtime_monitor 等）',
      '  --config <path>     指定 MCP 配置文件路径',
    ].join('\n'));
    process.exit(1);
  }

  const config = loadMcpConfig(configPath);

  const excludeRaw = parseArg(args, '--exclude');
  const extraNoise = excludeRaw
    ? excludeRaw.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  let result;
  if (recent) {
    console.error(`获取 MCP Server 最近 ${lines} 行日志（已过滤噪音）...`);
    result = fetchRecentLogs(config, lines, extraNoise);
  } else {
    console.error(`在 MCP Server 日志中搜索 "${keyword}"（最近 ${lines} 条，已过滤噪音）...`);
    result = fetchLogs(config, keyword, { lines, extraNoise });
  }

  if (result && result.trim()) {
    console.log(result);
  } else {
    console.error('未找到匹配的日志。');
  }
}

main();
