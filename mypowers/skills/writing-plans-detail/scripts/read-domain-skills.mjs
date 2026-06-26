#!/usr/bin/env node

/**
 * read-domain-skills.mjs
 *
 * 读取插件根目录下的 cospowers.config.json 并提取 "domain-skills" 节点内容，
 * 以可读格式打印每个领域技能条目（名称、标识、描述）。
 *
 * 用途：
 *   - 在 SKILL.md 扩展点中被调用，用于发现当前可用的领域技能
 *
 * 用法：
 *   node read-domain-skills.mjs                           # 使用 $CLAUDE_PLUGIN_ROOT/cospowers.config.json
 *   node read-domain-skills.mjs <plugin-root-or-config>   # 传入插件根目录路径或直接配置文件路径
 *
 * 环境变量：
 *   CLAUDE_PLUGIN_ROOT  - 插件根目录（未提供路径参数时使用）
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';

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
      // 传入的是目录（插件根路径），自动拼接配置文件
      return join(resolved, 'cospowers.config.json');
    }
  } catch {
    // stat 失败则当作文件路径处理
  }

  return resolved;
}

function main() {
  // 确定配置路径优先级：命令行参数 > CLAUDE_PLUGIN_ROOT 环境变量 > 当前工作目录
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || '.';

  // 尝试以插件根目录方式解析命令行参数，失败后回退到直接文件路径
  const configPath =
    resolveConfigPath(process.argv[2])
    || resolveConfigPath(join(process.argv[2] || pluginRoot, 'cospowers.config.json'))
    || join(pluginRoot, 'cospowers.config.json');

  const resolvedPath = resolve(configPath);

  if (!existsSync(resolvedPath)) {
    console.error(`[read-domain-skills] config file not found: ${resolvedPath}`);
    process.exit(1);
  }

  try {
    const raw = readFileSync(resolvedPath, 'utf-8');
    const config = JSON.parse(raw);

    const domainSkills = config['domain-skills'];

    if (!domainSkills || typeof domainSkills !== 'object' || Object.keys(domainSkills).length === 0) {
      console.log('[read-domain-skills] Extension skill does not exist');
      return;
    }

    const keys = Object.keys(domainSkills).filter(k => !k.startsWith('_'));
    if (keys.length === 0) {
      console.log('[read-domain-skills] Extension skill does not exist');
      return;
    }

    console.log(`[read-domain-skills] Found ${keys.length} domain skill(s):\n`);

    for (const key of keys) {
      const entry = domainSkills[key];
      const name = entry.name || '(no name)';
      const skill = entry.skill || '(no skill)';
      const description = entry.description || '(no description)';
      console.log(`  [${key}]`);
      console.log(`    name        : ${name}`);
      console.log(`    skill       : ${skill}`);
      console.log(`    description : ${description}`);
      console.log('');
    }
  } catch (err) {
    console.error(`[read-domain-skills] failed to read or parse config: ${err.message}`);
    process.exit(1);
  }
}

main();
