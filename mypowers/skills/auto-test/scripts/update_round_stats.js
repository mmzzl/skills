#!/usr/bin/env node
/**
 * update_round_stats.js — 更新每轮统计数据
 *
 * 用法:
 *   node update_round_stats.js <task_dir> --round <N>
 *     从 case_status.json 追加轮次通过/失败数据
 *
 *   node update_round_stats.js <task_dir> --round <N> --update-classification
 *     从 analysis/summary.md 解析 ABCD 分类计数，补充到当前轮次
 */

const fs = require('fs');
const path = require('path');

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
let taskDir = '';
let round = 0;
let updateClassification = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--round' && i + 1 < args.length) {
    round = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--update-classification') {
    updateClassification = true;
  } else if (!taskDir) {
    taskDir = args[i];
  }
}

if (!taskDir || round < 1) {
  console.error('用法: node update_round_stats.js <task_dir> --round <N> [--update-classification]');
  process.exit(1);
}

const td = path.join('.cospowers', 'auto-test', 'tasks', taskDir);
const roundStatsPath = path.join(td, 'round_stats.json');

// ── 读取或初始化 round_stats.json ────────────────────────
let roundStats;
if (fs.existsSync(roundStatsPath)) {
  roundStats = JSON.parse(fs.readFileSync(roundStatsPath, 'utf-8'));
} else {
  // 读取 framework
  const taskConfigPath = path.join(td, 'task_config.yaml');
  let framework = 'rf';
  if (fs.existsSync(taskConfigPath)) {
    const config = fs.readFileSync(taskConfigPath, 'utf-8');
    const m = config.match(/^framework:\s*(\S+)/m);
    if (m) framework = m[1];
  }
  roundStats = { task_dir: taskDir, framework, rounds: [] };
}

// ── 查找或创建当前轮次 ─────────────────────────────────
let roundEntry = roundStats.rounds.find(r => r.round === round);

if (!updateClassification) {
  // 轮次连续性校验：round 必须等于已有轮次数 + 1
  const expectedRound = roundStats.rounds.length + 1;
  if (round !== expectedRound) {
    console.error(`轮次不连续: 期望 round ${expectedRound}，但传入 round ${round}。已有轮次: [${roundStats.rounds.map(r => r.round).join(', ')}]`);
  }

  // 从 case_status.json 追加轮次数据
  const caseStatusPath = path.join(td, 'case_status.json');
  if (!fs.existsSync(caseStatusPath)) {
    console.error(`case_status.json 不存在: ${caseStatusPath}`);
    process.exit(1);
  }

  const cs = JSON.parse(fs.readFileSync(caseStatusPath, 'utf-8'));

  // 计算通过率：优先使用 case_status 中的 passRate；缺失则根据 passed/total 计算
  const total = cs.total || 0;
  const passed = cs.passed || 0;
  const failed = cs.failed || 0;
  const skipped = cs.skipped || 0;
  const passRate = (typeof cs.passRate === 'number' && cs.passRate > 0)
    ? cs.passRate
    : (total > 0 ? Math.round((passed / total) * 10000) / 100 : 0);

  roundEntry = {
    round,
    executed_at: cs.executed_at || new Date().toISOString().replace('T', ' ').substring(0, 19),
    total,
    passed,
    failed,
    skipped,
    passRate,
    classification: { A: 0, B: 0, C: 0, D: 0 },
    fixed: 0,
    fixes: []
  };

  roundStats.rounds.push(roundEntry);
} else {
  // 从 analysis/summary.md 补充分类数据
  if (!roundEntry) {
    console.error(`round_stats.json 中未找到 round ${round}，请先执行不带 --update-classification 的更新`);
    process.exit(1);
  }

  const summaryPath = path.join(td, 'analysis', 'summary.md');
  if (!fs.existsSync(summaryPath)) {
    console.error(`analysis/summary.md 不存在: ${summaryPath}`);
    process.exit(1);
  }

  const summary = fs.readFileSync(summaryPath, 'utf-8');
  roundEntry.classification = parseClassification(summary);

  // 从 code_fixes.md 读取修复数据
  const codeFixesPath = path.join(td, 'analysis', 'code_fixes.md');
  if (fs.existsSync(codeFixesPath)) {
    const fixes = fs.readFileSync(codeFixesPath, 'utf-8');
    const fixCount = (fixes.match(/^## 修复 \d+:/gm) || []).length;
    roundEntry.fixed = fixCount;
  }
}

// ── 写入 ─────────────────────────────────────────────────
fs.writeFileSync(roundStatsPath, JSON.stringify(roundStats, null, 2) + '\n', 'utf-8');
console.log(`round_stats.json 已更新: round ${round}, classification=${updateClassification ? 'yes' : 'no'}`);

// ── 解析 summary.md 中的分类计数 ──────────────────────────
function parseClassification(summary) {
  const classification = { A: 0, B: 0, C: 0, D: 0 };

  // 匹配 "按分类统计" 表格中的计数
  // 兼容格式：
  //   | A类—用例编写错误 | N | ... |     (规范格式)
  //   | A 类（用例...） | N | ... |        (带空格 + 括号)
  //   | A类（用例...） | N | ... |         (括号)
  // 关键点：A类 / A 类 / A类—xxx 都匹配，字母与"类"之间允许 0 或 1 个空格
  const lines = summary.split('\n');
  const patterns = {
    A: /\|\s*A\s*类[^|]*\|\s*(\d+)\s*\|/,
    B: /\|\s*B\s*类[^|]*\|\s*(\d+)\s*\|/,
    C: /\|\s*C\s*类[^|]*\|\s*(\d+)\s*\|/,
    D: /\|\s*D\s*类[^|]*\|\s*(\d+)\s*\|/,
  };

  for (const line of lines) {
    for (const key of ['A', 'B', 'C', 'D']) {
      const m = line.match(patterns[key]);
      if (m) classification[key] = parseInt(m[1], 10);
    }
  }

  return classification;
}
