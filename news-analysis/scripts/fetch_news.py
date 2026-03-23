#!/usr/bin/env python3
"""
财经新闻获取与分析脚本
"""

import argparse
import csv
import requests
from collections import defaultdict
from datetime import datetime
import json
import os

BASE_URL = "https://life233.top"
AUTH_URL = f"{BASE_URL}/api/auth/token"
STOCK_CSV_PATH = r"all_stock_industry.csv"

AUTH_PARAMS = {
    "username": "admin",
    "password": "7ac117d63b4b25369703699267104fb4dcf192cb",
}


def get_token():
    response = requests.post(AUTH_URL, json=AUTH_PARAMS)
    response.raise_for_status()
    data = response.json()
    return data["access_token"]


def get_all_news(api_path, headers):
    all_items = []
    page = 1
    page_size = 50

    while True:
        response = requests.get(
            f"{BASE_URL}{api_path}",
            headers=headers,
            params={"page": page, "size": page_size},
        )
        response.raise_for_status()
        data = response.json()
        items = data.get("items", [])

        if not items:
            break

        all_items.extend(items)
        total = data.get("total", 0)

        if len(all_items) >= total:
            break

        page += 1

    return all_items


def load_stock_industry_mapping():
    mapping = {}
    stock_to_sector = defaultdict(list)

    with open(STOCK_CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sector_name = row["板块名称"]
            sector_code = row["板块代码"]
            stock_code = row["代码"]
            stock_name = row["名称"]

            stock_to_sector[stock_code].append(
                {"sector_name": sector_name, "sector_code": sector_code}
            )

            if sector_code not in mapping:
                mapping[sector_code] = {"name": sector_name, "stocks": []}
            mapping[sector_code]["stocks"].append(
                {"code": stock_code, "name": stock_name}
            )

    return mapping, stock_to_sector


def calculate_heat(count, comments, shares):
    return count * 10 + comments * 2 + shares * 5


def analyze_news(news_items, stock_to_sector):
    sector_stats = defaultdict(lambda: {"count": 0, "comments": 0, "shares": 0})
    stock_stats = {}
    all_keywords = []

    for item in news_items:
        pinglun = item.get("pinglun_Num", 0) or 0
        share = item.get("share", 0) or 0
        stock_list = item.get("stockList", []) or []

        for stock_code in stock_list:
            if stock_code not in stock_stats:
                stock_stats[stock_code] = {
                    "count": 0,
                    "comments": 0,
                    "shares": 0,
                    "sectors": [],
                }

            stock_stats[stock_code]["count"] += 1
            stock_stats[stock_code]["comments"] += pinglun
            stock_stats[stock_code]["shares"] += share

            sectors = stock_to_sector.get(stock_code, [])
            for sector in sectors:
                sector_code = sector["sector_code"]
                sector_stats[sector_code]["count"] += 1
                sector_stats[sector_code]["comments"] += pinglun
                sector_stats[sector_code]["shares"] += share

                if sector not in stock_stats[stock_code]["sectors"]:
                    stock_stats[stock_code]["sectors"].append(sector)

        title = item.get("title", "")
        if title:
            all_keywords.append(title)

    return sector_stats, stock_stats, all_keywords


def generate_report(
    news_type, news_items, sector_stats, stock_stats, stock_to_sector, output_path=None
):
    lines = []
    lines.append("# 财经新闻分析报告\n")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    lines.append(f"**分析周期**: {news_type}\n")
    lines.append(f"**新闻总数**: {len(news_items)}\n")

    lines.append("\n## 热点板块 TOP 10\n")
    lines.append("| 排名 | 板块名称 | 出现次数 | 热度指数 |\n")
    lines.append("|------|----------|----------|----------|\n")

    sorted_sectors = sorted(
        sector_stats.items(),
        key=lambda x: calculate_heat(x[1]["count"], x[1]["comments"], x[1]["shares"]),
        reverse=True,
    )[:10]

    for i, (sector_code, stats) in enumerate(sorted_sectors, 1):
        sector_name = next(
            (
                s["sector_name"]
                for s in stock_to_sector.values()
                if any(ss["sector_code"] == sector_code for ss in s)
            ),
            sector_code,
        )
        heat = calculate_heat(stats["count"], stats["comments"], stats["shares"])
        lines.append(f"| {i} | {sector_name} | {stats['count']} | {heat} |\n")

    lines.append("\n## 热点股票 TOP 10\n")
    lines.append("| 排名 | 股票代码 | 股票名称 | 出现次数 | 热度指数 | 所属板块 |\n")
    lines.append("|------|----------|----------|----------|----------|----------|\n")

    sorted_stocks = sorted(
        stock_stats.items(),
        key=lambda x: calculate_heat(x[1]["count"], x[1]["comments"], x[1]["shares"]),
        reverse=True,
    )[:10]

    for i, (stock_code, stats) in enumerate(sorted_stocks, 1):
        heat = calculate_heat(stats["count"], stats["comments"], stats["shares"])
        sectors = ", ".join([s["sector_name"] for s in stats.get("sectors", [])][:3])
        lines.append(
            f"| {i} | {stock_code} | - | {stats['count']} | {heat} | {sectors} |\n"
        )

    lines.append("\n## 热点舆情分析\n")
    lines.append("### 主要新闻事件\n")

    top_news = sorted(news_items, key=lambda x: x.get("pinglun_Num", 0), reverse=True)[
        :5
    ]
    for i, item in enumerate(top_news, 1):
        lines.append(f"{i}. **{item.get('title', 'N/A')}**\n")
        lines.append(f"   - 发布时间: {item.get('showTime', 'N/A')}\n")
        lines.append(
            f"   - 评论数: {item.get('pinglun_Num', 0)}, 分享数: {item.get('share', 0)}\n"
        )

    report = "".join(lines)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"报告已保存到: {output_path}")

    return report


def main():
    parser = argparse.ArgumentParser(description="财经新闻获取与分析")
    parser.add_argument(
        "--type",
        "-t",
        choices=["daily", "weekly", "monthly"],
        default="daily",
        help="新闻类型",
    )
    parser.add_argument("--output", "-o", help="输出报告文件路径")
    args = parser.parse_args()

    api_map = {
        "daily": "/api/news/daily",
        "weekly": "/api/news/weekly",
        "monthly": "/api/news/monthly",
    }

    print(f"正在获取 {args.type} 新闻...")

    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    news_items = get_all_news(api_map[args.type], headers)
    print(f"获取到 {len(news_items)} 条新闻")

    print("正在加载板块股票映射...")
    mapping, stock_to_sector = load_stock_industry_mapping()

    print("正在分析新闻数据...")
    sector_stats, stock_stats, keywords = analyze_news(news_items, stock_to_sector)

    output_path = (
        args.output or f"news_report_{args.type}_{datetime.now().strftime('%Y%m%d')}.md"
    )
    report = generate_report(
        args.type, news_items, sector_stats, stock_stats, stock_to_sector, output_path
    )

    print("\n" + "=" * 50)
    print(report)


if __name__ == "__main__":
    main()
