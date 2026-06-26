#!/usr/bin/env node
'use strict';

/**
 * 远端TP平台测试计划调度执行脚本
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const yaml = require('./vendor/js-yaml');

const {
  getRealtimeTaskReport,
  getTaskData,
  getTaskProgress,
  getTestbedByName,
  createBuild,
  interruptBuild,
  retryBuild
} = require('./remote_api/tp_platform');


// ============================================================================
// Constants
// ============================================================================

const TP_BASE_URLS = {
  prod: 'https://tp.sangfor.com',
  test: 'http://10.61.67.105:31031'
};


// ============================================================================
// URL Building
// ============================================================================

function getBaseUrl(env) {
  return TP_BASE_URLS[env] || TP_BASE_URLS.prod;
}

function detectEnvFromBaseUrl(baseUrl) {
  if (!baseUrl) return null;
  const normalized = baseUrl.replace(/\/$/, '');
  const found = Object.entries(TP_BASE_URLS).find(([, url]) => url === normalized);
  return found ? found[0] : null;
}

function buildReportUrl(baseUrl, reportId, projectId, versionId, agentVersion) {
  let url = `${baseUrl}/PlanHome/AIBuildDetail/${reportId}?productId=${projectId || ''}&projectId=${versionId || ''}`;
  if (agentVersion) url += `&agentVersion=${agentVersion}`;
  return url;
}

function buildAiTestcaseUrl(baseUrl, aiTestcaseTaskId, projectId, versionId, agentVersion) {
  let url = `${baseUrl}/PlanHome/${aiTestcaseTaskId || ''}?productId=${projectId || ''}&projectId=${versionId || ''}`;
  if (agentVersion) url += `&agentVersion=${agentVersion}`;
  return url;
}


// ============================================================================
// Date Formatting
// ============================================================================

function _formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function _formatTime(date) {
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}${min}${ss}`;
}

function _formatDateTime(date) {
  return `${_formatDate(date)}_${_formatTime(date)}`;
}

function _formatDateTimeReadable(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

function _formatNowBuild() {
  const now = new Date();
  return `${_formatDate(now)}-${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}


// ============================================================================
// Workspace Management
// ============================================================================

function getWorkspaceDir(configPath) {
  if (configPath) {
    return path.resolve(path.dirname(configPath));
  }
  return path.join(process.cwd(), '.qianliu', '.qianliu-aitest');
}

function generateTaskMd5(aiTestcaseTaskId, testbedId, execHostName, env, projectId, versionId) {
  const content = `${aiTestcaseTaskId}|${testbedId}|${execHostName}|${env}|${projectId}|${versionId}`;
  return crypto.createHash('md5').update(content, 'utf8').digest('hex').slice(0, 6);
}

function generateTaskId(aiTestcaseTaskId, testbedId, execHostName, env, projectId, versionId) {
  const md5Hash = generateTaskMd5(aiTestcaseTaskId, testbedId, execHostName, env, projectId, versionId);
  const timestamp = _formatDateTime(new Date());
  return `task_${timestamp}_${md5Hash}`;
}

function getTaskDir(workspaceDir, taskId) {
  let taskDirPath;
  if (taskId) {
    taskDirPath = path.join(workspaceDir, 'tp_tasks', taskId);
  } else {
    const timestamp = _formatDateTime(new Date());
    taskDirPath = path.join(workspaceDir, 'tp_tasks', `task_${timestamp}`);
  }
  fs.mkdirSync(taskDirPath, { recursive: true });
  return taskDirPath;
}

function getTaskDirByConfig(workspaceDir, config) {
  const taskId = generateTaskId(
    config.ai_testcase_task_id,
    config.testbed_id,
    config.exec_host_name || '',
    config.env || 'prod',
    config.project_id,
    config.version_id
  );
  const taskDirPath = path.join(workspaceDir, 'tp_tasks', taskId);
  fs.mkdirSync(taskDirPath, { recursive: true });
  return taskDirPath;
}

async function findRunningTask(workspaceDir, config) {
  const tasksDir = path.join(workspaceDir, 'tp_tasks');
  if (!fs.existsSync(tasksDir)) return null;

  const currentMd5 = generateTaskMd5(
    config.ai_testcase_task_id,
    config.testbed_id,
    config.exec_host_name || '',
    config.env || 'prod',
    config.project_id,
    config.version_id
  );

  let entries;
  try {
    entries = fs.readdirSync(tasksDir);
  } catch (_) {
    return null;
  }

  for (const entry of entries) {
    const taskDirPath = path.join(tasksDir, entry);
    try {
      const stat = fs.statSync(taskDirPath);
      if (!stat.isDirectory()) continue;
    } catch (_) {
      continue;
    }

    if (!entry.endsWith(`_${currentMd5}`)) continue;

    const configFile = path.join(taskDirPath, 'task_config.yaml');
    if (!fs.existsSync(configFile)) continue;

    try {
      const taskConfig = yaml.load(fs.readFileSync(configFile, 'utf8'));
      const taskInfo = (taskConfig && taskConfig.task_info) || {};
      const status = taskInfo.status || '';
      const tpConfig = (taskConfig && taskConfig.tp_platform_config) || {};

      if (status === 'running') {
        // 验证远程任务是否真的在运行
        try {
          const env = taskInfo.run_env || 'prod';
          const progress = await getTaskProgress(
            env,
            taskInfo.report_id,
            1000,
            tpConfig.project_id,
            tpConfig.version_id,
            tpConfig.tp_token,
            tpConfig.agent_version
          );

          // 如果远程任务没有进行中的任务，说明已结束，不复用
          // 同时更新本地状态以保持一致性
          if (progress.unfinished === 0) {
            const actualStatus = progress.terminated > 0 ? 'terminated'
              : progress.failed > 0 ? 'failed'
              : 'done';
            updateTaskStatus(configFile, actualStatus);
            continue;
          }
        } catch (e) {
          // API 调用失败，可能是网络问题或任务不存在，不复用
          continue;
        }

        return {
          taskDir: taskDirPath,
          reportId: taskInfo.report_id,
          taskConfig
        };
      }
    } catch (_) {
      continue;
    }
  }

  return null;
}

function updateTaskStatus(configFile, status, extraFields) {
  const taskConfig = yaml.load(fs.readFileSync(configFile, 'utf8')) || {};
  if (!taskConfig.task_info) taskConfig.task_info = {};
  taskConfig.task_info.status = status;

  if (extraFields) {
    Object.assign(taskConfig.task_info, extraFields);
  }

  // 重排 task_info 字段顺序
  const old = taskConfig.task_info;
  const ordered = {};
  if ('report_id' in old) ordered.report_id = old.report_id;
  for (const k of ['e2e_report_url', 'ai_testcase_url']) {
    if (k in old) ordered[k] = old[k];
  }
  if ('test_report_path' in old) ordered.test_report_path = old.test_report_path;
  if ('case_status_path' in old) ordered.case_status_path = old.case_status_path;
  ordered.status = old.status;
  if ('run_env' in old) ordered.run_env = old.run_env;
  if ('created_at' in old) ordered.created_at = old.created_at;
  for (const [k, v] of Object.entries(old)) {
    if (!(k in ordered)) ordered[k] = v;
  }
  taskConfig.task_info = ordered;

  fs.writeFileSync(configFile, yaml.dump(taskConfig, { lineWidth: -1 }), 'utf8');
}

function saveTaskConfig(configFile, config, reportId, env, status) {
  const baseUrl = getBaseUrl(env || 'prod');
  const projectId = config.project_id;
  const versionId = config.version_id;
  const aiTestcaseTaskId = config.ai_testcase_task_id;
  const agentVersion = config.agent_version || null;

  const e2eReportUrl = buildReportUrl(baseUrl, reportId, projectId, versionId, agentVersion);
  const aiTestcaseUrl = buildAiTestcaseUrl(baseUrl, aiTestcaseTaskId, projectId, versionId, agentVersion);

  const tpPlatformConfig = Object.assign({}, config, { tp_base_url: baseUrl });

  const taskInfo = {
    report_id: reportId,
    e2e_report_url: e2eReportUrl,
    ai_testcase_url: aiTestcaseUrl,
    status: status || 'running',
    run_env: env || 'prod',
    created_at: new Date().toISOString()
  };

  const content = {
    task_info: taskInfo,
    tp_platform_config: tpPlatformConfig
  };

  const dir = path.dirname(configFile);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configFile, yaml.dump(content, { lineWidth: -1 }), 'utf8');
}


function saveCaseStatus(taskDir, reportId, tasks, env, projectId, versionId, agentVersion) {
  const STATUS_NAMES = { 0: '等待中', 1: '进行中', 2: '执行成功', 3: '执行失败', 4: '终止' };
  const baseUrl = getBaseUrl(env);
  const cases = tasks.map(t => {
    const detailUrl = `${baseUrl}/testcase/ai-auto?productId=${projectId || ''}&projectId=${versionId || ''}&case_id=${t.case_id}&task_id=${t.task_id}${agentVersion ? `&agentVersion=${agentVersion}` : ''}`;
    return {
      case_id: t.case_id,
      task_id: t.task_id,
      case_name: t.case_name || null,
      case_code: t.case_code || null,
      status: t.status,
      status_name: STATUS_NAMES[t.status] !== undefined ? STATUS_NAMES[t.status] : '未知状态',
      detail_url: detailUrl
    };
  });
  const content = {
    report_id: reportId,
    generated_at: new Date().toISOString(),
    total: cases.length,
    cases
  };
  const caseStatusFile = path.join(taskDir, 'case_status.json');
  fs.writeFileSync(caseStatusFile, JSON.stringify(content, null, 2), 'utf8');
  return caseStatusFile;
}

function resetTaskForRetry(configFile, newReportId, env, tpConfig) {
  const taskConfig = yaml.load(fs.readFileSync(configFile, 'utf8')) || {};
  if (!taskConfig.task_info) taskConfig.task_info = {};

  const baseUrl = getBaseUrl(env || 'prod');
  const projectId = tpConfig.project_id;
  const versionId = tpConfig.version_id;
  const agentVersion = tpConfig.agent_version || null;
  const newReportUrl = buildReportUrl(baseUrl, newReportId, projectId, versionId, agentVersion);

  taskConfig.task_info.report_id = newReportId;
  taskConfig.task_info.e2e_report_url = newReportUrl;
  taskConfig.task_info.status = 'running';
  // 清除上次轮询的文件路径，避免新轮询完成前显示误导性旧路径
  delete taskConfig.task_info.test_report_path;
  delete taskConfig.task_info.case_status_path;

  // 重排 task_info 字段顺序
  const old = taskConfig.task_info;
  const ordered = {};
  if ('report_id' in old) ordered.report_id = old.report_id;
  for (const k of ['e2e_report_url', 'ai_testcase_url']) {
    if (k in old) ordered[k] = old[k];
  }
  if ('test_report_path' in old) ordered.test_report_path = old.test_report_path;
  if ('case_status_path' in old) ordered.case_status_path = old.case_status_path;
  ordered.status = old.status;
  if ('run_env' in old) ordered.run_env = old.run_env;
  if ('created_at' in old) ordered.created_at = old.created_at;
  for (const [k, v] of Object.entries(old)) {
    if (!(k in ordered)) ordered[k] = v;
  }
  taskConfig.task_info = ordered;

  fs.writeFileSync(configFile, yaml.dump(taskConfig, { lineWidth: -1 }), 'utf8');
}


// ============================================================================
// Global Config Management
// ============================================================================

function getGlobalConfigPath() {
  return path.join(os.homedir(), '.qianliu', 'config.json');
}

function loadGlobalConfig() {
  const configPath = getGlobalConfigPath();
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function ensureGlobalConfigDir() {
  const configDir = path.join(os.homedir(), '.qianliu');
  fs.mkdirSync(configDir, { recursive: true });
  return configDir;
}


// ============================================================================
// Logging
// ============================================================================

function setupLogging(taskDir) {
  fs.mkdirSync(taskDir, { recursive: true });
  const logFile = path.join(taskDir, 'run.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });

  function _formatMsg(level, msg) {
    const now = _formatDateTimeReadable(new Date());
    return `${now} | ${level.padEnd(8)} | qianliu-aitest-tp | ${msg}`;
  }

  return {
    debug(msg) {
      logStream.write(_formatMsg('DEBUG', msg) + '\n');
    },
    info(msg) {
      const formatted = _formatMsg('INFO', msg);
      logStream.write(formatted + '\n');
      console.log(`INFO: ${msg}`);
    },
    error(msg) {
      const formatted = _formatMsg('ERROR', msg);
      logStream.write(formatted + '\n');
      console.error(`ERROR: ${msg}`);
    },
    exception(msg) {
      const formatted = _formatMsg('ERROR', msg);
      logStream.write(formatted + '\n');
      console.error(`ERROR: ${msg}`);
    },
    close() {
      logStream.end();
    }
  };
}


// ============================================================================
// Config Validation
// ============================================================================

function validateRequiredFields(config) {
  const required = [
    ['project_id',           '项目ID（从任务链接 productId 获取）'],
    ['version_id',           '版本ID（从任务链接 projectId 获取）'],
    ['ai_testcase_task_id',  'AI测试用例任务ID（从任务链接路径获取）'],
    ['testbed_name',         '测试床名称（在 ResourceHome 测试床选项卡中获取）'],
    ['exec_host_name',       '执行主机标签（在 ResourceHome 执行主机选项卡中获取）'],
  ];

  const missing = required.filter(([key]) => config[key] == null || config[key] === '');
  if (missing.length > 0) {
    const details = missing.map(([key, desc]) => `  - ${key}: ${desc}`).join('\n');
    throw new Error(`配置文件缺少以下必填项：\n${details}`);
  }
}


// ============================================================================
// Config & Testbed
// ============================================================================

function loadTpConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return null;

  const content = fs.readFileSync(configPath, 'utf8');
  const fullConfig = yaml.load(content) || {};
  const config = fullConfig.tp_platform || {};

  // 从全局配置加载 tp_token
  const globalConfig = loadGlobalConfig();
  if (globalConfig && globalConfig.tp && globalConfig.tp.token) {
    config.tp_token = globalConfig.tp.token;
    console.log('✓ 已从全局配置加载 tp_token: ~/.qianliu/config.json');
  }

  if (!config.tp_token) {
    throw new Error(
      '未找到 tp_token 配置。请在全局配置文件中配置：\n' +
      '  ~/.qianliu/config.json 中的 tp.token'
    );
  }

  // agent_version 可选，默认 v1
  if (!config.agent_version) {
    config.agent_version = 'v1';
  }

  // 从 tp_base_url 自动推断环境
  if (config.tp_base_url && !config.env) {
    const detectedEnv = detectEnvFromBaseUrl(config.tp_base_url);
    if (detectedEnv) {
      config.env = detectedEnv;
    }
  }

  return config;
}

async function resolveTestbedConfig(config) {
  const testbedName = config.testbed_name;

  console.log(`正在查询测试床 '${testbedName}' 的ID...`);
  const resolvedId = await getTestbedByName(
    testbedName,
    config.env,
    config.project_id,
    config.version_id,
    config.tp_token,
    config.agent_version || null
  );
  console.log(`查询成功: '${testbedName}' -> testbed_id=${resolvedId}`);

  return Object.assign({}, config, { testbed_id: resolvedId, testbed_name: testbedName });
}


// ============================================================================
// Task Creation
// ============================================================================

async function tpCreateTask(config) {
  const env = config.env || 'prod';
  const projectId = config.project_id;
  const versionId = config.version_id;
  const aiTestcaseTaskId = config.ai_testcase_task_id;
  const testbedId = config.testbed_id;
  const execHostName = config.exec_host_name || '';
  const tpToken = config.tp_token;
  const agentVersion = config.agent_version || null;
  const desc = config.desc || `AI自动测试-${_formatNowBuild()}`;

  const aiAutoConfig = [];
  if (testbedId) {
    aiAutoConfig.push({ testbed_id: testbedId, host_tag: execHostName });
  }

  const result = await createBuild(desc, aiTestcaseTaskId, aiAutoConfig, env, projectId, versionId, tpToken, agentVersion);

  const reportId = result && result.id;
  if (!reportId) {
    throw new Error(`创建任务失败，错误日志：${JSON.stringify(result)}`);
  }

  return reportId;
}


// ============================================================================
// Adaptive Polling
// ============================================================================

function _getAdaptivePollInterval(elapsedSec) {
  if (elapsedSec < 600) return 20;
  if (elapsedSec < 3600) return 60;
  return 120;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================================
// Report Utilities
// ============================================================================

function formatSummaryStats(stats) {
  const translations = {
    total: '总用例数',
    success: '通过用例',
    failed: '失败用例',
    unfinished: '未完成用例',
    terminated: '终止用例',
    running: '执行中用例',
    successRate: '通过率',
    completionRate: '完成率',
    reportId: '报告ID'
  };

  const lines = ['| 指标 | 数值 |', '|------|------|'];
  for (const [key, value] of Object.entries(stats)) {
    const label = translations[key] || key;
    const valueStr = key.toLowerCase().includes('rate') && typeof value === 'number'
      ? `${value.toFixed(2)}%`
      : String(value);
    lines.push(`| ${label} | ${valueStr} |`);
  }
  return lines.join('\n');
}

function parseReportResult(reportResult) {
  let summarySection = '暂无执行摘要';
  let detailSection = '暂无测试结果详情';

  if (reportResult && typeof reportResult === 'object') {
    const stats = reportResult.summary || reportResult.progress || {};
    if (Object.keys(stats).length > 0) {
      summarySection = formatSummaryStats(stats);
    }
    const markdownContent = reportResult.markdown || '';
    if (markdownContent) {
      detailSection = markdownContent;
    }
  } else if (typeof reportResult === 'string') {
    detailSection = reportResult;
  }

  return { summarySection, detailSection };
}

function saveTestReport(reportFile, reportResult, config, reportId, env) {
  const baseUrl = getBaseUrl(env || 'prod');
  const projectId = config.project_id;
  const versionId = config.version_id;
  const agentVersion = config.agent_version || null;
  const e2eReportUrl = buildReportUrl(baseUrl, reportId, projectId, versionId, agentVersion);

  const header = `# 测试报告

## 基本信息
- **报告ID**: ${reportId}
- **E2E报告链接**: [${e2eReportUrl}](${e2eReportUrl})
- **运行环境**: ${env}
- **测试床名称**: ${config.testbed_name || 'N/A'}
- **测试床ID**: ${config.testbed_id || 'N/A'}
- **自动化执行资源标签**: ${config.exec_host_name || 'N/A'}
- **任务ID**: ${config.ai_testcase_task_id || 'N/A'}
- **生成时间**: ${_formatDateTimeReadable(new Date())}

`;

  let content;
  if (reportResult && typeof reportResult === 'object') {
    const markdownContent = reportResult.markdown || '';
    if (markdownContent) {
      content = header + '\n---\n\n' + markdownContent;
    } else {
      const parsed = parseReportResult(reportResult);
      content = header + `\n## 执行摘要\n\n${parsed.summarySection}\n\n## 测试详情\n\n${parsed.detailSection}\n`;
    }
  } else {
    const parsed = parseReportResult(reportResult);
    content = header + `\n## 执行摘要\n\n${parsed.summarySection}\n\n## 测试详情\n\n${parsed.detailSection}\n`;
  }

  fs.writeFileSync(reportFile, content, 'utf8');
}


// ============================================================================
// Main Mode: Create Task
// ============================================================================

async function mainCreateTask(config, workspaceDir) {
  const env = config.env || 'prod';
  const projectId = config.project_id;
  const versionId = config.version_id;

  // Print header
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(20) + '智能自动化测试平台 - 创建任务模式');
  console.log('='.repeat(80));
  console.log('\nTP平台配置:');
  console.log(`  环境: ${env}`);
  console.log(`  项目ID: ${projectId || 'N/A'}`);
  console.log(`  版本ID: ${versionId || 'N/A'}`);
  console.log(`  测试床名称: ${config.testbed_name || 'N/A'}`);
  console.log(`  测试床ID: ${config.testbed_id || 'N/A'}`);
  console.log(`  自动化执行资源标签: ${config.exec_host_name || 'N/A'}`);
  console.log(`  任务ID: ${config.ai_testcase_task_id || 'N/A'}`);
  console.log(`  创建时间: ${_formatDateTimeReadable(new Date())}`);
  console.log('-'.repeat(80) + '\n');

  // 检查是否有相同任务正在运行
  const runningTask = await findRunningTask(workspaceDir, config);
  if (runningTask) {
    const { taskDir, reportId, taskConfig } = runningTask;
    const logger = setupLogging(taskDir);
    logger.info('发现正在运行的相同任务，跳过创建步骤');
    logger.info(`复用已有任务目录: ${taskDir}`);
    logger.info(`复用已有报告ID: ${reportId}`);

    const e2eReportUrl = (taskConfig.task_info || {}).e2e_report_url || '';
    console.log(`\n[复用任务] 检测到正在运行的相同任务，复用已有报告ID: ${reportId}`);
    console.log(`[复用任务] 任务目录: ${taskDir}`);
    console.log(`[复用任务] E2E报告链接: ${e2eReportUrl}`);
    console.log('\n[复用任务] 查询当前进度...\n');

    return await mainPollProgress(taskDir, 0, true);
  }

  // 创建任务目录
  const taskDir = getTaskDirByConfig(workspaceDir, config);
  const logger = setupLogging(taskDir);
  logger.info(`工作目录: ${workspaceDir}`);
  logger.info(`任务目录: ${taskDir}`);

  let reportId;
  try {
    logger.info('创建异步测试任务');
    reportId = await tpCreateTask(config);
    logger.info(`创建自动化测试任务成功，任务报告ID: ${reportId}`);

    const taskConfigFile = path.join(taskDir, 'task_config.yaml');
    saveTaskConfig(taskConfigFile, config, reportId, env, 'running');
    logger.info(`任务配置已保存: ${taskConfigFile}`);
  } catch (e) {
    logger.error(`创建任务失败: ${e.message}`);
    console.log(`\n❌ 创建任务失败: ${e.message}`);
    console.log(`📄 详细日志已记录到: ${path.join(taskDir, 'run.log')}`);
    console.log('='.repeat(80) + '\n');
    return 1;
  }

  const baseUrl = getBaseUrl(env);
  const e2eReportUrl = buildReportUrl(baseUrl, reportId, projectId, versionId, config.agent_version || null);
  const scriptPath = path.resolve(__filename);

  logger.info(`E2E报告链接: ${e2eReportUrl}`);

  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(25) + '任务创建成功');
  console.log('='.repeat(80));
  console.log(`\n📋 报告ID: ${reportId}`);
  console.log(`📁 任务目录: ${taskDir}`);
  console.log(`\n🔗 E2E报告链接: ${e2eReportUrl}`);
  console.log('\n💡 提示: 您可以打开上述链接查看执行过程');
  console.log(`\n⏳ 任务正在后台执行，可使用以下命令轮询进度:`);
  console.log(`    node "${scriptPath}" --poll --task-dir "${taskDir}"`);
  console.log('='.repeat(80) + '\n');

  return 0;
}


// ============================================================================
// Main Mode: Stop Task
// ============================================================================

async function mainStopTask(taskDirStr) {
  const taskDir = taskDirStr;
  const taskConfigFile = path.join(taskDir, 'task_config.yaml');

  if (!fs.existsSync(taskConfigFile)) {
    console.log(`错误: 任务配置文件不存在: ${taskConfigFile}`);
    return 1;
  }

  const taskConfig = yaml.load(fs.readFileSync(taskConfigFile, 'utf8')) || {};
  const taskInfo = taskConfig.task_info || {};
  const tpConfig = taskConfig.tp_platform_config || {};

  const reportId = taskInfo.report_id;
  const env = taskInfo.run_env || 'prod';
  const projectId = tpConfig.project_id;
  const versionId = tpConfig.version_id;
  const tpToken = tpConfig.tp_token;
  const agentVersion = tpConfig.agent_version || null;

  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(30) + '智能自动化测试平台 - 停止任务');
  console.log('='.repeat(80));
  console.log('\n任务信息:');
  console.log(`  报告ID: ${reportId}`);
  console.log(`  运行环境: ${env}`);
  console.log(`  任务目录: ${taskDir}`);
  console.log('-'.repeat(80) + '\n');

  try {
    console.log(`正在停止任务 ${reportId}...`);
    const result = await interruptBuild(reportId, env, projectId, versionId, tpToken, agentVersion);
    console.log('✅ 任务停止成功！');
    console.log(`响应结果: ${JSON.stringify(result)}`);

    // 更新本地状态为 terminated
    updateTaskStatus(taskConfigFile, 'terminated');
    console.log(`\n📝 本地任务状态已更新为: terminated`);

    return 0;
  } catch (e) {
    console.log(`❌ 停止任务失败: ${e.message}`);
    return 1;
  }
}


// ============================================================================
// Main Mode: Retry Failed Tasks
// ============================================================================

async function mainRetryTask(taskDirStr, caseIds) {
  const taskDir = taskDirStr;
  const taskConfigFile = path.join(taskDir, 'task_config.yaml');

  if (!fs.existsSync(taskConfigFile)) {
    console.log(`错误: 任务配置文件不存在: ${taskConfigFile}`);
    return 1;
  }

  const logger = setupLogging(taskDir);
  const taskConfig = yaml.load(fs.readFileSync(taskConfigFile, 'utf8')) || {};
  const taskInfo = taskConfig.task_info || {};
  const tpConfig = taskConfig.tp_platform_config || {};

  const reportId = taskInfo.report_id;
  const env = taskInfo.run_env || 'prod';
  const projectId = tpConfig.project_id;
  const versionId = tpConfig.version_id;
  const tpToken = tpConfig.tp_token;
  const agentVersion = tpConfig.agent_version || null;
  const testbedId = tpConfig.testbed_id;
  const execHostName = tpConfig.exec_host_name || '';
  const testbedName = tpConfig.testbed_name || '';
  const aiTestcaseTaskId = tpConfig.ai_testcase_task_id;

  const retryMode = caseIds && caseIds.length > 0 ? `精准重试（${caseIds.length} 个指定用例）` : '全量失败重试';

  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(20) + '智能自动化测试平台 - 失败用例重试模式');
  console.log('='.repeat(80));
  console.log('\n源任务信息:');
  console.log(`  报告ID: ${reportId}`);
  console.log(`  运行环境: ${env}`);
  console.log(`  任务目录: ${taskDir}`);
  console.log(`  重试模式: ${retryMode}`);
  if (taskInfo.e2e_report_url) {
    console.log(`  E2E报告链接: ${taskInfo.e2e_report_url}`);
  }
  console.log('-'.repeat(80) + '\n');

  // 获取最新用例状态并更新 case_status.json
  console.log('正在获取最新用例状态...');
  let tasks = [];
  try {
    const responseData = await getTaskData(env, reportId, 1000, projectId, versionId, tpToken, agentVersion);
    tasks = responseData.tasks || [];

    // 更新 case_status.json（无论是否精准重试，都先更新为最新状态）
    const caseStatusFile = saveCaseStatus(taskDir, reportId, tasks, env, projectId, versionId, agentVersion);
    console.log(`✅ 用例状态已更新: ${caseStatusFile}`);
    logger.info(`用例状态已更新，总计 ${tasks.length} 个用例`);
  } catch (e) {
    logger.error(`获取用例状态失败: ${e.message}`);
    console.log(`❌ 获取用例状态失败: ${e.message}`);
    return 1;
  }

  // 获取需要重试的用例列表
  let failedTaskInfos;
  if (caseIds && caseIds.length > 0) {
    // 精准重试：从已更新的 case_status.json 读取（基于最新状态）
    const caseStatusFile = path.join(taskDir, 'case_status.json');
    let caseStatus;
    try {
      caseStatus = JSON.parse(fs.readFileSync(caseStatusFile, 'utf8'));
    } catch (e) {
      logger.error(`读取用例状态文件失败: ${e.message}`);
      console.log(`❌ 读取用例状态文件失败: ${e.message}`);
      return 1;
    }
    const caseIdSet = new Set(caseIds);
    failedTaskInfos = (caseStatus.cases || [])
      .filter(c => caseIdSet.has(c.case_id))
      .map(c => ({ case_id: c.case_id, task_id: c.task_id }));

    if (failedTaskInfos.length === 0) {
      console.log(`❌ 在最新用例状态中未找到指定的 case_id: ${caseIds.join(', ')}`);
      console.log(`💡 可用的 case_id 请查看: ${caseStatusFile}`);
      return 1;
    }
    console.log(`📋 找到 ${failedTaskInfos.length} 个指定用例，准备重试...`);
    logger.info(`精准重试：找到 ${failedTaskInfos.length} 个指定用例`);
  } else {
    // 全量失败重试：从已获取的最新状态中筛选
    failedTaskInfos = tasks
      .filter(t => t.status === 3)  // TaskStatus.FAILED = 3
      .map(t => ({ case_id: t.case_id, task_id: t.task_id }));

    if (failedTaskInfos.length === 0) {
      console.log('✅ 当前没有失败用例，无需重试！');
      return 0;
    }

    console.log(`📋 发现 ${failedTaskInfos.length} 个失败用例，准备重试...`);
    logger.info(`发现 ${failedTaskInfos.length} 个失败用例，开始重试`);
  }

  // 构造 ai_auto_config（与原构建保持一致）
  const aiAutoConfig = testbedId
    ? [{ testbed_id: testbedId, host_tag: execHostName, testbed: testbedName }]
    : [];

  // 调用重试接口
  let newReportId;
  let isInPlaceRetry = false;
  try {
    const result = await retryBuild(
      reportId, aiTestcaseTaskId, aiAutoConfig, failedTaskInfos,
      env, projectId, versionId, tpToken, agentVersion
    );
    newReportId = result && result.id;
    if (!newReportId) {
      // 兼容 {"data":"成功"} 格式：原地重试，复用原 report_id
      const isSuccess = result && (result.data === '成功' || result.data === 'success');
      if (!isSuccess) {
        throw new Error(`重试API返回异常: ${JSON.stringify(result)}`);
      }
      // 原地重试：复用原 report_id
      newReportId = reportId;
      isInPlaceRetry = true;
      logger.info(`原地重试已触发，复用原 report_id: ${reportId}`);
    }
  } catch (e) {
    logger.error(`重试任务失败: ${e.message}`);
    console.log(`❌ 重试任务失败: ${e.message}`);
    return 1;
  }

  logger.info(`重试任务创建成功，report_id: ${newReportId}${isInPlaceRetry ? '（原地重试）' : ''}`);

  // 就地更新原任务目录（不新建目录）
  resetTaskForRetry(taskConfigFile, newReportId, env, tpConfig);
  logger.info(`任务配置已更新：report_id=${newReportId}, status=running`);

  const baseUrl = getBaseUrl(env);
  const e2eReportUrl = buildReportUrl(baseUrl, newReportId, projectId, versionId, agentVersion);
  const scriptPath = path.resolve(__filename);

  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(25) + '重试任务已触发');
  console.log('='.repeat(80));
  console.log(`\n📋 报告ID: ${newReportId}${isInPlaceRetry ? '（原地重试，复用原报告）' : `（新建报告，重试 ${failedTaskInfos.length} 个失败用例）`}`);
  console.log(`📁 任务目录: ${taskDir}`);
  console.log(`\n🔗 E2E报告链接: ${e2eReportUrl}`);
  console.log('\n💡 提示: 您可以打开上述链接查看执行过程');
  console.log(`\n⏳ 任务正在后台执行，可使用以下命令轮询进度:`);
  console.log(`    node "${scriptPath}" --poll --task-dir "${taskDir}"`);
  console.log('='.repeat(80) + '\n');

  return 0;
}


// ============================================================================
// Main Mode: Poll Progress
// ============================================================================

async function mainPollProgress(taskDirStr, pollInterval, once = false) {
  const taskDir = taskDirStr;
  const taskConfigFile = path.join(taskDir, 'task_config.yaml');

  if (!fs.existsSync(taskConfigFile)) {
    console.log(`错误: 任务配置文件不存在: ${taskConfigFile}`);
    return 1;
  }

  const logger = setupLogging(taskDir);
  const taskConfig = yaml.load(fs.readFileSync(taskConfigFile, 'utf8')) || {};
  const taskInfo = taskConfig.task_info || {};
  const tpConfig = taskConfig.tp_platform_config || {};

  const reportId = taskInfo.report_id;
  const env = taskInfo.run_env || 'prod';
  const projectId = tpConfig.project_id;
  const versionId = tpConfig.version_id;
  const tpToken = tpConfig.tp_token;
  const agentVersion = tpConfig.agent_version || null;

  const modeStr = once ? '单次查询' : '轮询进度';
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(25) + `智能自动化测试平台 - ${modeStr}模式`);
  console.log('='.repeat(80));
  console.log('\n任务信息:');
  console.log(`  报告ID: ${reportId}`);
  console.log(`  运行环境: ${env}`);
  console.log(`  任务目录: ${taskDir}`);
  if (!once) console.log('  轮询间隔: 自适应（20s/60s/120s）');
  console.log(`  查询时间: ${_formatDateTimeReadable(new Date())}`);
  const e2eReportUrl = taskInfo.e2e_report_url || '';
  if (e2eReportUrl) {
    console.log(`  E2E测试报告链接: ${e2eReportUrl}`);
  }
  console.log('-'.repeat(80) + '\n');

  // 初次查询进度
  console.log('查询任务进度...');
  let progress = await getTaskProgress(env, reportId, 1000, projectId, versionId, tpToken, agentVersion);

  let total = progress.total || 0;
  let success = progress.success || 0;
  let failed = progress.failed || 0;
  let unfinished = progress.unfinished || 0;
  let terminated = progress.terminated || 0;
  let completionRate = progress.completionRate || 0;
  let successRate = progress.successRate || 0;

  console.log('\n  📊 当前进度:');
  console.log(`     总计: ${total}`);
  console.log(`     通过: ${success} ✅`);
  console.log(`     失败: ${failed} ❌`);
  console.log(`     未完成: ${unfinished} ⏳`);
  console.log(`     终止: ${terminated} ⛔`);
  console.log(`     完成度: ${completionRate}%`);
  console.log(`     通过率: ${successRate}%`);
  logger.info(`任务报告ID 「${reportId}」 进度: 通过=${success}, 失败=${failed}, 完成度=${completionRate}%`);

  let isRunning = unfinished > 0;

  if (once) {
    if (isRunning) {
      const scriptPath = path.resolve(__filename);
      console.log('\n⏳ 任务仍在执行中...');
      console.log('\n💡 提示: 使用以下命令继续轮询进度:');
      console.log(`    node "${scriptPath}" --poll --task-dir "${taskDir}"`);
      console.log('='.repeat(80) + '\n');
      return 2;
    } else {
      console.log('\n✅ 任务执行完成！\n');
      return await finalizeReport(taskDir, taskConfigFile, taskInfo, tpConfig, reportId, env, projectId, versionId, tpToken, agentVersion, logger);
    }
  }

  // 轮询模式
  const startTime = Date.now();
  let lastCompletionRate = completionRate;
  let lastSuccess = success;
  let lastFailed = failed;
  let lastProgressChangeTime = Date.now();
  const PROGRESS_STALE_TIMEOUT = 3600 * 1000; // 1 hour in ms

  try {
    while (isRunning) {
      const elapsedSec = (Date.now() - startTime) / 1000;
      const currentInterval = _getAdaptivePollInterval(elapsedSec);
      await _sleep(currentInterval * 1000);

      try {
        progress = await getTaskProgress(env, reportId, 1000, projectId, versionId, tpToken, agentVersion);
      } catch (e) {
        logger.error(`查询进度失败: ${e.message}`);
        const now = _formatDateTimeReadable(new Date()).slice(11, 19); // HH:MM:SS
        console.log(`  [${now}] ⚠️ 查询进度失败: ${e.message}，将在下次间隔重试`);
        continue;
      }

      total = progress.total || 0;
      success = progress.success || 0;
      failed = progress.failed || 0;
      unfinished = progress.unfinished || 0;
      completionRate = progress.completionRate || 0;

      // 检测进度停滞
      const timeSinceLastChange = Date.now() - lastProgressChangeTime;
      if (timeSinceLastChange > PROGRESS_STALE_TIMEOUT) {
        const staleMinutes = Math.floor(timeSinceLastChange / 60000);
        const errorMsg = (
          `进度停滞超过 ${PROGRESS_STALE_TIMEOUT / 60000} 分钟（实际 ${staleMinutes} 分钟），` +
          `可能存在异常情况需要人类介入处理。\n` +
          `停滞状态: 通过=${success}, 失败=${failed}, 未完成=${unfinished}, ` +
          `完成度=${completionRate}%, 总计=${total}\n` +
          `报告ID: ${reportId}\n` +
          `E2E报告链接: ${(taskInfo.e2e_report_url) || 'N/A'}`
        );
        logger.error(errorMsg);
        throw new Error(errorMsg);
      }

      // 仅在进度变化时输出
      if (completionRate !== lastCompletionRate || success !== lastSuccess || failed !== lastFailed) {
        const timeStr = _formatDateTimeReadable(new Date()).slice(11);
        console.log(`  [${timeStr}] 📊 进度更新: 通过: ${success}, 失败: ${failed}, 未完成: ${unfinished}, 总计: ${total}, 完成度: ${completionRate}%`);
        logger.info(`任务报告ID 「${reportId}」 执行进度: 通过 ${success}, 失败 ${failed}, 完成度: ${completionRate}%`);
        lastCompletionRate = completionRate;
        lastSuccess = success;
        lastFailed = failed;
        lastProgressChangeTime = Date.now();
      }

      isRunning = unfinished > 0;
    }

    console.log('\n✅ 任务执行完成！\n');
    return await finalizeReport(taskDir, taskConfigFile, taskInfo, tpConfig, reportId, env, projectId, versionId, tpToken, agentVersion, logger);
  } catch (e) {
    logger.error(`轮询过程发生异常: ${e.message}`);
    console.log(`\n❌ 轮询过程发生异常: ${e.message}`);
    console.log(`📄 详细日志已记录到: ${path.join(taskDir, 'run.log')}`);
    console.log('='.repeat(80) + '\n');
    return 1;
  }
}


// ============================================================================
// Finalize Report
// ============================================================================

async function finalizeReport(taskDir, taskConfigFile, taskInfo, tpConfig, reportId, env, projectId, versionId, tpToken, agentVersion, logger) {
  logger.info('整理处理测试报告结果');
  console.log('正在生成测试报告...');

  // 并行获取报告内容和全量用例列表；getTaskData 失败时降级跳过 case_status.json 生成
  const [reportResultSettled, taskDataSettled] = await Promise.allSettled([
    getRealtimeTaskReport({
      env,
      reportId,
      verbose: false,
      compressMode: 'step_only',
      projectId,
      versionId,
      tpToken,
      agentVersion
    }),
    getTaskData(env, reportId, 1000, projectId, versionId, tpToken, agentVersion)
  ]);

  if (reportResultSettled.status === 'rejected') {
    throw reportResultSettled.reason;
  }
  const reportResult = reportResultSettled.value;

  const now = new Date();
  const reportFile = path.join(taskDir, `test_report_${_formatDateTime(now)}.md`);
  saveTestReport(reportFile, reportResult, tpConfig, reportId, env);
  logger.info(`测试报告已保存: ${reportFile}`);

  let caseStatusFile = null;
  if (taskDataSettled.status === 'fulfilled') {
    const tasks = taskDataSettled.value.tasks || [];
    caseStatusFile = saveCaseStatus(taskDir, reportId, tasks, env, projectId, versionId, agentVersion);
    logger.info(`用例状态已保存: ${caseStatusFile}`);
  } else {
    logger.error(`获取用例状态失败（跳过 case_status.json 生成）: ${taskDataSettled.reason.message}`);
  }

  const extraFields = { test_report_path: reportFile };
  if (caseStatusFile) extraFields.case_status_path = caseStatusFile;
  updateTaskStatus(taskConfigFile, 'done', extraFields);
  logger.info('任务状态已更新为: done');

  // 打印最终摘要
  console.log('\n' + '='.repeat(80));
  console.log(' '.repeat(25) + '执行完成');
  console.log('='.repeat(80));

  if (reportResult && typeof reportResult === 'object') {
    const summary = reportResult.summary || {};
    if (Object.keys(summary).length > 0) {
      console.log('\n📊 执行摘要:');
      console.log(`   总用例数: ${summary.total !== undefined ? summary.total : 'N/A'}`);
      console.log(`   通过: ${summary.success !== undefined ? summary.success : 'N/A'} ✅`);
      console.log(`   失败: ${summary.failed !== undefined ? summary.failed : 'N/A'} ❌`);
      console.log(`   通过率: ${summary.successRate !== undefined ? summary.successRate : 'N/A'}%`);
    }
  }

  console.log(`\n📄 测试报告: ${reportFile}`);
  console.log(`🔗 E2E报告链接: ${taskInfo.e2e_report_url || ''}`);
  console.log('='.repeat(80) + '\n');

  return 0;
}


// ============================================================================
// Main Entry Point
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    create: null,
    poll: false,
    stop: false,
    retry: false,
    taskDir: null,
    pollInterval: 10,
    once: false,
    caseIds: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--create') {
      opts.create = args[i + 1] && !args[i + 1].startsWith('--')
        ? args[++i]
        : './.qianliu/.qianliu-aitest/tp-aitest-config.yaml';
    } else if (arg === '--poll') {
      opts.poll = true;
    } else if (arg === '--stop') {
      opts.stop = true;
    } else if (arg === '--retry') {
      opts.retry = true;
    } else if (arg === '--task-dir') {
      opts.taskDir = args[++i];
    } else if (arg === '--poll-interval') {
      opts.pollInterval = parseInt(args[++i], 10);
    } else if (arg === '--once') {
      opts.once = true;
    } else if (arg === '--case-ids') {
      const raw = args[++i];
      if (!raw || raw.startsWith('--')) {
        console.log('错误: --case-ids 需要提供逗号分隔的 case_id 列表（例如: --case-ids 123,456）');
        process.exit(1);
      }
      const parsed = raw.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
      if (parsed.length === 0) {
        console.log(`错误: --case-ids 值 "${raw}" 中不包含有效的数字 case_id`);
        process.exit(1);
      }
      opts.caseIds = parsed;
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    }
  }

  return opts;
}

function printHelp() {
  console.log(`Usage: run_tp_testplan [options]

远端TP平台测试计划调度执行（异步模式）

Options:
  --create [configPath]      创建任务模式：指定配置文件路径（默认:
                             ./.qianliu/.qianliu-aitest/tp-aitest-config.yaml）
  --poll                     轮询模式：查询任务进度并获取最终报告
  --stop                     停止模式：停止正在运行的构建任务
  --retry                    重试模式：重试指定构建中所有失败的用例
  --case-ids <ids>           精准重试：逗号分隔的 case_id 列表（配合 --retry 使用）
  --task-dir <path>          任务目录路径（轮询/停止/重试模式必需，由创建任务时输出）
  --poll-interval <seconds>  轮询间隔（秒），默认自适应（20s/60s/120s） (default: 10)
  --once                     仅查询一次进度（配合 --poll 使用）
  -h, --help                 display help for command

示例:
  # 步骤1: 创建任务（使用默认配置路径）
  node run_tp_testplan.js --create

  # 步骤1: 创建任务（指定配置文件路径）
  node run_tp_testplan.js --create ./.qianliu/.qianliu-aitest/tp-aitest-config.yaml

  # 步骤2: 轮询进度并获取报告
  node run_tp_testplan.js --poll --task-dir ./.qianliu/.qianliu-aitest/tp_tasks/task_xxx

  # 重试所有失败用例
  node run_tp_testplan.js --retry --task-dir ./.qianliu/.qianliu-aitest/tp_tasks/task_xxx

  # 精准重试指定用例
  node run_tp_testplan.js --retry --task-dir ./.qianliu/.qianliu-aitest/tp_tasks/task_xxx --case-ids 123,456
`);
}

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  let exitCode = 0;

  if (opts.stop) {
    if (!opts.taskDir) {
      console.log('错误: 停止模式需要提供 --task-dir 参数');
      printHelp();
      process.exit(1);
    }
    exitCode = await mainStopTask(opts.taskDir);
  } else if (opts.retry) {
    if (!opts.taskDir) {
      console.log('错误: 重试模式需要提供 --task-dir 参数');
      printHelp();
      process.exit(1);
    }
    exitCode = await mainRetryTask(opts.taskDir, opts.caseIds);
  } else if (opts.poll) {
    if (!opts.taskDir) {
      console.log('错误: 轮询模式需要提供 --task-dir 参数');
      printHelp();
      process.exit(1);
    }
    exitCode = await mainPollProgress(opts.taskDir, opts.pollInterval || 10, !!opts.once);
  } else if (opts.create !== null) {
    const configPath = opts.create;

    if (!fs.existsSync(configPath)) {
      console.log(`错误: 配置文件不存在: ${configPath}`);
      process.exit(1);
    }

    let config;
    try {
      config = loadTpConfig(configPath);
    } catch (e) {
      console.log(`错误: 配置加载失败 - ${e.message}`);
      process.exit(1);
    }
    if (!config) {
      console.log(`错误: 无法加载配置文件: ${configPath}`);
      process.exit(1);
    }

    try {
      validateRequiredFields(config);
    } catch (e) {
      console.log(`错误: ${e.message}`);
      process.exit(1);
    }

    try {
      config = await resolveTestbedConfig(config);
    } catch (e) {
      console.log(`错误: 测试床解析失败 - ${e.message}`);
      process.exit(1);
    }

    const workspaceDir = path.resolve(path.dirname(configPath));
    exitCode = await mainCreateTask(config, workspaceDir);
  } else {
    console.log('错误: 必须指定 --create 或 --poll 模式');
    printHelp();
    process.exit(1);
  }

  process.exit(exitCode);
}

main().catch(e => {
  console.error('未捕获的错误:', e.message);
  process.exit(1);
});
