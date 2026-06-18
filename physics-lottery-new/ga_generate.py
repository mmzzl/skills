"""
大乐透数据获取 + 遗传算法生成数据池
- 从 http://www.17500.cn/getData/dlt.TXT 获取历史数据
- 每个位置（红1-红5、蓝1-蓝2）单独统计频率分布
- 用遗传算法（选择/交叉/变异）生成10万组新数据
- 输出 CSV 到 data_pool 目录
"""
import os
import re
import csv
import random
import time
import sys
from collections import Counter

import requests

DLT_URL = "http://www.17500.cn/getData/dlt.TXT"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "data_pool")
CACHE_FILE = os.path.join(BASE_DIR, "dlt_history.csv")

RED_RANGE = range(1, 36)
BLUE_RANGE = range(1, 13)
POPULATION_SIZE = 2000
GENERATIONS = 100000
TARGET_COUNT = 200_000_000


def download_data():
    print("下载大乐透历史数据...")
    resp = requests.get(DLT_URL, timeout=30)
    resp.encoding = "utf-8"
    return resp.text


def save_draws_csv(draws, path):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["序号", "红1", "红2", "红3", "红4", "红5", "蓝1", "蓝2"])
        for idx, d in enumerate(draws, 1):
            writer.writerow([idx] + d)
    print(f"已保存: {path} ({len(draws)} 期)")


def load_data():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, encoding="utf-8-sig") as f:
                reader = csv.reader(f)
                next(reader)
                rows = []
                for row in reader:
                    if len(row) >= 8:
                        rows.append([int(x) for x in row[1:8]])
                if rows:
                    print(f"使用缓存数据: {CACHE_FILE} ({len(rows)} 期)")
                    return rows
        except (csv.Error, ValueError):
            pass
    text = download_data()
    draws = parse_draws(text)
    save_draws_csv(draws, CACHE_FILE)
    return draws


def parse_draws(text):
    """解析 dlt.TXT，每行格式: 期号 日期 红1 红2 红3 红4 红5 蓝1 蓝2 ..."""
    draws = []
    for line in text.strip().split("\n"):
        parts = line.split()
        if len(parts) < 9:
            continue
        try:
            reds = sorted(int(p) for p in parts[2:7])
            blues = sorted(int(p) for p in parts[7:9])
            if all(1 <= r <= 35 for r in reds) and all(1 <= b <= 12 for b in blues):
                draws.append(reds + blues)
        except (ValueError, IndexError):
            continue
    return draws


def build_position_freq(draws):
    """统计每个位置（红1-红5、蓝1-蓝2）的号码频率"""
    pos_freq = [Counter() for _ in range(7)]
    for d in draws:
        for i in range(7):
            pos_freq[i][d[i]] += 1
    return pos_freq


def weighted_sample(population, k, rng):
    """从 population 中加权采样 k 个不重复元素"""
    items = list(population)
    weights = [population[i] for i in items]
    return rng.choices(items, weights=weights, k=k)


def generate_individual(pos_freq, rng):
    """按位置频率分布生成一组号码（已排序的红球+蓝球）"""
    red_candidates = []
    for i in range(5):
        sample = weighted_sample(pos_freq[i], 1, rng)
        red_candidates.append(sample[0])

    reds = sorted(list(set(red_candidates)))
    while len(reds) < 5:
        missing = set(RED_RANGE) - set(reds)
        all_freq = Counter()
        for i in range(5):
            for num, cnt in pos_freq[i].items():
                if num in missing:
                    all_freq[num] += cnt
        if all_freq:
            pick = weighted_sample(all_freq, 1, rng)
            reds.append(pick[0])
        else:
            pick = rng.choice(list(missing))
            reds.append(pick)
        reds.sort()

    blues = []
    for i in range(5, 7):
        sample = weighted_sample(pos_freq[i], 1, rng)
        blues.append(sample[0])

    blues = sorted(list(set(blues)))
    while len(blues) < 2:
        missing = set(BLUE_RANGE) - set(blues)
        all_freq = Counter()
        for i in range(5, 7):
            for num, cnt in pos_freq[i].items():
                if num in missing:
                    all_freq[num] += cnt
        if all_freq:
            pick = weighted_sample(all_freq, 1, rng)
            blues.append(pick[0])
        else:
            pick = rng.choice(list(missing))
            blues.append(pick)
        blues.sort()

    return reds[:5] + blues[:2]


def fitness(individual, pos_freq):
    """适应度：基于位置频率的加权得分"""
    score = 0
    for i in range(7):
        freq = pos_freq[i].get(individual[i], 0)
        total = sum(pos_freq[i].values())
        score += freq / total if total > 0 else 0
    return score


def tournament_select(population, fitnesses, k, rng):
    """锦标赛选择"""
    candidates = rng.sample(list(enumerate(population)), k)
    best_idx, best_ind = max(candidates, key=lambda x: fitnesses[x[0]])
    return best_ind[:]


def crossover(p1, p2, rng):
    """顺序交叉 (OX) - 适用于红球和蓝球分别交叉"""
    def _ox(a, b, rng):
        n = len(a)
        if n <= 1:
            return a[:], b[:]
        cut1, cut2 = sorted(rng.sample(range(n), 2))
        child1 = [-1] * n
        child2 = [-1] * n
        child1[cut1:cut2+1] = a[cut1:cut2+1]
        child2[cut1:cut2+1] = b[cut1:cut2+1]
        remaining1 = [x for x in b if x not in child1]
        remaining2 = [x for x in a if x not in child2]
        idx1 = idx2 = 0
        for i in range(n):
            if child1[i] == -1:
                child1[i] = remaining1[idx1]
                idx1 += 1
            if child2[i] == -1:
                child2[i] = remaining2[idx2]
                idx2 += 1
        return child1, child2

    red_a, red_b = p1[:5], p2[:5]
    blue_a, blue_b = p1[5:], p2[5:]

    red_c1, red_c2 = _ox(red_a, red_b, rng)
    blue_c1, blue_c2 = _ox(blue_a, blue_b, rng)

    red_c1.sort()
    red_c2.sort()
    blue_c1.sort()
    blue_c2.sort()

    return red_c1 + blue_c1, red_c2 + blue_c2


def mutate(individual, pos_freq, rate, rng):
    """变异：某个位置按频率分布重新生成"""
    new_ind = individual[:]
    for i in range(7):
        if rng.random() < rate:
            candidates = set(pos_freq[i].keys())
            if candidates:
                pool = {k: v for k, v in pos_freq[i].items() if k in candidates}
                new_val = weighted_sample(pool, 1, rng)[0]
                new_ind[i] = new_val

    reds = sorted(list(set(new_ind[:5])))
    blues = sorted(list(set(new_ind[5:])))

    while len(reds) < 5:
        r = rng.choice([x for x in RED_RANGE if x not in reds])
        reds.append(r)
    while len(blues) < 2:
        b = rng.choice([x for x in BLUE_RANGE if x not in blues])
        blues.append(b)

    reds.sort()
    blues.sort()
    return reds[:5] + blues[:2]


def unique_key(ind):
    return tuple(ind)


def run_ga(pos_freq):
    print(f"\n初始化种群: {POPULATION_SIZE}")
    rng = random.Random(42)
    population = [generate_individual(pos_freq, rng) for _ in range(POPULATION_SIZE)]
    seen = {unique_key(ind) for ind in population}

    pool = []
    elite_count = max(1, POPULATION_SIZE // 20)

    progress_ticks = max(1, GENERATIONS // 20)

    for gen in range(GENERATIONS):
        fitnesses = [fitness(ind, pos_freq) for ind in population]
        sorted_pop = sorted(enumerate(population), key=lambda x: fitnesses[x[0]], reverse=True)

        new_population = []
        for j in range(elite_count):
            top_ind = sorted_pop[j][1][:]
            new_population.append(top_ind)

        while len(new_population) < POPULATION_SIZE:
            p1 = tournament_select(population, fitnesses, 3, rng)
            p2 = tournament_select(population, fitnesses, 3, rng)
            c1, c2 = crossover(p1, p2, rng)
            c1 = mutate(c1, pos_freq, 0.05, rng)
            c2 = mutate(c2, pos_freq, 0.05, rng)
            new_population.append(c1)
            if len(new_population) < POPULATION_SIZE:
                new_population.append(c2)

        population = new_population[:POPULATION_SIZE]

        for ind in population:
            key = unique_key(ind)
            if key not in seen:
                seen.add(key)
                pool.append(ind)

        if gen % progress_ticks == 0 or gen == GENERATIONS - 1:
            progress_bar = "=" * (gen // progress_ticks + 1) + "-" * (20 - gen // progress_ticks - 1)
            sys.stdout.write(f"\r  [{progress_bar}] 第 {gen+1}/{GENERATIONS} 代, 已收集: {len(pool)} 组")
            sys.stdout.flush()

    sys.stdout.write("\n")
    return pool, seen, rng


def fill_to_target(pool, seen, pos_freq, rng):
    """如果GA没生成够10万，用加权采样补足"""
    while len(pool) < TARGET_COUNT:
        ind = generate_individual(pos_freq, rng)
        key = unique_key(ind)
        if key not in seen:
            seen.add(key)
            pool.append(ind)
    return pool[:TARGET_COUNT]


def save_csv(data, path):
    os.makedirs(os.path.dirname(path) if os.path.dirname(path) else ".", exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["序号", "红1", "红2", "红3", "红4", "红5", "蓝1", "蓝2"])
        for idx, row in enumerate(data, 1):
            writer.writerow([idx] + row)
    print(f"\n已保存: {path} ({len(data)} 组)")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    draws = load_data()
    print(f"共 {len(draws)} 期历史数据")

    pos_freq = build_position_freq(draws)
    for i in range(5):
        top = pos_freq[i].most_common(3)
        print(f"  红球位置{i+1} TOP3: {[(n,c) for n,c in top]}")
    for i in range(5, 7):
        top = pos_freq[i].most_common(3)
        print(f"  蓝球位置{i+1-5} TOP3: {[(n,c) for n,c in top]}")

    print(f"\n启动遗传算法 (种群={POPULATION_SIZE}, 代数={GENERATIONS}, 目标={TARGET_COUNT})")
    start = time.time()
    pool, seen, rng = run_ga(pos_freq)
    elapsed = time.time() - start
    print(f"GA耗时: {elapsed:.1f}s, 生成: {len(pool)} 组")

    if len(pool) < TARGET_COUNT:
        print(f"不足 {TARGET_COUNT} 组，加权采样补足...")
        pool = fill_to_target(pool, seen, pos_freq, rng)

    save_csv(pool, os.path.join(OUTPUT_DIR, "dlt_data_pool.csv"))
    print(f"GA池保存至: {os.path.join(OUTPUT_DIR, 'dlt_data_pool.csv')}")

    print(f"\n总共: {len(pool)} 组 | 去重: {len(set(unique_key(p) for p in pool))} 组")
    print(f"总耗时: {time.time()-start:.1f}s")


if __name__ == "__main__":
    main()