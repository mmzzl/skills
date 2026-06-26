---
name: dlt-predictor
description: 大乐透号码预测系统，支持获取数据、训练模型、预测下期号码。当用户提到大乐透、彩票预测、体彩、选号、号码推荐时使用。
---

# 大乐透号码预测技能

基于 MultiOutputRegressor(RandomForest) 的号码预测系统，36 维结构特征映射。

> ⚠️ 大乐透为独立随机事件，本系统仅为数据建模实验，不构成购彩建议。

---

## 使用场景

```
用户: 下期大乐透推荐什么号？
   → 训练模型 → 预测输出

用户: 大乐透最新数据更新了吗？
   → 刷新缓存 → 显示最新期号

用户: 这期号码命中率怎么样？
   → 回测评估 → 输出历史准确率
```

---

## 命令列表

### 1. 生成演化数据池

```bash
# 纯自由演化：从 200 个随机细胞开始，120 代自我演化出 10 万组
py 大乐透/ga_generate.py
```

- **无需任何外部数据**，纯随机种子开始
- 输出到 `data_pool/dlt_data_pool.csv`（10 万组，全部不重复）

### 2. 训练 + 预测

```bash
# 完整流水线：加载数据 → 构建特征 → 训练 → 评估 → 预测下期
py 大乐透/predict/pipeline.py
```

输出示例：
```
加载数据...
历史: 2884 期, GA: 100000 组
构建数据集...
训练: (66307, 36), 测试: (577, 36), GA校验: (16000, 36)
训练中...
训练完成: 82.1s

测试集评估:
  红1: 7.28%, 红2: 6.41%, 红3: 7.28%, 红4: 7.97%, 红5: 6.59%
  蓝1: 7.80%, 蓝2: 8.49%
  MAE: 5.42, RMSE: 7.11
  命中≥0: 100.0%
  命中≥1: 91.3%
  命中≥2: 63.1%
  ≥2红+≥1蓝: 24.36%

最新一期: [7, 15, 16, 21, 29, 7, 11]
预测下期: [3, 12, 18, 24, 31, 5, 9]
```

### 3. 回测评估

```bash
# 在全部数据上训练，输出 577 期测试集详细报告
py 大乐透/predict/analyze.py
```

---

## 命令行参数

| 命令 | 功能 | 耗时 |
|------|------|------|
| `py 大乐透/ga_generate.py` | 纯自由演化生成 10 万组数据 | ~2 秒 |
| `py 大乐透/predict/pipeline.py` | 训练 + 预测下期 | ~90 秒 |
| `py 大乐透/predict/analyze.py` | 回测评估 | ~90 秒 |

---

## 微信龙虾接入示例

```python
import subprocess
import json

def handle_dlt_predict():
    """处理大乐透预测请求"""
    result = subprocess.run(
        ["py", "大乐透/predict/pipeline.py"],
        capture_output=True, text=True, timeout=120
    )
    return result.stdout

def handle_dlt_refresh():
    """刷新数据"""
    subprocess.run(
        ["py", "大乐透/ga_generate.py"],
        timeout=300
    )
    return "数据已更新"

def handle_dlt_analyze():
    """回测分析"""
    result = subprocess.run(
        ["py", "大乐透/predict/analyze.py"],
        capture_output=True, text=True, timeout=120
    )
    return result.stdout
```

---

## 数据说明

| 文件 | 说明 | 自动生成 |
|------|------|----------|
| `dlt_history.csv` | 历史开奖（序号, 红1-红5, 蓝1-蓝2） | ✅ |
| `data_pool/dlt_data_pool.csv` | GA 模拟号码池 ~10 万组 | ✅ |
| `predict/features.py` | 36 维特征提取 | — |
| `predict/pipeline.py` | 训练 + 预测流水线 | — |
| `predict/analyze.py` | 回测分析 | — |

GA 数据基于宇宙细胞演化模型：200 个随机种子 → 120 代高变异演化 → 10 万组完全不重复样本。

---

## 依赖

```bash
cd 大乐透/predict
pip install pandas numpy scikit-learn requests
```

---

## 模型参数

- **算法**: `MultiOutputRegressor(RandomForestRegressor)`
- **树数量**: 100, **深度**: 12, **叶最小样本**: 5
- **每树采样**: 80%, **每树特征**: 70%
- **训练/测试**: 前 2307 期 / 后 577 期
- **样本权重**: 历史 38:1 GA（历史信号主导）
