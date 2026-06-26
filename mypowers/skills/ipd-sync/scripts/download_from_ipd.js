#!/usr/bin/env node
'use strict';

/**
 * IPD 需求下载脚本
 * 从 IPD 下载需求（Epic/Feature/Story/Tech）到本地目录，支持树结构或单文件模式。
 *
 * 用法:
 *   node download_from_ipd.js <issueId> --output <dir> [--single] [--productId <id>]
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── 参数解析 ────────────────────────────────────────────────

function parseArgs(args) {
  const result = { issueId: null, output: null, single: false, productId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output')      result.output = args[++i];
    else if (args[i] === '--single') result.single = true;
    else if (args[i] === '--productId') result.productId = parseInt(args[++i], 10);
    else if (!args[i].startsWith('-') && !result.issueId) result.issueId = parseInt(args[i], 10);
  }
  return result;
}

// ── 名称处理 ────────────────────────────────────────────────

/**
 * 从 IPD 名称中剥离已有前缀，提取基础名称
 * "Epic1：灾备服务" → "灾备服务"
 * "Feature1.3-审计告警策略" → "审计告警策略"
 * "Tech-系统级-告警事件总线" → "告警事件总线"
 */
function stripPrefix(name) {
  return name
    .replace(/^(Epic\d*[：:\s]*|Feature[\d.]*[：:\s]*|Story[\d.]*[：:\s]*|Tech-系统级[：:\s]*|Tech-服务级[：:\s]*|【(?:Epic|Feature|Story|系统级|服务级)】\s*)/i, '')
    .replace(/^[-–—_\s]+/, '')
    .trim();
}

/**
 * 构建规范的目录/文件名
 */
function buildDirName(name, category, hasChildren) {
  const base = stripPrefix(name);
  switch (category) {
    case 'epic':    return `Epic1-${base}`;
    case 'feature': return `Feature-${base}`;
    case 'story':   return `Story-${base}`;
    case 'tech':    return hasChildren ? `Tech-系统级-${base}` : `Tech-服务级-${base}`;
    default:        return base;
  }
}

// ── Markdown 生成 ───────────────────────────────────────────

function buildReadme(detail) {
  const lines = [];
  lines.push(`# ${detail.name}`);
  lines.push('');
  if (detail.desc && detail.desc.trim()) {
    // desc 是 HTML，保留原格式（markdown 兼容内联 HTML）
    lines.push(detail.desc);
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push(`> 来源: ${detail.url}`);
  lines.push(`> 状态: ${detail.status}`);
  lines.push(`> 优先级: ${detail.priority}`);
  if (detail.assignee && detail.assignee !== '（未分配）') {
    lines.push(`> 负责人: ${detail.assignee}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── 递归下载 ────────────────────────────────────────────────

async function downloadNode(api, issueId, outputDir, opts) {
  const detail = await api.getIssueDetail(issueId);
  const category = detail.issueCategory;  // epic / feature / story / tech
  const single = opts.single;

  // 检查子级（树结构模式且非单文件）
  let children = [];
  let hasChildren = false;
  if (!single) {
    try {
      children = await api.getSubIssues(issueId, { productId: opts.productId });
      hasChildren = children.length > 0;
    } catch (_) { /* 无子级或无权限 */ }
  }

  const dirName = buildDirName(detail.name, category, hasChildren);

  if (category === 'tech' && !hasChildren) {
    // 服务级 Tech → .md 文件
    const filePath = path.join(outputDir, `${dirName}.md`);
    fs.writeFileSync(filePath, buildReadme(detail), 'utf8');
    return { name: dirName, type: 'service-tech', category, ipdId: issueId, children: [] };
  }

  // Epic / Feature / Story / 系统级 Tech → 目录 + README.md
  const dirPath = path.join(outputDir, dirName);
  fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path.join(dirPath, 'README.md'), buildReadme(detail), 'utf8');

  const childNodes = [];
  for (const child of children) {
    const childNode = await downloadNode(api, child.id, dirPath, { ...opts, single: false });
    childNodes.push(childNode);
  }

  const typeMap = { system: 'system-tech', service: 'service-tech' };
  const nodeType = category === 'tech' ? 'system-tech' : category;
  return { name: dirName, type: nodeType, category, ipdId: issueId, children: childNodes };
}

// ── 统计 ────────────────────────────────────────────────────

function countTree(node) {
  let stats = { epic: 0, feature: 0, story: 0, systemTech: 0, serviceTech: 0 };
  function walk(n) {
    if (n.category === 'epic') stats.epic++;
    else if (n.category === 'feature') stats.feature++;
    else if (n.category === 'story') stats.story++;
    else if (n.category === 'tech') {
      if (n.type === 'system-tech') stats.systemTech++;
      else stats.serviceTech++;
    }
    for (const c of n.children) walk(c);
  }
  walk(node);
  return stats;
}

// ── 主入口 ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const opts = parseArgs(args);

  if (!opts.issueId || !opts.output) {
    console.error('用法: node download_from_ipd.js <issueId> --output <dir> [--single] [--productId <id>]');
    console.error('示例: node download_from_ipd.js 1099431 --output ./download --single');
    process.exit(1);
  }

  const absOutput = path.resolve(opts.output);

  // 加载 IPD API
  const scriptDir = __dirname;
  const apiPath = path.join(scriptDir, 'ipd_api.js');
  if (!fs.existsSync(apiPath)) {
    console.error('未找到 ipd_api.js，请确保脚本位于 skills/ipd-sync/scripts/ 目录下');
    process.exit(1);
  }
  const api = require(apiPath);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 IPD 需求下载');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🔗 需求 ID: ${opts.issueId}`);
  console.log(`📂 输出目录: ${absOutput}`);
  console.log(`📋 模式: ${opts.single ? '单文件' : '树结构（含子级）'}`);
  console.log('');

  // 确保输出目录存在
  fs.mkdirSync(absOutput, { recursive: true });

  const root = await downloadNode(api, opts.issueId, absOutput, { single: opts.single, productId: opts.productId });

  const stats = countTree(root);
  const total = stats.epic + stats.feature + stats.story + stats.systemTech + stats.serviceTech;

  console.log('\n📊 下载概览：');
  if (stats.epic > 0)        console.log(`   - ${stats.epic} 个 Epic`);
  if (stats.feature > 0)     console.log(`   - ${stats.feature} 个 Feature`);
  if (stats.story > 0)       console.log(`   - ${stats.story} 个 Story`);
  if (stats.systemTech > 0)  console.log(`   - ${stats.systemTech} 个 Tech-系统级（目录）`);
  if (stats.serviceTech > 0) console.log(`   - ${stats.serviceTech} 个 Tech-服务级（.md 文件）`);
  console.log(`   - 总需求数: ${total} 条`);
  console.log(`\n✅ 下载完成: ${absOutput}`);
}

main().catch(err => {
  console.error(`\n❌ 下载失败: ${err.message}`);
  process.exit(1);
});
