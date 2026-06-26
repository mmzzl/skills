#!/usr/bin/env node
/**
 * generate_dashboard.js — 合并多轮测试数据并生成 Dashboard HTML
 *
 * 用法: node skills/auto-test/scripts/generate_dashboard.js --task-dir <task_dir>
 *
 * 执行两个步骤:
 *   1. 多轮数据合并: 扫描 round_*_data.json，合并到 dashboard_data.json
 *   2. Dashboard 生成: 读取 dashboard_data.json + case_status.json，注入模板生成 dashboard.html
 */

const fs = require('fs');
const path = require('path');

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2);
let taskDir = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--task-dir' && i + 1 < args.length) {
    taskDir = args[i + 1];
    i++;
  }
}

if (!taskDir) {
  console.error('用法: node generate_dashboard.js --task-dir <task_dir>');
  process.exit(1);
}

const projectRoot = process.cwd();
const td = path.join(projectRoot, '.cospowers', 'auto-test', 'tasks', taskDir);
const templatePath = path.join(projectRoot, 'skills', 'auto-test', 'auto-test-dashboard.html');

// ── 步骤 1: 多轮数据合并 ─────────────────────────────────
const dashboardDataPath = path.join(td, 'dashboard_data.json');

if (!fs.existsSync(dashboardDataPath)) {
  console.error(`dashboard_data.json 不存在: ${dashboardDataPath}`);
  process.exit(1);
}

const dd = JSON.parse(fs.readFileSync(dashboardDataPath, 'utf-8'));

// 优先从 round_stats.json 补充 ABCD 分类数据
const roundStatsPath = path.join(td, 'round_stats.json');
if (fs.existsSync(roundStatsPath)) {
  const rs = JSON.parse(fs.readFileSync(roundStatsPath, 'utf-8'));
  const statsMap = {};
  for (const r of rs.rounds || []) {
    statsMap[r.round] = r;
  }

  // 将 ABCD 分类数据写入对应 rounds[] 条目
  for (const round of dd.rounds) {
    const stats = statsMap[round.round];
    if (stats && stats.classification) {
      round.classification = stats.classification;
    }
  }

  // 如果 round_stats.json 的轮次比 dashboard_data.json 多，补充缺失轮次
  if (rs.rounds.length > dd.rounds.length) {
    for (const stats of rs.rounds) {
      if (!dd.rounds.find(r => r.round === stats.round)) {
        dd.rounds.push({
          round: stats.round,
          startTime: stats.executed_at,
          endTime: stats.executed_at,
          totalCases: stats.total,
          passed: stats.passed,
          failed: stats.failed,
          skipped: stats.skipped,
          classification: stats.classification,
          fixes: stats.fixes || [],
        });
      }
    }
    // 按 round 排序
    dd.rounds.sort((a, b) => a.round - b.round);
  }

  // 更新 summary
  dd.summary.totalRounds = dd.rounds.length;
  // 按 executed_at / startTime 排序，确保 lastRound 是真正最后执行的轮次
  // （不能按 round 编号排序，因为用户可能跳过 round 编号，例如 [1, 10, 4] 中 4 是最新的）
  dd.rounds.sort((a, b) => {
    const ta = new Date(a.startTime || a.executed_at || a.endTime || 0).getTime();
    const tb = new Date(b.startTime || b.executed_at || b.endTime || 0).getTime();
    if (ta !== tb) return ta - tb;
    return a.round - b.round;
  });
  const lastRound = dd.rounds[dd.rounds.length - 1];
  const firstRound = dd.rounds[0];
  dd.summary.finalPassRate = lastRound.totalCases > 0
    ? Math.round((lastRound.passed / lastRound.totalCases) * 100 * 100) / 100
    : 0;
  dd.summary.initialPassRate = firstRound.totalCases > 0
    ? Math.round((firstRound.passed / firstRound.totalCases) * 100 * 100) / 100
    : 0;
  dd.summary.fixedCases = dd.cases
    ? dd.cases.filter(c => c.fixedInRound != null).length
    : 0;
  dd.endTime = lastRound.endTime || dd.endTime;
  dd.status = lastRound.failed === 0 ? 'completed' : 'failed';

  // 构建 analysis 对象供 Dashboard 使用
  // 使用最后一轮的分类数据（而非跨轮次求和）— 因为不同轮次的失败用例可能重叠，求和无意义
  const lastStats = dd.rounds[dd.rounds.length - 1];
  const lastCls = lastStats.classification || { A: 0, B: 0, C: 0, D: 0 };
  dd.analysis = {
    totalFailed: (lastCls.A || 0) + (lastCls.B || 0) + (lastCls.C || 0) + (lastCls.D || 0),
    categoryA: lastCls.A || 0,
    categoryB: lastCls.B || 0,
    categoryC: lastCls.C || 0,
    categoryD: lastCls.D || 0,
    details: []
  };

  fs.writeFileSync(dashboardDataPath, JSON.stringify(dd, null, 2), 'utf-8');
  console.log(`从 round_stats.json 补充分类数据: ${rs.rounds.length} 轮`);
} else {
  // 降级：扫描 round_*_data.json 合并（旧逻辑）
  const allRounds = [];
  const files = fs.readdirSync(td).sort();
  for (const fname of files) {
    if (fname.startsWith('round_') && fname.endsWith('_data.json')) {
      const rd = JSON.parse(fs.readFileSync(path.join(td, fname), 'utf-8'));
      allRounds.push(rd);
    }
  }

  if (allRounds.length > 1) {
    dd.rounds = allRounds;
    dd.summary.totalRounds = allRounds.length;
    const last = allRounds[allRounds.length - 1];
    dd.summary.finalPassRate = last.totalCases > 0
      ? Math.round((last.passed / last.totalCases) * 100 * 100) / 100
      : 0;
    dd.summary.fixedCases = allRounds[0].failed - last.failed;
    dd.endTime = last.endTime || dd.endTime;
    dd.status = last.failed === 0 ? 'completed' : 'failed';
  }

  fs.writeFileSync(dashboardDataPath, JSON.stringify(dd, null, 2), 'utf-8');
  console.log(`多轮数据已合并: ${allRounds.length} 轮 (降级模式)`);
}

// ── 步骤 2: Dashboard 生成 ────────────────────────────────
if (!fs.existsSync(templatePath)) {
  console.error(`模板文件不存在: ${templatePath}`);
  process.exit(1);
}

const template = fs.readFileSync(templatePath, 'utf-8');

// 重新读取合并后的数据（步骤 1 可能已更新）
const data = JSON.parse(fs.readFileSync(dashboardDataPath, 'utf-8'));

// 合并 case_status.json 中的用例数据（仅当 cases 字段缺失或为空时）
if (!data.cases || data.cases.length === 0) {
  const caseStatusPath = path.join(td, 'case_status.json');
  if (fs.existsSync(caseStatusPath)) {
    const caseStatus = JSON.parse(fs.readFileSync(caseStatusPath, 'utf-8'));
    data.cases = caseStatus.cases || [];
  }
}

// 注入数据到模板
const html = template.replace('__DASHBOARD_DATA__', JSON.stringify(data));
const dashboardPath = path.join(td, 'dashboard.html');
fs.writeFileSync(dashboardPath, html, 'utf-8');
console.log(`Dashboard 已生成: ${dashboardPath}`);
