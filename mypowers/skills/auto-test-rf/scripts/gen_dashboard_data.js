#!/usr/bin/env node
/**
 * Generate dashboard_data.json from case_status.json for Robot Framework test runs.
 *
 * Usage:
 *   node gen_dashboard_data.js <task_dir>                     # Round 1: create new file
 *   node gen_dashboard_data.js <task_dir> --name "Task Name"   # Custom task name
 *   node gen_dashboard_data.js <task_dir> --max-rounds 3       # Set max rounds (default 3)
 *   node gen_dashboard_data.js <task_dir> --target-rate 90     # Set target pass rate (default 95)
 *   node gen_dashboard_data.js <task_dir> --round 2            # Round N>1: append to existing
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// Args
// ============================================================
function parseArgs(argv) {
  const args = { taskDir: null, taskName: null, maxRounds: 3, targetRate: 95, round: 1 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--name' && i + 1 < argv.length) {
      args.taskName = argv[++i];
    } else if (argv[i] === '--max-rounds' && i + 1 < argv.length) {
      args.maxRounds = parseInt(argv[++i], 10) || 3;
    } else if (argv[i] === '--target-rate' && i + 1 < argv.length) {
      args.targetRate = parseFloat(argv[++i]) || 95;
    } else if (argv[i] === '--round' && i + 1 < argv.length) {
      args.round = parseInt(argv[++i], 10) || 1;
    } else if (!args.taskDir) {
      args.taskDir = argv[i];
    }
  }
  return args;
}

// ============================================================
// Main
// ============================================================
function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.taskDir) {
    console.error(`Usage: node gen_dashboard_data.js <task_dir> [options]

Options:
  --name <name>         Custom task name (default: task_dir)
  --max-rounds <n>      Max retry rounds (default: 3)
  --target-rate <n>     Target pass rate percentage (default: 95)
  --round <n>           Round number (default: 1, >1 appends to existing)`);
    process.exit(1);
  }

  const taskDir = args.taskDir;
  const outDir = path.join('.cospowers', 'auto-test', 'tasks', taskDir);
  const caseStatusPath = path.join(outDir, 'case_status.json');

  if (!fs.existsSync(caseStatusPath)) {
    console.error(`Error: case_status.json not found at ${caseStatusPath}`);
    process.exit(1);
  }

  const cs = JSON.parse(fs.readFileSync(caseStatusPath, 'utf-8'));

  const now = cs.executed_at || new Date().toISOString().replace('T', ' ').substring(0, 19);
  const total = cs.total;
  const passed = cs.passed;
  const failed = cs.failed;
  const passRate = cs.passRate;

  const statusMap = { PASS: 'passed', FAIL: 'failed', SKIP: 'skipped' };

  if (args.round > 1) {
    // ── 追加模式：读取已有 dashboard_data.json，追加本轮数据 ──
    const existingPath = path.join(outDir, 'dashboard_data.json');
    if (!fs.existsSync(existingPath)) {
      console.error(`Error: dashboard_data.json not found for round ${args.round}. Run round 1 first.`);
      process.exit(1);
    }

    const dashboard = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));

    // 轮次连续性校验：round 必须等于已有 rounds 数 + 1
    const expectedRound = dashboard.rounds.length + 1;
    if (args.round !== expectedRound) {
      console.error(`轮次不连续: 期望 round ${expectedRound}，但传入 round ${args.round}。已有轮次: [${dashboard.rounds.map(r => r.round).join(', ')}]`);
    }

    // 追加本轮到 rounds[]
    dashboard.rounds.push({
      round: args.round,
      startTime: now,
      endTime: now,
      totalCases: total,
      passed,
      failed,
      skipped: cs.skipped || 0,
      fixes: [],
    });

    // 更新 cases[] 的 history 和 finalStatus
    const existingCaseMap = {};
    for (const c of dashboard.cases) {
      existingCaseMap[c.id] = c;
    }

    for (const c of (cs.cases || [])) {
      const finalStatus = statusMap[c.status] || 'passed';
      if (existingCaseMap[c.id]) {
        // 已有用例：追加 history，更新 finalStatus
        existingCaseMap[c.id].history.push({
          round: args.round,
          status: finalStatus,
          error: finalStatus === 'failed' ? (c.message || '') : null,
          duration: c.elapsed || 0,
        });
        existingCaseMap[c.id].finalStatus = finalStatus;
        // 如果本轮通过了但之前失败，标记修复轮次
        if (finalStatus === 'passed' && existingCaseMap[c.id].firstFailRound != null && !existingCaseMap[c.id].fixedInRound) {
          existingCaseMap[c.id].fixedInRound = args.round;
          existingCaseMap[c.id].fixType = 'code';
        }
      } else {
        // 新用例（本轮新增）
        dashboard.cases.push({
          id: c.id,
          name: c.name,
          module: c.suite || '',
          finalStatus,
          firstFailRound: finalStatus === 'failed' ? args.round : null,
          fixedInRound: null,
          fixType: null,
          history: [{
            round: args.round,
            status: finalStatus,
            error: finalStatus === 'failed' ? (c.message || '') : null,
            duration: c.elapsed || 0,
          }],
          fixes: [],
        });
      }
    }

    // 更新 summary
    dashboard.summary.totalRounds = dashboard.rounds.length;
    dashboard.summary.finalPassRate = passRate;
    dashboard.summary.fixedCases = dashboard.cases.filter(c => c.fixedInRound != null).length;
    dashboard.status = failed > 0 ? 'failed' : 'completed';
    dashboard.endTime = now;

    fs.writeFileSync(existingPath, JSON.stringify(dashboard, null, 2), 'utf-8');
    console.log(`dashboard_data.json updated: round ${args.round}, ${total} total, ${passed} passed, ${failed} failed`);

  } else {
    // ── 创建模式：Round 1，创建新文件 ──
    const cases = (cs.cases || []).map((c) => {
      const finalStatus = statusMap[c.status] || 'passed';
      return {
        id: c.id,
        name: c.name,
        module: c.suite || '',
        finalStatus,
        firstFailRound: finalStatus === 'failed' ? 1 : null,
        fixedInRound: null,
        fixType: null,
        history: [{
          round: 1,
          status: finalStatus,
          error: finalStatus === 'failed' ? (c.message || '') : null,
          duration: c.elapsed || 0,
        }],
        fixes: [],
      };
    });

    const dashboard = {
      taskId: taskDir,
      taskName: args.taskName || taskDir,
      framework: 'rf',
      status: failed > 0 ? 'failed' : 'completed',
      startTime: now,
      endTime: now,
      config: {
        maxRounds: args.maxRounds,
        targetSuccessRate: args.targetRate,
        framework_specific: {
          rf: { testPlatform: 'Robot Framework' }
        }
      },
      summary: {
        totalRounds: 1,
        totalCases: total,
        initialPassRate: passRate,
        finalPassRate: passRate,
        fixedCases: 0,
        codeChanges: 0,
      },
      rounds: [{
        round: 1,
        startTime: now,
        endTime: now,
        totalCases: total,
        passed,
        failed,
        skipped: cs.skipped || 0,
        fixes: [],
      }],
      cases,
    };

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = path.join(outDir, 'dashboard_data.json');
    fs.writeFileSync(outPath, JSON.stringify(dashboard, null, 2), 'utf-8');

    console.log(`dashboard_data.json generated: ${total} total, ${passed} passed, ${failed} failed`);
  }
}

main();
