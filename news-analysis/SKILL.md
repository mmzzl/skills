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

### 步骤 3: 加载板块股票映射

读取 `all_stock_industry.csv` 文件，建立板块与股票的映射关系：

- 文件路径: `D:\work\datastore\apps\api\data\all_stock_industry.csv`
- 格式: `板块名称,板块代码,代码,名称`

### 步骤 4: 分析新闻数据

#### 热点板块分析
1. 遍历每条新闻的 `stockList` 字段
2. 根据 stockList 中的股票代码，从 all_stock_industry.csv 查找对应板块
3. 统计每个板块出现的频次，结合评论数(pinglun_Num)和分享数(share)计算热度
4. 热度计算公式: `热度 = 出现次数 * 10 + 评论数 * 2 + 分享数 * 5`

#### 热点股票分析
1. 统计 stockList 中各股票出现频次
2. 结合评论数和分享数计算热度

#### 热点舆情分析
1. 分析新闻标题和摘要中的关键词
2. 识别市场情绪（正面/负面/中性）
3. 提取主要事件和影响

### 步骤 5: 生成报告

报告格式：

```markdown
# 财经新闻分析报告

## 报告概要
- 分析周期: [日期范围]
- 新闻总数: [数量]

## 热点板块 TOP 10
| 排名 | 板块名称 | 出现次数 | 热度指数 |
|------|----------|----------|----------|
| 1 | xxx | xx | xxxx |

## 热点股票 TOP 10
| 排名 | 股票代码 | 股票名称 | 出现次数 | 热度指数 | 所属板块 |
|------|----------|----------|----------|----------|----------|
| 1 | xxx | xxx | xx | xxxx | xxx |

## 热点舆情分析
### 主要事件
1. [事件描述]

### 市场情绪
[情绪分析]

### 关键词云
[高频关键词列表]
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

**注意**: `stockList` 字段可能包含板块代码（如 `90.BK1036`）而非股票代码。需要根据实际情况处理。

## 使用脚本

使用 `scripts/fetch_news.py` 脚本获取数据：

```bash
python scripts/fetch_news.py --type daily|weekly|monthly
```

## 注意事项

1. 分页查询时需要循环获取直到获取所有数据
2. Authorization header 格式为 `Bearer {token}`
3. 板块股票映射文件较大（约6万条记录），需要高效处理
4. 热度计算应综合考虑出现频次、评论数和分享数
