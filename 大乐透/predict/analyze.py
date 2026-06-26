"""
回测分析: 对后 577 期测试集逐期预测并统计
"""
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

import time
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

    hit_dist = Counter(res['any_hits'])
    print(f"\n命中个数分布:")
    for k in sorted(hit_dist):
        print(f"  {k}/7: {hit_dist[k]/len(Y_test)*100:.1f}% ({hit_dist[k]}次)")

    res_val = evaluate(model, X_val, Y_val)
    print(f"\n诊断对照:")
    print(f"  GA校验 MAE: {res_val['mae']:.3f} | 真实测试 MAE: {res['mae']:.3f}")
    print(f"  GA校验 RMSE: {res_val['rmse']:.3f} | 真实测试 RMSE: {res['rmse']:.3f}")

    print(f"\n最新一期: {draws[-1]}")
    next_pred = predict_next(model, draws[-1], draws[-2])
    print(f"预测下期: {next_pred}")


if __name__ == "__main__":
    backtest()
