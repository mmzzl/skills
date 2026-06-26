#!/usr/bin/env node
// Record execution timing for auto-test rounds
// Usage: node scripts/record-timing.js <framework> <task_dir>

// `execution_timing.json` 格式示例：
// ```json
// [{
//   "framework": "rf",
//   "round": 1,
//   "start_time": 1782115367,
//   "end_time": 1782115467,
//   "duration_seconds": 100
// },{
//   "framework": "rf",
//   "round": 2,
//   "start_time": 1782115470,
//   "end_time": 1782115571,
//   "duration_seconds": 101
// }]
// ```

const fs = require('fs');
const path = require('path');

const framework = process.argv[2];  // "rf" or "mcp"
const taskDir = process.argv[3];

if (!framework || !taskDir) {
  console.error('Usage: node scripts/record-timing.js <framework> <task_dir>');
  process.exit(1);
}

const timingFile = `.cospowers/auto-test/tasks/${taskDir}/execution_timing.json`;
const startTimeFile = `.cospowers/auto-test/tasks/${taskDir}/.autotest_start_time`;
const roundFile = `.cospowers/auto-test/tasks/${taskDir}/.autotest_round`;

const endTime = Math.floor(Date.now() / 1000);
const startTime = parseInt(fs.readFileSync(startTimeFile, 'utf8'), 10);
const round = parseInt(fs.readFileSync(roundFile, 'utf8'), 10);
const duration = endTime - startTime;

let arr = [];
if (fs.existsSync(timingFile)) {
  try { arr = JSON.parse(fs.readFileSync(timingFile, 'utf8')); } catch (e) { arr = []; }
}
arr.push({
  framework,
  round,
  start_time: startTime,
  end_time: endTime,
  duration_seconds: duration
});
fs.writeFileSync(timingFile, JSON.stringify(arr, null, 2) + '\n');

// Cleanup temp files
fs.unlinkSync(startTimeFile);
fs.unlinkSync(roundFile);
