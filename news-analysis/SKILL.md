---
name: news-analysis
description: 获取并分析财经新闻，生成热点板块、热点股票、热点舆情报告。当用户提到新闻分析、每日新闻、每周新闻、每月新闻、热点板块、热点股票、舆情分析、新闻报告等关键词时使用此技能。
---

# 财经新闻分析技能

## 概述

此技能用于从新闻API获取数据，分析并生成包含热点板块、热点股票、热点舆情的报告。

## API 信息

- **登录地址**: `https://life233.top/api/auth/token`
- **登录参数**: `{"username":"admin", "password":"aa123aaqqA@"}`
- **新闻接口**:
  - `/api/news/daily` - 每日新闻
  - `/api/news/weekly` - 每周新闻（每周日运行）
  - `/api/news/monthly` - 每月新闻（每月1日运行）

## 重要说明

**stockList 字段只包含板块代码，不包含股票代码！**

新闻的 `stockList` 字段存储的是板块代码（如 `90.BK0815` 新能源汽车），需要根据板块代码映射到具体的股票。

## 工作流程

### 步骤 1: 获取 Token

调用登录接口获取 access_token：

```python
import requests

response = requests.post(
    "https://life233.top/api/auth/token",
    json={"username": "admin", "password": "aa123aaqqA@"}
)
token_data = response.json()
token = token_data["access_token"]
```

### 步骤 2: 获取新闻数据

使用获取的token调用新闻接口，**需要分页获取所有数据**：

```python
headers = {"Authorization": f"Bearer {token}"}

def get_all_news(api_path):
    all_items = []
    page = 0
    while True:
        response = requests.get(
            f"https://life233.top{api_path}",
            headers=headers,
            params={"offset": page, "limit": 50}
        )
        data = response.json()
        items = data.get("items", [])
        if not items:
            break
        all_items.extend(items)
        if len(all_items) >= data.get("total", 0):
            break
        page += 1
    return all_items
```

### 步骤 3: 板块代码映射

stockList 中的代码是板块代码，读取all_stock_industry.csv，将csv转换为dataframe数据
使用for循环，把列表中的代码如 '90.BK0815'  使用.进行分割，然后取最后一位，放到dataframe 中查询 并将板块映射为中文名称。建议维护一个板块代码到名称的映射字典：

```python
import pandas as pd
# ---------------------- 输出结果 ----------------------
result_list = []
def get_sector_name(code):
    # 按 . 分割，取最后一段（BKxxxx）
    bk_code = code.split('.')[-1]
    # 可以在这里匹配df中的数据（根据你的CSV结构调整）
    # 示例：假设df中有列 'industry_code' 存储板块代码
    matched_data = df[df['板块代码'] == bk_code]
    # 组装结果
    industry_map = {
        code: matched_data['板块名称'].iloc[0] if not matched_data.empty else "未知板块",
        f"{code}_matched_data": matched_data.to_dict(orient='records')  # 转为列表字典
    }
    return industry_map.get(code)
```

### 步骤 4: 板块->股票映射

根据热点板块，使用get_sector_name()方法查询该板块下的代表性股票。

```python
get_sector_name('90.BK0815')  # 返回 {'90.BK0815': '新能源汽车', '90.BK0815_matched_data': [{'股票代码': '002594', '股票名称': '比亚迪'}, ...]}
```

### 步骤 5: 分析新闻数据

#### 热点板块分析
1. 遍历每条新闻的 `stockList` 字段（板块代码）
2. 统计每个板块出现的频次
3. 结合评论数(pinglun_Num)和分享数(share)计算热度
4. 热度计算公式: `热度 = 出现次数 * 10 + 评论数 * 2 + 分享数 * 5`

#### 热点股票分析
1. 根据热点板块，查询该板块下的代表性股票
2. 将板块热度分配给其对应的股票
3. 按热度排序

### 步骤 6: 生成报告

报告格式：

```markdown
📊 财经日报 · 2026-03-23

📋 新闻总数: 10

🔥 热点板块 TOP 10
1. 国产芯片 - 出现1次，热度297
2. 新能源汽车 - 出现2次，热度20
3. 光伏 - 出现1次，热度15

📈 热点股票 TOP 10
1. 中芯国际(688981) - 热度297
2. 华大九天(688396) - 热度297
3. 比亚迪(002594) - 热度20

📰 热门新闻
1. 新闻标题1
2. 新闻标题2
```

## 新闻数据结构

```json
{
  "total": 10,
  "items": [
    {
      "code": "202603223679769641",
      "title": "新闻标题",
      "summary": "新闻摘要",
      "showTime": "2026-03-22 20:16:52",
      "stockList": ["90.BK1036", "90.BK0459"],
      "image": [],
      "pinglun_Num": 76,
      "share": 31,
      "realSort": "1774181812069641",
      "titleColor": 3,
      "crawlTime": "2026-03-22 20:31:02"
    }
  ]
}
```

**注意**: `stockList` 字段只包含板块代码（如 `90.BK1036`），不包含股票代码。股票需要根据板块代码get_sector_name('90.BK1036')方法获取中文名称和股票信息。

## 完整示例代码

```python
import requests
from collections import defaultdict
from datetime import datetime

import pandas as pd
# ---------------------- 输出结果 ----------------------
result_list = []
df = pd.read_csv('all_stock_industry.csv', encoding='utf-8')  # 读取CSV文件到DataFrame

def get_sector_name(code):
    # 按 . 分割，取最后一段（BKxxxx）
    bk_code = code.split('.')[-1]
    # 可以在这里匹配df中的数据（根据你的CSV结构调整）
    # 示例：假设df中有列 'industry_code' 存储板块代码
    matched_data = df[df['板块代码'] == bk_code]
    # 组装结果
    industry_map = {
        code: matched_data['板块名称'].iloc[0] if not matched_data.empty else "未知板块",
        f"{code}_matched_data": matched_data.to_dict(orient='records')  # 转为列表字典
    }
    return industry_map.get(code)


# 1. 获取 token
resp = requests.post(
    'https://life233.top/api/auth/token',
    json={'username': 'admin', 'password': 'aa123aaqqA@'},
    timeout=15
)
token = resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 2. 获取每日新闻
news_resp = requests.get(
    'https://life233.top/api/news/daily',
    headers=headers,
    params={'offset': 0, 'limit': 50},
    timeout=15
)

items = news_resp.json().get('items', [])

# 3. 分析
sector_stats = defaultdict(lambda: {'count': 0, 'comments': 0, 'shares': 0})
stock_stats = defaultdict(lambda: {'count': 0, 'comments': 0, 'shares': 0})

for item in items:
    pinglun = item.get('pinglun_Num', 0) or 0
    share = item.get('share', 0) or 0
    stock_list = item.get('stockList', []) or []
    
    for sector_code in stock_list:
        # 统计板块
        sector_stats[sector_code]['count'] += 1
        sector_stats[sector_code]['comments'] += pinglun
        sector_stats[sector_code]['shares'] += share
        
        # 统计该板块下的股票
        sector_info = get_sector_name(sector_code)  # 获取板块名称和股票信息
        if isinstance(sector_info, dict) and f"{sector_code}_matched_data" in sector_info:
            for stock in sector_info[f"{sector_code}_matched_data"]:
                stock_key = f"{stock['股票名称']}({stock['股票代码']})"
                stock_stats[stock_key]['count'] += 1
                stock_stats[stock_key]['comments'] += pinglun
                stock_stats[stock_key]['shares'] += share

# 4. 排序
def calc_heat(s):
    return s['count'] * 10 + s['comments'] * 2 + s['shares'] * 5

top_sectors = sorted(sector_stats.items(), key=lambda x: calc_heat(x[1]), reverse=True)[:10]
top_stocks = sorted(stock_stats.items(), key=lambda x: calc_heat(x[1]), reverse=True)[:10]

# 5. 生成报告
today = datetime.now().strftime('%Y-%m-%d')
report = f"📊 财经日报 · {today}\n\n📋 新闻总数: {len(items)}\n\n🔥 热点板块 TOP 10\n"

for i, (code, stats) in enumerate(top_sectors, 1):
    heat = calc_heat(stats)
    name = get_sector_name(code)
    report += f'{i}. {name} - 出现{stats["count"]}次，热度{heat}\n'

report += '\n📈 热点股票 TOP 10\n'
if top_stocks:
    for i, (stock_key, stats) in enumerate(top_stocks, 1):
        heat = calc_heat(stats)
        report += f'{i}. {stock_key} - 热度{heat}\n'
else:
    report += '暂无股票数据\n'

# 热门新闻
top_news = sorted(items, key=lambda x: x.get('pinglun_Num', 0), reverse=True)[:5]
report += '\n📰 热门新闻\n'
for i, item in enumerate(top_news, 1):
    title = item.get('title', '')[:60]
    report += f'{i}. {title}\n'

# 6. AI 深度分析
# 构建分析提示词
ai_prompt = f"""
请根据以下财经新闻数据，进行专业的投资分析：

## 今日热点板块（按热度排序）
{chr(10).join([f'{i+1}. {get_sector_name(code)} - 热度: {calc_heat(stats)}' for i, (code, stats) in enumerate(top_sectors[:5])])}

## 今日热点股票（按热度排序）
{chr(10).join([f'{i+1}. {stock_key} - 热度: {calc_heat(stats)}' for i, (stock_key, stats) in enumerate(top_stocks[:5])])}

## 热门新闻摘要
{chr(10).join([f'{i+1}. {item.get("title", "")}' for i, item in enumerate(top_news[:3])])}

请从以下角度进行分析：
1. **市场整体态势**：根据热点板块分布，判断当前市场主线和资金流向
2. **板块轮动分析**：分析热点板块之间的关联性，是否形成产业链联动
3. **投资机会提示**：基于热点股票，提示潜在的投资机会和风险点
4. **明日展望**：预判明日可能的热点方向

请用专业但易懂的语言，输出分析报告。
"""

# 调用 AI 进行分析
ai_analysis = call_ai_analysis(ai_prompt)

# 将 AI 分析添加到报告中
report += '\n' + '='*50 + '\n'
report += '🤖 AI 深度分析\n'
report += '='*50 + '\n'
report += ai_analysis

print(report)
```

## AI 分析模块

### NVIDIA API 配置

- **API 地址**: `https://integrate.api.nvidia.com/v1/chat/completions`
- **API Key**: `xxxx`
- **模型**: `moonshotai/kimi-k2.5`

### 调用 AI 分析函数

```python
def call_ai_analysis(prompt):
    """
    调用 AI 模型进行深度分析
    支持多种 AI 后端：NVIDIA NIM、Claude、OpenAI、本地模型等
    """
    import os
    import requests as req

    # 方式1: 使用 NVIDIA NIM API（推荐）
    try:
        NVIDIA_API_KEY ="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"  # NVIDIA API Key
        NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {NVIDIA_API_KEY}"
        }

        payload = {
            "model": "moonshotai/kimi-k2.5",
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 2048,
            "temperature": 0.7
        }

        response = req.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=60)
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            print(f"NVIDIA API 返回异常: {result}")
    except Exception as e:
        print(f"NVIDIA API 调用失败: {e}")

    # 方式2: 使用 Claude API
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        return message.content[0].text
    except Exception as e:
        print(f"Claude API 调用失败: {e}")

    # 方式3: 使用 OpenAI API
    try:
        import openai
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2048
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"OpenAI API 调用失败: {e}")

    # 方式4: 使用本地模型（如 Ollama）
    try:
        response = req.post(
            "http://localhost:11434/api/generate",
            json={"model": "llama3", "prompt": prompt, "stream": False}
        )
        return response.json().get("response", "")
    except Exception as e:
        print(f"本地模型调用失败: {e}")

    return "AI 分析暂时不可用，请检查 API 配置"
```

### AI 分析报告示例

```markdown
🤖 AI 深度分析
==================================================

## 1. 市场整体态势

今日市场热点集中在科技板块，国产芯片、半导体产业链持续受资金追捧。
从板块分布看，硬科技方向占据主导地位，市场风险偏好有所提升。

## 2. 板块轮动分析

热点板块呈现明显的产业链联动特征：
- 国产芯片 → 半导体设备 → 电子化学品 形成完整产业链条
- 新能源汽车板块热度有所分化，上游材料端承压
- 光伏板块受政策消息刺激，短期表现活跃

## 3. 投资机会提示

机会：
- 半导体设备国产替代逻辑持续强化，关注龙头个股回调机会
- AI算力产业链有望延续景气度，可逢低布局

风险：
- 短期涨幅过大个股需警惕回调风险
- 关注海外市场波动对A股的传导影响

## 4. 明日展望

预计科技主线仍将延续，建议关注：
1. 半导体产业链龙头股的持续性
2. AI应用端能否接力硬件端上涨
3. 政策预期方向（如数字经济、新能源车）
```

## 脚本使用方法

### 脚本位置

脚本位于 `scripts/news_analysis.py`，数据文件 `scripts/all_stock_industry.csv`

### 运行方式

```bash
# 进入脚本目录
cd scripts

# 每日新闻分析（默认）
python news_analysis.py

# 每周新闻分析
python news_analysis.py --type weekly

# 每月新闻分析
python news_analysis.py --type monthly

# 保存报告到文件
python news_analysis.py --type daily -o report.txt

# 查看帮助
python news_analysis.py --help
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--type, -t` | 新闻类型：daily/weekly/monthly | daily |
| `--output, -o` | 输出文件路径 | 无（仅打印） |

### 依赖安装

```bash
pip install requests pandas
```

### 输出示例

```
==================================================
分析报告
==================================================
📊 财经日报 · 2026-04-03

📋 新闻总数: 50

🔥 热点板块 TOP 10
1. 国产芯片 - 出现5次，热度297
2. 新能源汽车 - 出现3次，热度150
...

📈 热点股票 TOP 10
1. 中芯国际(688981) - 热度297
...

📰 热门新闻
1. xxx新闻标题
...

==================================================
🤖 AI 深度分析
==================================================
## 1. 市场整体态势
...
```

## 注意事项

1. stockList 只包含板块代码，股票需要根据板块映射
2. 建议维护完整的板块代码->名称和板块->股票映射
3. 热度计算应综合考虑出现频次、评论数和分享数
4. 可以根据需要扩展映射字典覆盖更多板块
5. 运行脚本前确保 `all_stock_industry.csv` 文件存在于 scripts 目录
