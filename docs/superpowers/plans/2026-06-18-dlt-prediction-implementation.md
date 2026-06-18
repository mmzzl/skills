# 大乐透号码预测系统 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete lottery prediction pipeline using MultiOutputRegressor(RandomForest) with 36-dim features, trained on historical draws + GA pool with sample_weight balancing.

**Architecture:** Single Python package under `大乐透/predict/`. `features.py` extracts 36-dim feature vectors from any 7-number combination. `pipeline.py` handles data loading, GA pool generation, dataset construction, model training, and next-draw prediction. `analyze.py` runs rolling backtest on the last 577 historical draws.

**Tech Stack:** Python 3.12, pandas, numpy, scikit-learn, requests

---

## File Structure

```
大乐透/
├── dlt_history.csv              # 历史开奖数据 CSV (新)
├── ga_generate.py               # GA 生成器 (已有, 微调)
├── data_pool/
│   └── dlt_data_pool.csv        # GA 池 (已有)
└── predict/
    ├── requirements.txt         # (更新)
    ├── features.py              # (新) 36维特征提取
    ├── pipeline.py              # (新) 完整训练+预测流水线
    ├── analyze.py               # (新) 回测评估
    └── test_pipeline.py         # (新) 集成测试
```

---

## Task 1: dlt_history.csv 数据缓存

**Files:**
- Modify: `大乐透/ga_generate.py`
- Create: `大乐透/dlt_history.csv`
- Test: manual test

- [ ] **Step 1: 修改 ga_generate.py 缓存路径**

将 CACHE_FILE 从 `./dlt_cache.txt` 改为 `./dlt_history.csv`，输出格式改为 CSV：

```python
CACHE_FILE = "./dlt_history.csv"

def save_draws_as_csv(draws):
    """将解析后的开奖数据保存为 CSV"""
    with open(CACHE_FILE, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["期号", "红1", "红2", "红3", "红4", "红5", "蓝1", "蓝2"])
        for idx, d in enumerate(draws, 1):
            writer.writerow([idx] + d)

def load_data():
    if os.path.exists(CACHE_FILE):
        # 尝试 CSV 格式读取
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
        except:
            pass
    # 下载并保存 CSV
    text = download_data()
    draws = parse_draws(text)
    save_draws_as_csv(draws)
    return draws
```

Requires adjusting `main()` to use `load_data()` returning list of draws directly instead of text.

- [ ] **Step 2: 运行验证**

Run: `py 大乐透/ga_generate.py`
Expected: 下载/缓存数据，GA 运行，输出到 data_pool/dlt_data_pool.csv

- [ ] **Step 3: Commit**

```bash
git add 大乐透/ga_generate.py 大乐透/dlt_history.csv
git commit -m "refactor: change cache format to CSV"
```

---

## Task 2: features.py — 36维特征提取

**Files:**
- Create: `大乐透/predict/features.py`
- Test: `大乐透/predict/test_pipeline.py` (部分)

- [ ] **Step 1: 实现核心特征提取函数**

Create `大乐透/predict/features.py`:

```python
"""
大乐透号码组合 → 36维特征向量
所有函数输入: [红1, 红2, 红3, 红4, 红5, 蓝1, 蓝2]
"""

PRIMES = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31}

def extract_features(combo):
    """
    输入: [红1, 红2, 红3, 红4, 红5, 蓝1, 蓝2]
    输出: dict with 36 keys (浮点数)
    """
    r = combo[:5]
    b = combo[5:]

    feats = {}

    # === 第一部分: 红球基础静态 (13) ===
    feats["红和值"] = sum(r)
    feats["红跨度"] = max(r) - min(r)
    feats["红奇数"] = sum(1 for v in r if v % 2 == 1)
    feats["红偶数"] = sum(1 for v in r if v % 2 == 0)
    feats["红质数"] = sum(1 for v in r if v in PRIMES)
    feats["红合数"] = sum(1 for v in r if v > 1 and v not in PRIMES)
    feats["红一区"] = sum(1 for v in r if 1 <= v <= 12)
    feats["红二区"] = sum(1 for v in r if 13 <= v <= 24)
    feats["红三区"] = sum(1 for v in r if 25 <= v <= 35)
    feats["红连号组数"] = _count_consecutive_groups(r)
    for rem in [0, 1, 2]:
        feats[f"红余{rem}"] = sum(1 for v in r if v % 3 == rem)

    # === 第二部分: 红球扩展静态 (6) ===
    feats["红均值"] = sum(r) / 5
    feats["红方差"] = sum((v - sum(r)/5) ** 2 for v in r) / 5
    feats["小号数"] = sum(1 for v in r if 1 <= v <= 18)
    feats["大号数"] = sum(1 for v in r if 19 <= v <= 35)
    feats["最大连号长度"] = _max_consecutive_length(r)
    feats["奇偶交替"] = _odd_even_alternate(r)

    # === 第三部分: 双蓝静态 (8) ===
    feats["蓝和值"] = sum(b)
    feats["蓝跨度"] = b[1] - b[0]
    feats["蓝奇数"] = sum(1 for v in b if v % 2 == 1)
    feats["蓝偶数"] = sum(1 for v in b if v % 2 == 0)
    feats["蓝小号"] = sum(1 for v in b if 1 <= v <= 6)
    feats["蓝大号"] = sum(1 for v in b if 7 <= v <= 12)
    feats["蓝1余数"] = b[0] % 3
    feats["蓝2余数"] = b[1] % 3

    # === 第四部分: 时序差分 (9) ===
    # 由外部调用者填充，这里返回空值
    for key in ["和值差分", "跨度差分", "红奇数差分", "红偶数差分",
                 "红一区差分", "红二区差分", "红三区差分",
                 "连号差分", "红蓝总合差分"]:
        feats[key] = 0

    return feats


def _count_consecutive_groups(arr):
    """统计连号组数, 如 [5,6, 10, 15,16] → 2"""
    cnt = 0
    i = 0
    while i < len(arr) - 1:
        if arr[i+1] == arr[i] + 1:
            cnt += 1
            i += 2
        else:
            i += 1
    return cnt


def _max_consecutive_length(arr):
    """最大连号长度, 如 [5,6,7, 10, 15] → 3"""
    max_len = 1
    cur = 1
    for i in range(len(arr) - 1):
        if arr[i+1] == arr[i] + 1:
            cur += 1
            max_len = max(max_len, cur)
        else:
            cur = 1
    return max_len


def _odd_even_alternate(arr):
    """奇偶交替标记: 全部奇或全部偶→0, 有交替→1"""
    has_odd = any(v % 2 == 1 for v in arr)
    has_even = any(v % 2 == 0 for v in arr)
    return 1 if has_odd and has_even else 0


def extract_features_batch(combos):
    """批量提取"""
    import pandas as pd
    return pd.DataFrame([extract_features(c) for c in combos])


def feature_keys():
    """返回有序的 36 维特征名列表"""
    return list(extract_features([1, 2, 3, 4, 5, 1, 2]).keys())
```

- [ ] **Step 2: 编写测试**

Add to `大乐透/predict/test_pipeline.py`:

```python
from features import extract_features, feature_keys

def test_feature_dim():
    feats = extract_features([1, 10, 20, 30, 35, 3, 9])
    assert len(feats) == 36

def test_feature_values():
    feats = extract_features([1, 2, 3, 4, 5, 1, 2])
    assert feats["红和值"] == 15
    assert feats["红跨度"] == 4
    assert feats["最大连号长度"] == 5
    assert feats["连号差分"] == 0  # 默认值

def test_feature_keys_ordered():
    keys = feature_keys()
    assert keys[-9:] == [
        "和值差分", "跨度差分", "红奇数差分", "红偶数差分",
        "红一区差分", "红二区差分", "红三区差分",
        "连号差分", "红蓝总合差分"
    ]
```

- [ ] **Step 3: Run tests**

Run: `py -m pytest 大乐透/predict/test_pipeline.py::test_feature_dim 大乐透/predict/test_pipeline.py::test_feature_values 大乐透/predict/test_pipeline.py::test_feature_keys_ordered -v`
Expected: 3 PASS

- [ ] **Step 4: Commit**

```bash
git add 大乐透/predict/features.py 大乐透/predict/test_pipeline.py
git commit -m "feat: add 36-dim feature extraction"
```

---

## Task 3: pipeline.py — 数据加载 & GA生成

**Files:**
- Create: `大乐透/predict/pipeline.py`

- [ ] **Step 1: 实现数据加载函数**

```python
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
```

- [ ] **Step 2: 实现时序差分计算**

```python
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


def apply_delta(feats_dict, delta_dict):
    """将 9 维差分写入特征字典"""
    for k, v in delta_dict.items():
        feats_dict[k] = v
    return feats_dict
```

- [ ] **Step 3: 实现数据集构建**

```python
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

    X_ga = [extract_features(c) for c in ga_train_pool]  # 差分填0
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
```

- [ ] **Step 4: 实现训练逻辑**

```python
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

    # 位置精确命中率
    n = len(Y)
    pos_hits = []
    for pos in range(7):
        hits = sum(1 for i in range(n) if pred_int[i][pos] == Y[i][pos])
        pos_hits.append(hits / n)

    # 单注命中个数
    any_hits = [sum(1 for p in range(7) if pred_int[i][p] == Y[i][p]) for i in range(n)]

    # MAE
    mae = np.mean(np.abs(pred - Y))
    rmse = np.sqrt(np.mean((pred - Y) ** 2))

    return {"pos_hits": pos_hits, "any_hits": any_hits, "mae": mae, "rmse": rmse}
```

- [ ] **Step 5: 实现后处理**

```python
def postprocess(pred):
    """后处理: 取整→裁剪→去重排序→补全"""
    pred = np.atleast_2d(pred)
    result = []
    for row in pred:
        reds = [max(1, min(35, round(v))) for v in row[:5]]
        blues = [max(1, min(12, round(v))) for v in row[5:7]]

        # 红球去重
        reds = sorted(set(reds))
        # 补足
        while len(reds) < 5:
            for cand in range(1, 36):
                if cand not in reds:
                    reds.append(cand)
                    break
        reds = sorted(reds[:5])
        blues = sorted([max(1, min(12, b)) for b in blues[:2]])
        result.append(reds + blues)
    return np.array(result)
```

- [ ] **Step 6: 实现预测函数**

```python
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
```

- [ ] **Step 7: 实现 main() 入口**

```python
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

    # GA校验集
    res_val = evaluate(model, X_val, Y_val, "val")
    print(f"\nGA校验集 MAE: {res_val['mae']:.2f} (测试集 MAE: {res['mae']:.2f})")
    diff = abs(res_val['mae'] - res['mae'])
    if diff > 0.5:
        print("警告: GA/真实 MAE 差异偏大, 建议检查")

    # 预测下一期
    print(f"\n最新一期: {draws[-1]}")
    pred = predict_next(model, draws[-1], draws[-2])
    print(f"预测下期: {pred}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 8: 运行验证**

Run: `py 大乐透/predict/pipeline.py`
Expected: 训练完成，输出测试集评估 + 下一期预测

- [ ] **Step 9: Commit**

```bash
git add 大乐透/predict/pipeline.py
git commit -m "feat: add training pipeline with 36-dim features"
```

---

## Task 4: pipeline.py — 完善后处理 & 评估指标

**Files:**
- Modify: `大乐透/predict/pipeline.py`
- Test: `大乐透/predict/test_pipeline.py`

- [ ] **Step 1: 完善后处理函数**

改进 `postprocess()`:

```python
def postprocess(pred):
    """后处理: 取整→裁剪→去重排序→同区间高频补全"""
    PRIMES = {2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31}
    pred = np.atleast_2d(pred)
    result = []
    for row in pred:
        reds = [max(1, min(35, round(v))) for v in row[:5]]
        blues = [max(1, min(12, round(v))) for v in row[5:7]]

        reds = sorted(set(reds))
        # 不足5个: 按高频区间补
        while len(reds) < 5:
            # 计算现有分布
            odd_cnt = sum(1 for v in reds if v % 2 == 1)
            zone1 = sum(1 for v in reds if v <= 12)
            zone2 = sum(1 for v in reds if 13 <= v <= 24)
            zone3 = sum(1 for v in reds if 25 <= v <= 35)
            # 选最缺的区间
            zones = [(zone1, 1, 12), (zone2, 13, 24), (zone3, 25, 35)]
            target_zone = min(zones, key=lambda z: z[0])
            lo, hi = target_zone[1], target_zone[2]
            for cand in range(lo, hi + 1):
                if cand not in reds:
                    reds.append(cand)
                    break
        reds = sorted(reds[:5])
        blues = sorted([max(1, min(12, round(b))) for b in blues[:2]])
        result.append(reds + blues)
    return np.array(result)
```

- [ ] **Step 2: 加命中≥2+1指标**

```python
def evaluate(model, X, Y, name="test"):
    pred = model.predict(X)
    pred_int = postprocess(pred)
    n = len(Y)

    pos_hits = []
    for pos in range(7):
        pos_hits.append(sum(1 for i in range(n) if pred_int[i][pos] == Y[i][pos]) / n)

    any_hits = [sum(1 for p in range(7) if pred_int[i][p] == Y[i][p]) for i in range(n)]

    # 命中 ≥2红 + ≥1蓝
    hit_2r1b = sum(
        1 for i in range(n)
        if sum(1 for p in range(5) if pred_int[i][p] == Y[i][p]) >= 2
        and sum(1 for p in range(5, 7) if pred_int[i][p] == Y[i][p]) >= 1
    ) / n

    mae = np.mean(np.abs(pred_int - Y))
    rmse = np.sqrt(np.mean((pred_int - Y) ** 2))

    return {
        "pos_hits": pos_hits,
        "any_hits": any_hits,
        "hit_2r1b": hit_2r1b,
        "mae": mae,
        "rmse": rmse
    }
```

- [ ] **Step 3: 添加测试**

```python
def test_postprocess():
    from pipeline import postprocess
    pred = np.array([[1.2, 2.7, 3.1, 4.9, 35.2, 1.6, 12.3]])
    result = postprocess(pred)[0]
    assert len(result) == 7
    assert all(1 <= v <= 35 for v in result[:5])
    assert all(1 <= v <= 12 for v in result[5:])
    assert len(set(result[:5])) == 5  # 红球不重复
```

Run: `py -m pytest 大乐透/predict/test_pipeline.py::test_postprocess -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add 大乐透/predict/pipeline.py 大乐透/predict/test_pipeline.py
git commit -m "feat: add post-processing and hit_2r1b metric"
```

---

## Task 5: analyze.py — 回测分析

**Files:**
- Create: `大乐透/predict/analyze.py`

- [ ] **Step 1: 实现 rolling backtest**

```python
"""
回测分析: 对后 577 期测试集逐期预测并统计
"""
import sys, time
import numpy as np
from collections import Counter
from pipeline import (
    load_draws, load_ga_pool, build_dataset, train_model,
    evaluate, predict_next, postprocess, POS_NAMES
)


def backtest():
    draws = load_draws()
    ga_pool = load_ga_pool()
    print(f"历史: {len(draws)}, GA: {len(ga_pool)}")

    (X_train, Y_train, sw, X_test, Y_test, X_val, Y_val) = build_dataset(draws, ga_pool)

    print("训练全量模型...")
    t0 = time.time()
    model = train_model(X_train, Y_train, sw)
    print(f"训练耗时: {time.time()-t0:.1f}s")

    print("\n=== 测试集评估 (后577期) ===")
    res = evaluate(model, X_test, Y_test)
    for i, name in enumerate(POS_NAMES):
        print(f"  {name}: {res['pos_hits'][i]*100:.2f}%")
    print(f"  MAE: {res['mae']:.2f}, RMSE: {res['rmse']:.2f}")
    print(f"  命中≥0: {sum(1 for h in res['any_hits'] if h>=0)/len(Y_test)*100:.1f}%")
    print(f"  命中≥1: {sum(1 for h in res['any_hits'] if h>=1)/len(Y_test)*100:.1f}%")
    print(f"  命中≥2: {sum(1 for h in res['any_hits'] if h>=2)/len(Y_test)*100:.1f}%")
    print(f"  ≥2红+≥1蓝: {res['hit_2r1b']*100:.2f}%")

    # 命中个数分布
    hit_dist = Counter(res['any_hits'])
    print(f"\n命中个数分布:")
    for k in sorted(hit_dist):
        print(f"  {k}/7: {hit_dist[k]/len(Y_test)*100:.1f}% ({hit_dist[k]}次)")

    # GA 校验集对照
    res_val = evaluate(model, X_val, Y_val)
    print(f"\n诊断对照:")
    print(f"  GA校验 MAE: {res_val['mae']:.3f} | 真实测试 MAE: {res['mae']:.3f}")
    print(f"  GA校验 RMSE: {res_val['rmse']:.3f} | 真实测试 RMSE: {res['rmse']:.3f}")

    # 预测下一期
    print(f"\n最新一期: {draws[-1]}")
    next_pred = predict_next(model, draws[-1], draws[-2])
    print(f"预测下期: {next_pred}")


if __name__ == "__main__":
    backtest()
```

- [ ] **Step 2: 运行验证**

Run: `py 大乐透/predict/analyze.py`
Expected: 完整评估报告输出，包含命中率、分布、诊断对照

- [ ] **Step 3: Commit**

```bash
git add 大乐透/predict/analyze.py
git commit -m "feat: add backtest analysis for 577 test draws"
```

---

## Task 6: requirements.txt 更新

**Files:**
- Modify: `大乐透/predict/requirements.txt`

- [ ] **Step 1: 确保完整依赖**

```txt
pandas
numpy
scikit-learn
requests
```

- [ ] **Step 2: Commit**

```bash
git add 大乐透/predict/requirements.txt
git commit -m "chore: update requirements"
```

---

## Task 7: 集成测试

**Files:**
- Modify: `大乐透/predict/test_pipeline.py`

- [ ] **Step 1: 端到端测试**

```python
def test_end_to_end():
    from pipeline import load_draws, load_ga_pool, build_dataset, train_model, evaluate
    draws = load_draws()
    ga_pool = load_ga_pool()
    assert len(draws) >= 2800
    assert len(ga_pool) >= 10000

    X_train, Y_train, sw, X_test, Y_test, _, _ = build_dataset(draws, ga_pool)
    assert X_train.shape[0] > 60000
    assert X_train.shape[1] == 36
    assert Y_train.shape[1] == 7
    assert len(sw) == X_train.shape[0]

    model = train_model(X_train, Y_train, sw)
    res = evaluate(model, X_test, Y_test)
    assert 0 <= res["mae"] <= 10
```

- [ ] **Step 2: 运行测试**

Run: `py -m pytest 大乐透/predict/test_pipeline.py::test_end_to_end -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add 大乐透/predict/test_pipeline.py
git commit -m "test: add integration test"
```
