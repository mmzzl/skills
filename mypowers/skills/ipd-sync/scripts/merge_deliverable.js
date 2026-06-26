#!/usr/bin/env node
'use strict';

/**
 * 交付物文件合并脚本
 * 将文件夹中的 .md 文件按章节顺序合并为单个交付物文件。
 * 筛选由 AI 负责（排除质量报告、索引等），本脚本只做拼接。
 *
 * 用法:
 *   node merge_deliverable.js <folder> --files <f1,f2,...> --output <path>
 */

const fs   = require('fs');
const path = require('path');

// ── 解析命令行参数 ────────────────────────────────────────────────
function parseArgs(args) {
  const result = { folder: null, files: null, output: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--files') {
      result.files = args[++i].split(',').map(f => f.trim());
    } else if (args[i] === '--output') {
      result.output = args[++i];
    } else if (!args[i].startsWith('-') && !result.folder) {
      result.folder = args[i];
    }
  }
  return result;
}

// ── 章节排序 ──────────────────────────────────────────────────────
const CHAPTER_ORDER = [
  'ch01', 'ch02', 'ch03', 'ch04', 'ch05', 'ch06',
  'ch07', 'ch08', 'ch09', 'ch10', 'ch11', 'ch12',
];

function chapterRank(filename) {
  // index.md 永远排在最前面
  if (/^index\.md$/i.test(filename)) return -1;
  const lower = filename.toLowerCase();
  for (let i = 0; i < CHAPTER_ORDER.length; i++) {
    if (lower.startsWith(CHAPTER_ORDER[i])) return i;
  }
  return CHAPTER_ORDER.length;
}

// ── 主逻辑 ────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.folder || !args.files || !args.output) {
    console.error('用法: node merge_deliverable.js <folder> --files <f1,f2,...> --output <path>');
    process.exit(1);
  }

  const absFolder = path.resolve(args.folder);
  if (!fs.existsSync(absFolder) || !fs.statSync(absFolder).isDirectory()) {
    console.error(`文件夹不存在: ${absFolder}`);
    process.exit(1);
  }

  // 验证文件存在
  const missing = args.files.filter(f => !fs.existsSync(path.join(absFolder, f)));
  if (missing.length) {
    console.error(`以下文件不存在: ${missing.join(', ')}`);
    process.exit(1);
  }

  // 按章节排序
  const sorted = [...args.files].sort((a, b) => chapterRank(a) - chapterRank(b));

  console.log(`\n📂 ${absFolder}`);
  console.log(`   合并 ${sorted.length} 个文件:`);
  for (const f of sorted) {
    console.log(`     ✓ ${f}`);
  }

  // 合并（第一个文件不加分隔符）
  const SPLIT = '\n<!-- split -->\n';
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    const filename = sorted[i];
    let content = fs.readFileSync(path.join(absFolder, filename), 'utf8');
    const isYaml = /\.ya?ml$/i.test(filename);

    // .yaml 文件：加标题 + 波浪线代码块包裹（避免和 YAML --- 及反引号冲突）
    if (isYaml) {
      content = `## ${filename}\n\n~~~yaml\n${content}\n~~~\n`;
    }

    if (i === 0) {
      parts.push(`${content}\n`);
    } else {
      parts.push(`${SPLIT}\n${content}\n`);
    }
  }
  const merged = parts.join('');

  const outPath = path.resolve(args.output);
  fs.writeFileSync(outPath, merged, 'utf8');

  console.log(`\n✅ 合并完成: ${outPath}`);
  console.log(`   总行数: ${merged.split('\n').length}`);
  console.log(`   总大小: ${(Buffer.byteLength(merged, 'utf8') / 1024).toFixed(1)} KB`);
}

main();
