#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CORE_PIPELINE_SKILLS = new Set([
  'brainstorming',
  'requirement-analysis',
  'system-requirement-analysis',
  'overall-design-spec',
  'writing-plans',
  'executing-plans',
  'spec-commit',
]);

const SKILL_SCAN_PATTERNS = [
  '.claude/skills/*/SKILL.md',
  '.codex/skills/*/SKILL.md',
  '.agents/skills/*/SKILL.md',
  '.cursor/skills/*/SKILL.md',
  '.claude/plugins/cache/*/*/*/skills/*/SKILL.md',
  '.codex/plugins/cache/*/*/*/skills/*/SKILL.md',
  '.cursor/plugins/cache/*/*/*/skills/*/SKILL.md',
];

const INTERNAL_PLUGIN_MARKERS = [
  '/spec-developer/',
  '/cospowers/',
  '\\spec-developer\\',
  '\\cospowers\\',
];

const DEFAULT_CLAUDE_MARKETPLACES_ROOT = path.join(os.homedir(), '.claude', 'plugins', 'marketplaces');

const PRELOADED_INSTRUCTION_FILENAMES = new Set([
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
  'AGENTS.override.md',
]);

const PROJECT_CASCADE_FILENAMES = new Set(PRELOADED_INSTRUCTION_FILENAMES);

const PRIORITY_OVERRIDE_PATTERNS = [
  'highest priority',
  'takes precedence over .*skill',
  'override[s]?(?: all)? skill',
  'supersede[s]?(?: all)? skill',
  'ignore(?: all)? skill',
  '\\u4f18\\u5148\\u7ea7\\u6700\\u9ad8',
  '\\u8986\\u76d6.*(?:skill|\\u6280\\u80fd)',
  '\\u9ad8\\u4e8e.*(?:skill|\\u6280\\u80fd)',
  '\\u5ffd\\u7565.*(?:skill|\\u6280\\u80fd)',
];

const BYPASS_PATTERNS = [
  'go straight to code',
  'implement directly',
  'skip (?:the )?planning',
  'skip (?:the )?design',
  'skip brainstorming',
  'without analysis',
  'do not .*brainstorm',
  '\\u76f4\\u63a5\\u5199\\u4ee3\\u7801',
  '\\u76f4\\u63a5\\u5b9e\\u73b0',
  '\\u8df3\\u8fc7.*\\u89c4\\u5212',
  '\\u8df3\\u8fc7.*\\u8bbe\\u8ba1',
  '\\u8df3\\u8fc7.*brainstorm',
  '\\u65e0\\u9700\\u5206\\u6790',
  '\\u4e0d\\u8981.*\\u8bbe\\u8ba1\\u6587\\u6863',
];

const SKILL_TOOL_DISABLE_PATTERNS = [
  'never use skill tool',
  'do not use skill tool',
  'avoid using skill tool',
  '\\u7981\\u6b62\\u4f7f\\u7528.*skill',
  '\\u4e0d\\u8981\\u4f7f\\u7528.*skill',
];

const AUTO_COMMIT_PATTERNS = [
  'commit without confirmation',
  'auto(?:matically)? commit',
  'push directly',
  'commit and push immediately',
  '\\u81ea\\u52a8\\u63d0\\u4ea4',
  '\\u65e0\\u9700\\u786e\\u8ba4.*commit',
  '\\u76f4\\u63a5 push',
  '\\u76f4\\u63a5\\u63d0\\u4ea4',
];

const TRIGGER_HINT_PATTERNS = [
  'use when[^.\\n]*',
  'activated by[^.\\n]*',
  'when the user[^.\\n]*',
  'triggered by[^.\\n]*',
  '\\u5f53\\u7528\\u6237[^\\u3002\\n]*',
  '\\u9002\\u7528\\u4e8e[^\\u3002\\n]*',
  '\\u89e6\\u53d1[^\\u3002\\n]*',
];

const TRIGGER_SECTION_HEADERS = [
  'when to activate',
  'activation',
  'trigger',
  '\\u89e6\\u53d1',
  '\\u4f55\\u65f6\\u89e6\\u53d1',
  '\\u9002\\u7528',
];

const WORD_TOKEN_RE = /[a-z][a-z0-9_-]{1,}|[\p{Script=Han}]{2,}/gu;
const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)]+\.md(?:#[^)]+)?)\)/giu;
const BARE_MD_PATH_RE = /(?<![\w/\\])((?:\.{1,2}[\\/]|[\w.-]+[\\/])[\w .\-/\\]+\.(?:md|markdown))(?![\w])/giu;

const CANONICAL_REPLACEMENTS = [
  [/\bbrainstorming\b/giu, 'brainstorm'],
  [/\bbrainstorm\b/giu, 'brainstorm'],
  [/\bplanning\b/giu, 'plan'],
  [/\bplans\b/giu, 'plan'],
  [/\bdesign docs?\b/giu, 'design'],
  [/\bdesign\b/giu, 'design'],
  [/\bspecification\b/giu, 'spec'],
  [/\bspec\b/giu, 'spec'],
  [/\bimplement(?:ation|ing)?\b/giu, 'implement'],
  [/\bcoding\b/giu, 'code'],
  [/\bcommit(?:ting)?\b/giu, 'commit'],
  [/\bpush(?:ing)?\b/giu, 'push'],
  [/\breview(?:er|ing)?\b/giu, 'review'],
  [/\brequirements?\b/giu, 'requirement'],
  [/\bstories\b/giu, 'story'],
  [/\u89c4\u5212/gu, 'plan'],
  [/\u8ba1\u5212/gu, 'plan'],
  [/\u8bbe\u8ba1/gu, 'design'],
  [/\u76f4\u63a5\u5199\u4ee3\u7801/gu, 'direct_code'],
  [/\u76f4\u63a5\u5b9e\u73b0/gu, 'direct_code'],
  [/\u63d0\u4ea4/gu, 'commit'],
  [/\u63a8\u9001/gu, 'push'],
  [/\u9700\u6c42/gu, 'requirement'],
  [/\u8bc4\u5ba1/gu, 'review'],
  [/\u6392\u969c/gu, 'debug'],
];

const TOKEN_STOPWORDS = new Set([
  'use',
  'when',
  'user',
  'skill',
  'this',
  'that',
  'with',
  'from',
  'into',
  'for',
  'and',
  'the',
  'any',
  'before',
  'after',
  'must',
  'should',
  'workflow',
  'current',
  'project',
  'code',
  'task',
  'tasks',
  'system',
  'document',
  'documents',
  'response',
  'analysis',
  'directly',
]);

const SEMANTIC_FLAG_PATTERNS = {
  priority_override_skills: [
    'highest priority',
    'override[s]?(?: all)? skill',
    'supersede[s]?(?: all)? skill',
    'ignore(?: all)? skill',
    '\\u4f18\\u5148\\u7ea7\\u6700\\u9ad8',
    '\\u8986\\u76d6.*(?:skill|\\u6280\\u80fd)',
    '\\u5ffd\\u7565.*(?:skill|\\u6280\\u80fd)',
  ],
  forbid_skill_tool: [
    'never use skill tool',
    'do not use skill tool',
    'avoid using skill tool',
    '\\u7981\\u6b62\\u4f7f\\u7528.*skill',
    '\\u4e0d\\u8981\\u4f7f\\u7528.*skill',
  ],
  require_skill_before_response: [
    'invoke .*skill .*before any response',
    'before any response.*skill',
    'must use .*skill',
    'must invoke .*skill',
    '\\u5148.*skill.*\\u518d.*\\u56de\\u590d',
    '\\u5728.*\\u56de\\u590d.*\\u4e4b\\u524d.*skill',
  ],
  direct_implement: [
    'go straight to code',
    'implement directly',
    'without analysis',
    '\\u76f4\\u63a5\\u5199\\u4ee3\\u7801',
    '\\u76f4\\u63a5\\u5b9e\\u73b0',
    '\\u65e0\\u9700\\u5206\\u6790',
  ],
  skip_brainstorm: [
    'skip brainstorming',
    'do not .*brainstorm',
    '\\u8df3\\u8fc7.*brainstorm',
    '\\u4e0d\\u8981.*brainstorm',
  ],
  skip_design: [
    'skip (?:the )?design',
    '\\u8df3\\u8fc7.*\\u8bbe\\u8ba1',
    '\\u4e0d\\u8981.*\\u8bbe\\u8ba1\\u6587\\u6863',
  ],
  skip_plan: [
    'skip (?:the )?planning',
    'skip plan',
    '\\u8df3\\u8fc7.*plan',
    '\\u8df3\\u8fc7.*\\u89c4\\u5212',
    '\\u8df3\\u8fc7.*\\u8ba1\\u5212',
  ],
  require_brainstorm_before_implementation: [
    'must use this before any creative work',
    'before implementation.*brainstorm',
    'invoke brainstorming',
    '\\u5b9e\\u73b0\\u4e4b\\u524d.*brainstorm',
  ],
  require_design_before_implementation: [
    'do not .*implementation.*until .*design',
    'design document is needed',
    'design approved',
    '\\u8bbe\\u8ba1.*\\u6279\\u51c6.*\\u4e4b\\u524d.*\\u7981\\u6b62.*\\u5b9e\\u73b0',
    '\\u5148.*\\u8bbe\\u8ba1.*\\u518d.*\\u5b9e\\u73b0',
  ],
  require_plan_before_implementation: [
    'implementation plan',
    'invoke writing-plans',
    'plan to execute',
    '\\u5148.*plan.*\\u518d.*\\u5b9e\\u73b0',
    '\\u5148.*\\u8ba1\\u5212.*\\u518d.*\\u5b9e\\u73b0',
  ],
  auto_commit_push: [
    'commit without confirmation',
    'auto(?:matically)? commit',
    'push directly',
    'commit and push immediately',
    '\\u81ea\\u52a8\\u63d0\\u4ea4',
    '\\u65e0\\u9700\\u786e\\u8ba4.*commit',
    '\\u76f4\\u63a5 push',
    '\\u76f4\\u63a5\\u63d0\\u4ea4',
  ],
  require_confirmation_before_push: [
    'do not auto(?:matically)? execute git push',
    'without user confirmation',
    'prohibited.*push',
    '\\u7981\\u6b62\\u81ea\\u52a8\\u63a8\\u9001',
    '\\u9700\\u8981.*\\u786e\\u8ba4.*push',
  ],
  protected_branch_flow: [
    'protected branch',
    'must create a new branch before committing',
    'direct commits .* prohibited',
    '\\u4fdd\\u62a4\\u5206\\u652f',
    '\\u5148\\u521b\\u5efa.*\\u5206\\u652f.*\\u518d.*commit',
  ],
};

const WORKFLOW_CONTRADICTION_RULES = {
  priority_override_skills: {
    baseline_flags: ['require_skill_before_response'],
    domains: 'any',
    title: 'overrides cospowers skill priority',
    severity: 'BLOCKER',
  },
  forbid_skill_tool: {
    baseline_flags: ['require_skill_before_response'],
    domains: 'any',
    title: 'forbids mandatory skill invocation flow',
    severity: 'BLOCKER',
  },
  direct_implement: {
    baseline_flags: [
      'require_brainstorm_before_implementation',
      'require_design_before_implementation',
      'require_plan_before_implementation',
    ],
    domains: ['workflow', 'requirement-analysis', 'overall-design'],
    title: 'bypasses analysis/design/plan flow',
    severity: 'BLOCKER',
  },
  skip_brainstorm: {
    baseline_flags: ['require_brainstorm_before_implementation'],
    domains: ['workflow', 'requirement-analysis'],
    title: 'skips brainstorming gate',
    severity: 'BLOCKER',
  },
  skip_design: {
    baseline_flags: ['require_design_before_implementation'],
    domains: ['workflow', 'overall-design'],
    title: 'skips design gate',
    severity: 'BLOCKER',
  },
  skip_plan: {
    baseline_flags: ['require_plan_before_implementation'],
    domains: ['workflow', 'overall-design', 'requirement-analysis'],
    title: 'skips planning gate',
    severity: 'WARN',
  },
  auto_commit_push: {
    baseline_flags: ['require_confirmation_before_push', 'protected_branch_flow'],
    domains: ['git-commit', 'workflow'],
    title: 'bypasses commit confirmation / protected branch flow',
    severity: 'BLOCKER',
  },
};

const ANTI_PATTERN_HEADER_MARKERS = [
  'anti-pattern',
  'anti pattern',
  '\\u53cd\\u6a21\\u5f0f',
  '\\u9700\\u907f\\u514d',
  '\\u9700\\u8981\\u907f\\u514d',
];

function compilePattern(pattern, flags = 'iu') {
  return new RegExp(pattern, flags);
}

function compilePatterns(patterns, flags = 'iu') {
  return patterns.map((pattern) => compilePattern(pattern, flags));
}

function nowUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function stripQuotes(value) {
  const trimmed = String(value).trim();
  if (trimmed.length >= 2 && (trimmed.startsWith('"') && trimmed.endsWith('"') || trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeName(value) {
  let name = String(value || '').trim().toLowerCase();
  const colonIndex = name.indexOf(':');
  if (colonIndex !== -1) {
    name = name.slice(colonIndex + 1);
  }
  return name;
}

function toPosix(filePath) {
  return filePath.replace(/\\/g, '/');
}

function isWithin(candidatePath, rootPath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function formatPath(candidatePath, projectRoot, homeDir) {
  const resolved = path.resolve(candidatePath);
  if (isWithin(resolved, projectRoot)) {
    return `./${toPosix(path.relative(path.resolve(projectRoot), resolved))}`;
  }
  if (isWithin(resolved, homeDir)) {
    return `~/${toPosix(path.relative(path.resolve(homeDir), resolved))}`;
  }
  return toPosix(resolved);
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(value);
  }
  return output;
}

function canonicalizeText(text) {
  let normalized = String(text || '').toLowerCase();
  for (const [pattern, replacement] of CANONICAL_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

function tokeniseText(text) {
  const normalized = canonicalizeText(text);
  const tokens = [];
  for (const match of normalized.matchAll(WORD_TOKEN_RE)) {
    tokens.push(match[0]);
  }
  return dedupeStrings(tokens.filter((token) => !TOKEN_STOPWORDS.has(token)));
}

function wildcardToRegExp(segment) {
  const escaped = segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'u');
}

function globFromRoot(root, pattern) {
  const results = [];
  const segments = pattern.replace(/\\/g, '/').split('/').filter(Boolean);

  function walk(currentPath, index) {
    if (index >= segments.length) {
      results.push(currentPath);
      return;
    }

    const segment = segments[index];
    if (segment.includes('*')) {
      let entries = [];
      try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
      } catch {
        return;
      }
      const regex = wildcardToRegExp(segment);
      for (const entry of entries) {
        if (!regex.test(entry.name)) {
          continue;
        }
        const nextPath = path.join(currentPath, entry.name);
        if (index === segments.length - 1) {
          results.push(nextPath);
        } else if (entry.isDirectory()) {
          walk(nextPath, index + 1);
        }
      }
      return;
    }

    const nextPath = path.join(currentPath, segment);
    if (!fs.existsSync(nextPath)) {
      return;
    }
    if (index === segments.length - 1) {
      results.push(nextPath);
      return;
    }
    try {
      if (fs.statSync(nextPath).isDirectory()) {
        walk(nextPath, index + 1);
      }
    } catch {
      return;
    }
  }

  walk(path.resolve(root), 0);
  return results;
}

function parseSpecDomains(filePath) {
  const domains = {};
  let current = null;
  let activeList = null;

  for (const rawLine of readText(filePath).split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) {
      continue;
    }
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (line === 'domains:') {
      continue;
    }
    if (indent === 2 && line.endsWith(':')) {
      const key = line.slice(0, -1);
      current = { key, label: key, keywords: [], spec_skills: [], conflict_pattern: '' };
      domains[key] = current;
      activeList = null;
      continue;
    }
    if (!current) {
      continue;
    }
    if (indent === 4 && line.startsWith('label:')) {
      current.label = stripQuotes(line.split(':', 2)[1]);
      activeList = null;
      continue;
    }
    if (indent === 4 && (line === 'keywords:' || line === 'spec_skills:')) {
      activeList = line.slice(0, -1);
      continue;
    }
    if (indent === 4 && line.startsWith('conflict_pattern:')) {
      current.conflict_pattern = stripQuotes(line.split(':', 2)[1]);
      activeList = null;
      continue;
    }
    if (indent === 6 && line.startsWith('- ') && activeList) {
      current[activeList].push(stripQuotes(line.slice(2)));
    }
  }

  return domains;
}

function parseConfigTargets(filePath) {
  const result = {
    config_files: [],
    scan_exclusions: [],
    internal_role_files: [],
    known_non_conflicting_files: [],
  };

  let currentSection = null;
  let currentItem = null;
  let activeListKey = null;

  for (const rawLine of readText(filePath).split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) {
      continue;
    }
    const indent = rawLine.length - rawLine.trimStart().length;
    const line = rawLine.trim();
    if (indent === 0 && line.endsWith(':')) {
      currentSection = line.slice(0, -1);
      currentItem = null;
      activeListKey = null;
      continue;
    }
    if (!currentSection) {
      continue;
    }
    if (currentSection === 'scan_exclusions') {
      if (indent === 2 && line.startsWith('- ')) {
        result[currentSection].push(stripQuotes(line.slice(2)));
      }
      continue;
    }
    if (indent === 2 && line.startsWith('- ')) {
      const remainder = line.slice(2);
      currentItem = {};
      result[currentSection].push(currentItem);
      activeListKey = null;
      if (remainder.includes(': ')) {
        const [key, value] = remainder.split(/: (.+)/, 2);
        currentItem[key] = stripQuotes(value);
      } else if (remainder.endsWith(':')) {
        const key = remainder.slice(0, -1);
        currentItem[key] = [];
        activeListKey = key;
      }
      continue;
    }
    if (!currentItem) {
      continue;
    }
    if (indent === 4 && line.endsWith(':')) {
      const key = line.slice(0, -1);
      currentItem[key] = [];
      activeListKey = key;
      continue;
    }
    if (indent === 4 && line.includes(': ')) {
      const [key, value] = line.split(/: (.+)/, 2);
      currentItem[key] = stripQuotes(value);
      activeListKey = null;
      continue;
    }
    if (indent === 6 && line.startsWith('- ') && activeListKey) {
      if (!Array.isArray(currentItem[activeListKey])) {
        currentItem[activeListKey] = [];
      }
      currentItem[activeListKey].push(stripQuotes(line.slice(2)));
    }
  }

  result.config_files = result.config_files.map((item) => ({
    path: item.path || '',
    location: item.location || '',
    description: item.description || '',
    check_rules: item.check_rules || [],
  }));
  return result;
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(readText(filePath));
  } catch {
    return null;
  }
}

function isDefaultMarketplaceInstallLocation(installLocation) {
  if (!installLocation) {
    return false;
  }
  return path.resolve(installLocation).startsWith(path.resolve(DEFAULT_CLAUDE_MARKETPLACES_ROOT));
}

function loadKnownMarketplaceInstallLocations(homeDir) {
  const knownMarketplacesPath = path.join(homeDir, '.claude', 'plugins', 'known_marketplaces.json');
  const data = readJsonFile(knownMarketplacesPath);
  if (!data || typeof data !== 'object') {
    return new Map();
  }

  const locations = new Map();
  for (const [marketName, record] of Object.entries(data)) {
    if (!record || typeof record !== 'object') {
      continue;
    }
    const installLocation = typeof record.installLocation === 'string' ? record.installLocation : '';
    if (!installLocation || isDefaultMarketplaceInstallLocation(installLocation)) {
      continue;
    }
    locations.set(marketName, path.resolve(installLocation));
  }
  return locations;
}

function loadInstalledPlugins(homeDir) {
  const installedPluginsPath = path.join(homeDir, '.claude', 'plugins', 'installed_plugins.json');
  const data = readJsonFile(installedPluginsPath);
  if (!data || typeof data !== 'object' || !data.plugins || typeof data.plugins !== 'object') {
    return [];
  }

  const entries = [];
  for (const [pluginKey, installs] of Object.entries(data.plugins)) {
    if (!pluginKey.includes('@') || !Array.isArray(installs)) {
      continue;
    }
    const atIndex = pluginKey.lastIndexOf('@');
    const pluginName = pluginKey.slice(0, atIndex);
    const marketName = pluginKey.slice(atIndex + 1);
    entries.push({
      pluginKey,
      pluginName,
      marketName,
      installs,
    });
  }
  return entries;
}

function discoverMarketplaceInstalledSkillFiles(homeDir) {
  const knownMarketplaces = loadKnownMarketplaceInstallLocations(homeDir);
  if (!knownMarketplaces.size) {
    return [];
  }

  const installedPlugins = loadInstalledPlugins(homeDir);
  const discovered = [];
  const seen = new Set();

  for (const entry of installedPlugins) {
    const installLocation = knownMarketplaces.get(entry.marketName);
    if (!installLocation || !fs.existsSync(installLocation)) {
      continue;
    }

    const candidateRoots = new Set();
    for (const installRecord of entry.installs) {
      if (!installRecord || typeof installRecord !== 'object') {
        continue;
      }

      const explicitInstallPath = typeof installRecord.installPath === 'string' ? installRecord.installPath : '';
      if (explicitInstallPath && fs.existsSync(explicitInstallPath)) {
        candidateRoots.add(path.resolve(explicitInstallPath));
      }

      candidateRoots.add(path.join(installLocation, entry.pluginName));
      candidateRoots.add(path.join(installLocation, 'plugins', entry.pluginName));
      if (typeof installRecord.version === 'string' && installRecord.version) {
        candidateRoots.add(path.join(installLocation, entry.pluginName, installRecord.version));
        candidateRoots.add(path.join(installLocation, 'plugins', entry.pluginName, installRecord.version));
      }
    }

    for (const candidateRoot of candidateRoots) {
      if (!fs.existsSync(candidateRoot)) {
        continue;
      }
      for (const skillFile of globFromRoot(candidateRoot, 'skills/*/SKILL.md')) {
        const resolved = path.resolve(skillFile);
        if (seen.has(resolved)) {
          continue;
        }
        seen.add(resolved);
        discovered.push(resolved);
      }
    }
  }

  return discovered;
}

function parseSkillMetadata(filePath) {
  const text = readText(filePath);
  const lines = text.split(/\r?\n/);
  const frontmatter = {};
  let bodyLines = lines;
  let title = '';

  if (lines.length > 0 && lines[0].trim() === '---') {
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line.trim() === '---') {
        bodyLines = lines.slice(index + 1);
        break;
      }
      if (line.includes(': ')) {
        const [key, value] = line.split(/: (.+)/, 2);
        frontmatter[key.trim()] = stripQuotes(value.trim());
      }
    }
  }

  for (const line of bodyLines) {
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      break;
    }
  }

  return {
    name: frontmatter.name || path.basename(path.dirname(filePath)),
    description: frontmatter.description || '',
    title,
    text,
    source: path.resolve(filePath),
  };
}

function discoverInternalSkillNames(internalSkillsRoot) {
  const names = new Map();
  if (!fs.existsSync(internalSkillsRoot)) {
    return names;
  }
  for (const skillFile of globFromRoot(internalSkillsRoot, '*/SKILL.md')) {
    names.set(normalizeName(path.basename(path.dirname(skillFile))), path.resolve(skillFile));
    const metadata = parseSkillMetadata(skillFile);
    if (metadata.name) {
      names.set(normalizeName(metadata.name), path.resolve(skillFile));
    }
  }
  return names;
}

function canonicalPath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    try {
      return fs.realpathSync(filePath);
    } catch {
      return path.resolve(filePath);
    }
  }
}

function isSamePhysicalSkillPath(sourcePath, baselinePath) {
  const sourceCanonical = toPosix(canonicalPath(sourcePath)).toLowerCase();
  const baselineCanonical = toPosix(canonicalPath(baselinePath)).toLowerCase();
  return sourceCanonical === baselineCanonical;
}

function extractSectionLines(text, headers, maxLines = 24) {
  const lines = String(text || '').split(/\r?\n/);
  const loweredHeaders = headers.map((header) => header.toLowerCase());
  const results = [];
  let collecting = false;

  for (const rawLine of lines) {
    const stripped = rawLine.trim();
    const lowered = stripped.toLowerCase();
    if (stripped.startsWith('#')) {
      collecting = loweredHeaders.some((header) => lowered.includes(header));
      continue;
    }
    if (!collecting) {
      continue;
    }
    if (!stripped) {
      if (results.length > 0) {
        break;
      }
      continue;
    }
    results.push(stripped.slice(0, 240));
    if (results.length >= maxLines) {
      break;
    }
  }
  return dedupeStrings(results);
}

function lowerBlob(...parts) {
  return parts.join('\n').toLowerCase();
}

function keywordMatches(blob, keywords) {
  const lowered = blob.toLowerCase();
  return keywords.filter((keyword) => lowered.includes(String(keyword).toLowerCase()));
}

function lineIsUnderAntiPatternHeader(lines, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const stripped = lines[cursor].trim();
    if (!stripped) {
      continue;
    }
    if (stripped.startsWith('#')) {
      const lowered = stripped.toLowerCase();
      return ANTI_PATTERN_HEADER_MARKERS.some((marker) => lowered.includes(marker.toLowerCase()));
    }
  }
  return false;
}

function filterAntiPatternEvidence(text, items) {
  if (!items.length) {
    return [];
  }
  const lines = String(text || '').split(/\r?\n/);
  const allowed = [];
  for (const item of items) {
    let keep = true;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].trim() === item.trim() && lineIsUnderAntiPatternHeader(lines, index)) {
        keep = false;
        break;
      }
    }
    if (keep) {
      allowed.push(item);
    }
  }
  return dedupeStrings(allowed);
}

function extractByPatterns(text, patterns, maxItems = 5) {
  const matches = [];
  const regexes = compilePatterns(patterns);
  const lines = String(text || '').split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || lineIsUnderAntiPatternHeader(lines, index)) {
      continue;
    }
    if (regexes.some((regex) => regex.test(line))) {
      matches.push(line.slice(0, 240));
    }
    if (matches.length >= maxItems) {
      break;
    }
  }
  return dedupeStrings(matches);
}

function semanticPatternMatches(text, patterns, maxItems = 6) {
  return extractByPatterns(text, patterns, maxItems);
}

function extractTriggers(metadata) {
  const snippets = [];
  const probe = [metadata.description, metadata.title, metadata.text.slice(0, 4000)].join('\n');
  for (const pattern of TRIGGER_HINT_PATTERNS) {
    const regex = compilePattern(pattern, 'igu');
    for (const match of probe.matchAll(regex)) {
      snippets.push(match[0].split(/\s+/).join(' ').slice(0, 240));
      if (snippets.length >= 5) {
        return dedupeStrings(snippets);
      }
    }
  }
  return dedupeStrings(snippets);
}

function extractTriggerLines(metadata, maxItems = 8) {
  const lines = dedupeStrings([
    ...extractTriggers(metadata),
    ...extractSectionLines(metadata.text, TRIGGER_SECTION_HEADERS, maxItems),
  ]);
  return lines.slice(0, maxItems);
}

function extractWorkflowLines(text, maxItems = 12) {
  const results = [];
  const tokens = [
    'brainstorm',
    'plan',
    'design',
    'spec',
    'commit',
    'push',
    'review',
    'direct_code',
    'skip',
    'requirement',
  ];

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    const lowered = canonicalizeText(line);
    if (!line) {
      continue;
    }
    if (tokens.some((token) => lowered.includes(token))) {
      results.push(line.slice(0, 240));
    }
    if (results.length >= maxItems) {
      break;
    }
  }
  return dedupeStrings(results);
}

function extractSemanticFlags(text) {
  const flags = {};
  for (const [key, patterns] of Object.entries(SEMANTIC_FLAG_PATTERNS)) {
    const matched = filterAntiPatternEvidence(text, semanticPatternMatches(text, patterns));
    if (matched.length) {
      flags[key] = matched;
    }
  }
  return flags;
}

function buildInternalDomainBaselines(internalSkillsRoot, domains) {
  const baselines = {};
  const metadataByName = new Map();

  for (const skillFile of globFromRoot(internalSkillsRoot, '*/SKILL.md')) {
    const metadata = parseSkillMetadata(skillFile);
    metadataByName.set(normalizeName(metadata.name || path.basename(path.dirname(skillFile))), metadata);
    metadataByName.set(normalizeName(path.basename(path.dirname(skillFile))), metadata);
  }

  for (const [key, domain] of Object.entries(domains)) {
    const baseline = {
      domain_key: key,
      domain_label: domain.label,
      spec_skill_names: [...domain.spec_skills],
      trigger_hints: [],
      trigger_tokens: [],
      semantic_flags: {},
      workflow_lines: [],
    };

    const triggerLines = [];
    const workflowLines = [];
    const mergedFlags = {};

    for (const skillName of domain.spec_skills) {
      const metadata = metadataByName.get(normalizeName(skillName));
      if (!metadata) {
        continue;
      }
      triggerLines.push(...extractTriggerLines(metadata));
      workflowLines.push(...extractWorkflowLines(metadata.text));
      const flags = extractSemanticFlags(metadata.text);
      for (const [flagKey, matchedLines] of Object.entries(flags)) {
        if (!mergedFlags[flagKey]) {
          mergedFlags[flagKey] = [];
        }
        mergedFlags[flagKey].push(...matchedLines);
      }
    }

    baseline.trigger_hints = dedupeStrings(triggerLines).slice(0, 12);
    baseline.trigger_tokens = tokeniseText(baseline.trigger_hints.join(' '));
    baseline.workflow_lines = dedupeStrings(workflowLines).slice(0, 16);
    for (const [flagKey, lines] of Object.entries(mergedFlags)) {
      baseline.semantic_flags[flagKey] = dedupeStrings(lines).slice(0, 8);
    }
    baselines[key] = baseline;
  }

  return baselines;
}

function discoverSkillFiles(projectRoot, homeDir, internalSkillsRoot) {
  const candidates = [];
  const seen = new Set();
  const searchRoots = [projectRoot, homeDir];

  for (const root of searchRoots) {
    for (const pattern of SKILL_SCAN_PATTERNS) {
      for (const candidate of globFromRoot(root, pattern)) {
        let stats;
        try {
          stats = fs.statSync(candidate);
        } catch {
          continue;
        }
        if (!stats.isFile()) {
          continue;
        }
        const resolved = path.resolve(candidate);
        if (seen.has(resolved)) {
          continue;
        }
        seen.add(resolved);
        candidates.push(resolved);
      }
    }
  }

  for (const candidate of globFromRoot(internalSkillsRoot, '*/SKILL.md')) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    candidates.push(resolved);
  }

  for (const candidate of discoverMarketplaceInstalledSkillFiles(homeDir)) {
    const resolved = path.resolve(candidate);
    if (seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    candidates.push(resolved);
  }

  return candidates.sort((left, right) => toPosix(left).toLowerCase().localeCompare(toPosix(right).toLowerCase()));
}

function discoverRuntimeSkillRecords({ projectRoot, homeDir, internalSkillsRoot }) {
  const discovered = discoverSkillFiles(projectRoot, homeDir, internalSkillsRoot);
  return [
    discovered.map((skillFile) => ({
      name: path.basename(path.dirname(skillFile)),
      source: skillFile,
      description: '',
      title: '',
    })),
    {
      mode: 'filesystem_primary',
      filesystem_records_loaded: discovered.length,
    },
  ];
}

function isInternalPluginCache(candidatePath) {
  const raw = path.resolve(candidatePath);
  return INTERNAL_PLUGIN_MARKERS.some((marker) => raw.includes(marker));
}

function extractHardGateLines(text, maxItems = 6) {
  const results = [];
  const hardGateRegex = /<HARD-GATE>([\s\S]*?)<\/HARD-GATE>/giu;
  for (const match of String(text || '').matchAll(hardGateRegex)) {
    for (const rawLine of match[1].split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line) {
        results.push(line.slice(0, 240));
      }
      if (results.length >= maxItems) {
        return dedupeStrings(results);
      }
    }
  }

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    const lowered = line.toLowerCase();
    if (lowered.includes('hard-gate') || lowered.includes('hard gate')) {
      results.push(line.slice(0, 240));
    } else if (['MUST', 'NEVER', 'REQUIRED', '\u5fc5\u987b', '\u7981\u6b62'].some((token) => line.includes(token))) {
      results.push(line.slice(0, 240));
    }
    if (results.length >= maxItems) {
      break;
    }
  }
  return dedupeStrings(results);
}

function triggerOverlapScore(candidateTokens, baselineTokens) {
  const candidateSet = new Set(candidateTokens);
  const baselineSet = new Set(baselineTokens);
  if (!candidateSet.size || !baselineSet.size) {
    return [0, []];
  }
  const overlap = [...candidateSet].filter((token) => baselineSet.has(token)).sort();
  const denominator = Math.min(candidateSet.size, baselineSet.size);
  const score = denominator ? overlap.length / denominator : 0;
  return [score, overlap.slice(0, 8)];
}

function compareDomainTriggers(matchedDomains, candidateTriggerLines, baselines) {
  const candidateTokens = tokeniseText(candidateTriggerLines.join(' '));
  const comparisons = [];

  for (const domain of matchedDomains) {
    const baseline = baselines[domain.domain_key];
    if (!baseline) {
      continue;
    }
    const [score, overlap] = triggerOverlapScore(candidateTokens, baseline.trigger_tokens);
    let assessment = 'trigger_unclear';
    if (score >= 0.6) {
      assessment = 'high_overlap';
    } else if (score >= 0.25) {
      assessment = 'possible_overlap';
    } else if (candidateTriggerLines.length) {
      assessment = 'different_or_weak_overlap';
    }
    comparisons.push({
      domain_key: domain.domain_key,
      domain_label: domain.domain_label,
      score: Number(score.toFixed(3)),
      assessment,
      overlap_tokens: overlap,
      baseline_trigger_hints: baseline.trigger_hints.slice(0, 4),
    });
  }
  return comparisons;
}

function detectWorkflowContradictions({ matchedDomains, externalFlags, baselines }) {
  const contradictions = [];
  const matchedDomainKeys = new Set(matchedDomains.map((item) => item.domain_key));

  for (const [externalFlag, rule] of Object.entries(WORKFLOW_CONTRADICTION_RULES)) {
    if (!externalFlags[externalFlag]) {
      continue;
    }
    if (rule.domains !== 'any') {
      const applicable = rule.domains.some((domain) => matchedDomainKeys.has(domain));
      if (!applicable) {
        continue;
      }
    }

    for (const baselineFlag of rule.baseline_flags) {
      const matchedBaselines = [];
      for (const domainKey of matchedDomainKeys) {
        const baseline = baselines[domainKey];
        if (!baseline || !baseline.semantic_flags[baselineFlag]) {
          continue;
        }
        matchedBaselines.push({
          domain_key: domainKey,
          domain_label: baseline.domain_label,
          spec_skill_names: baseline.spec_skill_names.slice(0, 5),
          baseline_flag: baselineFlag,
          baseline_evidence: baseline.semantic_flags[baselineFlag].slice(0, 3),
        });
      }

      if (matchedBaselines.length) {
        contradictions.push({
          title: rule.title,
          severity: rule.severity,
          external_flag: externalFlag,
          external_evidence: externalFlags[externalFlag].slice(0, 3),
          matched_baselines: matchedBaselines,
        });
      }
    }
  }

  return contradictions;
}

function classifySkillCandidate(
  matchedDomains,
  triggerComparisons,
  workflowContradictions,
  prioritySignals,
  bypassSignals,
  skillToolDisableSignals,
  autoCommitSignals,
  hardGateLines,
) {
  const reasons = [];
  const highOverlap = triggerComparisons.some((item) => item.assessment === 'high_overlap');
  const possibleOverlap = triggerComparisons.some((item) => item.assessment === 'possible_overlap');
  const contradictionLevels = new Set(workflowContradictions.map((item) => item.severity));

  if (highOverlap) {
    reasons.push('high trigger overlap with cospowers domain baseline');
  } else if (possibleOverlap) {
    reasons.push('possible trigger overlap with cospowers domain baseline');
  }
  if (workflowContradictions.length) {
    reasons.push('workflow contradiction with cospowers baseline');
  }
  if (prioritySignals.length) {
    reasons.push('explicit priority override');
  }
  if (bypassSignals.length) {
    reasons.push('workflow bypass / direct-to-code language');
  }
  if (skillToolDisableSignals.length) {
    reasons.push('explicit Skill tool disable language');
  }
  if (autoCommitSignals.length) {
    reasons.push('commit/push without confirmation language');
  }
  if (hardGateLines.length) {
    reasons.push('mandatory workflow language');
  }

  const matchedDomainKeys = new Set(matchedDomains.map((item) => item.domain_key));
  let blocker = contradictionLevels.has('BLOCKER');
  blocker = blocker || Boolean(prioritySignals.length || bypassSignals.length || skillToolDisableSignals.length);
  blocker = blocker || Boolean(autoCommitSignals.length && matchedDomainKeys.has('git-commit'));
  return [blocker ? 'BLOCKER' : 'WARN', reasons];
}

function scanSkills({ projectRoot, homeDir, internalSkillsRoot, domains, baselines }) {
  const internalNames = discoverInternalSkillNames(internalSkillsRoot);
  const [discovered, discoveryMeta] = discoverRuntimeSkillRecords({
    projectRoot,
    homeDir,
    internalSkillsRoot,
  });

  const findings = [];
  const sameSkill = [];
  let internalSkipped = 0;

  for (const runtimeSkill of discovered) {
    const resolved = path.resolve(runtimeSkill.source);
    if (isWithin(resolved, internalSkillsRoot) || isInternalPluginCache(resolved)) {
      internalSkipped += 1;
      continue;
    }
    if (!fs.existsSync(resolved)) {
      continue;
    }
    let stats;
    try {
      stats = fs.statSync(resolved);
    } catch {
      continue;
    }
    if (!stats.isFile()) {
      continue;
    }

    const metadata = parseSkillMetadata(resolved);
    if (runtimeSkill.description && !metadata.description) {
      metadata.description = runtimeSkill.description;
    }
    if (runtimeSkill.title && !metadata.title) {
      metadata.title = runtimeSkill.title;
    }
    if (runtimeSkill.name) {
      metadata.name = runtimeSkill.name;
    }

    const normalizedName = normalizeName(metadata.name || path.basename(path.dirname(resolved)));
    if (internalNames.has(normalizedName)) {
      const baselinePath = internalNames.get(normalizedName);
      if (baselinePath && isSamePhysicalSkillPath(resolved, baselinePath)) {
        sameSkill.push({
          skill_name: metadata.name,
          source: formatPath(resolved, projectRoot, homeDir),
          reason: 'same skill name resolves to the same physical baseline file',
        });
        continue;
      }
      if (baselinePath) {
        findings.push({
          type: 'skill',
          conflict_kind: 'same_name_path_collision',
          provisional_level: 'BLOCKER',
          needs_model_review: false,
          skill_name: metadata.name,
          source: formatPath(resolved, projectRoot, homeDir),
          baseline_source: formatPath(baselinePath, projectRoot, homeDir),
          obvious_conflict_reasons: [
            'same skill name exists at a different physical path than the cospowers baseline',
          ],
        });
        continue;
      }
    }

    const blob = lowerBlob(metadata.name, metadata.description, metadata.title);
    const matchedDomains = [];
    for (const [key, domain] of Object.entries(domains)) {
      const matched = keywordMatches(blob, domain.keywords);
      if (matched.length) {
        matchedDomains.push({
          domain_key: key,
          domain_label: domain.label,
          keywords: matched,
          spec_skills: domain.spec_skills,
        });
      }
    }

    if (!matchedDomains.length) {
      continue;
    }

    const prioritySignals = filterAntiPatternEvidence(metadata.text, extractByPatterns(metadata.text, PRIORITY_OVERRIDE_PATTERNS));
    const bypassSignals = filterAntiPatternEvidence(metadata.text, extractByPatterns(metadata.text, BYPASS_PATTERNS));
    const skillToolDisableSignals = filterAntiPatternEvidence(metadata.text, extractByPatterns(metadata.text, SKILL_TOOL_DISABLE_PATTERNS));
    const autoCommitSignals = filterAntiPatternEvidence(metadata.text, extractByPatterns(metadata.text, AUTO_COMMIT_PATTERNS));
    const hardGateLines = filterAntiPatternEvidence(metadata.text, extractHardGateLines(metadata.text));
    const triggerHints = extractTriggerLines(metadata);
    const semanticFlags = extractSemanticFlags(metadata.text);
    const triggerComparisons = compareDomainTriggers(matchedDomains, triggerHints, baselines);
    const workflowContradictions = detectWorkflowContradictions({
      matchedDomains,
      externalFlags: semanticFlags,
      baselines,
    });

    const hasReviewSignal = [
      triggerHints,
      prioritySignals,
      bypassSignals,
      skillToolDisableSignals,
      autoCommitSignals,
      hardGateLines,
      workflowContradictions,
    ].some((items) => items.length);

    if (!hasReviewSignal) {
      continue;
    }

    const [provisionalLevel, reasons] = classifySkillCandidate(
      matchedDomains,
      triggerComparisons,
      workflowContradictions,
      prioritySignals,
      bypassSignals,
      skillToolDisableSignals,
      autoCommitSignals,
      hardGateLines,
    );

    findings.push({
      type: 'skill',
      provisional_level: provisionalLevel,
      needs_model_review: true,
      skill_name: metadata.name,
      source: formatPath(resolved, projectRoot, homeDir),
      domain_keys: matchedDomains.map((item) => item.domain_key),
      trigger_hints: triggerHints,
      trigger_comparisons: triggerComparisons.map((item) => ({
        domain_key: item.domain_key,
        assessment: item.assessment,
      })),
      workflow_contradictions: workflowContradictions.map((item) => ({
        severity: item.severity,
        reason: item.reason,
      })),
      priority_signals: prioritySignals,
      bypass_signals: bypassSignals,
      skill_tool_disable_signals: skillToolDisableSignals,
      auto_commit_signals: autoCommitSignals,
      hard_gate_lines: hardGateLines,
      obvious_conflict_reasons: reasons,
    });
  }

  return {
    discovery_mode: discoveryMeta.mode,
    filesystem_records_loaded: discoveryMeta.filesystem_records_loaded || 0,
    discovered_skill_files: discovered.length,
    internal_skills_skipped: internalSkipped,
    same_skill_skipped: sameSkill,
    findings,
  };
}

function resolveConfigPaths(target, projectRoot) {
  const rawPath = target.path;
  if (rawPath.startsWith('~/')) {
    const homeDir = os.homedir();
    const pattern = rawPath.slice(2);
    if (pattern.includes('*')) {
      return globFromRoot(homeDir, pattern).map((item) => path.resolve(item));
    }
    return [path.join(homeDir, pattern)];
  }

  if (PROJECT_CASCADE_FILENAMES.has(rawPath)) {
    const paths = [];
    const seen = new Set();
    let current = path.resolve(projectRoot);
    for (;;) {
      const candidate = path.join(current, rawPath);
      const resolved = path.resolve(candidate);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        paths.push(candidate);
      }
      const parent = path.dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }
    return paths;
  }

  if (rawPath.includes('*')) {
    return globFromRoot(projectRoot, rawPath).map((item) => path.resolve(item));
  }

  return [path.join(projectRoot, rawPath)];
}

function shouldExpandMemoryReferences(filePath) {
  return path.basename(filePath).toUpperCase() === 'MEMORY.MD';
}

function normalizeReferenceTarget(rawTarget) {
  let target = String(rawTarget || '').trim();
  if (!target) {
    return '';
  }
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }
  const hashIndex = target.indexOf('#');
  if (hashIndex !== -1) {
    target = target.slice(0, hashIndex);
  }
  return target.trim();
}

function iterMemoryReferenceTargets(content) {
  const targets = [];
  for (const match of String(content || '').matchAll(MARKDOWN_LINK_RE)) {
    const target = normalizeReferenceTarget(match[1]);
    if (target) {
      targets.push(target);
    }
  }
  for (const match of String(content || '').matchAll(BARE_MD_PATH_RE)) {
    const target = normalizeReferenceTarget(match[1]);
    if (target) {
      targets.push(target);
    }
  }
  return dedupeStrings(targets);
}

function resolveMemoryReference(baseFile, rawTarget) {
  const target = normalizeReferenceTarget(rawTarget);
  if (!target) {
    return null;
  }
  if (target.startsWith('~/')) {
    return path.resolve(path.join(os.homedir(), target.slice(2)));
  }
  if (path.isAbsolute(target)) {
    return path.resolve(target);
  }
  return path.resolve(path.dirname(baseFile), target);
}

function memoryReferenceRoots(baseFile) {
  const roots = [path.resolve(path.dirname(baseFile))];
  try {
    roots.push(path.resolve(path.dirname(path.dirname(baseFile))));
  } catch {
    return roots;
  }
  return roots;
}

function isWithinAnyRoot(candidatePath, roots) {
  return roots.some((root) => isWithin(candidatePath, root));
}

function expandMemoryReferenceFiles(memoryFile) {
  const visited = new Set();
  const expanded = [];
  const issues = [];
  const roots = memoryReferenceRoots(memoryFile);

  function walk(currentFile) {
    const resolvedCurrent = path.resolve(currentFile);
    if (visited.has(resolvedCurrent)) {
      return;
    }
    visited.add(resolvedCurrent);

    let content;
    try {
      content = readText(resolvedCurrent);
    } catch (error) {
      issues.push({
        path: toPosix(resolvedCurrent),
        issue: `unreadable memory reference: ${error.message}`,
      });
      return;
    }

    for (const rawTarget of iterMemoryReferenceTargets(content)) {
      const candidate = resolveMemoryReference(resolvedCurrent, rawTarget);
      if (!candidate) {
        continue;
      }
      if (!isWithinAnyRoot(candidate, roots)) {
        issues.push({
          path: toPosix(candidate),
          issue: 'memory reference skipped: outside allowed roots',
        });
        continue;
      }
      if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
        issues.push({
          path: toPosix(candidate),
          issue: 'memory reference target not found',
        });
        continue;
      }
      const suffix = path.extname(candidate).toLowerCase();
      if (suffix !== '.md' && suffix !== '.markdown') {
        continue;
      }
      if (!expanded.includes(candidate)) {
        expanded.push(candidate);
      }
      walk(candidate);
    }
  }

  walk(path.resolve(memoryFile));
  return [
    expanded.filter((candidate) => path.resolve(candidate) !== path.resolve(memoryFile)),
    issues,
  ];
}

function parseSettingsJson(content) {
  try {
    const data = JSON.parse(content);
    const disabledSkills = Array.isArray(data.disabledSkills) ? data.disabledSkills.map(String) : [];
    let denyEntries = [];
    if (data.permissions && typeof data.permissions === 'object' && Array.isArray(data.permissions.deny)) {
      denyEntries = data.permissions.deny.map(String);
    }
    return [disabledSkills, denyEntries, null];
  } catch (error) {
    return [[], [], `invalid JSON: ${error.message}`];
  }
}

function detectConfigSemanticCategories(content) {
  const categories = {
    priority_override: semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.priority_override_skills),
    workflow_bypass: dedupeStrings([
      ...semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.direct_implement),
      ...semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.skip_brainstorm),
      ...semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.skip_design),
      ...semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.skip_plan),
    ]),
    skill_tool_disable: semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.forbid_skill_tool),
    auto_commit: semanticPatternMatches(content, SEMANTIC_FLAG_PATTERNS.auto_commit_push),
  };

  const filtered = {};
  for (const [key, value] of Object.entries(categories)) {
    if (value.length) {
      filtered[key] = value;
    }
  }
  return filtered;
}

function classifyConfigMatch(category, line) {
  const lowered = String(line || '').toLowerCase();
  if (category === 'preloaded_instruction_file_present') {
    return 'BLOCKER';
  }
  if (category === 'workflow_bypass' || category === 'skill_tool_disable' || category === 'auto_commit') {
    return 'BLOCKER';
  }
  if (category === 'priority_override') {
    if (lowered.includes('ignore') || line.includes('\u8986\u76d6') || lowered.includes('override')) {
      return 'BLOCKER';
    }
    return 'WARN';
  }
  if (category === 'disabled_skill') {
    return CORE_PIPELINE_SKILLS.has(normalizeName(line)) ? 'BLOCKER' : 'WARN';
  }
  if (category === 'permission_deny') {
    if (lowered.includes('skill') || lowered.trim() === '*') {
      return 'BLOCKER';
    }
    return 'WARN';
  }
  return 'WARN';
}

function appendFinding(findings, { projectRoot, homeDir, sourcePath, category, line }) {
  const level = classifyConfigMatch(category, line);
  findings.push({
    type: 'config',
    level,
    source: formatPath(sourcePath, projectRoot, homeDir),
    category,
    evidence: String(line).slice(0, 240),
  });
}

function scanConfigFile(filePath, target, projectRoot, homeDir, sourceKind = 'config') {
  const findings = [];

  const formattedPath = formatPath(filePath, projectRoot, homeDir);
  if (PRELOADED_INSTRUCTION_FILENAMES.has(path.basename(filePath)) || formattedPath === '~/.codex/AGENTS.md' || formattedPath === '~/.AGENTS.override.md') {
    appendFinding(findings, {
      projectRoot,
      homeDir,
      sourcePath: filePath,
      category: 'preloaded_instruction_file_present',
      line: `${path.basename(filePath)} exists`,
    });
  }

  let content = '';
  try {
    content = readText(filePath);
  } catch {
    return findings;
  }

  const semanticCategories = detectConfigSemanticCategories(content);
  for (const line of semanticCategories.priority_override || []) {
    appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'priority_override', line });
  }
  for (const line of semanticCategories.workflow_bypass || []) {
    appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'workflow_bypass', line });
  }
  for (const line of semanticCategories.skill_tool_disable || []) {
    appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'skill_tool_disable', line });
  }
  for (const line of semanticCategories.auto_commit || []) {
    appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'auto_commit', line });
  }

  const basename = path.basename(filePath);
  if (basename === 'settings.json' || basename === 'settings.local.json') {
    const [disabledSkills, denyEntries, parseError] = parseSettingsJson(content);
    if (parseError) {
      findings.push({
        type: 'config',
        level: 'WARN',
        source: formatPath(filePath, projectRoot, homeDir),
        category: 'settings_parse',
        evidence: parseError,
      });
    }
    for (const skillName of disabledSkills) {
      appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'disabled_skill', line: skillName });
    }
    for (const denyEntry of denyEntries) {
      appendFinding(findings, { projectRoot, homeDir, sourcePath: filePath, category: 'permission_deny', line: denyEntry });
    }
  }

  return findings;
}

function scanConfigs(projectRoot, configSpec) {
  const homeDir = os.homedir();
  const findings = [];
  const internalRolePaths = new Set(
    (configSpec.internal_role_files || [])
      .filter((item) => item && item.path)
      .map((item) => toPosix(item.path))
  );

  for (const target of configSpec.config_files) {
    const paths = resolveConfigPaths(target, projectRoot);
    if (!paths.length) {
      continue;
    }

    for (const candidatePath of paths) {
      const relative = toPosix(candidatePath);
      if (internalRolePaths.has(relative)) {
        continue;
      }
      if (!fs.existsSync(candidatePath)) {
        continue;
      }

      findings.push(...scanConfigFile(candidatePath, target, projectRoot, homeDir));

      if (shouldExpandMemoryReferences(candidatePath)) {
        const [referencedFiles] = expandMemoryReferenceFiles(candidatePath);
        for (const referencedFile of referencedFiles) {
          findings.push(...scanConfigFile(
            referencedFile,
            target,
            projectRoot,
            homeDir,
            'memory_reference',
          ));
        }
      }
    }
  }

  return { findings };
}

function summariseLevels(findings, key = 'level') {
  const counts = { BLOCKER: 0, WARN: 0 };
  for (const finding of findings) {
    const level = finding[key];
    if (Object.prototype.hasOwnProperty.call(counts, level)) {
      counts[level] += 1;
    }
  }
  return counts;
}

function buildJsonReport({ projectRoot, pluginRoot, skillScan, configScan }) {
  const configCounts = summariseLevels(configScan.findings, 'level');
  const skillCounts = summariseLevels(skillScan.findings, 'provisional_level');
  const scriptConfirmedSkillFindings = [];
  const modelReviewSkillCandidates = [];
  for (const finding of skillScan.findings) {
    if (finding.needs_model_review === false) {
      scriptConfirmedSkillFindings.push(finding);
    } else {
      modelReviewSkillCandidates.push(finding);
    }
  }

  const scriptConfirmedConfigFindings = [];
  const modelReviewConfigCandidates = [];
  const scriptConfirmedConfigCategories = new Set([
    'preloaded_instruction_file_present',
    'disabled_skill',
    'permission_deny',
    'settings_parse',
  ]);
  for (const finding of configScan.findings) {
    if (scriptConfirmedConfigCategories.has(finding.category)) {
      scriptConfirmedConfigFindings.push(finding);
    } else {
      modelReviewConfigCandidates.push(finding);
    }
  }

  return {
    generated_at: nowUtc(),
    project_root: toPosix(path.resolve(projectRoot)),
    plugin_root: toPosix(path.resolve(pluginRoot)),
    mode: 'script-first-manual-scan',
    summary: {
      script_confirmed_findings: scriptConfirmedSkillFindings.length + scriptConfirmedConfigFindings.length,
      model_review_skill_candidates: modelReviewSkillCandidates.length,
      model_review_config_candidates: modelReviewConfigCandidates.length,
      skill_provisional_levels: skillCounts,
      config_levels: configCounts,
    },
    script_confirmed_findings: {
      skills: scriptConfirmedSkillFindings,
      configs: scriptConfirmedConfigFindings,
    },
    model_review_candidates: {
      skills: modelReviewSkillCandidates,
      configs: modelReviewConfigCandidates,
    },
  };
}

function ensureReportDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseArgs(argv) {
  const args = {
    projectRoot: '.',
    reportDir: 'docs',
    printSummary: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--project-root') {
      index += 1;
      args.projectRoot = argv[index] || '.';
    } else if (arg === '--report-dir') {
      index += 1;
      args.reportDir = argv[index] || 'docs';
    } else if (arg === '--print-summary') {
      args.printSummary = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }

  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: env_conflict_checker.js [options]',
      '',
      'Options:',
      '  --project-root <path>   Project root to scan',
      '  --report-dir <path>     Directory for reports (default: docs)',
      '  --print-summary         Print short JSON summary',
      '  -h, --help              Show this help message',
      '',
    ].join('\n')
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const projectRoot = path.resolve(args.projectRoot);
  let reportDir = args.reportDir;
  if (!path.isAbsolute(reportDir)) {
    reportDir = path.join(projectRoot, reportDir);
  }

  const pluginRoot = path.resolve(__dirname, '..', '..', '..');
  const internalSkillsRoot = path.join(pluginRoot, 'skills');
  const skillDir = path.resolve(__dirname, '..');
  const referencesDir = path.join(skillDir, 'references');

  const domains = parseSpecDomains(path.join(referencesDir, 'spec-domains.yaml'));
  const configSpec = parseConfigTargets(path.join(referencesDir, 'config-files.yaml'));
  const baselines = buildInternalDomainBaselines(internalSkillsRoot, domains);
  const skillScan = scanSkills({
    projectRoot,
    homeDir: os.homedir(),
    internalSkillsRoot,
    domains,
    baselines,
  });
  const configScan = scanConfigs(projectRoot, configSpec);
  const report = buildJsonReport({
    projectRoot,
    pluginRoot,
    skillScan,
    configScan,
  });

  ensureReportDir(reportDir);
  const jsonPath = path.join(reportDir, 'env-conflict-report.json');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (args.printSummary) {
    process.stdout.write(`${JSON.stringify({
      generated_at: report.generated_at,
      json_report: jsonPath,
      script_confirmed_findings: report.summary.script_confirmed_findings,
      model_review_skill_candidates: report.summary.model_review_skill_candidates,
      model_review_config_candidates: report.summary.model_review_config_candidates,
    })}\n`);
  }
  return 0;
}

process.exitCode = main();
