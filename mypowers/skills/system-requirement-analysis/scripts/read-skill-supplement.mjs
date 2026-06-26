#!/usr/bin/env node

/**
 * read-skill-supplement.mjs
 *
 * 从 cospowers.config.json 中读取指定 skill 的补充提示词（skillSupplements），
 * 并输出到标准输出，供 SKILL.md 的 Extension Points 块注入使用。
 *
 * 配置格式（cospowers.config.json → skillSupplements）：
 *   - null / 未配置 → 无补充内容，静默退出
 *   - 字符串        → 直接作为 markdown 补充内容输出
 *   - { "file": "path/to/supplement.md" } → 读取文件内容并输出（路径相对于插件根目录）
 *
 * 用法：
 *   node read-skill-supplement.mjs <skill-name>                              # 使用 $CLAUDE_PLUGIN_ROOT
 *   node read-skill-supplement.mjs <skill-name> <plugin-root-or-config-path>
 *
 * 环境变量：
 *   CLAUDE_PLUGIN_ROOT  - 插件根目录（未提供路径参数时使用）
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

/**
 * 解析配置路径：若传入的是目录，则自动追加 cospowers.config.json；
 * 若传入的是文件，则直接使用。
 */
function resolveConfigPath(inputPath) {
  if (!inputPath) return null;

  const resolved = resolve(inputPath);

  if (!existsSync(resolved)) {
    return null;
  }

  try {
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return join(resolved, 'cospowers.config.json');
    }
  } catch {
    // stat 失败则当作文件路径处理
  }

  return resolved;
}

/**
 * 读取并解析 cospowers.config.json
 */
function loadConfig(configPath) {
  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    console.error(`[read-skill-supplement] 未找到配置文件: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    const raw = readFileSync(resolvedPath, 'utf-8');
    return { config: JSON.parse(raw), configDir: dirname(resolvedPath) };
  } catch (err) {
    console.error(`[read-skill-supplement] 读取或解析配置文件失败: ${err.message}`);
    process.exit(1);
  }
}

/**
 * 解析补充内容值，支持三种格式：
 *   1. null / undefined → 无补充
 *   2. string → 直接返回
 *   3. { file: "path" } → 读取文件内容
 */
function resolveSupplement(value, configDir) {
  if (value === null || value === undefined) {
    return null;
  }

  // 字符串类型：直接作为 markdown 内容
  if (typeof value === 'string') {
    return value;
  }

  // 对象类型：检查 file 字段
  if (typeof value === 'object' && value.file && typeof value.file === 'string') {
    const filePath = resolve(configDir, value.file);
    if (!existsSync(filePath)) {
      console.error(`[read-skill-supplement] 补充文件不存在: ${filePath}`);
      process.exit(1);
    }
    try {
      return readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.error(`[read-skill-supplement] 读取补充文件失败: ${err.message}`);
      process.exit(1);
    }
  }

  // 其他格式 → 当作字符串化输出（兜底）
  console.error(`[read-skill-supplement] 警告: 不支持的补充内容格式，已跳过 (类型: ${typeof value})`);
  return null;
}

function main() {
  const skillName = process.argv[2];
  if (!skillName) {
    console.error('[read-skill-supplement] 用法: node read-skill-supplement.mjs <skill-name> [plugin-root]');
    process.exit(1);
  }

  // 确定配置路径优先级：命令行参数 > CLAUDE_PLUGIN_ROOT 环境变量 > 当前工作目录
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '.';

  const configPath =
    resolveConfigPath(process.argv[3])
    || resolveConfigPath(join(process.argv[3] || pluginRoot, 'cospowers.config.json'))
    || join(pluginRoot, 'cospowers.config.json');

  const { config, configDir } = loadConfig(configPath);

  // 检查 skillSupplements 配置段
  const supplements = config.skillSupplements;
  if (!supplements || typeof supplements !== 'object') {
    // 未配置 skillSupplements 段，静默退出
    console.log(' ');
    process.exit(0);
  }

  const supplementValue = supplements[skillName];
  const content = resolveSupplement(supplementValue, configDir);

  if (content === null) {
    // 无补充内容，输出空格避免空输出
    console.log(' ');
    process.exit(0);
  }

  // 输出补充内容
  console.log(`## Additional Requirements\n\n${content}`);
}

main();
