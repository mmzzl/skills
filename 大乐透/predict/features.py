"""
大乐透号码组合 → 36维特征向量
所有函数输入: [红1, 红2, 红3, 红4, 红5, 蓝1, 蓝2]
"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import pandas as pd

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
    feats["蓝跨度"] = abs(b[1] - b[0])
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
    while i < len(arr):
        j = i
        while j + 1 < len(arr) and arr[j+1] == arr[j] + 1:
            j += 1
        if j - i >= 1:
            cnt += 1
        i = j + 1
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
    return pd.DataFrame([extract_features(c) for c in combos])


def feature_keys():
    """返回有序的 36 维特征名列表"""
    return list(extract_features([1, 2, 3, 4, 5, 1, 2]).keys())
