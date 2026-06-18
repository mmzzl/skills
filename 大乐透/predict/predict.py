"""
大乐透下一期预测
- 加载历史数据 + GA池
- 特征工程：和值、跨度、奇偶比、质数、位置频率等
- 用 sklearn RandomForest 对每个位置训练分类器
- 基于最新一期开奖特征预测下一期
"""
import os, sys, csv, math, time
import requests
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.ensemble import RandomForestClassifier

DLT_URL = "http://www.17500.cn/getData/dlt.TXT"
CACHE = os.path.join(os.path.dirname(__file__), "..", "dlt_cache.txt")
GA_POOL = os.path.join(os.path.dirname(__file__), "..", "ga", "go", "data_pool", "dlt_data_pool.csv")

PRIMES = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31}

POS_NAMES = ["红1", "红2", "红3", "红4", "红5", "蓝1", "蓝2"]
POS_RANGES = [35, 35, 35, 35, 35, 12, 12]

# ── 数据加载 ──────────────────────────────────────────

def load_data(refresh=False):
    if not refresh and os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as f:
            text = f.read().strip()
        if text:
            print(f"使用缓存数据: {CACHE}")
            return text
    print("下载大乐透历史数据...")
    resp = requests.get(DLT_URL, timeout=30)
    resp.encoding = "utf-8"
    text = resp.text
    with open(CACHE, "w", encoding="utf-8") as f:
        f.write(text)
    return text

def parse_draws(text):
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

def load_ga_pool(path):
    if not os.path.exists(path):
        return None
    pool = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader, None)
        for row in reader:
            if len(row) >= 8:
                pool.append([int(x) for x in row[1:8]])
    return pool

# ── 特征工程 ──────────────────────────────────────────

def is_prime(n):
    return n in PRIMES

def draw_features(draw):
    """单个号码组合的特征"""
    r = draw[:5]
    b = draw[5:]
    feats = {
        "红和值": sum(r),
        "红跨度": max(r) - min(r),
        "红奇数": sum(1 for v in r if v % 2 == 1),
        "红偶": sum(1 for v in r if v % 2 == 0),
        "红质数": sum(1 for v in r if is_prime(v)),
        "蓝和值": sum(b),
        "蓝跨度": b[1] - b[0],
        "蓝奇数": sum(1 for v in b if v % 2 == 1),
        "蓝偶": sum(1 for v in b if v % 2 == 0),
    }
    return feats

def build_features(draws, pos, ga_pool=None):
    """
    对位置 pos 构建训练数据。
    每期 = 1样本:
      - 上期的号码组合特征 (和值、跨度等) 
      - 上期的7个号码
      - 滚动窗口频率 (近20期该位置)
      - GA池频率 (如果提供)
    标签 = 该期该位置的号码
    """
    window = 20
    nr = POS_RANGES[pos]
    n = len(draws)

    # 滚动频率
    roll_counts = np.zeros((n + 1, nr + 1), dtype=int)
    for t in range(n):
        roll_counts[t + 1] = roll_counts[t].copy()
        roll_counts[t + 1][draws[t][pos]] += 1
        if t >= window:
            roll_counts[t + 1][draws[t - window][pos]] -= 1

    # GA池频率
    if ga_pool is not None:
        ga_freq = np.zeros(nr + 1)
        for combo in ga_pool:
            ga_freq[combo[pos]] += 1
        ga_freq = ga_freq / max(len(ga_pool), 1)
    else:
        ga_freq = None

    rows = []
    labels = []
    for t in range(1, n):
        prev = draws[t - 1]
        feats = draw_features(prev)
        # 上期7个号码
        feats["上期红1"] = prev[0] / 35
        feats["上期红2"] = prev[1] / 35
        feats["上期红3"] = prev[2] / 35
        feats["上期红4"] = prev[3] / 35
        feats["上期红5"] = prev[4] / 35
        feats["上期蓝1"] = prev[5] / 12
        feats["上期蓝2"] = prev[6] / 12
        # 滚动频率 (归一化)
        for num in range(1, nr + 1):
            feats[f"窗口频_{num}"] = roll_counts[t][num] / window
        # GA池频率 (差值)
        if ga_freq is not None:
            for num in range(1, nr + 1):
                feats[f"GA差_{num}"] = ga_freq[num] - roll_counts[t][num] / window

        rows.append(feats)
        labels.append(draws[t][pos] - 1)

    return pd.DataFrame(rows), np.array(labels)

def build_ga_freq_all(ga_pool):
    """GA池每个位置频率分布"""
    freqs = []
    for pos in range(7):
        c = Counter()
        for combo in ga_pool:
            c[combo[pos]] += 1
        total = len(ga_pool)
        freqs.append({k: v / total for k, v in c.items()})
    return freqs

def predict_features(last_draw, pos, hist_roll_counts, hist_total, ga_freq=None):
    """预测阶段：用最新一期开奖 + 全局历史频率 + GA池频率"""
    nr = POS_RANGES[pos]
    feats = draw_features(last_draw)
    feats["上期红1"] = last_draw[0] / 35
    feats["上期红2"] = last_draw[1] / 35
    feats["上期红3"] = last_draw[2] / 35
    feats["上期红4"] = last_draw[3] / 35
    feats["上期红5"] = last_draw[4] / 35
    feats["上期蓝1"] = last_draw[5] / 12
    feats["上期蓝2"] = last_draw[6] / 12
    for num in range(1, nr + 1):
        feats[f"窗口频_{num}"] = hist_roll_counts[pos][num]
    if ga_freq is not None:
        for num in range(1, nr + 1):
            feats[f"GA差_{num}"] = ga_freq[pos].get(num, 0) - hist_roll_counts[pos][num]
    return feats

# ── 主流程 ──────────────────────────────────────────

def main(refresh=False, use_ga=True):
    t0 = time.time()

    text = load_data(refresh)
    draws = parse_draws(text)
    print(f"解析到 {len(draws)} 期历史数据")

    ga_pool = load_ga_pool(GA_POOL) if use_ga else None
    if ga_pool is not None:
        print(f"加载 GA 池: {len(ga_pool)} 组")
        ga_freq_all = build_ga_freq_all(ga_pool)
    else:
        ga_freq_all = None
        print("未使用 GA 池")

    # 全局滚动频率 (用于预测)
    hist_roll = {}
    for pos in range(7):
        nr = POS_RANGES[pos]
        counts = np.zeros(nr + 1)
        for d in draws:
            counts[d[pos]] += 1
        total = max(len(draws), 1)
        hist_roll[pos] = {num: counts[num] / total for num in range(1, nr + 1)}

    models = {}
    for pi, name in enumerate(POS_NAMES):
        nr = POS_RANGES[pi]
        print(f"\n=== 训练 {name} (号码1-{nr}) ===")
        X, y = build_features(draws, pi, ga_pool)
        n_test = 1000
        X_train, y_train = X[:-n_test], y[:-n_test]
        X_test, y_test = X.iloc[-n_test:], y[-n_test:]

        rf = RandomForestClassifier(
            n_estimators=100, max_depth=12, min_samples_leaf=5,
            random_state=42, n_jobs=-1
        )
        rf.fit(X_train, y_train)
        acc = rf.score(X_test, y_test)
        print(f"  样本: {len(X)}, 特征: {X.shape[1]}, 测试准确率: {acc*100:.2f}% (随机: {100/nr:.2f}%)")
        models[pi] = rf

    # ── 预测下一期 ──
    last = draws[-1]
    print(f"\n=== 预测下一期 ===")
    print(f"最近一期开奖: 红{last[:5]} 蓝{last[5:]}")

    if ga_freq_all is not None:
        print(f"\n{'位置':<6} {'GA推荐':>8} {'GA频率':>8} {'RF预测':>8} {'置信度':>8} {'集成':>8}")
        print("-" * 52)
    else:
        print(f"\n{'位置':<6} {'RF预测':>8} {'置信度':>8}")
        print("-" * 26)

    final = []
    for pi, name in enumerate(POS_NAMES):
        feat = predict_features(last, pi, hist_roll, len(draws), ga_freq_all)
        X_pred = pd.DataFrame([feat])

        probs = models[pi].predict_proba(X_pred)[0]
        pred = np.argmax(probs)
        confidence = probs[pred]

        if ga_freq_all is not None:
            ga_best = max(ga_freq_all[pi], key=ga_freq_all[pi].get)
            ga_pct = ga_freq_all[pi][ga_best] * 100
            rf_pct = confidence * 100
            weight_ga = ga_pct / 100
            ensemble = pred + 1 if rf_pct >= weight_ga * 100 else ga_best
            final.append(ensemble)
            print(f"  {name:<6}  {ga_best:>4}({ga_pct:>5.1f}%)  {pred+1:>4}({rf_pct:>5.1f}%)  {ensemble:>4}")
        else:
            final.append(pred + 1)
            print(f"  {name:<6}  {pred+1:>4}       {confidence*100:>5.1f}%")

    reds = final[:5]
    blues = final[5:]
    print(f"\n预测号码: 红{reds}  蓝{blues}")
    print(f"总耗时: {time.time()-t0:.1f}s")

if __name__ == "__main__":
    refresh = "--refresh" in sys.argv
    no_ga = "--no-ga" in sys.argv
    main(refresh=refresh, use_ga=not no_ga)
