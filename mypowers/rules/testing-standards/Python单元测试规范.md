# Python 单元测试规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写测试前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## 测试策略决策树

```
写哪一层？
  正常场景 → Controller 层（端到端，验证完整请求→处理→响应流程）
  异常场景 → Provider 层（边界与错误验证：参数校验、业务异常、外部依赖失败、回滚）
  内部方法 → 不单独写，由上层接口覆盖

函数是否必须写单测（3-High）？
  对外接口（Controller/Provider）→ 必须
  公共基础方法（utils/helpers/sf-libs）→ 必须
  函数行数 >80 行 或 入参 ≥3 个 → 必须
  函数行数 30-80 行 或 入参 ≥2 个 → 建议（2-Medium）
  函数行数 <30 行 且 入参 ≤1 个 → 酌情（1-Low）
```

---

## 规则详情

### 优先级与覆盖

**PY-PRIO-01** `[强制]` 3-High 函数必须写单测，且必须覆盖所有异常逻辑（参数非法、外部调用失败、回滚逻辑等）；不以代码覆盖率为唯一目标，追求场景覆盖率。

违规信号：3-High 函数无任何测试；单测只有正常场景，无异常分支用例；测试函数无断言只跑覆盖率。

---

### 四步骤规范

**PY-STEP-01** `[强制]` 每个测试用例必须包含四步：**注释 → 构造参数 → 打桩 → 断言**，缺一不可。

违规信号：无注释（不知道测什么）；无断言（只跑覆盖率）；有 Mock 但未断言调用。

```python
@mock.patch("{driver}.create_region_trusts".format(driver=TRUST_DRIVER_PATH))
@mock.patch("{driver}.update_user_trusts".format(driver=TRUST_DRIVER_PATH))
def test_create_trust_succeeds_when_all_params_valid(
        self, mock_update, mock_create_region):
    """
    创建代维授权成功
    被测函数名: create_trusts
    被测函数等级: 3-High
    单测函数思路（正常场景）:
    租户申请代维授权（msp 和 global admin），2 个数据中心，
    创建授权成功，并成功发送通知 4 次
    """

    # 1. 构造参数（按业务场景构造有意义的数据）
    params = copy.deepcopy(trust_data.create_trust)

    # 2. 打桩（只 Mock 当前用例需要的依赖）
    mock_create_region.return_value = trust_data.region_mgmt_success_return
    mock_update.return_value = trust_data.update_trusts_return

    # 3. 执行
    result = self.trust_api.create_trusts(self.req, params)

    # 4. 断言（返回值 + Mock 调用验证）
    self.assertEqual(result, trust_data.update_trusts_return)   # 验证返回值
    mock_update.assert_called_once()                            # 验证调用次数
```

---

### 命名规范

**PY-NAME-01** `[强制]` 测试函数命名遵循 `test_<主体>_<行为>_when_<条件>` 格式；函数 docstring 必须包含：被测函数名、被测函数等级、测试思路（场景类型 + 期望结果）。

违规信号：`test_create`、`test_case2`、`test_abnormal` 等无法判断测试场景的命名；无 docstring 或 docstring 无场景描述。

```python
❌ def test_create(self): ...
❌ def test_case2(self): ...
❌ def test_abnormal_scene(self): ...         # 不知道什么异常

✅ def test_create_trust_raises_error_when_trustor_mismatch(self): ...
✅ def test_list_trusts_returns_expired_when_deadline_passed(self): ...
✅ def test_create_alarm_strategy_raises_error_when_param_invalid(self): ...

# docstring 模板
"""
[功能描述]
被测函数名: create_trusts
被测函数等级: 3-High
单测函数思路（异常场景）:
（异常值-参数异常）代维租户和请求租户不一致 期望：返回 VisibleExNoPermissionTrust
（异常值-参数异常）数据中心列表为空 期望：返回 VisibleExRegionWithEmpty
（异常场景）部分数据中心创建失败 期望：回滚并返回 VisibleExUpdateTrustError
"""
```

---

### 测试数据

**PY-DATA-01** `[强制]` 时间相关测试数据必须基于当前时间动态计算，禁止使用静态固定时间；临界值数据必须准确反映业务边界（当前时间 ± 临界偏移量）。

违规信号：`expires_at = "2020-01-01"` 永远过期，无法验证边界；时间相关断言在不同时区/时间下结果不同。

```python
❌ trust["expires_at"] = "2020-01-01 00:00:00"   # 静态，永远过期，无法验证边界

✅ local_now = datetime.datetime.now()
   # 构造"刚过期1分钟"的临界数据
   expires_at = (local_now - relativedelta(minutes=1)).strftime(TIME_FORMAT)
   trust["expires_at"] = expires_at
```

---

**PY-DATA-02** `[建议]` 测试数据使用工厂函数/基础模板 + `copy.deepcopy`，每个用例只修改差异字段；ID 类数据使用随机生成（`data_utils.rand_uuid_hex()`）而非固定字符串。

违规信号：每个用例重新手写相同的大块字典；所有用例共享同一个字典对象（修改会互相影响）。

```python
❌ # 每个用例重写相同数据
   params = {"user_id": "fixed-id-123", "regions": [...], "expires_at": "..."}

❌ # 共享同一对象，前一个 case 修改后污染后续 case
   create_trust_param['user_id'] = data_utils.rand_uuid_hex()   # 直接修改共享对象

✅ # 深拷贝基础模板，只改需要的字段
   params = copy.deepcopy(trust_data.create_trust)
   params['user_id'] = data_utils.rand_uuid_hex()   # 只修改当前 case 需要的字段
```

---

### 断言规范

**PY-ASSERT-01** `[强制]` 每个用例必须有完整断言：返回值断言 + Mock 对象断言（调用次数或调用参数）；禁止无断言的"空跑"用例。

违规信号：测试函数无任何 `assert`/`assertEqual`；有 Mock 但从未校验 `call_count`/`assert_called_with`/`assert_not_called`。

```python
# ❌ 无断言，只跑覆盖率
def test_create_trust(self, mock_update, ...):
    self.trust_api.create_trusts(self.req, params)   # 无断言

# ✅ 验证返回值
self.assertEqual(result, trust_data.update_trusts_return)

# ✅ 验证调用次数（通知发送了 4 次）
self.assertEqual(mock_run_async.call_count, 4)

# ✅ 验证调用参数精确匹配（回滚函数入参正确）
mock_delete.assert_called_with(
    self.req, [trust_data.trust_region], common.DEFAULT_USER_ID,
    [common.DEFAULT_MSP_NAME, common.DEFAULT_GLOBAL_ADMIN_NAME])

# ✅ 验证未被调用（无授权时不应触发删除）
mock_update_user_trusts.assert_not_called()

# ✅ 验证调用参数细节
self.assertDictEqual(expected_filter, mock_list_trusts.call_args[0][1])
```

---

**PY-ASSERT-02** `[强制]` 异常场景必须用 `assertRaises` 断言精确的异常类型，禁止用宽泛的 `Exception`。

违规信号：`self.assertRaises(Exception, ...)` 无法区分不同异常类型；异常场景只 try/except 不做断言。

```python
❌ self.assertRaises(Exception, self.trust_api.create_trusts, ...)

✅ self.assertRaises(exception.VisibleExNoPermissionTrust,
                   self.trust_api.create_trusts,
                   self.req, create_trust_param)

✅ self.assertRaises(exception.VisibleExRegionWithEmpty,
                   self.trust_api.create_trusts,
                   self.req, create_trust_param2)
```

---

### Mock 规范

**PY-MOCK-01** `[强制]` 只 Mock 外部依赖（DB 查询、RPC 调用、工具函数），不 Mock 被测对象内部逻辑；每个 Mock 对象必须有调用断言；测试间不得共享 Mock 状态（`side_effect` 在每个 case 前重置）。

违规信号：`@mock.patch` 了 6 个函数但只用到 2 个；Mock 函数从未做任何调用断言；前一个 case 设置的 `side_effect` 未重置影响后续 case。

```python
# ❌ 无用的 Mock（@mock.patch 了但从不用也不断言）
@mock.patch("{driver}.unused_func".format(driver=DRIVER))
def test_something(self, mock_unused, ...):   # mock_unused 从未使用
    ...

# ✅ 每个 case 重置 side_effect，防止跨 case 污染
def test_multi_cases(self, mock_update, ...):
    # case 1
    mock_update.side_effect = Exception("error")
    self.assertRaises(Exception, self.api.do, self.req, params1)

    # case 2 — 必须重置，否则影响 case 2
    mock_update.side_effect = None
    mock_update.return_value = trust_data.update_trusts_return
    result = self.api.do(self.req, params2)
    self.assertEqual(result, ...)
```

---

**PY-MOCK-02** `[建议]` 在需要验证回滚/副作用场景时，用 `with mock.patch(...)` 内联 Mock 以缩小作用域，避免影响其他 case。

```python
✅ # 只在需要验证回滚的 case 内 Mock delete 函数
   with mock.patch("{driver}.delete_region_trusts".format(
           driver=TRUST_DRIVER_PATH)) as mock_delete:
       mock_delete.return_value = trust_data.delete_trust_success_return
       self.assertRaises(exception.VisibleExUpdateTrustError,
                         self.trust_api.create_trusts,
                         self.req, create_trust_param)
       # 精确验证回滚函数的调用参数
       mock_delete.assert_called_with(
           self.req, [trust_data.trust_region], common.DEFAULT_USER_ID,
           [common.DEFAULT_MSP_NAME, common.DEFAULT_GLOBAL_ADMIN_NAME])
```

---

### 用例设计

**PY-DESIGN-01** `[建议]` 用例场景覆盖使用如下分类，优先覆盖异常场景：

| 场景类型 | 说明 | 示例 |
|---------|------|------|
| 空值 | 参数为空/None/空列表 | regions=[] |
| 临界值 | 边界条件 | 通知人数上限 ±1 |
| 异常值 | 非法输入/类型错误 | user_id 与请求租户不一致 |
| 异常场景 | 外部依赖失败、回滚逻辑 | 部分数据中心创建失败 |
| 等价类 | 有效/无效输入分组 | 合法参数 vs 非法参数 |
| 正常场景 | 完整正常流程 | 所有参数合法，成功创建 |

---

### 稳定性

**PY-STABLE-01** `[强制]` 用例在不同环境下执行结果必须一致；用例间无依赖、不破坏环境；失败只因 bug 而非环境差异。

违规信号：测试依赖本地环境变量或外部网络；前一个 case 的 Mock 状态影响后续 case；不同机器/时区执行结果不同。

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**优先级与覆盖**
- [ ] PY-PRIO-01 — 3-High 函数是否有单测；是否只有正常场景，缺失异常分支

**四步骤**
- [ ] PY-STEP-01 — 是否有注释/构造参数/打桩/断言四步；无断言是高压线

**命名**
- [ ] PY-NAME-01 — 函数名是否符合 `test_<主体>_<行为>_when_<条件>` 格式；docstring 是否含被测函数名、等级、测试思路

**测试数据**
- [ ] PY-DATA-01 — 时间相关数据是否动态计算（禁止静态固定时间）
- [ ] PY-DATA-02 — 是否用 `copy.deepcopy` 基础模板；是否修改了共享对象导致 case 间污染（建议）

**断言**
- [ ] PY-ASSERT-01 — 是否有返回值断言；有 Mock 是否校验调用次数/参数/未调用
- [ ] PY-ASSERT-02 — 异常场景是否用精确异常类型（禁止宽泛 Exception）

**Mock**
- [ ] PY-MOCK-01 — 是否有无用的 Mock（@patch 了但从不使用）；`side_effect` 是否在各 case 前重置
- [ ] PY-MOCK-02 — 副作用场景是否用 `with mock.patch` 缩小作用域（建议）

**用例设计**
- [ ] PY-DESIGN-01 — 是否覆盖空值/临界值/异常值/异常场景（建议）

**稳定性**
- [ ] PY-STABLE-01 — 测试是否依赖外部环境；case 间是否有状态依赖
