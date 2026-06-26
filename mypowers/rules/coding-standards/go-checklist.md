# Go 编码规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写 Go 代码前对照规则）、**代码 Review**（逐条扫描输出违规）。

> 通用原则: [GEN-API-01] [GEN-CONST-01] [GEN-ERR-01] [GEN-ERR-02] [GEN-ERR-03] [GEN-ERR-04] [GEN-FUNC-01] [GEN-FUNC-02] [GEN-FUNC-03] [GEN-LANG-01] [GEN-PHOENIX-01] [GEN-REDUND-01] [GEN-RES-01] [GEN-RES-02] [GEN-SEC-01] [GEN-SEC-02] [GEN-SEC-03] [GEN-STMT-01] [GEN-STMT-02] [GEN-STMT-03] [GEN-STYLE-01] [GEN-STYLE-02] [GEN-STYLE-03] [GEN-STYLE-04] [GEN-STYLE-05] [GEN-STYLE-06]
> 详见“通用编码规范”。以下为 Go 语言特有实现细节。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

## 风格规范

**GO-STYLE-01** `[强制]` 所有代码必须通过 `gofmt` / `goimports` 格式化；使用 Tab 缩进；左大括号不换行；运算符和操作数之间留空格（数组下标和函数入参处紧凑）。

违规信号：代码未经 gofmt 格式化；左大括号换行；空格使用不一致。

```go
❌ func foo() {                             // 左大括号换行（gofmt 会修复，但提交前必须格式化）
       ...
   }

❌ var i int=1+2                            // 运算符两侧无空格

✅ var i int = 1 + 2
✅ v := []float64{1.0, 2.0, 3.0}[i-i]       // 下标处紧凑，不加空格
✅ fmt.Printf("%f\n", v+1)                  // 入参处紧凑
```

---

**GO-STYLE-02** `[强制]` 导出标识符（对外接口）以大写字母开头；非导出标识符以小写字母开头。

违规信号：对外接口使用小写；内部函数使用大写导致意外导出。

```go
❌ package mypkg
   func internalHelper() {}                  // 对外接口却小写
   var GlobalConfig string                   // 内部变量却大写导出

✅ package mypkg
   func ProcessOrder() {}                    // 对外接口大写
   func validateInput() {}                   // 内部函数小写
   var config string                         // 内部变量小写
```

---

**GO-STYLE-03** `[强制]` 文件头部注释说明用途、注意事项、作者/修改者信息；函数头部注释功能、参数、返回值。注释原则参见 [GEN-STYLE-04]。

违规信号：源文件无头部注释；导出函数无注释；注释不满足 godoc 规范。

```go
❌ package network
   func Router() {}                          // 无注释

✅ // Package network 提供网络设备管理功能
   // 作者: zhangsan
   // 修改者: lisi — 2024-03-15: 新增 VPC 路由器支持
   package network

   // CreateRouter 创建路由器
   // 参数：
   //   - name: 路由器名称
   //   - vpcID: 所属 VPC ID
   // 返回值：
   //   - routerID: 创建的路由器 ID
   //   - err: 错误信息
   func CreateRouter(name, vpcID string) (string, error) {
       ...
   }
```

---

**GO-STYLE-04** `[建议]` 函数长度尽量不超过 50 行；单个文件长度尽量不超过 800 行。通用代码复用原则参见 [GEN-STYLE-05] [GEN-STYLE-06]。

违规信号：函数超过 50 行；文件超过 800 行；复制粘贴的代码块仅变量名不同。

```go
❌ func Process() {                          // 80 行函数
       // ...
   }

✅ func Process() {
       validateInput()
       processCore()
       persistResult()
   }
```

## 错误处理

**GO-ERR-01** `[强制]` 错误处理及时、明确、完整：尽早处理错误，避免传播；提供有意义的错误信息；使用 `defer` 确保资源释放；错误作为最后一个返回值返回。

违规信号：错误返回值未检查；`defer` 未用于资源释放；错误信息无上下文。

```go
❌ f, _ := os.Open("file.txt")               // 忽略错误
   defer f.Close()

❌ return db.Query(sql)                      // 直接透传错误，无上下文

✅ f, err := os.Open("file.txt")
   if err != nil {
       return fmt.Errorf("open file failed, path=%s: %w", path, err)
   }
   defer f.Close()
```

---

**GO-ERR-02** `[强制]` `panic` 仅用于不可恢复的错误；程序初始化阶段（文件/数据库无法打开导致无法运行时）可用 `panic`。

违规信号：普通业务错误使用 `panic`；可恢复错误未返回 `error` 而直接 `panic`。

```go
❌ if user == nil {
       panic("user not found")               // 业务错误不应 panic
   }

✅ if configFile == "" {
       panic("config file path is required") // 初始化失败，无法运行
   }

✅ if user == nil {
       return nil, fmt.Errorf("user not found, userID=%s", userID)
   }
```

---

## 项目组织

**GO-PROJ-01** `[强制]` 项目必须提供 `go.mod` 文件，模块 ID 格式 `example.com/<org>/<module>`，仅含小写字母、数字、下划线、横线、点、斜杠。

违规信号：无 `go.mod`；模块 ID 含大写字母或中文。

```
❌ # 无 go.mod 文件

❌ module Example/CloudManager/NetWork        # 含大写字母

✅ module example.com/cloudmanager/network
```

---

**GO-PROJ-02** `[强制]` 禁止相对路径导入（`./subpackage`）；禁止用 `.` 简化包调用（`import . "pkg"`）；导入路径符合 `go get` 标准。

违规信号：`import "./mypkg"`；`import . "fmt"`。

```go
❌ import "./subpackage"                    // 相对路径
❌ import . "fmt"                            // 简化导入

✅ import "example.com/myproject/mypkg"
✅ import "fmt"
```

---

**GO-PROJ-03** `[强制]` 项目必须提供单元测试（`*_test.go`），使用 `testing` 包或 Gomock/GoStub/GoConvey 等框架。

违规信号：无测试文件；核心函数无单元测试覆盖。

```go
❌ # 仅有 router.go，无 router_test.go

✅ // router_test.go
   func TestCreateRouter(t *testing.T) {
       id, err := CreateRouter("test", "vpc-123")
       assert.NoError(t, err)
       assert.NotEmpty(t, id)
   }
```

## 语言特性

**GO-LANG-01** `[强制]` 切片形参不使用指针传递；需要修改时返回新切片；`nil` 是有效的空切片；检查空切片用 `len(s) == 0`。

违规信号：`func process(s *[]int)` 指针传递；检查切片用 `s == nil`。

```go
❌ func appendItem(items *[]int, item int) {  // 指针传递切片
       *items = append(*items, item)
   }

❌ if s == nil { ... }                        // nil 不是唯一空状态

✅ func appendItem(items []int, item int) []int {
       return append(items, item)
   }

✅ if len(s) == 0 { ... }
```

---

**GO-LANG-02** `[强制]` 判断 map 键是否存在用 `v, ok := m[k]`；map 必须用 `make` 初始化；channel 必须用 `make` 初始化。

违规信号：通过零值判断 map 键是否存在；未 `make` 直接使用 map/channel。

```go
❌ if m["key"] != "" { ... }                 // 值可能是空字符串

❌ var m map[string]int
   m["key"] = 1                               // panic: assignment to nil map

❌ var ch chan int
   ch <- 1                                    // panic: send to nil channel

✅ if v, ok := m["key"]; ok { ... }

✅ m := make(map[string]int)
   m["key"] = 1

✅ ch := make(chan int, 1)
   ch <- 1
```

---

**GO-LANG-03** `[强制]` 多个生产者时优雅关闭 channel（避免重复关闭或向已关闭 channel 写入）；`select` 多个 channel 同时就绪时随机执行；channel size 通常为 1 或无缓冲。

违规信号：重复关闭 channel；向已关闭 channel 写入；假设 `select` 有固定顺序。

```go
❌ close(ch)
   close(ch)                                  // panic: close of closed channel

❌ close(ch)
   ch <- 1                                    // panic: send on closed channel

❌ select {                                   // 假设先 case A 后 case B
   case <-chA:
       processA()
   case <-chB:
       processB()
   }

✅ var once sync.Once
   closeCh := func() { once.Do(func() { close(ch) }) }
```

---

**GO-LANG-04** `[强制]` 一个文件只定义一个 `init` 函数；包内多个 `init` 之间无任何依赖关系（执行顺序不确定）。

违规信号：单个文件多个 `init`；`init` 之间有隐式依赖。

```go
❌ package mypkg
   func init() { a = 1 }
   func init() { b = a }                      // 依赖第一个 init，顺序不确定

✅ package mypkg
   func init() {
       a = 1
       b = 2                                  // 不依赖其他 init
   }
```

---

**GO-LANG-05** `[强制]` 返回值不超过 3 个。

违规信号：函数有 4 个及以上返回值。

```go
❌ func getResult() (int, string, bool, error) {}   // 4 个返回值

✅ func getResult() (int, string, error) {}          // 3 个返回值
```

---

**GO-LANG-06** `[强制]` 结构体初始化用 `&Struct{Field: value}` 标签语法；接口实现添加编译期校验；枚举 iota 从 `Invalid` 开始使 0 为无效值。

违规信号：`new(MyStruct)` 无字段名；接口实现无编译校验；枚举默认值 0 是有效值。

```go
❌ s := &MyStruct{"name", 18}                 // 无字段名，新增字段时编译错误

❌ type MyInterface interface { Method() }
   type MyImpl struct{}
   func (m MyImpl) Method() {}                // 无编译期校验

❌ const (
       StatusActive = iota                   // 0 是 Active，默认有效
       StatusInactive
   )

✅ s := &MyStruct{Name: "name", Age: 18}      // 标签语法

✅ var _ MyInterface = (*MyImpl)(nil)         // 编译期校验

✅ const (
       StatusInvalid = iota                  // 0 是无效值
       StatusActive
       StatusInactive
   )

✅ func (s Status) String() string {          // 枚举添加 String 方法
       switch s {
       case StatusActive:
           return "Active"
       case StatusInactive:
           return "Inactive"
       default:
           return "Invalid"
       }
   }
```

---

**GO-LANG-07** `[建议]` 结构体初始化用 `&T{}` 代替 `new(T)`；接口实现多态；包间调用优先使用接口而非具体实现。

```go
❌ s := new(MyStruct)                         // 建议用 &MyStruct{}

✅ s := &MyStruct{}

✅ type Storage interface {
       Get(key string) (string, error)
       Set(key, value string) error
   }

   type RedisStorage struct{}
   func (r *RedisStorage) Get(key string) (string, error) { ... }
   func (r *RedisStorage) Set(key, value string) error { ... }

   var _ Storage = (*RedisStorage)(nil)       // 编译期校验
```

---

**GO-LANG-08** `[建议]` 缩小变量作用域：`if err := func(); err != nil` 形式；零值切片可直接使用无需 `make`；Printf-style 格式字符串声明为 `const`。

```go
❌ err := doSomething()
   if err != nil {
       return err
   }

✅ if err := doSomething(); err != nil {
       return err
   }

✅ var s []int                                 // 零值切片可直接 append
   s = append(s, 1)

✅ const format = "user=%s, status=%s"
   fmt.Printf(format, user, status)
```

## 国际化

**GO-I18N-01** `[强制]` 用户可见字符串使用 `i18n.I()` 包裹；翻译词条不先格式化后包裹；中英文标点区分。

违规信号：裸中文字符串；`i18n.I()("hello %s" % name)` 先格式化后翻译。

```go
❌ return "操作成功"                          // 未国际化

❌ msg := i18n.I("错误: %s" % err.Error())        // 先格式化后翻译

✅ return i18n.I("操作成功")

✅ msg := i18n.I("错误: %(reason)s")              // 占位符，翻译后格式化
   fmt.Sprintf(msg, map[string]interface{}{"reason": err.Error()})
```

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**风格规范**
- [ ] GO-STYLE-01 — 代码是否经过 gofmt / goimports 格式化；左大括号是否换行；空格是否正确
- [ ] GO-STYLE-02 — 导出标识符是否大写开头；非导出标识符是否小写开头
- [ ] GO-STYLE-03 — 文件/函数是否有头部注释；导出函数是否有 godoc 注释
- [ ] GO-STYLE-04 — 函数是否超过 50 行；文件是否超过 800 行（建议）

**错误处理**
- [ ] GO-ERR-01 — 错误返回值是否检查；资源是否 defer 关闭；错误信息是否有上下文
- [ ] GO-ERR-02 — 业务错误是否误用 panic（应返回 error）

**项目组织**
- [ ] GO-PROJ-01 — 是否有 go.mod 文件；模块 ID 格式是否正确
- [ ] GO-PROJ-02 — 是否有相对路径导入或简化导入（import .）
- [ ] GO-PROJ-03 — 是否有对应的 *_test.go 单元测试

**语言特性**
- [ ] GO-LANG-01 — 切片是否用指针传递；空切片检查是否用 len(s) == 0
- [ ] GO-LANG-02 — map 是否通过零值判断键存在；map/channel 是否 make 初始化
- [ ] GO-LANG-03 — channel 是否重复关闭；select 是否假设固定顺序；channel size 是否合理
- [ ] GO-LANG-04 — 单个文件是否多个 init；init 之间是否有依赖
- [ ] GO-LANG-05 — 函数返回值是否超过 3 个
- [ ] GO-LANG-06 — 结构体初始化是否用标签语法；接口实现是否有编译期校验；枚举 0 是否为无效值
- [ ] GO-LANG-07 — 是否用 new(T) 而非 &T{}；包间调用是否用接口（建议）
- [ ] GO-LANG-08 — 变量作用域是否尽可能缩小（建议）

**国际化**
- [ ] GO-I18N-01 — 用户可见字符串是否用 i18n.I()或者i18n.Sprintf() 包裹；是否先格式化后翻译
