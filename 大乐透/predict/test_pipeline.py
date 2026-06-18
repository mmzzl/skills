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

def test_consecutive_groups():
    from features import _count_consecutive_groups
    assert _count_consecutive_groups([5, 6, 10, 15, 16]) == 2
    assert _count_consecutive_groups([1, 2, 3, 4, 5]) == 1
    assert _count_consecutive_groups([1, 3, 5, 7, 9]) == 0
    assert _count_consecutive_groups([10, 11, 20, 21, 22]) == 2

def test_feature_keys_ordered():
    keys = feature_keys()
    assert keys[-9:] == [
        "和值差分", "跨度差分", "红奇数差分", "红偶数差分",
        "红一区差分", "红二区差分", "红三区差分",
        "连号差分", "红蓝总合差分"
    ]


def test_postprocess():
    from pipeline import postprocess
    import numpy as np
    pred = np.array([[1.2, 2.7, 3.1, 4.9, 35.2, 1.6, 12.3]])
    result = postprocess(pred)[0]
    assert len(result) == 7
    assert all(1 <= v <= 35 for v in result[:5])
    assert all(1 <= v <= 12 for v in result[5:])
    assert len(set(result[:5])) == 5


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
