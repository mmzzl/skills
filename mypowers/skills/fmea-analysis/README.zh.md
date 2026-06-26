# FMEA Analysis — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`。

## 概述

从 Excel《FMEA分析表模板》转换的独立 FMEA 分析 skill。提供完整的 S/O/D 评分准则、AP 措施优先级矩阵（1000 组合 JSON）、字段定义规范和输出审核清单。

本 skill 是**被调用型 tool skill**，由 `module-design-spec` 在撰写 Ch.5 §5.2.5 FMEA 表时调用，由 `module-design-evaluator` 在 §0.3 FMEA 检查时引用规则文件。

## 目录说明

```
skills/fmea-analysis/
├── SKILL.md                        ← AI 工作流定义
├── README.zh.md                    ← 本文档
├── rules/
│   ├── fmea_fields.md              ← 17 字段定义与填写规则
│   ├── s_scoring.md                ← S 严重程度 1-10 评分准则
│   ├── o_scoring.md                ← O 发生概率 1-10 评分准则
│   ├── d_scoring.md                ← D 检测度 1-10 评分准则
│   ├── ap_priority.md              ← AP 范围规则（S/O/D→H/M/L 精确查表）
├── templates/
│   └── review_checklist.md         ← 13 项输出前自检清单
```

## 核心设计原则

1. **AP 必须查表**：不允许主观填写，必须从 `ap_priority.md` 的 S/O/D 范围表精确查表
2. **禁止 RPN**：不使用 RPN（S×O×D）替代 AP
3. **失效模式 ≠ 失效原因**：严格区分，一个原因一行
4. **客户业务影响**：失效影响必须写对客户业务的影响，而非只写技术故障
5. **管理层评审**：S=9~10 且 AP=H/M 的高风险项需提示管理层评审

## 来源

从 `FMEA分析表模板_20240723.xlsx` 转换，AP 矩阵已展开为 1000 个 S/O/D 组合，避免 AI 推理错误。
