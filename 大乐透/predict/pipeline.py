"""
大乐透预测流水线：数据加载、GA 生成、特征标注、模型训练、预测
"""

import os, csv, math, sys, time
import numpy as np
import pandas as pd
from collections import Counter
from sklearn.ensemble import RandomForestRegressor
from sklearn.multioutput import MultiOutputRegressor

from features import extract_features, extract_features_batch, feature_keys

DLT_CSV = os.path.join(os.path.dirname(__file__), "..", "dlt_history.csv")
GA_CSV = os.path.join(os.path.dirname(__file__), "..", "data_pool", "dlt_data_pool.csv")

POS_NAMES = ["红1", "红2", "红3", "红4", "红5", "蓝1", "蓝2"]


def load_draws(path=DLT_CSV):
    """加载历史开奖 CSV"""
    draws = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 8:
                draws.append([int(x) for x in row[1:8]])
    return draws


def load_ga_pool(path=GA_CSV):
    """加载 GA 池 CSV"""
    pool = []
    with open(path, encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)
        for row in reader:
            if len(row) >= 8:
                pool.append([int(x) for x in row[1:8]])
    return pool


def compute_delta(combo_t, combo_t1):
    """
    计算 combo_t 相对于 combo_t1 的 9 维差分特征
    combo_t = 当期, combo_t1 = 上期
    """
    r_t, b_t = combo_t[:5], combo_t[5:]
    r_t1, b_t1 = combo_t1[:5], combo_t1[5:]

    return {
        "和值差分": sum(r_t) - sum(r_t1),
        "跨度差分": (max(r_t) - min(r_t)) - (max(r_t1) - min(r_t1)),
        "红奇数差分": sum(1 for v in r_t if v % 2 == 1) - sum(1 for v in r_t1 if v % 2 == 1),
        "红偶数差分": sum(1 for v in r_t if v % 2 == 0) - sum(1 for v in r_t1 if v % 2 == 0),
        "红一区差分": sum(1 for v in r_t if v <= 12) - sum(1 for v in r_t1 if v <= 12),
        "红二区差分": sum(1 for v in r_t if 13 <= v <= 24) - sum(1 for v in r_t1 if 13 <= v <= 24),
        "红三区差分": sum(1 for v in r_t if v >= 25) - sum(1 for v in r_t1 if v >= 25),
        "连号差分": _count_groups(r_t) - _count_groups(r_t1),
        "红蓝总合差分": (sum(r_t) + sum(b_t)) - (sum(r_t1) + sum(b_t1)),
    }


def _count_groups(arr):
    """辅助: 统计连号组数 (供 compute_delta 内部使用)"""
    cnt = 0
    i = 0
    while i < len(arr):
        j = i
        while j + 1 < len(arr) and arr[j+1] == arr[j] + 1:
            j += 1
        if j - i >= 1:
            cnt += 1
        i = j + 1
    return cnt


def apply_delta(feats_dict, delta_dict):
    """将 9 维差分写入特征字典"""
    for k, v in delta_dict.items():
        feats_dict[k] = v
    return feats_dict


def build_dataset(draws, ga_pool, ga_filter_std=2.0):
    """
    构建训练/测试数据集
    - 历史: 前2307训练, 后577测试
    - GA: 随机64000训练, 16000校验
    """
    n = len(draws)
    train_n = 2307

    # 历史训练集 (第1期差分填0)
    hist_train = draws[:train_n]
    X_hist = []
    Y_hist = []
    for i, combo in enumerate(hist_train):
        feats = extract_features(combo)
        if i > 0:
            delta = compute_delta(combo, draws[i-1])
            feats = apply_delta(feats, delta)
        X_hist.append(feats)
        Y_hist.append(combo)

    # 历史测试集
    hist_test = draws[train_n:]
    X_test = []
    Y_test = []
    for i, combo in enumerate(hist_test):
        feats = extract_features(combo)
        abs_idx = train_n + i
        delta = compute_delta(combo, draws[abs_idx-1])
        feats = apply_delta(feats, delta)
        X_test.append(feats)
        Y_test.append(combo)

    # GA 池过滤: 2σ
    filtered = filter_ga_pool(ga_pool, draws, ga_filter_std)
    rng = np.random.RandomState(42)
    rng.shuffle(filtered)
    n_ga_train = min(64000, len(filtered))
    ga_train_pool = filtered[:n_ga_train]
    ga_val_pool = filtered[n_ga_train:n_ga_train+16000]

    X_ga = [extract_features(c) for c in ga_train_pool]
    Y_ga = ga_train_pool

    X_val = [extract_features(c) for c in ga_val_pool]
    Y_val = ga_val_pool

    # 合并
    X_train = pd.DataFrame(X_hist + X_ga, columns=feature_keys())
    Y_train = np.array(Y_hist + Y_ga)
    X_test = pd.DataFrame(X_test, columns=feature_keys())
    Y_test = np.array(Y_test)

    # 权重
    sample_weight = np.array([38] * len(X_hist) + [1] * len(X_ga))

    return (X_train, Y_train, sample_weight,
            X_test, Y_test,
            pd.DataFrame(X_val), np.array(Y_val))


def filter_ga_pool(pool, draws, std_thresh=2.0):
    """过滤偏离历史分布超过 2σ 的 GA 组合"""
    hist_sums = np.array([sum(d[:5]) for d in draws])
    hist_odds = np.array([sum(1 for v in d[:5] if v % 2 == 1) for d in draws])
    hist_z1 = np.array([sum(1 for v in d[:5] if v <= 12) for d in draws])
    hist_z2 = np.array([sum(1 for v in d[:5] if 13 <= v <= 24) for d in draws])

    means = [hist_sums.mean(), hist_odds.mean(), hist_z1.mean(), hist_z2.mean()]
    stds = [max(hist_sums.std(), 1), max(hist_odds.std(), 1),
            max(hist_z1.std(), 1), max(hist_z2.std(), 1)]

    valid = []
    for c in pool:
        r = c[:5]
        vals = [sum(r), sum(1 for v in r if v % 2 == 1),
                sum(1 for v in r if v <= 12), sum(1 for v in r if 13 <= v <= 24)]
        if all(abs(vals[i] - means[i]) <= std_thresh * stds[i] for i in range(4)):
            valid.append(c)
    return valid


def train_model(X_train, Y_train, sample_weight):
    """训练 MultiOutputRegressor(RandomForest)"""
    base_rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_leaf=5,
        max_samples=0.8,
        max_features=0.7,
        random_state=42,
        n_jobs=-1
    )
    model = MultiOutputRegressor(base_rf)
    model.fit(X_train, Y_train, sample_weight=sample_weight)
    return model


def evaluate(model, X, Y, name="test"):
    """评估模型"""
    pred = model.predict(X)
    pred_int = postprocess(pred)

    n = len(Y)
    pos_hits = []
    for pos in range(7):
        hits = sum(1 for i in range(n) if pred_int[i][pos] == Y[i][pos])
        pos_hits.append(hits / n)

    any_hits = [sum(1 for p in range(7) if pred_int[i][p] == Y[i][p]) for i in range(n)]

    mae = np.mean(np.abs(pred - Y))
    rmse = np.sqrt(np.mean((pred - Y) ** 2))

    return {"pos_hits": pos_hits, "any_hits": any_hits, "mae": mae, "rmse": rmse}


def postprocess(pred):
    """后处理: 取整→裁剪→去重排序→补全"""
    pred = np.atleast_2d(pred)
    result = []
    for row in pred:
        reds = [max(1, min(35, round(v))) for v in row[:5]]
        blues = [max(1, min(12, round(v))) for v in row[5:7]]

        reds = sorted(set(reds))
        while len(reds) < 5:
            for cand in range(1, 36):
                if cand not in reds:
                    reds.append(cand)
                    break
        reds = sorted(reds[:5])
        blues = sorted([max(1, min(12, b)) for b in blues[:2]])
        result.append(reds + blues)
    return np.array(result)


def predict_next(model, draw_t, draw_t1):
    """
    基于最新两期开奖预测下一期
    draw_t: 最新一期
    draw_t1: 倒数第二期
    """
    feats = extract_features(draw_t)
    delta = compute_delta(draw_t, draw_t1)
    feats = apply_delta(feats, delta)

    X = pd.DataFrame([feats], columns=feature_keys())
    pred = model.predict(X)
    return postprocess(pred)[0]


def main():
    print("加载数据...")
    draws = load_draws()
    ga_pool = load_ga_pool()
    print(f"历史: {len(draws)} 期, GA: {len(ga_pool)} 组")

    print("构建数据集...")
    (X_train, Y_train, sw, X_test, Y_test, X_val, Y_val) = build_dataset(draws, ga_pool)
    print(f"训练: {X_train.shape}, 测试: {X_test.shape}, GA校验: {X_val.shape}")

    print("训练中...")
    t0 = time.time()
    model = train_model(X_train, Y_train, sw)
    print(f"训练完成: {time.time()-t0:.1f}s")

    print("\n测试集评估:")
    res = evaluate(model, X_test, Y_test)
    for i, name in enumerate(POS_NAMES):
        print(f"  {name}: {res['pos_hits'][i]*100:.2f}%")
    print(f"  MAE: {res['mae']:.2f}, RMSE: {res['rmse']:.2f}")
    print(f"  命中≥0: {sum(1 for h in res['any_hits'] if h>=0)/len(Y_test)*100:.1f}%")
    print(f"  命中≥1: {sum(1 for h in res['any_hits'] if h>=1)/len(Y_test)*100:.1f}%")
    print(f"  命中≥2: {sum(1 for h in res['any_hits'] if h>=2)/len(Y_test)*100:.1f}%")

    res_val = evaluate(model, X_val, Y_val, "val")
    print(f"\nGA校验集 MAE: {res_val['mae']:.2f} (测试集 MAE: {res['mae']:.2f})")
    diff = abs(res_val['mae'] - res['mae'])
    if diff > 0.5:
        print("警告: GA/真实 MAE 差异偏大, 建议检查")

    print(f"\n最新一期: {draws[-1]}")
    pred = predict_next(model, draws[-1], draws[-2])
    print(f"预测下期: {pred}")


if __name__ == "__main__":
    main()
