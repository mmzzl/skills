#!/usr/bin/env node
/**
 * Generate build_config.yaml
 *
 * Mode A — read from config (config.yaml exists):
 *   node gen_build_config.js <task_dir>
 *
 * Mode B — explicit args (config.yaml missing):
 *   node gen_build_config.js <task_dir> \
 *     --testbed-path <path> --gitrepo <url> --casedir <dir> \
 *     [--branch <branch>] [--include <tags>] [--exclude <tags>]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---- args ----
const args = process.argv.slice(2);
const taskDir = args[0];
if (!taskDir) {
  console.error('Usage: node gen_build_config.js <task_dir> [--testbed-path ...]');
  process.exit(1);
}

// ---- parse CLI flags ----
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--testbed-path' && i + 1 < argv.length) flags.testbedConfig = argv[++i];
    else if (argv[i] === '--gitrepo' && i + 1 < argv.length) flags.gitrepo = argv[++i];
    else if (argv[i] === '--casedir' && i + 1 < argv.length) flags.casedir = argv[++i];
    else if (argv[i] === '--branch' && i + 1 < argv.length) flags.branch = argv[++i];
    else if (argv[i] === '--include' && i + 1 < argv.length) flags.include = argv[++i];
    else if (argv[i] === '--exclude' && i + 1 < argv.length) flags.exclude = argv[++i];
  }
  return flags;
}
const cliFlags = parseFlags(args);

// ---- resolve values ----
const configPath = '.cospowers/auto-test/config.yaml';
let testbedConfig, gitrepo, casedir, branch, include, exclude;

if (fs.existsSync(configPath)) {
  // Mode A: read from config
  const configJson = execSync(
    `python -c "import yaml,json,sys; print(json.dumps(yaml.safe_load(open(sys.argv[1],encoding='utf-8')),ensure_ascii=False))" "${configPath}"`,
    { encoding: 'utf-8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
  );
  const config = JSON.parse(configJson);
  const rf = config.rf || {};
  const wf = rf.workflow || {};

  testbedConfig = cliFlags.testbedConfig || wf.testbed_path || '';
  gitrepo        = cliFlags.gitrepo       || wf.gitrepo || '';
  casedir        = cliFlags.casedir       || wf.casedir || '';
  branch         = cliFlags.branch        || wf.branch || '';
  include        = cliFlags.include       || wf.include || '';
  exclude        = cliFlags.exclude       || wf.exclude || '';
} else {
  // Mode B: require explicit flags
  testbedConfig = cliFlags.testbedConfig || '';
  gitrepo       = cliFlags.gitrepo || '';
  casedir       = cliFlags.casedir || '';
  branch        = cliFlags.branch || '';
  include       = cliFlags.include || '';
  exclude       = cliFlags.exclude || '';

  if (!testbedConfig || !gitrepo || !casedir) {
    console.error('config.yaml 不存在，必须提供 --testbed-path、--gitrepo、--casedir');
    process.exit(1);
  }
}

// ---- generate build_config.yaml ----
const buildConfig = [
  'build_option:',
  '    exit_on_fail: false',
  '    pause_on_fail: false',
  '    image_url: default',
  '    clean_on_start: false',
  '    pass_rate: 1',
  '    advanced_mode: yes',
  '    create_ini: false',
  '    rerunfailed: false',
  'report_option:',
  '    baseline_selector: SAME',
  'workflow:',
  '    -',
  `        testbed: ${testbedConfig}`,
  `        gitrepo: ${gitrepo}`,
  `        branch: ${branch}`,
  `        casedir: ${casedir}`,
  `        include: ${include}`,
  `        exclude: ${exclude}`,
  '',
].join('\n');

const outDir = path.join('.cospowers', 'auto-test', 'tasks', taskDir);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'build_config.yaml'), buildConfig, 'utf-8');
console.log('build_config.yaml 已生成');
