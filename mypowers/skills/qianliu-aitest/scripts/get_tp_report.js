#!/usr/bin/env node
'use strict';

/**
 * TP平台报告查询脚本
 *
 * 传入报告链接，自动解析参数并拉取失败用例详情，打印到终端。
 * 支持可选保存为 .md 文件。
 *
 * 用法:
 *   node get_tp_report.js <report_url> [--save <path>] [--all] [--verbose]
 *
 * 示例:
 *   node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286"
 *   node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286" --save ./report.md
 *   node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286" --all
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const { getRealtimeTaskReport } = require('./remote_api/tp_report');


// ============================================================================
// Constants
// ============================================================================

const TP_BASE_URLS = {
  prod: 'https://tp.sangfor.com',
  test: 'http://10.61.67.105:31031'
};


// ============================================================================
// Helpers
// ============================================================================

function _formatDateTimeReadable(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function loadGlobalToken() {
  const configPath = path.join(os.homedir(), '.qianliu', 'config.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return (cfg.tp && cfg.tp.token) || null;
  } catch (_) {
    return null;
  }
}

/**
 * 从报告 URL 中解析出 env, reportId, projectId, versionId
 *
 * 支持格式：
 *   {base}/PlanHome/AIBuildDetail/{reportId}?productId={projectId}&projectId={versionId}
 */
function parseReportUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw new Error(`无效的 URL: ${rawUrl}`);
  }

  const origin = parsed.origin;

  const env = Object.entries(TP_BASE_URLS).find(([, base]) => origin === base);
  const resolvedEnv = env ? env[0] : 'prod';

  const match = parsed.pathname.match(/\/PlanHome\/AIBuildDetail\/(\d+)/);
  if (!match) {
    throw new Error(`URL 路径中未找到报告ID，期望格式: /PlanHome/AIBuildDetail/{reportId}`);
  }
  const reportId = parseInt(match[1], 10);

  const projectId = parsed.searchParams.get('productId');
  const versionId = parsed.searchParams.get('projectId');
  const agentVersion = parsed.searchParams.get('agentVersion') || null;

  if (!projectId || !versionId) {
    throw new Error(`URL 缺少必要参数: productId 或 projectId (projectId=${versionId}, productId=${projectId})`);
  }

  return {
    env: resolvedEnv,
    reportId,
    projectId: parseInt(projectId, 10),
    versionId: parseInt(versionId, 10),
    agentVersion,
    baseUrl: origin
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    url: null,
    savePath: null,
    all: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--save' || arg === '-s') {
      opts.savePath = args[++i];
    } else if (arg === '--all') {
      opts.all = true;
    } else if (arg === '--verbose' || arg === '-v') {
      opts.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (!arg.startsWith('--') && !opts.url) {
      opts.url = arg;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
用法: node get_tp_report.js <report_url> [选项]

参数:
  report_url            TP平台报告链接（必填）
                        格式: {base}/PlanHome/AIBuildDetail/{id}?productId={x}&projectId={y}

选项:
  --save, -s <path>     将报告保存为 .md 文件（默认不保存）
  --all                 同时展示成功用例（默认仅展示失败用例）
  --verbose, -v         在报告中输出全部用例状态列表
  --help, -h            显示帮助

示例:
  node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286"
  node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286" --save ./report_2115.md
  node get_tp_report.js "https://tp.sangfor.com/PlanHome/AIBuildDetail/2115?productId=8&projectId=286" --all --verbose
`);
}

function buildReportHeader(reportId, baseUrl, projectId, versionId, env, agentVersion) {
  let reportUrl = `${baseUrl}/PlanHome/AIBuildDetail/${reportId}?productId=${projectId}&projectId=${versionId}`;
  if (agentVersion) reportUrl += `&agentVersion=${agentVersion}`;
  return [
    '# 测试报告',
    '',
    '## 基本信息',
    `- **报告ID**: ${reportId}`,
    `- **E2E报告链接**: [${reportUrl}](${reportUrl})`,
    `- **运行环境**: ${env}`,
    `- **生成时间**: ${_formatDateTimeReadable(new Date())}`,
    '',
    '---',
    ''
  ].join('\n');
}


// ============================================================================
// Main
// ============================================================================

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  if (!opts.url) {
    console.error('错误: 请提供报告链接\n');
    printHelp();
    process.exit(1);
  }

  const tpToken = loadGlobalToken();
  if (!tpToken) {
    console.error('错误: 未找到 TP Token，请确保 ~/.qianliu/config.json 中已配置 tp.token');
    process.exit(1);
  }

  let urlInfo;
  try {
    urlInfo = parseReportUrl(opts.url);
  } catch (e) {
    console.error(`错误: ${e.message}`);
    process.exit(1);
  }

  const { env, reportId, projectId, versionId, agentVersion, baseUrl } = urlInfo;

  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(22) + '智能自动化测试平台 - 报告查询');
  console.log('='.repeat(80));
  console.log(`\n  报告ID:    ${reportId}`);
  console.log(`  项目ID:    ${projectId}`);
  console.log(`  版本ID:    ${versionId}`);
  console.log(`  环境:      ${env}`);
  console.log(`  查询时间:  ${_formatDateTimeReadable(new Date())}`);
  console.log('-'.repeat(80));
  console.log('\n正在拉取报告数据，请稍候...\n');

  // statusFilter: 3=失败, 2=成功, 1=进行中
  const statusFilter = opts.all ? [2, 3, 1] : [3];
  const compressMode = 'both';

  let result;
  try {
    result = await getRealtimeTaskReport({
      env,
      reportId,
      projectId,
      versionId,
      tpToken,
      agentVersion,
      statusFilter,
      compressMode,
      verbose: opts.verbose,
      maxWorkers: 5
    });
  } catch (e) {
    console.error(`错误: 拉取报告失败 - ${e.message}`);
    process.exit(1);
  }

  const { summary, markdown } = result;

  // 打印执行概览
  console.log('='.repeat(80));
  console.log(' '.repeat(30) + '执行概览');
  console.log('='.repeat(80));
  console.log(`\n  总用例数:  ${summary.total}`);
  console.log(`  通过:      ${summary.success} ✅`);
  console.log(`  失败:      ${summary.failed} ❌`);
  console.log(`  进行中:    ${summary.running} 🔄`);
  console.log(`  通过率:    ${summary.successRate}%`);
  console.log(`  完成度:    ${summary.completionRate}%`);
  console.log('');

  // 打印失败用例详情
  console.log('='.repeat(80));
  console.log(' '.repeat(28) + (opts.all ? '用例详情' : '失败用例详情'));
  console.log('='.repeat(80));
  console.log('');
  console.log(markdown);

  // 保存为 .md 文件（可选）
  if (opts.savePath) {
    const savePath = path.resolve(opts.savePath);
    const dir = path.dirname(savePath);
    fs.mkdirSync(dir, { recursive: true });

    const header = buildReportHeader(reportId, baseUrl, projectId, versionId, env, agentVersion);
    const content = header + markdown;
    fs.writeFileSync(savePath, content, 'utf8');

    console.log('='.repeat(80));
    console.log(`\n✅ 报告已保存: ${savePath}`);
    console.log('='.repeat(80) + '\n');
  }
}

main().catch(e => {
  console.error('未捕获的错误:', e.message);
  process.exit(1);
});
