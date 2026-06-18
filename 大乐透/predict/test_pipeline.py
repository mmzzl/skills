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
