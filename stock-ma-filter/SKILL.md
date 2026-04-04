---
name: stock-ma-filter
description: 基于双均线策略筛选股票，支持沪深300、中证500、全A股范围，检测金叉信号和多头排列。当用户提到双均线、均线筛选、金叉选股、技术分析选股、MA金叉、均线多头等关键词时使用此技能。
---

# 双均线股票筛选技能

## 概述

基于双均线策略筛选符合条件的股票：
- **金叉信号**：MA5 上穿 MA20，短期趋势转强
- **多头排列**：MA5 > MA10 > MA20，上升趋势确立

支持三种筛选范围：
- **沪深300**：大盘蓝筹股，默认范围
- **中证500**：中盘成长股
- **全A股**：全部A股股票

## 数据源

### MongoDB 配置

- **地址**: 121.37.47.63
- **端口**: 27017
- **账号**: admin
- **密码**: aa123aaqqA!
- **数据库**: eastmoney_news
- **集合**: stock_kline

### K线数据结构

```json
{
    "_id": ObjectId,
    "code": "000001",
    "date": "2026-04-03 15:00",
    "frequency": 9,
    "adjust": "qfq",
    "open": 11.28,
    "high": 11.28,
    "low": 11.09,
    "close": 11.12,
    "volume": 757757,
    "amount": 845283648,
    "crawl_time": "2026-04-03T16:43:34.320985"
}
```

## 均线计算

```
MA5  = 最近5个交易日收盘价平均值
MA10 = 最近10个交易日收盘价平均值
MA20 = 最近20个交易日收盘价平均值
```

## 筛选条件

### 1. 金叉信号

```
金叉条件：
┌─────────────────────────────────────────────────────┐
│ 今日 MA5 > 今日 MA20                                │
│ 且                                                  │
│ 昨日 MA5 <= 昨日 MA20                               │
└─────────────────────────────────────────────────────┘
```

### 2. 多头排列

```
多头排列条件：
┌─────────────────────────────────────────────────────┐
│ MA5 > MA10 > MA20                                   │
│ 且                                                  │
│ 收盘价 > MA5（股价在短期均线上方）                   │
└─────────────────────────────────────────────────────┘
```

## 使用方法

### 脚本位置

`stock-ma-filter/scripts/ma_filter.py`

### 运行方式

```bash
# 进入脚本目录
cd stock-ma-filter/scripts

# 默认筛选沪深300（金叉 + 多头排列）
python ma_filter.py

# 筛选中证500
python ma_filter.py --index zz500

# 筛选全A股
python ma_filter.py --index all

# 只筛选金叉信号
python ma_filter.py --signal golden_cross

# 只筛选多头排列
python ma_filter.py --signal bullish_alignment

# 保存报告到文件
python ma_filter.py -o report.txt

# 不使用AI分析
python ma_filter.py --no-ai
```

### 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--index, -i` | 筛选范围：hs300/zz500/all | hs300 |
| `--signal, -s` | 信号类型：all/golden_cross/bullish_alignment | all |
| `--output, -o` | 输出文件路径 | 无（仅打印） |
| `--no-ai` | 禁用AI分析 | 否 |

### 依赖安装

```bash
pip install pymongo pandas requests
```

## 输出示例

```
════════════════════════════════════════════════════════════════
📊 双均线筛选报告 · 2026-04-04
筛选范围：沪深300 | 均线参数：MA5/MA10/MA20
════════════════════════════════════════════════════════════════

🔔 金叉信号（今日 MA5 上穿 MA20）
────────────────────────────────────────────────────────────────
说明：金叉出现，短期均线上穿长期均线，可能预示上涨趋势开始

序号 │ 代码    │ 名称     │ 收盘价 │ MA5   │ MA20  │ 涨幅   │ 成交量
─────┼─────────┼──────────┼────────┼───────┼───────┼────────┼────────
1    │ 000001  │ 平安银行 │ 11.12  │ 11.08 │ 11.05 │ +2.3%  │ 75.8万
2    │ 600036  │ 招商银行 │ 35.20  │ 35.15 │ 35.10 │ +1.8%  │ 120万

📈 技术分析：
• 平安银行：放量金叉，突破前期盘整区间，关注后续量能
• 招商银行：缩量金叉，需观察后续补量情况

════════════════════════════════════════════════════════════════

📈 多头排列（MA5 > MA10 > MA20，股价在均线上方）
────────────────────────────────────────────────────────────────
说明：均线多头排列，上升趋势确立，持股待涨

序号 │ 代码    │ 名称     │ 收盘价  │ MA5  │ MA10 │ MA20 │ 距MA5
─────┼─────────┼──────────┼─────────┼──────┼──────┼──────┼───────
1    │ 600519  │ 贵州茅台 │ 1850.0  │ 1820 │ 1790 │ 1750 │ +1.6%
2    │ 000858  │ 五粮液   │ 165.5   │ 163  │ 160  │ 156  │ +1.5%

════════════════════════════════════════════════════════════════

📋 统计摘要
────────────────────────────────────────────────────────────────
• 沪深300 共 300 只股票
• 金叉信号：2 只
• 多头排列：15 只
• 空头排列：280 只
• 数据截止：2026-04-03 15:00

════════════════════════════════════════════════════════════════

🤖 AI 市场分析
────────────────────────────────────────────────────────────────
[AI对筛选结果的深度分析]
```

## 沪深300成分股

### 数据来源

1. **静态文件**：`scripts/hs300_stocks.csv`
2. **动态更新**：使用 `--update-hs300` 从东方财富API获取最新成分股

### 更新沪深300成分股

```bash
python ma_filter.py --update-hs300
```

成分股每半年调整一次（6月和12月），建议定期更新。

### 沪深300成分股文件格式

```csv
code,name
000001,平安银行
000002,万科A
600000,浦发银行
...
```

## MongoDB 查询示例

### 连接数据库

```python
from pymongo import MongoClient

# 连接MongoDB
client = MongoClient(
    "mongodb://admin:aa123aaqqA!@121.37.47.63:27017/",
    username="admin",
    password="aa123aaqqA!"
)
db = client["eastmoney_news"]
collection = db["stock_kline"]
```

### 查询近30日K线

```python
from datetime import datetime, timedelta

# 查询某股票近30日K线
end_date = datetime.now()
start_date = end_date - timedelta(days=45)  # 多查一些，确保有30个交易日

klines = list(collection.find({
    "code": "000001",
    "date": {"$gte": start_date.strftime("%Y-%m-%d")}
}).sort("date", 1))
```

## 技术分析逻辑

### 金叉检测

```python
def detect_golden_cross(klines):
    """
    检测金叉信号

    Args:
        klines: K线数据列表，按日期升序排列

    Returns:
        (is_golden, today_ma5, today_ma20)
    """
    if len(klines) < 21:  # 需要至少21天数据
        return False, None, None

    # 计算今日和昨日的MA5、MA20
    today_ma5 = calculate_ma(klines, 5)
    today_ma20 = calculate_ma(klines, 20)
    yesterday_ma5 = calculate_ma(klines[:-1], 5)
    yesterday_ma20 = calculate_ma(klines[:-1], 20)

    # 金叉条件：今日MA5上穿MA20
    is_golden = (today_ma5 > today_ma20) and (yesterday_ma5 <= yesterday_ma20)

    return is_golden, today_ma5, today_ma20
```

### 多头排列检测

```python
def detect_bullish_alignment(klines):
    """
    检测多头排列

    Args:
        klines: K线数据列表，按日期升序排列

    Returns:
        (is_bullish, ma5, ma10, ma20)
    """
    if len(klines) < 20:
        return False, None, None, None

    ma5 = calculate_ma(klines, 5)
    ma10 = calculate_ma(klines, 10)
    ma20 = calculate_ma(klines, 20)
    close = klines[-1]['close']

    # 多头排列条件
    is_bullish = (ma5 > ma10 > ma20) and (close > ma5)

    return is_bullish, ma5, ma10, ma20
```

## AI 分析模块

### NVIDIA API 配置

- **API 地址**: `https://integrate.api.nvidia.com/v1/chat/completions`
- **模型**: `moonshotai/kimi-k2.5`

### AI 分析内容

AI 会对筛选结果进行以下分析：

1. **市场趋势判断**：根据金叉和多头排列数量判断市场强弱
2. **板块分析**：分析信号股票所属板块的特征
3. **风险提示**：提醒潜在的风险因素
4. **操作建议**：给出具体的操作参考

## 注意事项

1. 确保 MongoDB 可访问（网络连接、认证信息正确）
2. K线数据需要至少20个交易日才能计算MA20
3. 建议在收盘后运行（15:00之后），确保数据完整
4. 沪深300成分股每半年调整，建议定期更新列表
5. 信号仅供参考，不构成投资建议

## 文件说明

| 文件 | 说明 |
|------|------|
| `SKILL.md` | 技能描述文档（本文件） |
| `scripts/ma_filter.py` | 主筛选脚本 |
| `scripts/hs300_stocks.csv` | 沪深300成分股列表 |
| `requirements.txt` | Python依赖 |
