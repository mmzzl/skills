# env-conflict-checker 中文说明

> 本文件给人看，AI 实际遵循同目录下的 `SKILL.md`。

## 现在的实现方式

`env-conflict-checker` 现在是“脚本优先，模型复核”：

1. 先由本地脚本直接扫描磁盘上的 skill / plugin cache / config
2. 脚本把所有可确定的静态检查结果写到 `docs/`
3. 再由模型读取报告，对候选冲突做语义判断

它仍然是**手动触发**，不走 hook。

## 脚本入口

统一入口：直接用 Node.js 18+ 运行：

```powershell
node "<resolved-skill-dir>/scripts/env_conflict_checker.js" --project-root .
```

## 输出位置

- `docs/env-conflict-report.json`

其中：

- `json` 是结构化源数据
- `md` 是给人快速阅读的摘要页

## 当前检测范围

### 脚本直接检测

- skill 扫描路径
- 文件是否存在、是否可读
- 同名 skill 仅在解析到同一物理文件时才去重
- 同名但不同物理路径的 skill 直接记为 `BLOCKER`
- cospowers 自身排除
- 内部 role 文件排除
- skill 元数据提取
- 能力域关键词命中
- trigger 语句提取
- HARD-GATE 信号提取
- direct-to-code / workflow bypass 信号提取
- 显式优先级覆盖语句
- 显式禁用 Skill tool 语句
- 显式跳过 planning / design / brainstorming 语句
- 显式 commit / push 无确认语句
- `disabledSkills`
- `permissions.deny`
- `MEMORY.md` 正文扫描
- `MEMORY.md` 引用的 `.md` 递归扫描
- 明显硬冲突 provisional 分类
- 候选项整理
- 报告输出

### 模型负责判断

- trigger 场景是否真的重叠
- 同域 skill 是否只是范围不同
- 工作流到底是互补、竞争还是冲突
- HARD-GATE 信号是否形成真实竞争工作流
- priority 文案是否真的覆盖 cospowers
- direct-to-code 文案是否是真绕过还是误报
- memory 体系中的内容到底是偏好还是 override
- 最终 `WARN` / `BLOCKER` / `NO_CONFLICT` 结论
- 面向用户的解释与处理建议

## 当前范围约束

- 检测项目级和用户级位置
- 报告落到 `docs/`
- 扫描范围内的外部 skill 按统一规则检测
- `INFO` 不写入报告
- `MEMORY.md` 会递归扫描被引用的 `.md` 文件

## Skill 枚举策略

现在的 skill 枚举逻辑是：

- 只由脚本直接扫描本地 skill 目录和插件缓存
- skill 枚举仅来自文件系统扫描

因此报告里的 `skill_discovery.mode` 固定反映为：

- `filesystem_primary`

## 读写边界

这个 skill 仍然是只读诊断：

- 不自动禁用 skill
- 不自动修改配置
- 不自动修复

如果用户后续要求处理，AI 只应给出明确命令或配置片段，不能默认直接执行。
## 最终输出格式

最终回复固定为两段：

- `问题`
- `建议`

格式要求：

- `问题` 必须是一个 Markdown 表格
- 表头固定为：`级别 | 位置 | 问题 | 处理`
- 表中只允许出现 `BLOCKER` 和 `WARN`
- 行顺序必须先 `BLOCKER`，再 `WARN`
- `建议` 必须是逐条列表，一条建议一行
- 不应输出扫描过程、阶段说明、候选计数、误报分析

## 判决收紧规则

为减少模型二次复核时的摇摆，当前额外收紧以下口径：

- 命中 `preloaded_instruction_file_present` 的文件，只要存在就必须报；不能因为内容为空、内容无害、只有个人偏好就放过
- 命中自动 `push` 的外部 skill，按 `BLOCKER` 处理
- 命中无确认自动 `commit` 的外部 skill，至少按 `WARN` 处理；若属于可复用工作流，按 `BLOCKER` 处理
- 命中显式覆盖 / ignore / supersede 其他 skill 的优先级语句，按 `BLOCKER` 处理
- 命中 active 的 direct-to-code / skip-design / skip-brainstorm 指令时，不能降为无冲突
- 同域同触发的 skill，不能仅因为“操作不同文档 / 不同产物 / 不同层级”就降为无冲突
## 路径规则

- `env_conflict_checker.js` 必须按当前 skill 目录解析
- 不能假设目标项目里存在 `./skills/env-conflict-checker/`
- 不能用被扫描项目的根目录去拼这个脚本路径
- 正确调用形式是：

```powershell
node "<resolved-skill-dir>/scripts/env_conflict_checker.js" --project-root .
```
