# 新闻分析技能更新说明

## 更新时间
2026-03-30

## 更新内容

### 1. 新增AI深度分析功能

#### 新增文件
- `scripts/ai_analysis.py` - AI分析模块
  - `analyze_news_with_ai()` - 使用AI分析新闻数据
  - `generate_ai_report()` - 生成AI分析报告
  - `analyze_sentiment()` - 分析新闻情感倾向
  - `generate_sentiment_report()` - 生成情感分析报告

#### 更新文件
- `scripts/fetch_news.py` - 主脚本
  - 添加AI分析模块导入
  - 添加.env文件支持
  - 更新`generate_report()`函数，集成AI分析
  - 更新`main()`函数，添加`--no-ai`选项

- `SKILL.md` - 技能文档
  - 添加AI分析功能说明
  - 添加配置指南
  - 添加使用示例

#### 新增文件
- `README.md` - 详细使用说明
  - 功能特性介绍
  - 快速开始指南
  - 配置说明
  - 输出示例
  - 故障排除
  - 开发说明

- `.env.example` - 配置文件示例
  - 提供多种AI服务的配置示例

### 2. AI分析功能

#### 市场热点总结
AI分析当前市场最关注的核心主题，提供简洁的市场概览。

#### 板块分析
- 分析热点板块的表现
- 解释板块上涨/下跌的原因
- 预测板块趋势

#### 个股分析
- 分析受市场关注的股票
- 解释股票背后的逻辑
- 评估市场情绪

#### 风险提示
- 识别潜在的投资风险
- 提供风险预警

#### 投资机会
- 基于新闻分析提供投资建议
- 推荐值得关注的投资方向

#### 情感分析
- 分析市场整体情绪倾向
- 计算情绪指数
- 统计正面/负面/中性新闻数量
- 提取关键主题

### 3. 配置方式

#### 环境变量配置
```bash
export AI_API_URL="https://api.openai.com/v1/chat/completions"
export AI_API_KEY="your-api-key"
export AI_MODEL="gpt-4o-mini"
```

#### .env文件配置
复制`.env.example`为`.env`，填入配置信息。

### 4. 使用方式

#### 启用AI分析（默认）
```bash
python scripts/fetch_news.py --type daily
```

#### 禁用AI分析
```bash
python scripts/fetch_news.py --type daily --no-ai
```

### 5. 支持的AI服务

- OpenAI (GPT-4, GPT-3.5)
- Azure OpenAI
- 本地模型（如Ollama）
- 其他兼容OpenAI API的服务

## 技术细节

### AI分析流程
1. 收集新闻数据
2. 提取热点板块和股票
3. 构建分析提示词
4. 调用AI API进行分析
5. 解析AI返回结果
6. 生成Markdown报告

### 错误处理
- 未配置AI_API_KEY时自动禁用AI分析
- AI API调用失败时跳过AI分析
- JSON解析失败时返回原始文本

### 性能优化
- AI分析增加约30-60秒处理时间
- 使用`--no-ai`选项可以快速生成基础报告

## 注意事项

1. **API密钥安全**：不要将API密钥提交到版本控制系统
2. **成本控制**：建议使用成本较低的模型（如gpt-4o-mini）
3. **网络要求**：需要稳定的网络连接以访问AI API
4. **仅供参考**：AI分析结果仅供参考，不构成投资建议

## 后续优化建议

1. 添加缓存机制，避免重复分析
2. 支持批量分析历史数据
3. 添加可视化图表
4. 支持自定义分析模板
5. 添加多语言支持

## 测试

```bash
# 测试基础功能
python scripts/fetch_news.py --type daily --no-ai

# 测试AI分析（需要配置AI_API_KEY）
python scripts/fetch_news.py --type daily

# 测试帮助信息
python scripts/fetch_news.py --help
```
