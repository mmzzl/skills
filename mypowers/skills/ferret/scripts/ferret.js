#!/usr/bin/env node
'use strict';

/**
 * Ferret — 远程服务器操控脚本
 *
 * 通过内嵌的 ferret-server 二进制（JSON-RPC over stdio）
 * 直接执行远程操作，无需配置 MCP Server。
 * 自动根据平台选择 Linux (ferret-server) 或 Windows (.exe) 二进制。
 *
 * 用法:
 *   node ferret.js execute "ls -la"
 *   node ferret.js execute "kubectl get pods" --server testbed
 *   node ferret.js sync --local ./src --remote /path/to/dest
 *   node ferret.js build --command "go build" --local ./src
 *   node ferret.js test [--server name]
 *   node ferret.js list
 *   node ferret.js add-server --name testbed --host 10.0.0.1 --user root --password pass123 --remote-root /root
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// ============================================================================
// 路径常量
// ============================================================================

const BIN_DIR = path.resolve(__dirname, '../bin');
const BIN_NAME = process.platform === 'win32' ? 'ferret-server.exe' : 'ferret-server';
const BIN_PATH = path.join(BIN_DIR, BIN_NAME);
const BIN_CONFIG_PATH = path.join(BIN_DIR, 'config.json');

// ============================================================================
// 配置管理
// ============================================================================

function loadConfig() {
  if (!fs.existsSync(BIN_CONFIG_PATH)) {
    return { defaultServer: '', servers: {} };
  }
  return JSON.parse(fs.readFileSync(BIN_CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  fs.writeFileSync(BIN_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

/**
 * 动态添加一个 server 到 config.json（不覆盖已有）
 */
function addServer(name, host, port, username, password, localRootDir, remoteRootDir) {
  const config = loadConfig();
  config.servers[name] = {
    host,
    port: port || 22,
    username: username || 'root',
    auth: { password: password || '' },
    localRootDir: localRootDir || '.',
    remoteRootDir: remoteRootDir || '/root',
  };
  if (!config.defaultServer) {
    config.defaultServer = name;
  }
  saveConfig(config);
  return config;
}

// ============================================================================
// MCP JSON-RPC 客户端
// ============================================================================

class McpClient {
  constructor() {
    this._id = 0;
    this._pending = new Map();
    this._buffer = '';
    this._proc = null;
  }

  async start() {
    if (!fs.existsSync(BIN_PATH)) {
      throw new Error(`ferret-server 二进制不存在: ${BIN_PATH}`);
    }

    this._proc = spawn(BIN_PATH, [], {
      cwd: BIN_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      // 阻止 MSYS/Git Bash 将 / 开头的 Linux 路径转换为 C:/Program Files/Git/... 的 Windows 路径
      env: { ...process.env, MSYS_NO_PATHCONV: '1' },
    });

    this._proc.stdout.on('data', (chunk) => this._onData(chunk));
    this._proc.stderr.on('data', () => {}); // 忽略 stderr

    this._proc.on('error', (err) => {
      for (const [, { reject }] of this._pending) {
        reject(err);
      }
      this._pending.clear();
    });

    // initialize 握手
    await this._request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ferret', version: '1.0.0' },
    });

    // 发送 initialized 通知
    this._notify('notifications/initialized', {});
  }

  /**
   * 调用 MCP 工具
   * @param {string} toolName - 工具名称 (execute_command, sync_to_remote, build_and_execute, test_connection, list_servers)
   * @param {object} args - 工具参数
   * @returns {string} 提取后的文本结果
   */
  async callTool(toolName, args) {
    const result = await this._request('tools/call', {
      name: toolName,
      arguments: args || {},
    });

    // 提取文本内容
    let raw = '';
    if (result && result.content) {
      for (const item of result.content) {
        if (item.type === 'text') { raw = item.text; break; }
      }
    }

    // remote-build 返回格式: 装饰文本 + "===...===" + 实际输出 + "===...==="
    const sepPattern = /={10,}/g;
    const matches = [...raw.matchAll(sepPattern)];
    if (matches.length >= 2) {
      const start = matches[0].index + matches[0][0].length;
      const end = matches[matches.length - 1].index;
      return raw.substring(start, end).trim();
    }

    return raw.trim();
  }

  close() {
    if (this._proc) {
      this._proc.stdin.end();
      this._proc.kill();
      this._proc = null;
    }
  }

  _request(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this._id;
      const timer = setTimeout(() => {
        this._pending.delete(id);
        reject(new Error(`请求超时 (method=${method})`));
      }, 120000); // 2 分钟超时

      this._pending.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); },
      });

      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params });
      this._proc.stdin.write(msg + '\n');
    });
  }

  _notify(method, params) {
    const msg = JSON.stringify({ jsonrpc: '2.0', method, params });
    this._proc.stdin.write(msg + '\n');
  }

  _onData(chunk) {
    this._buffer += chunk.toString();
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id && this._pending.has(msg.id)) {
          const { resolve, reject } = this._pending.get(msg.id);
          this._pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (e) {
        // 非 JSON 行，忽略
      }
    }
  }
}

// ============================================================================
// MSYS 路径修复
// ============================================================================

// Git Bash/MSYS 会自动将 / 开头的 Linux 路径转换为 Windows 路径
// 例如: /data/app -> C:/Program Files/Git/data/app
// 此函数检测并还原被转换的路径
function fixMsysPath(p) {
  if (!p) return p;
  // 检测常见的 MSYS 路径前缀
  const msysPrefix = 'C:/Program Files/Git/';
  if (p.startsWith(msysPrefix)) {
    return '/' + p.substring(msysPrefix.length);
  }
  return p;
}

// ============================================================================
// 参数解析
// ============================================================================

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return null;
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

// ============================================================================
// 操作实现
// ============================================================================

async function doExecute(client, args) {
  // node remote-exec.js execute "command" [--server name]
  const command = args[0];
  if (!command) {
    throw new Error('缺少命令参数。用法: node remote-exec.js execute "command" [--server name]');
  }
  const server = parseArg(args, '--server');
  const params = { command };
  if (server) params.server = server;
  return await client.callTool('execute_command', params);
}

async function doSync(client, args) {
  // node remote-exec.js sync --local <path> [--remote <path>] [--server name]
  const localPath = parseArg(args, '--local') || '.';
  let remotePath = parseArg(args, '--remote');
  const server = parseArg(args, '--server');
  // 修复 MSYS 路径转换：/data/app 可能被转为 C:/Program Files/Git/data/app
  remotePath = fixMsysPath(remotePath);
  const params = { local_path: localPath };
  if (remotePath) params.remote_path = remotePath;
  if (server) params.server = server;
  return await client.callTool('sync_to_remote', params);
}

async function doBuild(client, args) {
  // node remote-exec.js build --command "build cmd" [--local <dir>] [--server name]
  const command = parseArg(args, '--command');
  if (!command) {
    throw new Error('缺少 --command 参数。用法: node remote-exec.js build --command "go build" [--local <dir>]');
  }
  const localDir = parseArg(args, '--local');
  const server = parseArg(args, '--server');
  const params = { command };
  if (localDir) params.local_dir = localDir;
  if (server) params.server = server;
  return await client.callTool('build_and_execute', params);
}

async function doTest(client, args) {
  // node remote-exec.js test [--server name]
  const server = parseArg(args, '--server');
  const params = {};
  if (server) params.server = server;
  return await client.callTool('test_connection', params);
}

async function doList(client) {
  // node remote-exec.js list
  return await client.callTool('list_servers', {});
}

async function doAddServer(args) {
  // node remote-exec.js add-server --name xx --host xx --user xx --password xx [--port 22] [--local-root .] [--remote-root /root]
  const name = parseArg(args, '--name');
  const host = parseArg(args, '--host');
  const user = parseArg(args, '--user');
  const password = parseArg(args, '--password');
  const port = parseInt(parseArg(args, '--port') || '22', 10);
  const localRoot = parseArg(args, '--local-root') || '.';
  const remoteRoot = parseArg(args, '--remote-root') || '/root';

  if (!name || !host) {
    throw new Error('缺少必要参数。用法: node remote-exec.js add-server --name xx --host xx [--user root] [--password xx] [--remote-root /root]');
  }

  const config = addServer(name, host, port, user, password, localRoot, remoteRoot);
  return `服务器 "${name}" 已添加到配置。当前配置:\n${JSON.stringify(config, null, 2)}`;
}

async function doSetDefault(args) {
  // node remote-exec.js set-default --name xx
  const name = parseArg(args, '--name');
  if (!name) {
    throw new Error('缺少 --name 参数');
  }
  const config = loadConfig();
  if (!config.servers[name]) {
    throw new Error(`服务器 "${name}" 不存在于配置中`);
  }
  config.defaultServer = name;
  saveConfig(config);
  return `默认服务器已设置为 "${name}"`;
}

// ============================================================================
// 主入口
// ============================================================================

const USAGE = `
remote-exec.js — 远程服务器操作工具（基于内嵌 mcp-remote-build-server 二进制）

用法:
  node remote-exec.js <action> [args...]

操作:
  execute <command> [--server name]              在远程服务器执行命令
  sync --local <path> [--remote <path>] [--server name]  同步文件到远程
  build --command <cmd> [--local <dir>] [--server name]   同步并执行构建
  test [--server name]                           测试服务器连接
  list                                           列出所有配置的服务器
  add-server --name <n> --host <h> [--user root] [--password pw] [--port 22] [--remote-root /root]
                                                 动态添加服务器到配置
  set-default --name <n>                         设置默认服务器

示例:
  node remote-exec.js execute "ls -la"
  node remote-exec.js execute "kubectl get pods -n dsp" --server testbed
  node remote-exec.js test --server testbed
  node remote-exec.js add-server --name testbed --host 10.74.167.22 --user admin --password Sangfor@123 --remote-root /root
`.trim();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || hasFlag(args, '--help') || hasFlag(args, '-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const action = args[0];
  const actionArgs = args.slice(1);

  // add-server 和 set-default 不需要启动二进制
  if (action === 'add-server') {
    const result = await doAddServer(actionArgs);
    console.log(result);
    return;
  }

  if (action === 'set-default') {
    const result = await doSetDefault(actionArgs);
    console.log(result);
    return;
  }

  // 其余操作需要启动 MCP 二进制
  const client = new McpClient();
  try {
    await client.start();

    let result;
    switch (action) {
      case 'execute':
        result = await doExecute(client, actionArgs);
        break;
      case 'sync':
        result = await doSync(client, actionArgs);
        break;
      case 'build':
        result = await doBuild(client, actionArgs);
        break;
      case 'test':
        result = await doTest(client, actionArgs);
        break;
      case 'list':
        result = await doList(client);
        break;
      default:
        console.error(`未知操作: ${action}\n`);
        console.log(USAGE);
        process.exit(1);
    }

    if (result !== undefined && result !== null) {
      console.log(result);
    }
  } finally {
    client.close();
  }
}

main().catch(e => {
  console.error(`错误: ${e.message}`);
  process.exit(1);
});
