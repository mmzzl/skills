"""
宇宙细胞演化模型 — 纯自由演化遗传算法

核心思想：
  抛弃一切外部数据、历史、概率统计。
  从 200 个随机原始细胞开始，通过杂交 + 高变异自我演化，
  以多样性（独特性）为筛选标准，自动分化出海量全新结构。

  等价于：从几个单细胞，自己演化出整个生态圈。
"""
import os
import csv
import random
import time
import sys
from collections import Counter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "data_pool")

RED_RANGE = range(1, 36)
BLUE_RANGE = range(1, 13)

POPULATION_SIZE = 200
GENERATIONS = 120
MUTATION_RATE = 0.25
ELITE_COUNT = 1
TARGET_COUNT = 100_000
TOURNAMENT_SIZE = 3  # 锦标赛规模


def random_individual(rng):
    """随机生成一个合法个体（纯随机，无任何外部依赖）"""
    reds = sorted(rng.sample(list(RED_RANGE), 5))
    blues = sorted(rng.sample(list(BLUE_RANGE), 2))
    return reds + blues


def crossover(p1, p2, rng):
    """OX 顺序交叉 — 红球/蓝球分别交叉"""
    def _ox(a, b):
        n = len(a)
        if n <= 1:
            return a[:], b[:]
        cut1, cut2 = sorted(rng.sample(range(n), 2))
        child1 = [-1] * n
        child2 = [-1] * n
        child1[cut1:cut2+1] = a[cut1:cut2+1]
        child2[cut1:cut2+1] = b[cut1:cut2+1]
        r1 = [x for x in b if x not in child1]
        r2 = [x for x in a if x not in child2]
        i1 = i2 = 0
        for i in range(n):
            if child1[i] == -1:
                child1[i] = r1[i1]
                i1 += 1
            if child2[i] == -1:
                child2[i] = r2[i2]
                i2 += 1
        return child1, child2

    red_c1, red_c2 = _ox(p1[:5], p2[:5])
    blue_c1, blue_c2 = _ox(p1[5:], p2[5:])
    red_c1.sort()
    red_c2.sort()
    blue_c1.sort()
    blue_c2.sort()
    return red_c1 + blue_c1, red_c2 + blue_c2


def mutate(ind, rng):
    """高变异：每一位都有 25% 概率突变为随机合法值"""
    new = ind[:]
    for i in range(5):
        if rng.random() < MUTATION_RATE:
            new[i] = rng.choice(list(RED_RANGE))
    for i in range(5, 7):
        if rng.random() < MUTATION_RATE:
            new[i] = rng.choice(list(BLUE_RANGE))
    # 修复红球不重复
    reds = sorted(set(new[:5]))
    while len(reds) < 5:
        candidate = rng.choice([x for x in RED_RANGE if x not in reds])
        reds.append(candidate)
    reds.sort()
    # 修复蓝球不重复
    blues = sorted(set(new[5:]))
    while len(blues) < 2:
        candidate = rng.choice([x for x in BLUE_RANGE if x not in blues])
        blues.append(candidate)
    blues.sort()
    return reds[:5] + blues[:2]


def tournament_select(population, fitnesses, rng):
    """锦标赛选择：优先挑选独特、高分个体作为父本"""
    candidates = rng.sample(list(zip(population, fitnesses)), TOURNAMENT_SIZE)
    # 按适应度降序，取最优
    candidates.sort(key=lambda x: -x[1])
    return candidates[0][0][:]


def run_evolution():
    """纯自由演化主循环"""
    rng = random.Random(42)

    print(f"播种: {POPULATION_SIZE} 个原始细胞...")
    population = [random_individual(rng) for _ in range(POPULATION_SIZE)]
    seen = {tuple(ind) for ind in population}
    pool = list(population)

    progress_ticks = max(1, GENERATIONS // 40)

    for gen in range(GENERATIONS):
        # 统计当前种群每个组合出现次数
        pop_keys = [tuple(i) for i in population]
        counts = Counter(pop_keys)
        # 计算适应度：越稀有分数越高
        fitnesses = [1.0 / counts[tuple(ind)] for ind in population]

        # 排序取精英
        ranked = sorted(enumerate(fitnesses), key=lambda x: -x[1])
        new_population = []
        # 保留精英个体
        for j in range(ELITE_COUNT):
            elite_idx = ranked[j][0]
            new_population.append(population[elite_idx][:])

        # 交配繁殖填充种群
        while len(new_population) < POPULATION_SIZE:
            p1 = tournament_select(population, fitnesses, rng)
            p2 = tournament_select(population, fitnesses, rng)
            child1, child2 = crossover(p1, p2, rng)
            child1 = mutate(child1, rng)
            child2 = mutate(child2, rng)
            new_population.append(child1)
            if len(new_population) < POPULATION_SIZE:
                new_population.append(child2)

        population = new_population[:POPULATION_SIZE]

        # 收集全新未出现过的个体
        for ind in population:
            key = tuple(ind)
            if key not in seen:
                seen.add(key)
                pool.append(ind)

        # 进度条打印
        if gen % progress_ticks == 0 or gen == GENERATIONS - 1:
            bar = "=" * (gen // progress_ticks + 1) + "-" * (40 - gen // progress_ticks - 1)
            sys.stdout.write(f"\r  [{bar}] 第 {gen+1}/{GENERATIONS} 代, 已收集: {len(pool)} 组")
            sys.stdout.flush()

    sys.stdout.write("\n")
    return pool, seen, rng


def fill_to_target(pool, seen, rng):
    """演化结束后随机补满至目标数量"""
    while len(pool) < TARGET_COUNT:
        ind = random_individual(rng)
        key = tuple(ind)
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

    print("=" * 52)
    print("  宇宙细胞演化模型 — 纯自由演化")
    print("=" * 52)
    print(f"  初始种群: {POPULATION_SIZE}")
    print(f"  迭代代数: {GENERATIONS}")
    print(f"  变异率:   {MUTATION_RATE}")
    print(f"  精英保留: {ELITE_COUNT}")
    print(f"  锦标赛规模: {TOURNAMENT_SIZE}")
    print(f"  目标样本: {TARGET_COUNT}")
    print(f"  外部数据: 无 (纯随机种子)")
    print("=" * 52)

    start = time.time()

    pool, seen, rng = run_evolution()
    elapsed = time.time() - start
    print(f"\n演化完成: {elapsed:.1f}s, 生成 {len(pool)} 组 (全局唯一去重: {len(seen)})")

    if len(pool) < TARGET_COUNT:
        print(f"随机补足至 {TARGET_COUNT} 组...")
        pool = fill_to_target(pool, seen, rng)

    save_csv(pool, os.path.join(OUTPUT_DIR, "dlt_data_pool.csv"))
    print(f"\n输出总量: {len(pool)} 组 | 全局唯一样本总数: {len(seen)} 组")
    print(f"总耗时: {time.time()-start:.1f}s")


if __name__ == "__main__":
    main()