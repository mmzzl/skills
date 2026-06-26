#!/usr/bin/env node
'use strict';

/**
 * IPD 批量同步脚本
 * 将本地需求文档（Epic→Feature→Story→Tech-系统级→Tech-服务级）同步到 IPD 系统
 *
 * 使用方式：
 *   node sync_from_docs.js <docsRoot> [options]
 *
 * 参数：
 *   docsRoot      - 需求文档根目录（包含 Epic-xxx 目录的路径）
 *
 * 选项：
 *   --productId     - 产品 ID（默认从环境变量或配置读取）
 *   --projectId     - 项目 ID（默认从环境变量或配置读取）
 *   --versionId     - 版本 ID（默认从环境变量或配置读取）
 *   --indexFile     - 索引文件输出路径（可选，默认 ipd_index.yaml）
 *   --dry-run       - 仅扫描不创建（预览模式）
 *
 * 目录结构支持：
 * - Epic-xxx/README.md
 * - Feature-xxx/README.md
 * - Story-xxx/README.md（如 Story1.1-将安全保密管理员更名为授权管理员）
 * - Tech-系统级-xxx/README.md
 * - Tech-服务级-xxx/README.md（目录形式，名称保留完整描述）
 * - Tech-服务级/名字.md（文件形式，去掉 .md 后缀）
 *
 * 输出：
 *   - 在 IPD 创建对应层级的需求条目
 *   - 生成 YAML 索引文件记录本地路径与 IPD ID 的映射，支持工作量字段
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ── 参数解析 ─────────────────────────────────────────────────

function parseArgs(args) {
  const result = {
    docsRoot: null,
    productId: null,
    projectId: null,
    versionId: null,
    teamId: null,
    indexFile: null,
    dryRun: false,
    parentId: null,
    single: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--productId') {
      result.productId = parseInt(args[++i], 10);
    } else if (arg === '--projectId') {
      result.projectId = parseInt(args[++i], 10);
    } else if (arg === '--versionId') {
      result.versionId = parseInt(args[++i], 10);
    } else if (arg === '--teamId') {
      result.teamId = parseInt(args[++i], 10);
    } else if (arg === '--indexFile') {
      result.indexFile = args[++i];
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--parent-id') {
      result.parentId = parseInt(args[++i], 10);
    } else if (arg === '--single') {
      result.single = true;
    } else if (!arg.startsWith('-') && !result.docsRoot) {
      result.docsRoot = arg;
    }
  }

  return result;
}

// ── Markdown 转 HTML ─────────────────────────────────

function markdownToHtml(md, filePath) {
  if (!md) return '';
  const _inline = (text) => inline(text, filePath);
  const code = [];
  const lines = md.replace(/\r\n?/g, '\n').replace(/^\d+\t/gm, '')
    .replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, lang, body) => {
      const cls = lang.trim() ? ` class="language-${escapeHtml(lang.trim())}"` : '';
      code.push(`<pre><code${cls}>${escapeHtml(body)}</code></pre>`);
      return `\u0000CODE${code.length - 1}\u0000`;
    }).split('\n');
  const out = [];
  const isSep = s => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(s.trim());
  const isTable = i => lines[i] && lines[i].includes('|') && isSep(lines[i + 1] || '');
  const isList = s => /^\s*(?:[-*+]|\d+\.)\s+/.test(s);
  const isBlock = i => !lines[i] || /^\u0000CODE\d+\u0000$/.test(lines[i].trim()) || /^(#{1,6}\s+|---+$)/.test(lines[i].trim()) || isTable(i) || isList(lines[i]);

  for (let i = 0; i < lines.length;) {
    const line = lines[i], s = line.trim();
    if (!s) { i++; continue; }
    const token = s.match(/^\u0000CODE(\d+)\u0000$/);
    if (token) { out.push(code[+token[1]]); i++; continue; }
    const h = s.match(/^(#{1,6})\s+(.+)$/);
    if (h) { out.push(`<h${h[1].length}>${_inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (/^---+$/.test(s)) { out.push('<hr>'); i++; continue; }
    if (isTable(i)) {
      const rows = [lines[i++]]; i++;
      while (lines[i] && lines[i].includes('|')) rows.push(lines[i++]);
      out.push(renderTable(rows, filePath));
      continue;
    }
    if (isList(line)) {
      const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul', items = [];
      while (isList(lines[i] || '')) items.push(`<li>${_inline(lines[i++].replace(/^\s*(?:[-*+]|\d+\.)\s+/, ''))}</li>`);
      out.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (lines[i] && !isBlock(i)) para.push(lines[i++].trim());
    out.push(`<p>${_inline(para.join('\u0000BR\u0000')).replace(/\u0000BR\u0000/g, '<br>')}</p>`);
  }
  return out.join('\n\n');
}

function renderTable(lines, filePath) {
  const cells = row => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const [head, ...body] = lines.map(cells);
  const tr = (row, tag) => `<tr>${row.map(c => `<${tag}>${inline(c, filePath)}</${tag}>`).join('')}</tr>`;
  return `<table>\n<thead>${tr(head, 'th')}</thead>\n<tbody>${body.map(r => tr(r, 'td')).join('\n')}</tbody>\n</table>`;
}

function inline(text, filePath) {
  /* 先提取图片和链接，替换为占位符，避免 escapeHtml 破坏语法 */
  const placeholders = [];
  const hold = (html) => { const id = `\u0000PH${placeholders.length}\u0000`; placeholders.push(html); return id; };
  let result = text;
  /* 图片必须在链接之前处理，否则 ![alt](url) 会被链接正则先匹配 */
  result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const resolvedUrl = resolveImageUrl(url, filePath);
    return hold(`<img src="${escapeHtml(resolvedUrl)}" alt="${escapeHtml(alt)}" style="max-width:100%;height:auto;">`);
  });
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
    return hold(`<a href="${escapeHtml(url)}" target="_blank">${escapeHtml(txt)}</a>`);
  });
  result = escapeHtml(result)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  /* 还原占位符 */
  result = result.replace(/\u0000PH(\d+)\u0000/g, (_, i) => placeholders[parseInt(i)]);
  return result;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 仓库远程 URL 基础路径 ─────────────────────────────────

/** 缓存仓库远程基础路径，格式：https://git.sangfor.com/HCI/hci-7.0.0/start/-/raw/master */
let _repoBaseUrl = null;

function getRepoBaseUrl() {
  if (_repoBaseUrl !== null) return _repoBaseUrl;
  try {
    const raw = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const https = raw.replace(/^git@([^:]+):(.+)\.git$/, 'https://$1/$2');
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    _repoBaseUrl = `${https}/-/raw/${branch}`;
  } catch (_) {
    _repoBaseUrl = '';
  }
  return _repoBaseUrl;
}

/**
 * 将 Markdown 中的相对图片路径转换为仓库绝对 URL
 * @param {string} imgPath - 图片原始路径（可能是相对路径或绝对 URL）
 * @param {string} filePath - 当前 Markdown 文件的路径
 * @returns {string} 转换后的 URL
 */
function resolveImageUrl(imgPath, filePath) {
  if (!imgPath) return imgPath;
  // 已经是绝对 URL（http/https/data:）或以 / 开头的绝对路径，直接返回不做转换
  if (/^(https?:|data:|\/)/i.test(imgPath)) return imgPath;
  const base = getRepoBaseUrl();
  if (!base) return imgPath;
  // 基于 Markdown 文件所在目录解析相对路径
  const fileDir = path.dirname(path.resolve(filePath));
  const resolved = path.resolve(fileDir, imgPath);
  // 转为相对于仓库根目录的路径
  let repoRoot;
  try {
    repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch (_) {
    return imgPath;
  }
  const relToRepo = path.relative(repoRoot, resolved).replace(/\\/g, '/');
  return `${base}/${relToRepo}`;
}

// ── 目录扫描 ────────────────────────────────────────────────

function listDirs(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
}

function listFiles(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(d => d.isFile())
      .map(d => d.name)
      .sort(naturalSort);
  } catch {
    return [];
  }
}

const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });
function naturalSort(a, b) { return collator.compare(a, b); }

/**
 * 提取名称（保留完整编号）
 * 支持灵活命名：
 *   Epic1-xxx → Epic1：xxx
 *   E04.xxx → E04.xxx（保留原样）
 *   Story1.1-xxx → Story1.1：xxx
 *   【Epic】xxx → 【Epic】xxx（保留原样）
 */
function extractName(dirName, prefix) {
  // 支持短编号格式 E04.xxx / F04.xxx / S04.xxx
  const shortPrefixMap = { 'Epic': 'E', 'Feature': 'F', 'Story': 'S' };
  const shortPrefix = shortPrefixMap[prefix];
  if (shortPrefix) {
    const shortMatch = dirName.match(new RegExp(`^(${shortPrefix}\\d+[.\\-_])(.*)$`, 'i'));
    if (shortMatch) {
      const [, head, tail] = shortMatch;
      if (!tail) return head.replace(/[._-]$/, '');
      return `${head.replace(/[._-]$/, '')}：${tail}`;
    }
  }
  // 支持中括号格式 【Epic】xxx / 【Feature】xxx / 【Story】xxx
  const bracketMatch = dirName.match(new RegExp(`^【${prefix}】\\s*(.*)$`, 'i'));
  if (bracketMatch) {
    return bracketMatch[1] ? `【${prefix}】${bracketMatch[1]}` : `【${prefix}】`;
  }
  // 原有逻辑：Epic1-xxx / Feature1.1-xxx / Story1.1.1-xxx
  const match = dirName.match(new RegExp(`^(${prefix}(?:\\d+(?:\\.\\d+)*)?)\\s*[–—\\-_ ]?\\s*(.*)$`, 'i'));
  if (match) {
    const [, head, tail] = match;
    if (!tail) return head;
    return /\d/.test(head) ? `${head}：${tail}` : tail;
  }
  return dirName;
}

/**
 * 提取 Tech 名称
 * 支持灵活命名：
 *   Tech-系统级-角色中心 → Tech-系统级-角色中心
 *   Tech-系统级-1.1.1.1-LACP状态采集服务 → Tech-系统级-1.1.1.1-LACP状态采集服务
 *   【系统级】角色中心 → 【系统级】角色中心
 */
function extractTechName(dirName, level) {
  // 支持中括号格式 【系统级】xxx / 【服务级】xxx
  const bracketMatch = dirName.match(new RegExp(`^【${level}】\\s*(.*)$`));
  if (bracketMatch) return bracketMatch[1] ? `Tech-${level}-${bracketMatch[1]}` : `Tech-${level}`;
  // 原有逻辑：Tech-系统级-xxx / Tech-服务级-xxx
  const match = dirName.match(new RegExp(`^Tech\\s*[–—\\-_ ]\\s*${level}\\s*[–—\\-_ ]?\\s*(.*)$`, 'i'));
  if (match) return match[1] ? `Tech-${level}-${match[1]}` : `Tech-${level}`;
  return dirName;
}

function readDescription(readmePath) {
  if (!fs.existsSync(readmePath)) return '';
  return markdownToHtml(fs.readFileSync(readmePath, 'utf-8'), readmePath);
}

/**
 * 根据目录名前缀和深度推断节点类型
 * 前缀优先匹配，无前缀时按深度推断：
 *   depth 0 = epic, 1 = feature, 2 = story, 3 = system-tech, 4+ = service-tech
 */
function nodeKind(name, depth) {
  // 前缀优先匹配（兼容带编号的目录名，如 Epic1-xxx、Feature1.1-xxx）
  if (/^Epic(?:\d+)?[-–—_\s]/i.test(name) || /^Epic\d+$/i.test(name)) return 'epic';
  // 短编号格式：E04.xxx / E04-xxx / E04 xxx
  if (/^E\d+[.–—_\s]/i.test(name)) return 'epic';
  if (/^Feature(?:\d+(?:\.\d+)*)?[-–—_\s]/i.test(name) || /^Feature\d+$/i.test(name)) return 'feature';
  // 短编号格式：F04.xxx / F04-xxx / F04 xxx
  if (/^F\d+[.–—_\s]/i.test(name)) return 'feature';
  if (/^Story(?:\d+(?:\.\d+)*)?[-–—_\s]/i.test(name) || /^Story\d+$/i.test(name)) return 'story';
  // 短编号格式：S04.xxx / S04-xxx / S04 xxx
  if (/^S\d+[.–—_\s]/i.test(name)) return 'story';
  if (/^Tech\s*[–—\-_]\s*系统级/i.test(name) || /^【UEDC】/i.test(name)) return 'system-tech';
  if (/^Tech\s*[–—\-_]\s*服务级/i.test(name)) return 'service-tech';
  // 无前缀时按深度推断（仅 depth 1~4，depth 0 不推断为 epic）
  const depthMap = { 1: 'feature', 2: 'story', 3: 'system-tech', 4: 'service-tech' };
  return depthMap[depth] || 'folder';
}

/**
 * 提取节点名称（兼容有前缀和无前缀两种情况）
 */
function extractNodeName(dirName, kind) {
  const prefixMap = {
    'epic': 'Epic',
    'feature': 'Feature',
    'story': 'Story',
  };
  const prefix = prefixMap[kind];
  if (prefix) return extractName(dirName, prefix);
  if (kind === 'system-tech' || kind === 'service-tech') {
    const level = kind === 'system-tech' ? '系统级' : '服务级';
    return extractTechName(dirName, level);
  }
  return dirName;
}

/**
 * 扫描需求目录结构（递归，基于深度+前缀推断类型）
 * @param {string} docsRoot - 文档根目录
 * @param {number} depth - 当前扫描深度（0=epic层）
 */
function scanRequirements(docsRoot) {
  const tree = { epics: [] };
  const unmatched = [];

  const entries = listDirs(docsRoot).filter(d => {
    // 跳过隐藏目录和索引文件
    if (d.startsWith('.')) return false;
    if (d === 'ipd_index.yaml' || d === 'ipd_index.md' || d === '系统需求分析总结.md') return false;
    return true;
  });

  for (const entry of entries) {
    const kind = nodeKind(entry, 0);
    if (kind === 'epic' || kind === 'feature' || kind === 'story' || kind === 'system-tech' || kind === 'service-tech') {
      const node = buildNode(docsRoot, entry, 0, kind);
      if (node) tree.epics.push(node);
    } else {
      unmatched.push({ path: entry, level: 'root' });
    }
  }

  return { tree, unmatched };
}

/**
 * 递归构建节点
 * @param {string} parentPath - 父目录绝对路径
 * @param {string} dirName - 当前目录名
 * @param {number} depth - 当前深度
 * @param {string} kind - 节点类型
 */
function buildNode(parentPath, dirName, depth, kind) {
  const fullPath = path.join(parentPath, dirName);
  const name = extractNodeName(dirName, kind);

  if (kind === 'epic') {
    const node = {
      type: 'epic',
      kind: 'epic',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      features: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'feature') node.features.push(child);
      else if (child.kind === 'story') { node.features.push({ ...child, type: 'feature', stories: [child] }); }
      else if (child.kind === 'system-tech') { node.features.push({ type: 'feature', kind: 'feature', dirName, name: `${name}-隐含Feature`, readmePath: node.readmePath, ipdId: null, estimatedDay: null, stories: [{ type: 'story', kind: 'story', dirName, name: `${name}-隐含Story`, readmePath: node.readmePath, ipdId: null, estimatedDay: null, techs: [child] }] }); }
    }
    return node;
  }

  if (kind === 'feature') {
    const node = {
      type: 'feature',
      kind: 'feature',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      stories: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'story') node.stories.push(child);
      else if (child.kind === 'system-tech') {
        /* Tech 直接挂在 Feature 下，隐含 Story 层 */
        node.stories.push({
          type: 'story',
          kind: 'story',
          dirName,
          name: `${name}-隐含Story`,
          readmePath: node.readmePath,
          ipdId: null,
          estimatedDay: null,
          techs: [child]
        });
      }
    }
    return node;
  }

  if (kind === 'story') {
    const node = {
      type: 'story',
      kind: 'story',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: null,
      techs: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'system-tech') node.techs.push(child);
    }
    return node;
  }

  if (kind === 'system-tech') {
    const node = {
      type: 'tech',
      kind: 'system-tech',
      level: '系统级',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: 1,
      subTechs: []
    };
    for (const child of scanChildren(fullPath, depth + 1)) {
      if (child.kind === 'service-tech') node.subTechs.push(child);
    }
    // 扫描系统级目录下的 .md 文件（服务级 Tech），不依赖深度判断
    for (const mdFile of listFiles(fullPath).filter(f => /\.md$/i.test(f) && !/^README\.md$/i.test(f))) {
      node.subTechs.push(makeServiceTech(path.join(fullPath, mdFile), mdFile, mdFile));
    }
    return node;
  }

  if (kind === 'service-tech') {
    return {
      type: 'tech',
      kind: 'service-tech',
      level: '服务级',
      dirName,
      name,
      readmePath: path.join(fullPath, 'README.md'),
      ipdId: null,
      estimatedDay: 1,
    };
  }

  return null;
}

/**
 * 扫描子目录，根据深度+前缀推断类型并构建节点
 */
function scanChildren(dirPath, depth) {
  const results = [];
  const entries = listDirs(dirPath).filter(d => {
    if (d.startsWith('.')) return false;
    return true;
  });

  for (const entry of entries) {
    const kind = nodeKind(entry, depth);
    if (kind !== 'folder') {
      const node = buildNode(dirPath, entry, depth, kind);
      if (node) results.push(node);
    }
  }

  return results;
}

function makeServiceTech(readmePath, dirName, rawName) {
  // rawName 可能来自目录名（serviceNameFromDir）或文件名
  // 目录名不含扩展名，直接使用；文件名才需要去掉 .md
  const isFromDir = !rawName.endsWith('.md');
  let name = isFromDir ? rawName : path.basename(rawName, path.extname(rawName));
  // 文件名本身带了 Tech-服务级- 前缀时，剥离避免 fullName 双前缀
  name = name.replace(/^Tech-服务级[-–—_\s]*/, '');
  return {
    type: 'tech',
    kind: 'service-tech',
    level: '服务级',
    dirName,
    name,
    fullName: `Tech-服务级：${name}`,
    readmePath,
    ipdId: null,
    estimatedDay: 1, // Tech-服务级 默认工作量 1 天
  };
}

// ── 辅助函数 ────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function summarizeTree(tree) {
  const stats = { epic: 0, feature: 0, story: 0, systemTech: 0, serviceTech: 0 };

  function walk(node) {
    if (node.type === 'epic') stats.epic++;
    else if (node.type === 'feature') stats.feature++;
    else if (node.type === 'story') stats.story++;

    if (node.kind === 'system-tech') stats.systemTech++;
    else if (node.kind === 'service-tech') stats.serviceTech++;

    if (node.features) node.features.forEach(walk);
    if (node.stories) node.stories.forEach(walk);
    if (node.techs) node.techs.forEach(walk);
    if (node.subTechs) node.subTechs.forEach(walk);
  }

  tree.epics.forEach(walk);
  return stats;
}

function countItems(tree) {
  let count = 0;
  for (const item of tree.epics) {
    count++; // top-level
    if (item.type === 'epic') {
      for (const feature of item.features) {
        count++;
        for (const story of feature.stories) {
          count++;
          for (const tech of story.techs) {
            count++;
            count += tech.subTechs ? tech.subTechs.length : 0;
          }
        }
      }
    } else if (item.type === 'feature') {
      for (const story of item.stories) {
        count++;
        for (const tech of story.techs) {
          count++;
          count += tech.subTechs ? tech.subTechs.length : 0;
        }
      }
    } else if (item.type === 'story') {
      for (const tech of item.techs) {
        count++;
        count += tech.subTechs ? tech.subTechs.length : 0;
      }
    } else if (item.type === 'tech') {
      count += item.subTechs ? item.subTechs.length : 0;
    }
  }
  return count;
}

/**
 * 生成 YAML 索引文件
 */
function generateYamlIndex(allItems, config) {
  // 先统计叶子节点
  const stats = {
    epic: 0,
    feature: 0,
    story: 0,
    tech: 0,
    total: 0,
    total_estimated_days: 0,  // 仅叶子节点 Tech
  };

  for (const item of allItems) {
    stats[item.type]++;
    stats.total++;
    // 只有叶子节点 Tech（没有子节点的 Tech）才统计工作量
    if (item.type === 'tech' && (!item.children || item.children.length === 0)) {
      stats.total_estimated_days += item.estimatedDay || 1;
    }
  }

  const lines = [];

  // 统计部分
  lines.push('stats:');
  lines.push(`  epic: ${stats.epic}`);
  lines.push(`  feature: ${stats.feature}`);
  lines.push(`  story: ${stats.story}`);
  lines.push(`  tech: ${stats.tech}`);
  lines.push(`  total: ${stats.total}`);
  lines.push(`  total_estimated_days: ${stats.total_estimated_days}`);

  // 元信息
  lines.push('meta:');
  lines.push(`  project_id: ${config.projectId}`);
  lines.push(`  version_id: ${config.versionId}`);
  lines.push(`  team_id: ${config.teamId}`);
  lines.push(`  product_id: ${config.productId}`);
  lines.push(`  sync_time: "${new Date().toISOString()}"`);

  // 需求列表
  lines.push('issues:');

  // 构建层级结构
  const itemMap = new Map();
  for (const item of allItems) {
    itemMap.set(item.ipdId, { ...item, children: [] });
  }

  for (const item of allItems) {
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(itemMap.get(item.ipdId));
      }
    }
  }

  // 根节点
  const rootItems = [];
  for (const item of allItems) {
    if (!item.parentId) {
      rootItems.push(itemMap.get(item.ipdId));
    }
  }

  // 递归生成 YAML
  for (const root of rootItems) {
    lines.push('  -');
    const itemLines = convertToYamlItemRecursive(root, 2);
    for (const line of itemLines) {
      lines.push(line);
    }
  }

  return lines.join('\n');
}

function formatValue(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') {
    if (/[#:{}[\],&*?|\-<>]/.test(value) || value.includes(' ')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

function convertToYamlItemRecursive(item, indent) {
  const lines = [];
  const indentStr = '  '.repeat(indent);

  lines.push(`${indentStr}id: ${item.ipdId}`);
  lines.push(`${indentStr}type: ${item.type}`);
  lines.push(`${indentStr}name: ${formatValue(item.name)}`);
  lines.push(`${indentStr}url: ${formatValue(item.ipdUrl)}`);
  lines.push(`${indentStr}local_path: ${formatValue(item.localPath)}`);

  if (item.type === 'tech') {
    if (item.level) {
      lines.push(`${indentStr}level: ${item.level}`);
    }
    // 只有叶子节点才写工作量
    if (!item.children || item.children.length === 0) {
      lines.push(`${indentStr}estimated_day: ${item.estimatedDay || 1}`);
    }
  }

  if (item.children && item.children.length > 0) {
    lines.push(`${indentStr}children:`);
    for (const child of item.children) {
      lines.push(`${indentStr}  -`);
      const childLines = convertToYamlItemRecursive(child, indent + 2);
      for (const line of childLines) {
        lines.push(line);
      }
    }
  }

  return lines;
}

// ── 导出模块 ────────────────────────────────────────────────

module.exports = {
  markdownToHtml,
  scanRequirements,
  extractName,
  extractTechName,
  readDescription,
  countItems,
  generateYamlIndex,
};

// ── 主同步函数 ──────────────────────────────────────────────

async function syncToIpd(options) {
  let {
    docsRoot,
    productId,
    projectId,
    versionId,
    teamId,
    indexFile,
    dryRun = false,
    parentId = null,
    single = false,
  } = options;
  let { ipdApi } = options; // 注入 IPD API 模块

  if (!docsRoot) {
    throw new Error('缺少必需参数: docsRoot');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 IPD 同步脚本（支持工作量同步）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📂 文档目录: ${docsRoot}`);
  if (dryRun) console.log('👁️  预览模式（仅扫描，不创建）');
  console.log('');

  const yamlPath = indexFile || path.join(docsRoot, 'ipd_index.yaml');

  // 扫描目录 — 自动检测完整树 / 部分同步
  console.log('\n📂 扫描本地目录...');
  let tree, unmatched;

  // 检查 docsRoot 本身是否为一个具名条目（部分同步）
  const rootName = path.basename(docsRoot);
  const rootIsFile = fs.existsSync(docsRoot) && fs.statSync(docsRoot).isFile();

  if (rootIsFile && docsRoot.endsWith('.md')) {
    // 单文件：作为 Tech-服务级处理
    const kind = nodeKind(path.basename(docsRoot, '.md'), 0) || 'service-tech';
    const name = path.basename(docsRoot, '.md').replace(/^Tech-服务级[-–—_\s]*/, '');
    const node = {
      type: 'tech', kind: 'service-tech', level: '服务级',
      dirName: rootName, name,
      readmePath: docsRoot, ipdId: null, estimatedDay: 1,
    };
    tree = { epics: [node] };
    unmatched = [];
  } else {
    const rootKind = nodeKind(rootName, 0);
    if (rootKind && rootKind !== 'folder' && rootKind !== 'epic') {
      // docsRoot 本身是一个具名条目（Feature/Story/Tech-系统级目录）
      const parentDir = path.dirname(docsRoot);
      const node = buildNode(parentDir, rootName, 0, rootKind);
      tree = { epics: node ? [node] : [] };
      unmatched = node ? [] : [{ path: docsRoot, level: 'root' }];
    } else {
      // docsRoot 是容器目录，完整扫描
      ({ tree, unmatched } = scanRequirements(docsRoot));
    }
  }
  const totalCount = countItems(tree);
  console.log(`   找到 ${tree.epics.length} 个条目，共 ${totalCount} 条需求\n`);
  for (const item of tree.epics) {
    const emoji = { epic: '📘', feature: '📗', story: '📙', tech: '📓' };
    console.log(`   ${emoji[item.type] || '📘'} ${item.name}`);
    if (item.type === 'epic') {
      for (const feature of item.features) {
        console.log(`     📗 ${feature.name}（${feature.stories.length} Stories）`);
        for (const story of feature.stories) {
          const techCount = story.techs.length;
          const subTechCount = story.techs.reduce((sum, t) => sum + (t.subTechs ? t.subTechs.length : 0), 0);
          console.log(`       📙 ${story.name}（${techCount} 系统级 Tech / ${subTechCount} 服务级 Tech）`);
        }
      }
    } else if (item.type === 'feature') {
      for (const story of item.stories) {
        const techCount = story.techs.length;
        const subTechCount = story.techs.reduce((sum, t) => sum + (t.subTechs ? t.subTechs.length : 0), 0);
        console.log(`     📙 ${story.name}（${techCount} 系统级 Tech / ${subTechCount} 服务级 Tech）`);
      }
    } else if (item.type === 'story') {
      const techCount = item.techs.length;
      const subTechCount = item.techs.reduce((sum, t) => sum + (t.subTechs ? t.subTechs.length : 0), 0);
      console.log(`     📓 ${techCount} 系统级 Tech / ${subTechCount} 服务级 Tech`);
    } else if (item.type === 'tech' && item.subTechs) {
      console.log(`     🔧 ${item.subTechs.length} 服务级 Tech`);
    }
  }

  // 汇总统计
  const summary = summarizeTree(tree);
  console.log(`\n📊 目录结构概览：`);
  console.log(`   - ${summary.epic} 个 Epic`);
  console.log(`   - ${summary.feature} 个 Feature`);
  console.log(`   - ${summary.story} 个 Story`);
  console.log(`   - ${summary.systemTech} 个 Tech-系统级（目录）`);
  console.log(`   - ${summary.serviceTech} 个 Tech-服务级（.md 文件）`);
  console.log(`   - 总需求数: ${totalCount} 条`);

  // 警告：未能识别的目录/文件
  if (unmatched.length > 0) {
    console.log(`\n⚠️  以下 ${unmatched.length} 个项目无法识别，将被跳过：`);
    for (const u of unmatched) {
      console.log(`   - ${u.path}（${u.level} 层）`);
    }
    console.log('   请检查命名是否符合 Epic{N}-/Feature{N}.{N}-/Story{N}.{N}.{N}-/Tech-系统级- 格式');
  }

  if (totalCount === 0) {
    console.log('\n⚠️  未发现任何可同步的需求条目，请确认目录结构是否正确。');
  }

  if (dryRun) {
    console.log('\n预览完成，退出。');
    return { tree, items: [] };
  }

  if (!ipdApi) {
    // 优先从同级目录加载 ipd_api.js
    const scriptDir = __dirname;
    const localApiPath = path.join(scriptDir, 'ipd_api.js');
    if (fs.existsSync(localApiPath)) {
      ipdApi = require(localApiPath);
    } else {
      // 回退到环境变量方式
      const skillsBase = process.env.SKILLS_BASE_DIR
        || (process.env.CLAUDE_CONFIG_DIR
          ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills')
          : path.join(os.homedir(), '.claude', 'skills'));
      ipdApi = require(path.join(skillsBase, 'ipd-sync/scripts/ipd_api'));
    }
  }

  // 如果提供了 parentId 但缺少 projectId/productId，从父节点自动解析
  if (parentId && (!projectId || !productId)) {
    try {
      const parentRes = await ipdApi.getIssue(parentId);
      const parentData = parentRes.data || parentRes;
      if (!productId && parentData.product?.id) {
        productId = parentData.product.id;
        console.log(`🔗 从父节点 ${parentId} 解析 productId: ${productId}`);
      }
      if (!projectId && parentData.ipd_project?.id) {
        projectId = parentData.ipd_project.id;
        console.log(`🔗 从父节点 ${parentId} 解析 projectId: ${projectId}`);
      }
    } catch (err) {
      console.warn(`⚠️  无法从父节点 ${parentId} 解析项目信息: ${err.message}`);
    }
  }

  // 获取团队信息
  let teamVersionId = null;

  if (teamId && versionId) {
    // 显式传入 teamId + versionId，直接使用
    teamVersionId = teamId;
    console.log(`\n👥 团队 ID: ${teamVersionId}`);
  } else if (projectId && versionId) {
    // 有 versionId 无 teamId，自动解析团队
    try {
      const teams = await ipdApi.getTeamsByProject(projectId);
      const targetTeam = teams.find(t => t.planVersionId === versionId);
      if (targetTeam) {
        teamVersionId = targetTeam.teamId;
        console.log(`\n👥 团队 ID: ${teamVersionId} (${targetTeam.teamName})`);
      }
    } catch (err) {
      console.warn(`⚠️  获取团队失败: ${err.message}`);
    }
  }

  // 提示同步目标
  if (!versionId) {
    console.log(`\n📦 同步目标: 项目需求池`);
  } else if (teamId) {
    console.log(`\n📦 同步目标: 版本 ${versionId} / 团队 ${teamId}`);
  } else {
    console.log(`\n📦 同步目标: 版本 ${versionId}`);
  }

  // 同步
  const baseOpts = { productId, ipdProjectId: projectId, planVersionId: versionId, teamVersionId };
  const allItems = [];

  for (const epic of tree.epics) {
    const epicPath = path.join(docsRoot, epic.dirName);

    const typeEmoji = { epic: '📘', feature: '📗', story: '📙', tech: '📓' };
    const typeLabel = { epic: 'Epic', feature: 'Feature', story: 'Story', tech: `Tech-${epic.level || ''}` };
    console.log(`\n${typeEmoji[epic.type] || '📘'} ${typeLabel[epic.type] || epic.type}: ${epic.name}`);

    const epicCreateOpts = {
      ...baseOpts,
      desc: readDescription(epic.readmePath),
    };
    if (parentId) {
      epicCreateOpts.parentId = parentId;
    }
    const epicResult = await ipdApi.createIssue(epic.type, epic.name, epicCreateOpts);
    console.log(`   ✅ 创建: ${epic.name} → ID: ${epicResult.id}`);
    epic.ipdId = epicResult.id;
    await sleep(300);
    allItems.push({ type: epic.type, name: epic.name, ipdId: epicResult.id, ipdUrl: epicResult.url, localPath: epic.dirName, estimatedDay: null });

    if (single) continue;

    if (epic.type === 'epic') {
      for (const feature of epic.features) {
        const featurePath = path.join(epicPath, feature.dirName);
        console.log(`  📗 Feature: ${feature.name}`);

        const featureResult = await ipdApi.createIssue('feature', feature.name, {
          ...baseOpts,
          parentId: epic.ipdId,
          desc: readDescription(feature.readmePath),
        });
        console.log(`     ✅ 创建: ${feature.name} → ID: ${featureResult.id}`);
        feature.ipdId = featureResult.id;
        await sleep(300);
        allItems.push({ type: 'feature', name: feature.name, ipdId: featureResult.id, ipdUrl: featureResult.url, localPath: `${epic.dirName}/${feature.dirName}`, parentId: epic.ipdId, estimatedDay: null });

        for (const story of feature.stories) {
          const storyPath = path.join(featurePath, story.dirName);
          console.log(`    📙 Story: ${story.name}`);

          const storyResult = await ipdApi.createIssue('story', story.name, {
            ...baseOpts,
            parentId: feature.ipdId,
            desc: readDescription(story.readmePath),
          });
          console.log(`       ✅ 创建: ${story.name} → ID: ${storyResult.id}`);
          story.ipdId = storyResult.id;
          await sleep(300);
          allItems.push({ type: 'story', name: story.name, ipdId: storyResult.id, ipdUrl: storyResult.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}`, parentId: feature.ipdId, estimatedDay: null });

          for (const tech of story.techs) {
            const techPath = path.join(storyPath, tech.dirName);
            console.log(`      📓 Tech-${tech.level}: ${tech.name}`);

            const estimatedDay = tech.estimatedDay || 1;

            const techResult = await ipdApi.createIssue('tech', tech.name, {
              ...baseOpts,
              parentId: story.ipdId,
              desc: readDescription(tech.readmePath),
              estimatedDay,
            });
            console.log(`         ✅ 创建: ${tech.name} → ID: ${techResult.id}（工作量: ${estimatedDay}天）`);
            tech.ipdId = techResult.id;
            await sleep(300);
            allItems.push({ type: 'tech', level: tech.level, name: tech.name, ipdId: techResult.id, ipdUrl: techResult.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}/${tech.dirName}`, parentId: story.ipdId, estimatedDay });

            if (tech.subTechs) {
              for (const subTech of tech.subTechs) {
                console.log(`        🔧 Tech-服务级: ${subTech.name}`);

                const subEstimatedDay = subTech.estimatedDay || 1;

                const subTechResult = await ipdApi.createIssue('tech', subTech.fullName, {
                  ...baseOpts,
                  parentId: tech.ipdId,
                  desc: readDescription(subTech.readmePath),
                  estimatedDay: subEstimatedDay,
                });
                console.log(`           ✅ 创建: ${subTech.name} → ID: ${subTechResult.id}（工作量: ${subEstimatedDay}天）`);
                subTech.ipdId = subTechResult.id;
                await sleep(300);
                allItems.push({ type: 'tech', level: '服务级', name: subTech.name, ipdId: subTechResult.id, ipdUrl: subTechResult.url, localPath: `${epic.dirName}/${feature.dirName}/${story.dirName}/${tech.dirName}/${subTech.dirName}`, parentId: tech.ipdId, estimatedDay: subEstimatedDay });
              }
            }
          }
        }
      }
    } else if (epic.type === 'feature') {
      for (const story of epic.stories) {
        const storyPath = path.join(epicPath, story.dirName);
        console.log(`    📙 Story: ${story.name}`);

        const storyResult = await ipdApi.createIssue('story', story.name, {
          ...baseOpts,
          parentId: epic.ipdId,
          desc: readDescription(story.readmePath),
        });
        console.log(`       ✅ 创建: ${story.name} → ID: ${storyResult.id}`);
        story.ipdId = storyResult.id;
        await sleep(300);
        allItems.push({ type: 'story', name: story.name, ipdId: storyResult.id, ipdUrl: storyResult.url, localPath: `${epic.dirName}/${story.dirName}`, parentId: epic.ipdId, estimatedDay: null });

        for (const tech of story.techs) {
          const techPath = path.join(storyPath, tech.dirName);
          console.log(`      📓 Tech-${tech.level}: ${tech.name}`);

          const estimatedDay = tech.estimatedDay || 1;

          const techResult = await ipdApi.createIssue('tech', tech.name, {
            ...baseOpts,
            parentId: story.ipdId,
            desc: readDescription(tech.readmePath),
            estimatedDay,
          });
          console.log(`         ✅ 创建: ${tech.name} → ID: ${techResult.id}（工作量: ${estimatedDay}天）`);
          tech.ipdId = techResult.id;
          await sleep(300);
          allItems.push({ type: 'tech', level: tech.level, name: tech.name, ipdId: techResult.id, ipdUrl: techResult.url, localPath: `${epic.dirName}/${story.dirName}/${tech.dirName}`, parentId: story.ipdId, estimatedDay });

          if (tech.subTechs) {
            for (const subTech of tech.subTechs) {
              console.log(`        🔧 Tech-服务级: ${subTech.name}`);

              const subEstimatedDay = subTech.estimatedDay || 1;

              const subTechResult = await ipdApi.createIssue('tech', subTech.fullName, {
                ...baseOpts,
                parentId: tech.ipdId,
                desc: readDescription(subTech.readmePath),
                estimatedDay: subEstimatedDay,
              });
              console.log(`           ✅ 创建: ${subTech.name} → ID: ${subTechResult.id}（工作量: ${subEstimatedDay}天）`);
              subTech.ipdId = subTechResult.id;
              await sleep(300);
              allItems.push({ type: 'tech', level: '服务级', name: subTech.name, ipdId: subTechResult.id, ipdUrl: subTechResult.url, localPath: `${epic.dirName}/${story.dirName}/${tech.dirName}/${subTech.dirName}`, parentId: tech.ipdId, estimatedDay: subEstimatedDay });
            }
          }
        }
      }
    } else if (epic.type === 'story') {
      for (const tech of epic.techs) {
        const techPath = path.join(epicPath, tech.dirName);
        console.log(`      📓 Tech-${tech.level}: ${tech.name}`);

        const estimatedDay = tech.estimatedDay || 1;

        const techResult = await ipdApi.createIssue('tech', tech.name, {
          ...baseOpts,
          parentId: epic.ipdId,
          desc: readDescription(tech.readmePath),
          estimatedDay,
        });
        console.log(`         ✅ 创建: ${tech.name} → ID: ${techResult.id}（工作量: ${estimatedDay}天）`);
        tech.ipdId = techResult.id;
        await sleep(300);
        allItems.push({ type: 'tech', level: tech.level, name: tech.name, ipdId: techResult.id, ipdUrl: techResult.url, localPath: `${epic.dirName}/${tech.dirName}`, parentId: epic.ipdId, estimatedDay });

        if (tech.subTechs) {
          for (const subTech of tech.subTechs) {
            console.log(`        🔧 Tech-服务级: ${subTech.name}`);

            const subEstimatedDay = subTech.estimatedDay || 1;

            const subTechResult = await ipdApi.createIssue('tech', subTech.fullName, {
              ...baseOpts,
              parentId: tech.ipdId,
              desc: readDescription(subTech.readmePath),
              estimatedDay: subEstimatedDay,
            });
            console.log(`           ✅ 创建: ${subTech.name} → ID: ${subTechResult.id}（工作量: ${subEstimatedDay}天）`);
            subTech.ipdId = subTechResult.id;
            await sleep(300);
            allItems.push({ type: 'tech', level: '服务级', name: subTech.name, ipdId: subTechResult.id, ipdUrl: subTechResult.url, localPath: `${epic.dirName}/${tech.dirName}/${subTech.dirName}`, parentId: tech.ipdId, estimatedDay: subEstimatedDay });
          }
        }
      }
    } else if (epic.type === 'tech' && epic.subTechs) {
      for (const subTech of epic.subTechs) {
        console.log(`        🔧 Tech-服务级: ${subTech.name}`);

        const subEstimatedDay = subTech.estimatedDay || 1;

        const subTechResult = await ipdApi.createIssue('tech', subTech.fullName, {
          ...baseOpts,
          parentId: epic.ipdId,
          desc: readDescription(subTech.readmePath),
          estimatedDay: subEstimatedDay,
        });
        console.log(`           ✅ 创建: ${subTech.name} → ID: ${subTechResult.id}（工作量: ${subEstimatedDay}天）`);
        subTech.ipdId = subTechResult.id;
        await sleep(300);
        allItems.push({ type: 'tech', level: '服务级', name: subTech.name, ipdId: subTechResult.id, ipdUrl: subTechResult.url, localPath: `${epic.dirName}/${subTech.dirName}`, parentId: epic.ipdId, estimatedDay: subEstimatedDay });
      }
    }
  }

  // 生成索引
  const finalYamlPath = yamlPath;
  console.log('\n📝 生成 YAML 索引文件...');
  const yamlContent = generateYamlIndex(allItems, { productId, projectId, versionId, teamId: teamVersionId });
  fs.writeFileSync(finalYamlPath, yamlContent, 'utf-8');
  console.log(`   ✅ ${finalYamlPath}`);

  // 统计工作量
  const totalWorkload = allItems.filter(i => i.type === 'tech').reduce((sum, i) => sum + (i.estimatedDay || 0), 0);
  console.log(`\n📊 工作量统计: ${totalWorkload} 人天`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 同步完成！共处理 ${allItems.length} 条需求`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { tree, items: allItems };
}

module.exports.syncToIpd = syncToIpd;

// ── CLI 入口 ────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (!options.docsRoot) {
    console.error('用法: node sync_from_docs.js <docsRoot> [--productId <id>] [--projectId <id>] [--versionId <id>] [--teamId <id>] [--indexFile <path>] [--dry-run]');
    process.exit(1);
  }

  if (options.dryRun) {
    syncToIpd(options).catch(err => {
      console.error('\n❌ 失败:', err.message);
      process.exit(1);
    });
    return;
  }

  // 加载 IPD API - 优先从同级目录加载
  const scriptDir = __dirname;
  let ipdApiPath = path.join(scriptDir, 'ipd_api.js');
  if (!fs.existsSync(ipdApiPath)) {
    // 回退到环境变量方式
    const skillsBase = process.env.SKILLS_BASE_DIR
      || (process.env.CLAUDE_CONFIG_DIR
        ? path.join(process.env.CLAUDE_CONFIG_DIR, 'skills')
        : path.join(os.homedir(), '.claude', 'skills'));
    ipdApiPath = path.join(skillsBase, 'ipd-sync/scripts/ipd_api.js');
  }

  try {
    const ipdApi = require(ipdApiPath);
    syncToIpd({ ...options, ipdApi }).catch(err => {
      console.error('\n❌ 失败:', err.message);
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ 无法加载 IPD API:', err.message);
    console.error('   尝试路径:', ipdApiPath);
    process.exit(1);
  }
}
