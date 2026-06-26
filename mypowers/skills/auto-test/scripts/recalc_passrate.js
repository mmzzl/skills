#!/usr/bin/env node
/**
 * Recalculate passRate for existing rounds in round_stats.json
 * based on passed/total values. Fixes rounds created before passRate was computed.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let taskDir = '';
for (let i = 0; i < args.length; i++) {
  if (!taskDir) taskDir = args[i];
}

if (!taskDir) {
  console.error('用法: node recalc_passrate.js <task_dir>');
  process.exit(1);
}

const td = path.join('.cospowers', 'auto-test', 'tasks', taskDir);
const roundStatsPath = path.join(td, 'round_stats.json');

if (!fs.existsSync(roundStatsPath)) {
  console.error(`round_stats.json 不存在: ${roundStatsPath}`);
  process.exit(1);
}

const rs = JSON.parse(fs.readFileSync(roundStatsPath, 'utf-8'));
let fixed = 0;
for (const r of rs.rounds) {
  if (r.total > 0 && (!r.passRate || r.passRate === 0)) {
    r.passRate = Math.round((r.passed / r.total) * 10000) / 100;
    fixed++;
    console.log(`  round ${r.round}: passRate recalculated = ${r.passRate}% (${r.passed}/${r.total})`);
  }
}

fs.writeFileSync(roundStatsPath, JSON.stringify(rs, null, 2) + '\n', 'utf-8');
console.log(`已修复 ${fixed} 个轮次的 passRate`);
