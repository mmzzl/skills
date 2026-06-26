#!/usr/bin/env node
'use strict';

/**
 * 交付物文件拆分脚本
 * 将合并后的 .md 文件按 <!-- split --> 分隔符拆分为独立章节文件。
 * 和 merge_deliverable.js 互为逆向。
 *
 * 用法:
 *   node split_deliverable.js <mergedFile> --output <dir> --files <f1,f2,...>
 */

const fs   = require('fs');
const path = require('path');

// ── 参数解析 ────────────────────────────────────────────────

function parseArgs(args) {
  const result = { mergedFile: null, output: null, files: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--files') {
      result.files = args[++i].split(',').map(f => f.trim());
    } else if (args[i] === '--output') {
      result.output = args[++i];
    } else if (!args[i].startsWith('-') && !result.mergedFile) {
      result.mergedFile = args[i];
    }
  }
  return result;
}

// ── 主逻辑 ──────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.mergedFile || !args.output || !args.files) {
    console.error('用法: node split_deliverable.js <mergedFile> --output <dir> --files <f1,f2,...>');
    process.exit(1);
  }

  const absFile = path.resolve(args.mergedFile);
  if (!fs.existsSync(absFile)) {
    console.error(`文件不存在: ${absFile}`);
    process.exit(1);
  }

  const absOutput = path.resolve(args.output);
  if (!fs.existsSync(absOutput)) {
    fs.mkdirSync(absOutput, { recursive: true });
  }

  const content = fs.readFileSync(absFile, 'utf8');

  // 按 <!-- split --> 分隔符拆分（和 merge 的拼接规则对应）
  const parts = content.split(/\n<!-- split -->\n\n?/);

  if (parts.length < args.files.length) {
    console.error(`警告: 拆分出 ${parts.length} 个部分，但指定了 ${args.files.length} 个文件。`);
    console.error('多余的文件名将被忽略。');
  }

  console.log(`\n📂 源文件: ${absFile}`);
  console.log(`📂 输出目录: ${absOutput}`);
  console.log(`   拆分 ${Math.min(parts.length, args.files.length)} 个文件:`);

  for (let i = 0; i < args.files.length; i++) {
    const filePath = path.join(absOutput, args.files[i]);
    let fileContent = (i < parts.length ? parts[i] : '').trim();

    // .yaml 文件：从代码块中提取原始内容（支持 ``` 和 ~~~ 两种围栏）
    if (/\.ya?ml$/i.test(args.files[i])) {
      const codeMatch = fileContent.match(/```ya?ml\n([\s\S]*?)```/) || fileContent.match(/~~~ya?ml\n([\s\S]*?)~~~/);
      if (codeMatch) {
        fileContent = codeMatch[1].trim();
      }
    }

    fs.writeFileSync(filePath, fileContent + '\n', 'utf8');
    const size = Buffer.byteLength(fileContent, 'utf8');
    console.log(`     ✓ ${args.files[i]} (${(size / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n✅ 拆分完成: ${absOutput}`);
  console.log(`   共 ${args.files.length} 个文件`);
}

main();
