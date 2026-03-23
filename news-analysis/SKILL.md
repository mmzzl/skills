---
name: news-analysis
description: 获取并分析财经新闻，生成热点板块、热点股票、热点舆情报告。当用户提到新闻分析、每日新闻、每周新闻、每月新闻、热点板块、热点股票、舆情分析、新闻报告等关键词时使用此技能。
---

# 财经新闻分析技能

## 概述

此技能用于从新闻API获取数据，分析并生成包含热点板块、热点股票、热点舆情的报告。

## API 信息

- **登录地址**: `https://life233.top/api/auth/token`
- **登录参数**: `{"username":"admin", "password":"7ac117d63b4b25369703699267104fb4dcf192cb"}`
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
    json={"username": "admin", "password": "7ac117d63b4b25369703699267104fb4dcf192cb"}
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
    page = 1
    while True:
        response = requests.get(
            f"https://life233.top{api_path}",
            headers=headers,
            params={"page": page, "size": 50}
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

stockList 中的代码是板块代码，需要映射为中文名称。建议维护一个板块代码到名称的映射字典：

```python
SECTOR_NAMES = {
    '90.BK0815': '新能源汽车',
    '90.BK0588': '光伏',
    '90.BK0457': '锂电池',
    '90.BK0481': '储能',
    '90.BK0493': '芯片',
    '90.BK1031': '人工智能',
    '90.BK0428': '医疗器械',
    '90.BK0459': '半导体',
    '90.BK1036': '数字经济',
    '90.BK0413': '氢能源',
    '90.BK0491': '机器人',
    '90.BK0473': '军工',
    '90.BK0489': '5G',
    '90.BK0461': '生物医药',
    '90.BK0441': '环保',
    '90.BK0475': '国产芯片',
    '90.BK0689': '调味发酵品',
    # ... 更多板块
}

def get_sector_name(code):
    return SECTOR_NAMES.get(code, code)
```

### 步骤 4: 板块->股票映射

根据热点板块，查询该板块下的代表性股票。建议维护板块到股票的映射：

```python
SECTOR_TO_STOCKS = {
    '90.BK0815': [  # 新能源汽车
        {'code': '002594', 'name': '比亚迪'},
        {'code': '005930', 'name': '理想汽车'},
        {'code': '009868', 'name': '小鹏汽车'},
    ],
    '90.BK0588': [  # 光伏
        {'code': '601012', 'name': '隆基绿能'},
        {'code': '300274', 'name': '阿特斯'},
        {'code': '688599', 'name': '天合光能'},
    ],
    '90.BK0475': [  # 国产芯片
        {'code': '688981', 'name': '中芯国际'},
        {'code': '688396', 'name': '华大九天'},
        {'code': '688126', 'name': '沪硅产业'},
    ],
    # ... 更多板块的股票
}
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

**注意**: `stockList` 字段只包含板块代码（如 `90.BK1036`），不包含股票代码。股票需要根据板块代码手动映射。

## 完整示例代码

```python
import requests
from collections import defaultdict
from datetime import datetime

# 板块代码映射
SECTOR_NAMES = {
    '90.BK0815': '新能源汽车',
    '90.BK0588': '光伏',
    '90.BK0457': '锂电池',
    '90.BK0481': '储能',
    '90.BK0493': '芯片',
    '90.BK1031': '人工智能',
    '90.BK0428': '医疗器械',
    '90.BK0459': '半导体',
    '90.BK0475': '国产芯片',
    '90.BK0689': '调味发酵品',
}

# 板块->股票映射
SECTOR_TO_STOCKS = {
    '90.BK0815': [
        {'code': '002594', 'name': '比亚迪'},
        {'code': '005930', 'name': '理想汽车'},
    ],
    '90.BK0475': [
        {'code': '688981', 'name': '中芯国际'},
        {'code': '688396', 'name': '华大九天'},
    ],
}

def get_sector_name(code):
    return SECTOR_NAMES.get(code, code)

# 1. 获取 token
resp = requests.post(
    'https://life233.top/api/auth/token',
    json={'username': 'admin', 'password': '7ac117d63b4b25369703699267104fb4dcf192cb'},
    timeout=15
)
token = resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 2. 获取每日新闻
news_resp = requests.get(
    'https://life233.top/api/news/daily',
    headers=headers,
    params={'page': 1, 'size': 50},
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
        if sector_code in SECTOR_TO_STOCKS:
            for stock in SECTOR_TO_STOCKS[sector_code]:
                stock_key = f"{stock['name']}({stock['code']})"
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

print(report)
```

## 注意事项

1. stockList 只包含板块代码，股票需要根据板块映射
2. 建议维护完整的板块代码->名称和板块->股票映射
3. 热度计算应综合考虑出现频次、评论数和分享数
4. 可以根据需要扩展映射字典覆盖更多板块
