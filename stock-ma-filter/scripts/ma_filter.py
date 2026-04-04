#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
双均线股票筛选脚本
支持沪深300、中证500、全A股筛选金叉信号和多头排列股票
"""

import sys
import io
# 设置标准输出编码为 UTF-8，解决 Windows 终端编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import os
import argparse
from datetime import datetime, timedelta
from pymongo import MongoClient
import pandas as pd
import requests

# ==================== 配置区域 ====================

# MongoDB 配置
MONGO_HOST = "121.37.47.63"
MONGO_PORT = 27017
MONGO_USER = "admin"
MONGO_PASSWORD = "aa123aaqqA!"
MONGO_DB = "eastmoney_news"
MONGO_COLLECTION = "stock_kline"

# NVIDIA API 配置
NVIDIA_API_KEY = "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"
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL = "moonshotai/kimi-k2.5"

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HS300_FILE = os.path.join(SCRIPT_DIR, "hs300_stocks.csv")
ZZ500_FILE = os.path.join(SCRIPT_DIR, "zz500_stocks.csv")

# 东方财富成分股API
STOCK_API_URL = "https://push2.eastmoney.com/api/qt/clist/get"

# 指数类型
INDEX_HS300 = "hs300"  # 沪深300
INDEX_ZZ500 = "zz500"  # 中证500
INDEX_ALL = "all"      # 全A股

# 指数中文名称
INDEX_NAMES = {
    INDEX_HS300: "沪深300",
    INDEX_ZZ500: "中证500",
    INDEX_ALL: "全A股"
}

# ==================== MongoDB 连接 ====================

def get_mongo_collection():
    """获取MongoDB集合"""
    client = MongoClient(
        host=MONGO_HOST,
        port=MONGO_PORT,
        username=MONGO_USER,
        password=MONGO_PASSWORD,
        authSource="admin"
    )
    db = client[MONGO_DB]
    return db[MONGO_COLLECTION]


# ==================== 均线计算 ====================

def calculate_ma(klines, period):
    """计算移动平均线"""
    if len(klines) < period:
        return None
    closes = [k['close'] for k in klines[-period:]]
    return sum(closes) / period


def detect_golden_cross(klines):
    """
    检测金叉信号
    金叉条件：今日MA5上穿MA20
    """
    if len(klines) < 21:
        return False, None, None, None, None

    today_ma5 = calculate_ma(klines, 5)
    today_ma20 = calculate_ma(klines, 20)

    yesterday_klines = klines[:-1]
    yesterday_ma5 = calculate_ma(yesterday_klines, 5)
    yesterday_ma20 = calculate_ma(yesterday_klines, 20)

    is_golden = (today_ma5 > today_ma20) and (yesterday_ma5 <= yesterday_ma20)

    return is_golden, today_ma5, today_ma20, yesterday_ma5, yesterday_ma20


def detect_bullish_alignment(klines):
    """
    检测多头排列
    多头排列条件：MA5 > MA10 > MA20 且 收盘价 > MA5
    """
    if len(klines) < 20:
        return False, None, None, None, None

    ma5 = calculate_ma(klines, 5)
    ma10 = calculate_ma(klines, 10)
    ma20 = calculate_ma(klines, 20)
    close = klines[-1]['close']

    is_bullish = (ma5 > ma10 > ma20) and (close > ma5)

    return is_bullish, ma5, ma10, ma20, close


# ==================== 成分股获取 ====================

def get_stock_codes(index_type='hs300'):
    """
    获取股票代码列表

    Args:
        index_type: 指数类型 hs300/zz500/all

    Returns:
        股票代码列表
    """
    if index_type == INDEX_HS300:
        return get_hs300_codes()
    elif index_type == INDEX_ZZ500:
        return get_zz500_codes()
    elif index_type == INDEX_ALL:
        return get_all_codes()
    else:
        return get_hs300_codes()


def get_hs300_codes():
    """获取沪深300成分股代码列表"""
    if not os.path.exists(HS300_FILE):
        print(f"沪深300成分股文件不存在，使用默认列表")
        return get_default_hs300_codes()

    df = pd.read_csv(HS300_FILE, encoding='utf-8', dtype={'code': str})
    return df['code'].tolist()


def get_zz500_codes():
    """获取中证500成分股代码列表"""
    if not os.path.exists(ZZ500_FILE):
        print(f"中证500成分股文件不存在，使用默认列表")
        return get_default_zz500_codes()

    df = pd.read_csv(ZZ500_FILE, encoding='utf-8', dtype={'code': str})
    return df['code'].tolist()


def get_all_codes():
    """获取全A股代码列表（从MongoDB获取）"""
    collection = get_mongo_collection()
    codes = collection.distinct('code')
    return list(codes)


def get_default_hs300_codes():
    """获取默认的沪深300成分股列表"""
    default_stocks = [
        "000001", "000002", "000063", "000333", "000338",
        "000425", "000568", "000625", "000651", "000725",
        "000768", "000858", "000876", "000938", "001979",
        "002230", "002304", "002352", "002415", "002475",
        "002460", "002594", "002714", "002841", "002821",
        "600000", "600009", "600010", "600011", "600015",
        "600016", "600018", "600019", "600025", "600028",
        "600029", "600030", "600031", "600036", "600037",
        "600048", "600050", "600061", "600066", "600068",
        "600085", "600104", "600109", "600111", "600115",
        "600118", "600150", "600176", "600183", "600196",
        "600208", "600216", "600219", "600223", "600233",
        "600240", "600276", "600297", "600299", "600309",
        "600332", "600340", "600346", "600352", "600362",
        "600369", "600372", "600390", "600398", "600406",
        "600436", "600438", "600482", "600486", "600489",
        "600498", "600503", "600519", "600521", "600523",
        "600547", "600570", "600582", "600585", "600588",
        "600595", "600597", "600598", "600600", "600606",
        "600637", "600655", "600660", "600674", "600690",
        "600703", "600705", "600741", "600745", "600760",
        "600795", "600809", "600837", "600845", "600848",
        "600850", "600872", "600886", "600887", "600893",
        "600900", "600905", "600918", "600919", "600926",
        "600941", "600958", "600959", "600967", "600977",
        "600989", "600990", "600998", "600999", "601006",
        "601009", "601012", "601016", "601018", "601021",
        "601028", "601038", "601059", "601066", "601077",
        "601088", "601099", "601100", "601101", "601108",
        "601111", "601117", "601118", "601138", "601155",
        "601166", "601169", "601186", "601198", "601211",
        "601212", "601216", "601225", "601229", "601231",
        "601236", "601238", "601288", "601298", "601318",
        "601319", "601328", "601336", "601339", "601360",
        "601368", "601377", "601390", "601398", "601428",
        "601433", "601438", "601456", "601512", "601555",
        "601588", "601600", "601601", "601607", "601618",
        "601628", "601633", "601636", "601658", "601661",
        "601668", "601669", "601673", "601677", "601689",
        "601696", "601698", "601699", "601717", "601727",
        "601728", "601766", "601788", "601800", "601808",
        "601816", "601818", "601825", "601838", "601857",
        "601868", "601872", "601877", "601878", "601880",
        "601881", "601888", "601899", "601901", "601916",
        "601919", "601933", "601939", "601949", "601958",
        "601963", "601965", "601968", "601969", "601988",
        "601989", "601990", "601992", "601995", "601998"
    ]
    return default_stocks


def get_default_zz500_codes():
    """获取默认的中证500成分股列表"""
    default_stocks = [
        "000530", "000532", "000540", "000543", "000582",
        "000587", "000591", "000593", "000599", "000612",
        "000615", "000619", "000623", "000625", "000631",
        "000636", "000656", "000661", "000667", "000671",
        "000680", "000681", "000682", "000685", "000687",
        "000690", "000695", "000703", "000708", "000709",
        "000712", "000715", "000717", "000718", "000719",
        "000723", "000726", "000731", "000735", "000736",
        "000738", "000739", "000748", "000750", "000751",
        "000753", "000755", "000756", "000757", "000758",
        "002007", "002008", "002010", "002011", "002012",
        "002013", "002014", "002015", "002016", "002017",
        "002019", "002020", "002021", "002022", "002023",
        "002024", "002025", "002026", "002027", "002028",
        "002029", "002030", "002031", "002032", "002033",
        "002034", "002035", "002036", "002037", "002038",
        "002039", "002041", "002042", "002043", "002044",
        "002045", "002046", "002047", "002048", "002049",
        "002050", "002051", "002052", "002053", "002054",
        "002055", "002056", "002057", "002058", "002059",
        "600062", "600063", "600064", "600065", "600066",
        "600067", "600069", "600070", "600071", "600072",
        "600073", "600074", "600075", "600076", "600077",
        "600078", "600079", "600080", "600081", "600082",
        "600083", "600084", "600086", "600087", "600088",
        "600089", "600090", "600091", "600092", "600093",
        "600094", "600095", "600097", "600098", "600099",
        "600100", "600101", "600102", "600103", "600104",
        "600105", "600106", "600107", "600108", "600109",
        "600110", "600111", "600112", "600113", "600114",
        "600115", "600116", "600117", "600118", "600119",
        "600120", "600121", "600122", "600123", "600124",
        "600125", "600126", "600127", "600128", "600129",
        "600130", "600131", "600132", "600133", "600134",
        "600135", "600136", "600137", "600138", "600139",
        "600140", "600141", "600142", "600143", "600144",
        "600145", "600146", "600147", "600148", "600149",
        "600151", "600152", "600153", "600154", "600155",
        "600156", "600157", "600158", "600159", "600160",
        "600161", "600162", "600163", "600164", "600165",
        "600166", "600167", "600168", "600169", "600170",
        "600171", "600172", "600173", "600174", "600175",
        "600176", "600177", "600178", "600179", "600180"
    ]
    return default_stocks


# ==================== 股票名称获取 ====================

def get_stock_name(code, index_type='hs300'):
    """根据股票代码获取股票名称"""
    # 尝试从对应的成分股文件获取
    csv_file = HS300_FILE if index_type == INDEX_HS300 else (
        ZZ500_FILE if index_type == INDEX_ZZ500 else None
    )

    if csv_file and os.path.exists(csv_file):
        df = pd.read_csv(csv_file, encoding='utf-8', dtype={'code': str})
        result = df[df['code'] == code]
        if not result.empty and 'name' in result.columns:
            name = result.iloc[0]['name']
            if pd.notna(name) and name:
                return name

    return code


# ==================== 主筛选逻辑 ====================

def filter_stocks(index_type='hs300', signal_type='all', use_ai=True):
    """
    筛选股票

    Args:
        index_type: 指数类型 hs300/zz500/all
        signal_type: 信号类型 all/golden_cross/bullish_alignment
        use_ai: 是否使用AI分析

    Returns:
        筛选报告文本
    """
    index_name = INDEX_NAMES.get(index_type, "沪深300")

    print("=" * 60)
    print(f"双均线股票筛选 - {index_name}")
    print("=" * 60)

    # 1. 获取股票代码列表
    print(f"\n[1/4] 获取{index_name}股票列表...")
    stock_codes = get_stock_codes(index_type)
    print(f"共 {len(stock_codes)} 只股票")

    # 2. 连接MongoDB
    print("\n[2/4] 连接MongoDB...")
    collection = get_mongo_collection()
    print("连接成功")

    # 3. 筛选股票
    print("\n[3/4] 筛选股票...")
    golden_cross_stocks = []
    bullish_alignment_stocks = []

    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)

    total_count = 0
    for i, code in enumerate(stock_codes):
        if (i + 1) % 100 == 0:
            print(f"  处理进度: {i + 1}/{len(stock_codes)}")

        try:
            klines = list(collection.find({
                "code": code,
                "date": {"$gte": start_date.strftime("%Y-%m-%d")}
            }).sort("date", 1))

            if len(klines) < 21:
                continue

            total_count += 1
            name = get_stock_name(code, index_type)

            # 计算涨跌幅
            if len(klines) >= 2:
                prev_close = klines[-2]['close']
                curr_close = klines[-1]['close']
                change_pct = (curr_close - prev_close) / prev_close * 100
            else:
                change_pct = 0

            volume_wan = klines[-1]['volume'] / 10000

            # 检测金叉信号
            if signal_type in ['all', 'golden_cross']:
                is_golden, ma5, ma20, prev_ma5, prev_ma20 = detect_golden_cross(klines)
                if is_golden:
                    golden_cross_stocks.append({
                        'code': code,
                        'name': name,
                        'close': klines[-1]['close'],
                        'ma5': ma5,
                        'ma20': ma20,
                        'change_pct': change_pct,
                        'volume': volume_wan,
                        'date': klines[-1]['date']
                    })

            # 检测多头排列
            if signal_type in ['all', 'bullish_alignment']:
                is_bullish, ma5, ma10, ma20, close = detect_bullish_alignment(klines)
                if is_bullish:
                    dist_ma5 = (close - ma5) / ma5 * 100
                    bullish_alignment_stocks.append({
                        'code': code,
                        'name': name,
                        'close': close,
                        'ma5': ma5,
                        'ma10': ma10,
                        'ma20': ma20,
                        'dist_ma5': dist_ma5,
                        'date': klines[-1]['date']
                    })

        except Exception as e:
            continue

    # 4. 生成报告
    print("\n[4/4] 生成报告...")

    report = generate_report(
        golden_cross_stocks,
        bullish_alignment_stocks,
        total_count,
        index_type,
        signal_type,
        use_ai
    )

    return report


def generate_report(golden_stocks, bullish_stocks, total_count, index_type, signal_type, use_ai):
    """生成筛选报告"""
    today = datetime.now().strftime('%Y-%m-%d')
    index_name = INDEX_NAMES.get(index_type, "沪深300")

    report = ""
    report += "═" * 64 + "\n"
    report += f"📊 双均线筛选报告 · {today}\n"
    report += f"筛选范围：{index_name} | 均线参数：MA5/MA10/MA20\n"
    report += "═" * 64 + "\n\n"

    # 金叉信号
    if signal_type in ['all', 'golden_cross']:
        report += "🔔 金叉信号（今日 MA5 上穿 MA20）\n"
        report += "─" * 64 + "\n"
        report += "说明：金叉出现，短期均线上穿长期均线，可能预示上涨趋势开始\n\n"

        if golden_stocks:
            report += "序号 │ 代码    │ 名称     │ 收盘价 │ MA5   │ MA20  │ 涨幅   │ 成交量\n"
            report += "─────┼─────────┼──────────┼────────┼───────┼───────┼────────┼────────\n"

            for i, stock in enumerate(golden_stocks, 1):
                change_str = f"+{stock['change_pct']:.1f}%" if stock['change_pct'] >= 0 else f"{stock['change_pct']:.1f}%"
                report += f"{i:<5}│ {stock['code']:<8}│ {stock['name']:<9}│ {stock['close']:<7.2f}│ {stock['ma5']:<6.2f}│ {stock['ma20']:<6.2f}│ {change_str:<7}│ {stock['volume']:.1f}万\n"
        else:
            report += "今日无金叉信号\n"

        report += "\n"

    # 多头排列
    if signal_type in ['all', 'bullish_alignment']:
        report += "═" * 64 + "\n"
        report += "📈 多头排列（MA5 > MA10 > MA20，股价在均线上方）\n"
        report += "─" * 64 + "\n"
        report += "说明：均线多头排列，上升趋势确立，持股待涨\n\n"

        if bullish_stocks:
            report += "序号 │ 代码    │ 名称     │ 收盘价  │ MA5   │ MA10  │ MA20  │ 距MA5\n"
            report += "─────┼─────────┼──────────┼─────────┼───────┼───────┼───────┼───────\n"

            for i, stock in enumerate(bullish_stocks, 1):
                report += f"{i:<5}│ {stock['code']:<8}│ {stock['name']:<9}│ {stock['close']:<8.2f}│ {stock['ma5']:<7.2f}│ {stock['ma10']:<7.2f}│ {stock['ma20']:<7.2f}│ +{stock['dist_ma5']:.1f}%\n"
        else:
            report += "当前无多头排列股票\n"

        report += "\n"

    # 统计摘要
    report += "═" * 64 + "\n"
    report += "📋 统计摘要\n"
    report += "─" * 64 + "\n"
    report += f"• {index_name} 共 {total_count} 只股票（有效数据）\n"
    report += f"• 金叉信号：{len(golden_stocks)} 只\n"
    report += f"• 多头排列：{len(bullish_stocks)} 只\n"
    report += f"• 空头/其他：{total_count - len(golden_stocks) - len(bullish_stocks)} 只\n"

    if golden_stocks:
        report += f"• 数据截止：{golden_stocks[0]['date']}\n"
    elif bullish_stocks:
        report += f"• 数据截止：{bullish_stocks[0]['date']}\n"
    else:
        report += f"• 数据截止：{datetime.now().strftime('%Y-%m-%d')}\n"

    report += "\n"

    # AI分析
    if use_ai and (golden_stocks or bullish_stocks):
        report += "═" * 64 + "\n"
        report += "🤖 AI 市场分析\n"
        report += "─" * 64 + "\n"

        ai_analysis = call_ai_analysis(golden_stocks, bullish_stocks, index_name)
        report += ai_analysis

    return report


def call_ai_analysis(golden_stocks, bullish_stocks, index_name="沪深300"):
    """调用AI进行市场分析"""
    golden_list = "\n".join([f"{i+1}. {s['name']}({s['code']}) - 涨幅:{s['change_pct']:.1f}%" for i, s in enumerate(golden_stocks[:10])])
    bullish_list = "\n".join([f"{i+1}. {s['name']}({s['code']}) - 距MA5:+{s['dist_ma5']:.1f}%" for i, s in enumerate(bullish_stocks[:10])])

    prompt = f"""请根据以下双均线筛选结果，进行专业的技术分析和市场判断：

## 筛选范围
{index_name}

## 金叉信号股票（MA5上穿MA20）
{golden_list if golden_stocks else "今日无金叉信号"}

## 多头排列股票（MA5 > MA10 > MA20）
{bullish_list if bullish_stocks else "当前无多头排列股票"}

## 统计数据
- 金叉信号：{len(golden_stocks)} 只
- 多头排列：{len(bullish_stocks)} 只

请从以下角度进行分析：
1. **市场趋势判断**：根据金叉和多头排列数量，判断当前市场强弱
2. **板块特征**：分析信号股票所属板块的特征（如果能识别）
3. **风险提示**：提醒潜在的风险因素
4. **操作建议**：给出具体的操作参考

请用简洁专业的语言输出分析报告，控制在300字以内。
"""

    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {NVIDIA_API_KEY}"
        }

        payload = {
            "model": NVIDIA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1024,
            "temperature": 0.7
        }

        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=60)
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            return f"AI分析返回异常: {result}"

    except Exception as e:
        return f"AI分析调用失败: {e}"


# ==================== 主函数 ====================

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='双均线股票筛选工具')

    parser.add_argument('--index', '-i',
                        choices=['hs300', 'zz500', 'all'],
                        default='hs300',
                        help='筛选范围：hs300(沪深300), zz500(中证500), all(全A股)')

    parser.add_argument('--signal', '-s',
                        choices=['all', 'golden_cross', 'bullish_alignment'],
                        default='all',
                        help='信号类型：all(全部), golden_cross(金叉), bullish_alignment(多头排列)')

    parser.add_argument('--output', '-o',
                        help='输出文件路径（可选）')

    parser.add_argument('--no-ai',
                        action='store_true',
                        help='禁用AI分析')

    args = parser.parse_args()

    # 执行筛选
    report = filter_stocks(
        index_type=args.index,
        signal_type=args.signal,
        use_ai=not args.no_ai
    )

    # 输出结果
    print("\n" + report)

    # 保存到文件
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n报告已保存到: {args.output}")


if __name__ == "__main__":
    main()
