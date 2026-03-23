#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
财经新闻分析脚本
获取并分析财经新闻，生成热点板块、热点股票、热点舆情报告
"""

import sys
import io
# 设置标准输出编码为 UTF-8，解决 Windows 终端编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import requests
from collections import defaultdict
from datetime import datetime
import pandas as pd
import os

# ==================== 配置区域 ====================

# 新闻 API 配置
NEWS_API_BASE = "https://life233.top"
NEWS_LOGIN_URL = f"{NEWS_API_BASE}/api/auth/token"
NEWS_USERNAME = "admin"
NEWS_PASSWORD = "aa123aaqqA@"

# NVIDIA API 配置
NVIDIA_API_KEY = "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"
NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
NVIDIA_MODEL = "moonshotai/kimi-k2.5"

# CSV 文件路径
CSV_FILE = "all_stock_industry.csv"

# ==================== 初始化 ====================

# 读取板块股票映射数据
df = pd.read_csv(CSV_FILE, encoding='utf-8')

# ==================== 工具函数 ====================

def get_sector_name(code):
    """
    根据板块代码获取板块名称和相关股票信息

    Args:
        code: 板块代码，如 '90.BK0815'

    Returns:
        字典，包含:
        - code: 板块名称
        - {code}_matched_data: 该板块下的股票列表
    """
    bk_code = code.split('.')[-1]
    matched_data = df[df['板块代码'] == bk_code]

    industry_map = {
        code: matched_data['板块名称'].iloc[0] if not matched_data.empty else "未知板块",
        f"{code}_matched_data": matched_data.to_dict(orient='records'),
    }
    return industry_map


def get_sector_display_name(code):
    """
    获取板块显示名称（便捷函数）

    Args:
        code: 板块代码，如 '90.BK0815'

    Returns:
        板块名称字符串
    """
    sector_info = get_sector_name(code)
    return sector_info.get(code, "未知板块")


def call_ai_analysis(prompt):
    """
    调用 AI 模型进行深度分析
    支持多种 AI 后端：NVIDIA NIM、Claude、OpenAI、本地模型等

    Args:
        prompt: 分析提示词

    Returns:
        AI 分析结果文本
    """
    # 方式1: 使用 NVIDIA NIM API（推荐）
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {NVIDIA_API_KEY}"
        }

        payload = {
            "model": NVIDIA_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 16384,
            "temperature": 1.00,
            "top_p": 1.00,
            "stream": False,
            "chat_template_kwwargs": {"thinking": True}
        }

        response = requests.post(NVIDIA_API_URL, headers=headers, json=payload, timeout=60)
        result = response.json()

        if "choices" in result and len(result["choices"]) > 0:
            return result["choices"][0]["message"]["content"]
        else:
            print(f"NVIDIA API 返回异常: {result}")
    except Exception as e:
        print(f"NVIDIA API 调用失败: {e}")
    return "AI 分析暂时不可用，请检查 API 配置"


def calc_heat(s):
    """
    计算热度值
    热度 = 出现次数 * 10 + 评论数 * 2 + 分享数 * 5
    """
    return s['count'] * 10 + s['comments'] * 2 + s['shares'] * 5


def get_all_news(api_path, headers):
    """
    分页获取所有新闻数据

    Args:
        api_path: API 路径
        headers: 请求头（包含认证信息）

    Returns:
        新闻条目列表
    """
    all_items = []
    page = 0

    while True:
        response = requests.get(
            f"{NEWS_API_BASE}{api_path}",
            headers=headers,
            params={"offset": page, "limit": 50},
            timeout=15
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


# ==================== 主流程 ====================

def analyze_news(news_type='daily'):
    """
    分析新闻并生成报告

    Args:
        news_type: 新闻类型，可选 'daily', 'weekly', 'monthly'

    Returns:
        分析报告文本
    """
    # 1. 获取 token
    print("正在获取认证 Token...")
    resp = requests.post(
        NEWS_LOGIN_URL,
        json={"username": NEWS_USERNAME, "password": NEWS_PASSWORD},
        timeout=15
    )
    token = resp.json()['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    print("Token 获取成功！")

    # 2. 获取新闻数据
    api_map = {
        'daily': '/api/news/daily',
        'weekly': '/api/news/weekly',
        'monthly': '/api/news/monthly'
    }
    api_path = api_map.get(news_type, '/api/news/daily')

    print(f"正在获取{news_type}新闻...")
    items = get_all_news(api_path, headers)
    print(f"获取到 {len(items)} 条新闻")

    if not items:
        return "未获取到新闻数据"

    # 3. 统计板块热度
    sector_stats = defaultdict(lambda: {'count': 0, 'comments': 0, 'shares': 0})

    for item in items:
        pinglun = item.get('pinglun_Num', 0) or 0
        share = item.get('share', 0) or 0
        stock_list = item.get('stockList', []) or []

        for sector_code in stock_list:
            sector_stats[sector_code]['count'] += 1
            sector_stats[sector_code]['comments'] += pinglun
            sector_stats[sector_code]['shares'] += share

    # 4. 排序板块
    top_sectors = sorted(sector_stats.items(), key=lambda x: calc_heat(x[1]), reverse=True)[:10]

    # 5. 为每个热门板块选取代表性股票（每个板块最多取3只）
    stock_stats = defaultdict(lambda: {'count': 0, 'comments': 0, 'shares': 0, 'sector': ''})
    seen_stocks = set()  # 避免重复添加同一只股票

    for sector_code, stats in top_sectors:
        sector_info = get_sector_name(sector_code)
        if not sector_info or sector_info[sector_code] == "未知板块":
            continue

        matched_key = f"{sector_code}_matched_data"
        matched_data = sector_info.get(matched_key, [])

        # 每个板块最多取3只代表性股票
        for stock in matched_data[:3]:
            stock_code = str(stock['代码'])
            stock_name = stock['名称']
            stock_key = f"{stock_name}({sector_info[sector_code]})"

            if stock_key in seen_stocks:
                continue
            seen_stocks.add(stock_key)

            # 将板块热度分配给股票
            stock_stats[stock_key]['count'] = stats['count']
            stock_stats[stock_key]['comments'] = stats['comments']
            stock_stats[stock_key]['shares'] = stats['shares']
            stock_stats[stock_key]['sector'] = sector_info[sector_code]
    # 6. 排序股票（按热度）
    top_stocks = sorted(stock_stats.items(), key=lambda x: calc_heat(x[1]), reverse=True)[:10]

    # 7. 生成报告
    today = datetime.now().strftime('%Y-%m-%d')
    news_type_cn = {'daily': '日报', 'weekly': '周报', 'monthly': '月报'}

    report = f"📊 财经{news_type_cn.get(news_type, '日报')} · {today}\n\n"
    report += f"📋 新闻总数: {len(items)}\n\n"
    report += "🔥 热点板块 TOP 10\n"
    for i, (code, stats) in enumerate(top_sectors, 1):
        heat = calc_heat(stats)
        name = get_sector_name(code)
        if name[code] == "未知板块":
            continue
        report += f"{i}. {name[code]} - 出现{stats['count']}次，热度{heat}\n"

    report += "\n📈 热点股票 TOP 10\n"
    if top_stocks:
        for i, (stock_key, stats) in enumerate(top_stocks, 1):
            heat = calc_heat(stats)
            report += f"{i}. {stock_key} - 热度{heat}\n"
    else:
        report += "暂无股票数据\n"

    # 热门新闻
    top_news = sorted(items, key=lambda x: x.get('showTime', 0), reverse=True)[:200]
    report += "\n📰 热门新闻\n"
    summary_set = set()  # 用于去重新闻摘要
    for i, item in enumerate(top_news, 1):
        title = item.get('summary', '')[:200]
        if title in summary_set:
            continue
        summary_set.add(title)

        report += f"{i}. {title}\n"
   
    # 6. AI 深度分析
    print("正在进行 AI 深度分析...")

    # 构建分析提示词
    sector_list = "\n".join([f'{i+1}. {get_sector_display_name(code)} - 热度: {calc_heat(stats)}'
                             for i, (code, stats) in enumerate(top_sectors[:5])])
    stock_list_str = "\n".join([f'{i+1}. {stock_key} - 热度: {calc_heat(stats)}'
                                 for i, (stock_key, stats) in enumerate(top_stocks[:5])])
    news_list = "\n".join([f'{i+1}. {item.get("title", "")}'
                           for i, item in enumerate(top_news[:3])])

    ai_prompt = f"""
请根据以下财经新闻数据，进行专业的投资分析：

## 今日热点板块（按热度排序）
{sector_list}

## 今日热点股票（按热度排序）
{stock_list_str}

## 热门新闻摘要
{news_list}

请从以下角度进行分析：
1. **市场整体态势**：根据热点板块分布，判断当前市场主线和资金流向
2. **板块轮动分析**：分析热点板块之间的关联性，是否形成产业链联动
3. **投资机会提示**：基于热点股票，提示潜在的投资机会和风险点
4. **明日展望**：预判明日可能的热点方向

请用专业但易懂的语言，输出分析报告。
"""
    print(ai_prompt)
    ai_analysis = call_ai_analysis(ai_prompt)

    # 将 AI 分析添加到报告中
    report += "\n" + "="*50 + "\n"
    report += "🤖 AI 深度分析\n"
    report += "="*50 + "\n"
    report += ai_analysis

    return report


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='财经新闻分析工具')
    parser.add_argument('--type', '-t',
                        choices=['daily', 'weekly', 'monthly'],
                        default='daily',
                        help='新闻类型：daily(每日), weekly(每周), monthly(每月)')
    parser.add_argument('--output', '-o',
                        help='输出文件路径（可选）')

    args = parser.parse_args()

    # 执行分析
    report = analyze_news(args.type)

    # 输出结果
    print("\n" + "="*50)
    print("分析报告")
    print("="*50)
    print(report)

    # 保存到文件
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"\n报告已保存到: {args.output}")


if __name__ == "__main__":
    main()
