#!/usr/bin/env node
'use strict';

/**
 * 获取失败用例的详细执行步骤
 *
 * 用法:
 *   # 获取所有失败用例详情
 *   node fetch_failed_details.js <task-dir>
 *
 *   # 按 case_code 筛选（支持多个，逗号分隔）
 *   node fetch_failed_details.js <task-dir> --case-code tc_LongTemplate_FUNC_001
 *   node fetch_failed_details.js <task-dir> --case-code tc_FUNC_001,tc_FUNC_002
 *
 *   # 按 case_id 筛选（支持多个，逗号分隔）
 *   node fetch_failed_details.js <task-dir> --case-ids 167540,167541
 *
 *   # 获取所有用例（不限于失败），加 --all
 *   node fetch_failed_details.js <task-dir> --all
 *   node fetch_failed_details.js <task-dir> --all --case-code tc_FUNC_004
 *
 * 输入: task_dir 下的 case_status.json + task_config.yaml
 * 输出: JSON 到 stdout，进度信息到 stderr
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 复用 qianliu-aitest 的 TP API
const QIANLIU_SKILL_DIR = path.resolve(__dirname, '../../qianliu-aitest');
const { getTaskDetail } = require(path.join(QIANLIU_SKILL_DIR, 'scripts/remote_api/tp_platform'));
const yaml = require(path.join(QIANLIU_SKILL_DIR, 'scripts/vendor/js-yaml'));

function loadGlobalToken() {
  const configPath = path.join(os.homedir(), '.qianliu', 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('未找到全局配置 ~/.qianliu/config.json');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = config && config.tp && config.tp.token;
  if (!token) throw new Error('全局配置中未找到 tp.token');
  return token;
}

function loadTaskConfig(taskDir) {
  const configPath = path.join(taskDir, 'task_config.yaml');
  if (!fs.existsSync(configPath)) {
    throw new Error(`未找到任务配置: ${configPath}`);
  }
  const raw = yaml.load(fs.readFileSync(configPath, 'utf8'));
  // task_config.yaml 结构: { task_info: {...}, tp_platform_config: {...} }
  const tpConfig = raw.tp_platform_config || {};
  const taskInfo = raw.task_info || {};
  return {
    project_id: tpConfig.project_id,
    version_id: tpConfig.version_id,
    ai_testcase_task_id: tpConfig.ai_testcase_task_id,
    agent_version: tpConfig.agent_version || 'v1',
    tp_token: tpConfig.tp_token,
    env: tpConfig.env || taskInfo.run_env || 'prod',
    report_id: taskInfo.report_id,
    testbed_name: tpConfig.testbed_name,
  };
}

function loadCaseStatus(taskDir) {
  const statusPath = path.join(taskDir, 'case_status.json');
  if (!fs.existsSync(statusPath)) {
    throw new Error(`未找到用例状态文件: ${statusPath}，请先完成 --poll`);
  }
  return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
}

function parseArg(args, flag) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error([
      '用法: node fetch_failed_details.js <task-dir> [options]',
      '',
      '选项:',
      '  --case-code <code,...>  按用例编号筛选（如 tc_FUNC_001,tc_FUNC_002）',
      '  --case-ids <id,...>     按 case_id 筛选（如 167540,167541）',
      '  --all                   获取所有用例（默认仅失败用例）',
    ].join('\n'));
    process.exit(1);
  }

  const taskDir = path.resolve(args[0]);
  const includeAll = args.includes('--all');

  // 解析 --case-code
  const caseCodeRaw = parseArg(args, '--case-code');
  const filterCaseCodes = caseCodeRaw
    ? new Set(caseCodeRaw.split(',').map(s => s.trim()).filter(Boolean))
    : null;

  // 解析 --case-ids
  const caseIdsRaw = parseArg(args, '--case-ids');
  const filterCaseIds = caseIdsRaw
    ? new Set(caseIdsRaw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n)))
    : null;

  const taskConfig = loadTaskConfig(taskDir);
  const caseStatus = loadCaseStatus(taskDir);

  const token = taskConfig.tp_token || loadGlobalToken();
  const env = taskConfig.env || 'prod';
  const projectId = taskConfig.project_id;
  const versionId = taskConfig.version_id;
  const agentVersion = taskConfig.agent_version || 'v1';

  // 筛选用例
  let targetCases = includeAll
    ? caseStatus.cases
    : caseStatus.cases.filter(c => c.status === 3);

  if (filterCaseCodes) {
    targetCases = targetCases.filter(c => filterCaseCodes.has(c.case_code));
  }
  if (filterCaseIds) {
    targetCases = targetCases.filter(c => filterCaseIds.has(c.case_id));
  }

  if (targetCases.length === 0) {
    const output = { task_dir: taskDir, report_id: caseStatus.report_id, count: 0, details: [] };
    console.log(JSON.stringify(output, null, 2));
    console.error('未找到匹配的用例。');
    return;
  }

  console.error(`正在获取 ${targetCases.length} 个用例的详细步骤...`);

  const details = [];
  for (const tc of targetCases) {
    try {
      console.error(`  获取 ${tc.case_code || tc.case_name} (case_id=${tc.case_id}, task_id=${tc.task_id})...`);
      const detail = await getTaskDetail(env, tc.case_id, tc.task_id, projectId, versionId, token, agentVersion, true);
      // 补充 case_status.json 中的信息（API 可能返回 N/A）
      if (!detail.caseCode && tc.case_code) detail.caseCode = tc.case_code;
      if ((!detail.caseName || detail.caseName === 'N/A') && tc.case_name) detail.caseName = tc.case_name;
      detail.statusInReport = tc.status;
      detail.statusName = tc.status_name;
      detail.detailUrl = tc.detail_url;
      details.push(detail);
    } catch (e) {
      details.push({
        caseId: tc.case_id,
        taskId: tc.task_id,
        caseCode: tc.case_code,
        caseName: tc.case_name,
        statusInReport: tc.status,
        statusName: tc.status_name,
        detailUrl: tc.detail_url,
        caseStatus: '获取失败',
        error: String(e)
      });
    }
  }

  const output = {
    task_dir: taskDir,
    report_id: caseStatus.report_id,
    env,
    project_id: projectId,
    version_id: versionId,
    count: details.length,
    details
  };

  console.log(JSON.stringify(output, null, 2));
  console.error(`完成，共获取 ${details.length} 个用例详情。`);
}

main().catch(e => {
  console.error(`错误: ${e.message}`);
  process.exit(1);
});
