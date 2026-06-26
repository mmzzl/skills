# Go 单元测试规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（为 Go 代码编写单元测试时）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## Mock 工具选型决策树

```
依赖类型？
  interface → testify/mock（AssertExpectations 验证调用）
  函数/方法（非接口） → gomonkey（运行时替换）
  数据库 SQL → go-sqlmock（匹配 SQL 语句）

是否需要按调用次序返回不同结果？
  是 → ApplyFuncSeq（重试/分页/流式场景）
  否 → ApplyFunc（单次固定返回）
```

---

## 规则详情

### 文件与命名

**GOTEST-BASE-01** `[强制]` 测试文件以 `_test.go` 结尾；测试函数以 `Test` 开头，参数为 `t *testing.T`；Benchmark 以 `Benchmark` 开头，参数为 `b *testing.B`；测试文件与被测文件在同一包中。

违规信号：测试文件命名为 `xxx_unittest.go`；测试函数参数非 `t *testing.T`；测试文件与被测文件包名不同。

```go
❌ // file: user_unittest.go
   func TestUser(b *testing.B) { ... }   // 文件名和参数类型均错误

✅ // file: user_test.go
   func TestCreateUser(t *testing.T) { ... }
```

---

**GOTEST-BASE-02** `[强制]` 测试函数命名遵循 `Test<主体>_<行为>_When<条件>` 格式；子测试（`t.Run`）用中文描述场景。

违规信号：函数名仅为 `TestCreate`、`TestUser` 等，无法从名称判断测试场景。

```go
❌ func TestCreate(t *testing.T) {}         // 无法判断测什么、什么条件
❌ func TestUserService(t *testing.T) {}

✅ func TestDeleteVM_ReturnsError_WhenVMNotFound(t *testing.T) {}
✅ func TestCreateReport_Succeeds_WhenAllParamsValid(t *testing.T) {}

// 子测试用中文描述，与外层函数名互补
✅ t.Run("数据库超时时返回错误", func(t *testing.T) { ... })
✅ t.Run("参数为空时返回 InvalidParam 错误", func(t *testing.T) { ... })
```

---

### gomonkey 规则

**GOTEST-MONKEY-01** `[强制]` 所有 gomonkey 补丁必须在测试结束时恢复（`defer patches.Reset()` 或 `t.Cleanup`），禁止遗漏导致测试间相互污染；gomonkey 不是线程安全的，禁止在 `t.Parallel()` 子测试中使用。

违规信号：`ApplyFunc`/`ApplyFuncSeq` 后无 `defer patches.Reset()`；在 `t.Parallel()` 内使用 gomonkey。

```go
❌ patches := gomonkey.ApplyFunc(QueryVM, func(...) { ... })
   // 无 defer patches.Reset()，后续测试被污染

✅ patches := gomonkey.ApplyFunc(QueryVM, func(...) ([]*VM, error) {
       return vmList, nil
   })
   defer patches.Reset()

// 推荐用 t.Cleanup（测试失败时也能执行）
✅ t.Cleanup(func() { patches.Reset() })
```

---

**GOTEST-MONKEY-02** `[强制]` `ApplyFuncSeq` 的 `OutputCell.Values` 顺序和类型必须与被替换函数签名严格匹配，否则运行时 panic；第一个返回值不能用 `nil` 代替 slice/pointer 类型，须用零值。

违规信号：`Values` 第一项为 `nil` 但原函数返回 `[]*VM`；`Values` 顺序与函数签名不一致。

```go
// 被替换函数签名：func QueryVMs(ctx context.Context) ([]*VM, error)
❌ outputs := []gomonkey.OutputCell{
       {Values: gomonkey.Params{nil, someErr}},   // 第一个应为 []*VM，nil 会 panic
   }

✅ outputs := []gomonkey.OutputCell{
       {Values: gomonkey.Params{[]*VM{}, someErr}},  // 空 slice，类型正确
       {Values: gomonkey.Params{vmList, nil}},         // 正常返回
   }
```

---

**GOTEST-MONKEY-03** `[建议]` `ApplyFuncSeq` 适用于需要按调用次序返回不同结果的场景（重试、分页、流式调用）；单次固定返回使用 `ApplyFunc`。

```go
// ✅ 重试场景：前两次失败，第三次成功
p := gomonkey.ApplyFuncSeq(CallRemote, []gomonkey.OutputCell{
    {Values: gomonkey.Params{nil, errors.New("timeout")}},
    {Values: gomonkey.Params{nil, errors.New("timeout")}},
    {Values: gomonkey.Params{result, nil}},
})
defer p.Reset()

// ✅ 分页场景：按页返回
p2 := gomonkey.ApplyFuncSeq(FetchPage, []gomonkey.OutputCell{
    {Values: gomonkey.Params{page1, nil}},
    {Values: gomonkey.Params{page2, nil}},
    {Values: gomonkey.Params{[]*VM{}, nil}},   // 最后一页为空，结束
})
defer p2.Reset()
```

---

**GOTEST-MONKEY-04** `[建议]` 为频繁使用的外部函数替换封装 helper，返回 `*gomonkey.Patches`，统一管理补丁生命周期。

```go
// 封装 helper
func applyQueryVMMock(outputs []gomonkey.OutputCell) *gomonkey.Patches {
    return gomonkey.ApplyFuncSeq(QueryVM, outputs)
}

// 使用
p := applyQueryVMMock([]gomonkey.OutputCell{
    {Values: gomonkey.Params{vmList, nil}},
})
defer p.Reset()
```

---

### testify/mock 规则（接口 Mock）

**GOTEST-TESTIFY-01** `[强制]` 每个测试/子测试必须重建 mock 实例（`m := new(MockXxx)`），禁止跨用例复用同一实例；测试结束必须调用 `m.AssertExpectations(t)` 验证所有 `On(...)` 声明的调用均已发生。

违规信号：多个用例共享同一 mock 变量；存在 `On(...)` 声明但无 `AssertExpectations`。

```go
// ✅ 每个子测试：重建 → On 预设 → 执行 → AssertExpectations
func TestDeleteVM(t *testing.T) {
    t.Run("删除成功", func(t *testing.T) {
        m := new(MockVMService)                                // 重建
        m.On("DeleteVM", mock.Anything, "vm-001").Return(nil) // 预设

        err := HandleDelete(context.Background(), m, "vm-001")

        assert.NoError(t, err)
        m.AssertExpectations(t)                               // 验证调用
    })

    t.Run("删除失败", func(t *testing.T) {
        m := new(MockVMService)                               // 重建，不复用
        m.On("DeleteVM", mock.Anything, "vm-002").
            Return(errors.New("not found"))

        err := HandleDelete(context.Background(), m, "vm-002")

        assert.Error(t, err)
        m.AssertExpectations(t)
    })
}

// ❌ 错误：复用同一实例，On 记录累积，行为不可预期
func TestDeleteVM_Bad(t *testing.T) {
    m := new(MockVMService)   // 只创建一次
    m.On("DeleteVM", mock.Anything, "vm-001").Return(nil)
    HandleDelete(ctx, m, "vm-001")
    m.On("DeleteVM", mock.Anything, "vm-002").Return(errors.New("err"))
    HandleDelete(ctx, m, "vm-002")
    // On 记录累积，结果不可信
}
```

---

**GOTEST-TESTIFY-02** `[强制]` `On(...)` 参数须明确：精确校验的参数用具体值，不关心的用 `mock.Anything`；禁止对有具体校验要求的参数使用 `mock.Anything` 放宽。

```go
❌ m.On("DeleteVM", mock.Anything, mock.Anything).Return(nil)
   // id 参数任意都匹配，校验无效

✅ m.On("DeleteVM", mock.Anything, "vm-001").Return(nil)
   // ctx 不关心，id 精确匹配
```

---

### go-sqlmock 规则（数据库 Mock）

**GOTEST-SQL-01** `[强制]` 数据库层测试使用 go-sqlmock；每个测试独立创建 `sqlmock.New()` 实例，结束时调用 `mock.ExpectationsWereMet()` 验证所有预期 SQL 均已执行，并调用 `db.Close()`。

违规信号：多个用例共享同一 sqlmock；`Expect...` 声明的 SQL 未通过 `ExpectationsWereMet` 验证。

```go
func TestGetVM(t *testing.T) {
    t.Run("查询成功", func(t *testing.T) {
        db, sqlMock, err := sqlmock.New()   // 每次重建
        assert.NoError(t, err)
        defer db.Close()

        gormDB, _ := gorm.Open(mysql.New(mysql.Config{Conn: db}), &gorm.Config{})

        rows := sqlmock.NewRows([]string{"id", "name", "status"}).
            AddRow("vm-001", "test-vm", "running")
        sqlMock.ExpectQuery(`SELECT \* FROM "vms" WHERE id = \?`).
            WithArgs("vm-001").
            WillReturnRows(rows)

        result, err := GetVM(gormDB, "vm-001")

        assert.NoError(t, err)
        assert.Equal(t, "test-vm", result.Name)
        assert.NoError(t, sqlMock.ExpectationsWereMet())   // 验证 SQL 执行
    })
}
```

---

### 测试模板（Test Fixtures）

**GOTEST-FIXTURE-01** `[建议]` 将常用测试输入抽象为工厂函数，测试中只修改必要字段；模板只含测试需要的最小字段，禁止塞满所有生产字段导致紧耦合。

违规信号：每个测试函数内重复构造相同的大块结构体；工厂函数填写了大量测试不需要的字段。

```go
// ✅ 最小字段工厂函数
func newTestDBConf() *conf.Data {
    return &conf.Data{
        Database: &conf.Data_Database{
            Driver:       "mysql",
            Source:       "root:password@tcp(127.0.0.1:3306)/test",
            MaxIdleConns: 10,
            MaxOpenConns: 100,
            // 其余字段保持零值，测试不关心不填
        },
    }
}

// 测试中只改需要的字段
func TestConnect_WhenSourceEmpty(t *testing.T) {
    cfg := newTestDBConf()
    cfg.Database.Source = ""
    _, err := Connect(cfg)
    assert.Error(t, err)
}

// ❌ 过度耦合：塞满所有字段，生产新增字段时模板编译报错
func newTestDBConfBad() *conf.Data {
    return &conf.Data{
        Database: &conf.Data_Database{
            Driver: "mysql", Source: "...",
            MaxIdleConns: 10, ConnMaxLifetime: 3600,
            Charset: "utf8mb4",   // 测试不关心
        },
    }
}
```

---

### 表驱动测试

**GOTEST-TABLE-01** `[建议]` 将不同用例的差异抽象为表条目，公共输入用模板提供，差异用 `OutputCell` 序列描述；每个 `t.Run` 内独立创建和清理补丁，用例间互不干扰。

```go
func TestListVMs(t *testing.T) {
    vmList := []*VM{{ID: "vm-001", Name: "test"}}

    cases := []struct {
        name    string
        outputs []gomonkey.OutputCell
        wantErr bool
        wantLen int
    }{
        {
            name:    "正常返回列表",
            outputs: []gomonkey.OutputCell{{Values: gomonkey.Params{vmList, nil}}},
            wantLen: 1,
        },
        {
            name:    "查询返回空",
            outputs: []gomonkey.OutputCell{{Values: gomonkey.Params{[]*VM{}, nil}}},
            wantLen: 0,
        },
        {
            name:    "查询报错",
            outputs: []gomonkey.OutputCell{{Values: gomonkey.Params{[]*VM{}, errors.New("db error")}}},
            wantErr: true,
        },
    }

    for _, tc := range cases {
        tc := tc
        t.Run(tc.name, func(t *testing.T) {
            p := gomonkey.ApplyFuncSeq(QueryVM, tc.outputs)
            defer p.Reset()   // 每个子测试独立清理

            result, err := ListVMs(context.Background(), newTestDBConf())
            if tc.wantErr {
                assert.Error(t, err)
            } else {
                assert.NoError(t, err)
                assert.Len(t, result, tc.wantLen)
            }
        })
    }
}
```

---

### 模拟数据质量

**GOTEST-DATA-01** `[建议]` 模拟数据贴近真实场景（有意义的 UUID、时间戳、业务名称）；必须同时覆盖正常路径、错误路径、nil/空路径。

```go
// ❌ 全零值，测试有效性差
vm := &VM{}

// ✅ 贴近真实格式
vm := &VM{
    ID:        "6a0a707c-45ef-4758-b533-e55adddba8ce",
    Name:      "test-vm-001",
    Status:    "running",
    CreatedAt: time.Now().Unix(),
}

// ✅ 同时覆盖三条路径
outputs := []gomonkey.OutputCell{
    {Values: gomonkey.Params{vmList, nil}},                          // 正常
    {Values: gomonkey.Params{[]*VM{}, errors.New("timeout")}},       // 错误
    {Values: gomonkey.Params{[]*VM{}, nil}},                          // 空
}
```

---

### CI/并行环境

**GOTEST-CI-01** `[强制]` 并行测试中每个子测试使用独立 mock 实例，禁止包级或全局 mock 变量；gomonkey 不是线程安全的，并行测试中的函数依赖改用 testify/mock。

**GOTEST-CI-02** `[建议]` 推荐用 `t.Cleanup` 替代 `defer` 执行断言与重置，确保测试失败时也能正确清理。

```go
func TestParallel(t *testing.T) {
    cases := []struct{ id string }{{"vm-001"}, {"vm-002"}}

    for _, tc := range cases {
        tc := tc
        t.Run(tc.id, func(t *testing.T) {
            t.Parallel()

            m := new(MockVMService)   // 每个并行子测试独立创建
            m.On("DeleteVM", mock.Anything, tc.id).Return(nil)

            t.Cleanup(func() {
                m.AssertExpectations(t)   // t.Cleanup 失败时也执行
            })

            err := HandleDelete(context.Background(), m, tc.id)
            assert.NoError(t, err)
        })
    }
}
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**文件与命名**
- [ ] GOTEST-BASE-01 — 文件是否以 `_test.go` 结尾；函数参数是否为 `t *testing.T`；包名是否一致
- [ ] GOTEST-BASE-02 — 测试函数名是否符合 `Test<主体>_<行为>_When<条件>` 格式；子测试是否用中文描述

**gomonkey**
- [ ] GOTEST-MONKEY-01 — 所有补丁是否有 `defer patches.Reset()` 或 `t.Cleanup`；是否在并行测试中使用
- [ ] GOTEST-MONKEY-02 — `OutputCell.Values` 类型和顺序是否与函数签名匹配（nil 替代 slice 会 panic）
- [ ] GOTEST-MONKEY-03 — 多次不同返回是否用 `ApplyFuncSeq`；单次固定返回是否用 `ApplyFunc`（建议）
- [ ] GOTEST-MONKEY-04 — 频繁使用的替换是否封装为 helper（建议）

**testify/mock**
- [ ] GOTEST-TESTIFY-01 — 每个用例是否重建 mock；是否调用 `AssertExpectations(t)`
- [ ] GOTEST-TESTIFY-02 — `On(...)` 参数是否精确；有校验要求的参数是否误用 `Anything`

**go-sqlmock**
- [ ] GOTEST-SQL-01 — sqlmock 是否每次重建；是否调用 `ExpectationsWereMet()` 和 `db.Close()`

**测试模板**
- [ ] GOTEST-FIXTURE-01 — 测试输入是否封装为工厂函数；模板是否只含最小必要字段（建议）

**表驱动测试**
- [ ] GOTEST-TABLE-01 — 多场景测试是否使用表驱动；每个 `t.Run` 是否独立创建/清理补丁（建议）

**模拟数据**
- [ ] GOTEST-DATA-01 — 模拟数据是否贴近真实；是否同时覆盖正常/错误/空三条路径（建议）

**CI/并行**
- [ ] GOTEST-CI-01 — 并行测试是否有共享 mock/全局 gomonkey 补丁
- [ ] GOTEST-CI-02 — 是否用 `t.Cleanup` 统一清理（建议）

---

## 附录：gomonkey API 速查

| 方法 | 用途 |
|------|------|
| `ApplyFunc(fn, impl)` | 替换普通函数 |
| `ApplyMethod(type, "Name", impl)` | 替换成员方法 |
| `ApplyFuncSeq(fn, outputs)` | 函数序列桩（多次返回不同结果） |
| `ApplyMethodSeq(type, "Name", outputs)` | 成员方法序列桩 |
| `ApplyFuncVar(&var, impl)` | 替换函数变量 |
| `ApplyFuncVarSeq(&var, outputs)` | 函数变量序列桩 |
| `ApplyGlobalVar(&var, value)` | 替换全局变量 |
| `patches.Reset()` | 恢复所有补丁 |

## 附录：goconvey 断言速查

| 断言 | 含义 |
|------|------|
| `So(a, ShouldEqual, b)` | 相等 |
| `So(a, ShouldNotEqual, b)` | 不等 |
| `So(a, ShouldBeNil)` | 为 nil |
| `So(a, ShouldNotBeNil)` | 不为 nil |
| `So(a, ShouldBeTrue)` | 为 true |
| `So(a, ShouldBeFalse)` | 为 false |
| `So(a, ShouldResemble, b)` | 深度相等（slice/map/struct） |
| `So(a, ShouldContain, item)` | slice 包含元素 |
| `So(a, ShouldBeEmpty)` | 为空 |
| `So(a, ShouldHaveLength, n)` | 长度为 n |
| `So(a, ShouldStartWith, prefix)` | 字符串以 prefix 开头 |
| `So(a, ShouldContainSubstring, sub)` | 包含子串 |
| `So(fn, ShouldPanic)` | 函数发生 panic |
| `So(a, ShouldBeGreaterThan, b)` | 大于 |
| `So(a, ShouldBeBetween, lo, hi)` | 在区间内 |
