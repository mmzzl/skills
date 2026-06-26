# 通用编码规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写代码前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## 风格规范

**GEN-STYLE-01** `[强制]` 标识符命名禁止使用拼音、无意义字母、单个字符（循环变量 i/j/k 除外）；禁止与内置名称重名；禁止仅靠大小写或相似字符区分（如 `l` 与 `1`、`O` 与 `0`）。

违规信号：变量/函数名为拼音（`mingcheng`）；无意义字母组合（`a`、`b`、`c`、`tmp1`）；与内置名称重名（`list`、`str`、`map`）；相似名称并存（`myVar` 与 `myvar`）。

```python
❌ def mingcheng(): ...                     # 拼音
❌ def f(x): ...                            # 少于 3 字符
❌ list = [1, 2, 3]                         # 与内置名称重名
❌ myVar = 1; myvar = 2                     # 仅靠大小写区分

✅ def process_order(): ...                 # 语义清晰
✅ def calculate_total(items): ...          # 驼峰或下划线均可，同一文件统一
```

---

**GEN-STYLE-02** `[强制]` 判断类型（bool 类型或返回 bool 的函数）命名以 `Has`、`Is`、`Can`、`Allow` 等判断性动词开头。

违规信号：bool 变量名为 `status`、`flag`、`ok` 等无判断语义的词。

```python
❌ flag = True                              # 无判断语义
❌ def check_user(user): ...                # 返回 bool 但无判断前缀

✅ is_admin = True
✅ has_permission = False
✅ def can_access(user, resource): ...
```

---

**GEN-STYLE-03** `[建议]` 常量命名解释其内在含义，不与字面意思重复。

违规信号：`MAX_100 = 100`、`TIMEOUT_30 = 30`。

```python
❌ MAX_100 = 100                            # 字面意思重复
❌ TIMEOUT_30 = 30

✅ MAX_RETRY_COUNT = 100                    # 解释含义
✅ HTTP_REQUEST_TIMEOUT_SECONDS = 30
```

---

**GEN-STYLE-04** `[建议]` 注释解释"为什么"而不是"是什么"；所有导出的函数/类型/常量必须有英文注释；TODO 注释包含具体事项、负责人和截止时间。

违规信号：注释复述代码逻辑；导出函数无注释；TODO 无负责人或截止时间。

```python
❌ # 将 x 加 1
   x += 1

❌ # TODO: 优化

✅ # 补偿因时区转换导致的边界偏移
   x += 1

✅ # TODO(zhangsan, 2025-06-30): 替换为批量接口，当前逐条调用有性能瓶颈
```

---

**GEN-STYLE-05** `[建议]` 代码重复率不超过 10%，超过 5 行的重复代码提炼成函数；连续 15 行以上重复代码禁止出现。

违规信号：复制粘贴的代码块仅变量名不同；同一逻辑分散在多处。

```python
❌ # 代码块 A
   user_name = data["name"]
   user_age = data["age"]
   user_email = data["email"]
   ...  # 15 行处理逻辑

   # 代码块 B（仅变量名不同）
   admin_name = data["name"]
   admin_age = data["age"]
   admin_email = data["email"]
   ...  # 同样的 15 行处理逻辑

✅ def process_person(data):
       name = data["name"]
       age = data["age"]
       email = data["email"]
       ...
       return result

   user_result = process_person(data)
   admin_result = process_person(data)
```

---

**GEN-STYLE-06** `[建议]` 函数圈复杂度不超过 10；控制结构嵌套不超过 3 层（总共不超过 5 层）；优先使用短路返回减少嵌套。

违规信号：`if` 嵌套超过 3 层；函数内 `if/elif/else/for/while` 组合复杂度超过 10。

```python
❌ def process(data):
       if data:
           if data.valid:
               if data.enabled:
                   if data.type == "A":
                       ...                  # 4 层嵌套

✅ def process(data):
       if not data:
           return None
       if not data.valid:
           return None
       if not data.enabled:
           return None
       if data.type == "A":
           ...                              # 扁平化，最大 1 层嵌套
```

---

## 错误处理

**GEN-ERR-01** `[强制]` 对接口函数的参数进行验证；验证外部输入数据有效性（文件、数据库、标准输入、命令行参数、管道、socket 等）。

违规信号：函数入口未校验参数类型/范围；外部数据直接使用未校验。

```python
❌ def create_user(name, age):
       db.insert({"name": name, "age": age})  # 未校验 name 是否为空、age 是否为负数

✅ def create_user(name, age):
       if not name or len(name) > 64:
           raise ValueError("name must be non-empty and <= 64 chars")
       if not isinstance(age, int) or age < 0 or age > 150:
           raise ValueError("age must be integer between 0 and 150")
       db.insert({"name": name, "age": age})
```

```go
// Go
func CreateUser(name string, age int) error {
    if len(name) == 0 || len(name) > 64 {
        return fmt.Errorf("name must be non-empty and <= 64 chars")
    }
    if age < 0 || age > 150 {
        return fmt.Errorf("age must be between 0 and 150")
    }
    return db.Insert(name, age)
}
```

```bash
# Shell
create_user() {
    local name="$1"
    local age="$2"
    [[ -z "$name" || ${#name} -gt 64 ]] && { echo "ERROR: invalid name" >&2; return 1; }
    [[ ! "$age" =~ ^[0-9]+$ || "$age" -lt 0 || "$age" -gt 150 ]] && { echo "ERROR: invalid age" >&2; return 1; }
    db_insert "$name" "$age"
}
```

---

**GEN-ERR-02** `[强制]` 函数返回后必须先检查正确性；影响程序逻辑的命令不得忽略返回值（例外需注释说明）。

违规信号：调用函数后不检查返回值；关键操作（文件写入、网络请求、数据库操作）未判断成功/失败。

```python
❌ result = db.query(sql)                    # 未检查 result 是否为空/错误
   process(result)

❌ os.remove(temp_file)                      # 未检查是否删除成功

✅ result = db.query(sql)
   if not result:
       LOG.error("DB query failed, sql=%s", sql)
       return None
   process(result)

✅ # os.remove 失败不影响主流程，忽略返回值
   # 清理临时文件，失败不阻塞
   os.remove(temp_file)
```

---

**GEN-ERR-03** `[强制]` 禁止空 except/catch 吞掉异常，至少记录日志；不同类型的异常应分别捕获和处理。

违规信号：`except: pass` 无任何处理；多个不相关异常合并到一个 `except` 块。

```python
❌ try:
       process(data)
   except:
       pass                                    # 吞掉所有异常

❌ try:
       db.query(sql)
       api.call()
   except Exception as e:                      # 合并不相关异常
       LOG.error("failed: %s", e)

✅ try:
       process(data)
   except ValueError as e:
       LOG.warning("invalid data, error=%s", e)
       return {"error": "invalid data"}
   except DatabaseError as e:
       LOG.error("db error, sql=%s, error=%s", sql, e)
       return {"error": "service unavailable"}
```

```go
// Go
result, err := process(data)
if err != nil {
    switch e := err.(type) {
    case *ValidationError:
        log.Warnf("invalid data, error=%v", e)
        return nil, fmt.Errorf("invalid data")
    case *DatabaseError:
        log.Errorf("db error, sql=%s, error=%v", sql, e)
        return nil, fmt.Errorf("service unavailable")
    default:
        log.Errorf("unexpected error: %v", e)
        return nil, err
    }
}
```

```bash
# Shell
if ! result=$(process "$data" 2>&1); then
    case "$result" in
        *"ValueError"*) log_warn "invalid data: $result"; return 2 ;;
        *"DatabaseError"*) log_error "db error: $result"; return 3 ;;
        *) log_error "unexpected error: $result"; return 1 ;;
    esac
fi
```

---

**GEN-ERR-04** `[建议]` 日志级别合理：DEBUG/INFO 用于开发环境，WARNING/ERROR 用于生产环境；error 仅用于真正的错误，不滥用 warning；后台服务禁止用 print。

违规信号：生产环境输出 DEBUG/INFO；`LOG.error` 用于可预期的业务校验；使用 `print` 调试。

```python
❌ LOG.error("age invalid, age=%s", age)     # 业务校验应 warning
❌ print("debug: x=%s" % x)                  # 后台服务禁止 print

✅ LOG.warning("age invalid, age=%s", age)   # 可预期的业务校验
✅ LOG.debug("processing order, orderId=%s", order_id)  # 开发环境用 debug
✅ LOG.error("db connection failed, host=%s", host)     # 真正的系统错误
```

```go
// Go
log.Debugf("processing order, orderId=%s", oid)        // 开发环境 → debug
log.Warnf("age invalid, age=%d", age)                  // 业务校验 → warning
log.Errorf("db connection failed, host=%s", host)      // 系统错误 → error
// 后台禁止: fmt.Println("debug:", x)
```

```bash
# Shell
log_debug() { [[ "$LOG_LEVEL" == "DEBUG" ]] && echo "[DEBUG] $*" >&2; }
log_warn()  { echo "[WARN]  $*" >&2; }
log_error() { echo "[ERROR] $*" >&2; }
# 后台禁止: echo "debug: $x"
```

---

## 函数

**GEN-FUNC-01** `[强制]` 函数参数禁止使用布尔类型控制执行逻辑；避免使用标识参数控制函数分支。

违规信号：函数参数为 `bool` 类型；参数名为 `flag`、`is_x`、`do_y` 等控制分支。

```python
❌ def process(data, is_async=False):
       if is_async:
           process_async(data)
       else:
           process_sync(data)

✅ def process_sync(data): ...
✅ def process_async(data): ...
```

---

**GEN-FUNC-02** `[建议]` 函数参数不超过 5 个；本地变量不超过 10 个；扇出（调用的子函数数）不超过 7 个。

违规信号：函数签名超过 5 个参数；函数体内变量过多；函数调用过多子函数。

```python
❌ def create(a, b, c, d, e, f, g): ...      # 7 个参数

✅ def create(config): ...                    # 用结构体/字典封装参数
```

---

**GEN-FUNC-03** `[强制]` 递归调用必须考虑收敛条件，防止无限递归。

违规信号：递归函数缺少基准条件（base case）；递归条件无法收敛。

```python
❌ def factorial(n):
       return n * factorial(n - 1)            # 缺少 n <= 0 的基准条件

✅ def factorial(n):
       if n <= 0:
           return 1                            # 基准条件
       return n * factorial(n - 1)
```

---

## 语句

**GEN-STMT-01** `[强制]` 循环体外可进行的耗时计算不得放入循环体；循环体内不变的逻辑判断应移到循环体外。

违规信号：循环体内重复计算不变量；循环条件在循环体内未变化但被重复判断。

```python
❌ for item in items:
       total = sum(items)                     # 每次循环都计算 sum
       process(item, total)

❌ for item in items:
       if len(items) > 100:                   # 循环体内不变的条件
           process_large(item)
       else:
           process_small(item)

✅ total = sum(items)
   for item in items:
       process(item, total)

✅ is_large = len(items) > 100
   for item in items:
       if is_large:
           process_large(item)
       else:
           process_small(item)
```

---

**GEN-STMT-02** `[强制]` 禁止使用过于复杂的表达式；三目运算符禁止嵌套使用。

违规信号：单行表达式超过 3 个运算符嵌套；三目运算符嵌套超过 1 层。

```python
❌ result = a if b else c if d else e if f else g   # 三目嵌套

❌ result = (x + y) * (z - w) / (a + b) > threshold and (m * n) < limit  # 过于复杂

✅ if b:
       result = a
   elif d:
       result = c
   else:
       result = e
```

---

**GEN-STMT-03** `[强制]` 浮点变量禁止用 `==` 或 `!=` 与任何数字比较。

违规信号：`if x == 0.1`、`if y != 1.0` 等浮点直接相等比较。

```python
❌ if x == 0.1: ...                          # 浮点精度问题

✅ if abs(x - 0.1) < 1e-9: ...              # 使用误差范围比较
```

---

## 安全

**GEN-SEC-01** `[强制]` 禁止拼接外部输入到 shell 命令，使用参数化调用。

违规信号：`os.system("rm -rf " + user_input)` 拼接外部输入；`subprocess.call(cmd, shell=True)` 执行未转义的命令。

```python
❌ import os
   os.system("rm -rf " + user_input)          # 拼接外部输入，命令注入

❌ import subprocess
   subprocess.call("grep " + pattern + " file.txt", shell=True)

✅ import subprocess
   subprocess.call(["grep", pattern, "file.txt"])   # 参数化调用
```

---

**GEN-SEC-02** `[强制]` 禁止在代码/配置中硬编码密钥、token、密码。

违规信号：代码中出现 `SECRET_KEY = "xxx"`、`API_TOKEN = "xxx"`、`PASSWORD = "xxx"`。

```python
❌ SECRET_KEY = "abc123def456"                # 硬编码密钥
❌ DB_PASSWORD = "admin123"                   # 硬编码密码

✅ SECRET_KEY = os.environ.get("SECRET_KEY")  # 从环境变量读取
✅ DB_PASSWORD = config.get("db.password")    # 从配置中心读取
```

---

**GEN-SEC-03** `[建议]` API 接口必须有权限校验；共享资源访问必须考虑并发安全。

违规信号：接口无认证/授权检查；全局变量/共享资源未加锁保护。

```python
❌ @app.route("/delete", methods=["POST"])
   def delete_resource():
       resource_id = request.json.get("id")
       db.delete(resource_id)                   # 无权限校验

✅ @app.route("/delete", methods=["POST"])
   @require_auth
   def delete_resource():
       resource_id = request.json.get("id")
       if not current_user.can_delete(resource_id):
           return {"error": "permission denied"}, 403
       db.delete(resource_id)
```

---

## 资源管理

**GEN-RES-01** `[强制]` 数据库/文件/网络连接必须在 finally/defer 中关闭；禁止在循环内创建数据库连接/HTTP 客户端等重对象。

违规信号：连接未关闭；循环内反复创建连接。

```python
❌ conn = db.connect()
   cursor = conn.cursor()
   cursor.execute(sql)                          # 未关闭连接

❌ for item in items:
       conn = db.connect()                      # 循环内创建连接
       conn.query(item)

✅ conn = db.connect()
   try:
       cursor = conn.cursor()
       cursor.execute(sql)
   finally:
       conn.close()

✅ conn = db.connect()
   try:
       for item in items:
           conn.query(item)                     # 复用连接
   finally:
       conn.close()
```

```go
// Go — 用 defer
conn, err := db.Connect()
if err != nil {
    return err
}
defer conn.Close()
for _, item := range items {
    conn.Query(item)         // 复用连接
}
```

---

**GEN-RES-02** `[强制]` 分页查询必须设置合理的上限，防止全量拉取。

违规信号：分页接口未限制 `limit` 最大值；`limit` 超过 1000 或无上限。

```python
❌ def list_items(offset, limit):
       return db.query(f"SELECT * FROM items LIMIT {limit} OFFSET {offset}")  # limit 无上限

✅ def list_items(offset, limit):
       limit = min(limit, 100)                   # 上限 100
       return db.query("SELECT * FROM items LIMIT %s OFFSET %s", limit, offset)
```

---

## 接口设计

**GEN-API-01** `[建议]` 新增 API 参数应考虑向后兼容（设置默认值）；分页排序字段不能漏，默认排序要明确。

违规信号：新增必填参数导致旧客户端报错；分页接口未指定默认排序。

```python
❌ def list_users(page, page_size, sort_by):    # sort_by 无默认值，旧客户端报错
       ...

✅ def list_users(page=1, page_size=20, sort_by="created_at", order="desc"):
       ...
```

---

## 国际化

**GEN-I18N-01** `[建议]` 用户可见的文本必须使用 i18n 函数包裹。

违规信号：返回给用户的错误消息、提示信息为硬编码中文或英文。

```python
❌ return {"message": "操作成功"}
❌ raise ValueError("参数错误")

✅ return {"message": _("操作成功")}
✅ raise ValueError(_("参数错误"))
```

```go
// Go — i18n.I() 包裹
return map[string]string{"message": i18n.I("操作成功")}
```

---

## 框架规范（Phoenix）

**GEN-PHOENIX-01** `[强制]` Phoenix 框架下 `controllers.py` 中的方法名必须与 `provider.py` 中对应方法名保持一致，便于问题排查和追踪调用链。

违规信号：`controllers.py` 中方法名为 `create_vm`，`provider.py` 中对应实现命名为 `add_vm` 或 `do_create_vm`。

```python
# controllers.py
❌ def create_vm(self, req, body):
       return self.provider.add_vm(req, body)    # provider 方法名不一致

✅ def create_vm(self, req, body):
       return self.provider.create_vm(req, body) # 方法名完全一致

# provider.py
✅ def create_vm(self, req, body):
       ...
```

---

## 常量管理

**GEN-CONST-01** `[强制]` 字符串禁止在业务逻辑中直接硬编码，必须在 `constants.py` / `constants.go` 等常量文件中定义后通过变量引用。

违规信号：业务代码中直接出现状态字符串（`"running"`、`"success"`）、路径字符串（`"/api/v1/vms"`）、业务标识（`"vm"`、`"admin"`）等字面量。

```python
# constants.py
✅ VM_STATUS_RUNNING = "running"
   VM_STATUS_STOPPED = "stopped"
   RESOURCE_TYPE_VM = "vm"

# business.py
❌ if vm["status"] == "running":     # 硬编码字符串
       ...
❌ if resource_type == "vm":         # 硬编码字符串

✅ from constants import VM_STATUS_RUNNING, RESOURCE_TYPE_VM
   if vm["status"] == VM_STATUS_RUNNING:
       ...
   if resource_type == RESOURCE_TYPE_VM:
       ...
```

```go
// constants.go
✅ const (
       VMStatusRunning = "running"
       VMStatusStopped = "stopped"
       ResourceTypeVM  = "vm"
   )

// business.go
❌ if vm.Status == "running" { ... }       // 硬编码

✅ if vm.Status == VMStatusRunning { ... } // 引用常量
```

---

## 代码冗余

**GEN-REDUND-01** `[强制]` 禁止过度防御性的 `dict.get()` 写法；应根据变量的实际返回值结构判断——若正常情况下该键必定存在，应直接用 `dict[key]` 访问（缺失时让程序报错暴露问题），而非用 `get()` 静默返回 `None` 掩盖错误。

违规信号：数据库返回的必填字段、内部传递的 context 字段、已校验参数中的必填项，使用 `get()` 而非直接下标访问；`get()` 后的默认值 `None` 从未被检查或使用。

```python
# 场景一：数据库返回对象的必填字段 — 缺失应报错而非静默
❌ vm_id = vm.get("id")           # vm["id"] 必定存在，get 掩盖了数据问题
❌ status = vm.get("status")      # 同上

✅ vm_id = vm["id"]               # 缺失时直接 KeyError，暴露数据问题
✅ status = vm["status"]

# 场景二：用户输入的可选参数 — 合理使用 get 并给默认值
✅ page_size = params.get("page_size", 20)    # 可选参数，有合理默认值
✅ description = body.get("description", "")  # 可选字段

# 场景三：外部系统返回值 — 不确定性高，需 get + 明确处理
✅ error_msg = response.get("error")
   if error_msg:
       raise ExternalServiceError(error_msg)
```

---

## 注释与日志语言

**GEN-LANG-01** `[强制]` 注释和参数描述必须使用中文，且用户可见的描述字符串必须用 i18n 函数包裹；调试日志（DEBUG 级）内容必须使用英文，且关键信息（资源 ID、参数值、状态）必须打印出来。

违规信号：注释用英文（非英文能力要求的技术术语除外）；用户可见描述无 `_()` 包裹；DEBUG/INFO 日志无关键上下文参数；ERROR 日志内容为中文。

```python
# 注释：中文
❌ # Create the virtual machine      # 英文注释
✅ # 创建虚拟机，预先分配 UUID 以便关联操作日志

# 参数描述（docstring / sf_apidesc）：中文 + i18n
❌ REQUIRED("name", NameString(), "vm name")          # 英文描述
✅ REQUIRED("name", NameString(), _(u"虚拟机名称"))    # 中文 + i18n 包裹

# 调试日志：英文 + 关键信息
❌ LOG.debug("创建虚拟机")                             # 中文日志，缺少关键信息
❌ LOG.debug("creating vm")                           # 缺少关键信息
✅ LOG.debug("creating vm, vmId=%s, flavor=%s, azId=%s", vm_id, flavor, az_id)

# 错误日志：英文 + 关键信息（错误原因、资源标识）
❌ LOG.error("创建失败")                               # 中文，缺关键信息
❌ LOG.error("create vm failed")                      # 缺资源标识
✅ LOG.error("create vm failed, vmId=%s, flavor=%s, err=%s", vm_id, flavor, str(e))
```

```go
// Go
// 注释：中文
// ✅ // 创建虚拟机，预先分配 UUID 以便关联操作日志

// 调试日志：英文 + 关键信息
// ✅ log.Debugf("creating vm, vmId=%s, flavor=%s, azId=%s", vmId, flavor, azId)

// 错误日志：英文 + 关键信息
// ✅ log.Errorf("create vm failed, vmId=%s, flavor=%s, err=%v", vmId, flavor, err)
```

---


逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**风格规范**
- [ ] GEN-STYLE-01 — 标识符是否使用拼音、无意义字母、单个字符（循环变量除外）；是否与内置名称重名；是否仅靠大小写/相似字符区分
- [ ] GEN-STYLE-02 — 判断类型变量/函数是否以 Has/Is/Can/Allow 开头
- [ ] GEN-STYLE-03 — 常量命名是否解释含义而非字面重复（建议）
- [ ] GEN-STYLE-04 — 注释是否解释"为什么"而非"是什么"；导出函数是否有英文注释；TODO 是否有负责人和截止时间（建议）
- [ ] GEN-STYLE-05 — 是否存在超过 5 行的重复代码未提炼成函数；是否存在连续 15 行以上重复代码（建议）
- [ ] GEN-STYLE-06 — 函数圈复杂度是否超过 10；控制结构嵌套是否超过 3 层（建议）

**错误处理**
- [ ] GEN-ERR-01 — 接口参数和外部输入数据是否验证有效性
- [ ] GEN-ERR-02 — 函数返回值是否检查；关键操作是否忽略返回值（无注释说明）
- [ ] GEN-ERR-03 — 是否存在空 except/catch 吞掉异常；不相关异常是否合并捕获
- [ ] GEN-ERR-04 — 日志级别是否合理；error 是否用于真正的错误；是否使用 print 调试（建议）

**函数**
- [ ] GEN-FUNC-01 — 函数参数是否使用布尔类型控制逻辑；是否存在标识参数
- [ ] GEN-FUNC-02 — 函数参数是否超过 5 个；本地变量是否超过 10 个（建议）
- [ ] GEN-FUNC-03 — 递归调用是否有收敛条件（基准 case）

**语句**
- [ ] GEN-STMT-01 — 循环体内是否包含可在循环体外进行的耗时计算
- [ ] GEN-STMT-02 — 是否存在过于复杂的表达式；三目运算符是否嵌套
- [ ] GEN-STMT-03 — 浮点变量是否用 `==` 或 `!=` 比较

**安全**
- [ ] GEN-SEC-01 — 是否存在拼接外部输入到 shell 命令的情况
- [ ] GEN-SEC-02 — 代码中是否硬编码密钥、token、密码
- [ ] GEN-SEC-03 — API 接口是否有权限校验；共享资源是否考虑并发安全（建议）

**资源管理**
- [ ] GEN-RES-01 — 数据库/文件/网络连接是否在 finally/defer 中关闭；循环内是否创建重对象
- [ ] GEN-RES-02 — 分页查询是否设置合理的 limit 上限

**接口设计**
- [ ] GEN-API-01 — 新增 API 参数是否有默认值保证向后兼容；分页是否有默认排序（建议）

**国际化**
- [ ] GEN-I18N-01 — 用户可见文本是否使用 i18n 函数包裹（建议）

**框架规范（Phoenix）**
- [ ] GEN-PHOENIX-01 — `controllers.py` 方法名是否与 `provider.py` 对应方法名完全一致

**常量管理**
- [ ] GEN-CONST-01 — 业务逻辑中是否存在硬编码字符串（状态值、类型标识、路径等）；是否在 constants 文件中定义后引用

**代码冗余**
- [ ] GEN-REDUND-01 — 必填字段/必存键是否过度使用 `dict.get()` 掩盖错误；`get()` 返回值是否被正确检查

**注释与日志语言**
- [ ] GEN-LANG-01 — 注释是否使用中文；参数描述是否有 i18n 包裹；调试/错误日志是否用英文且包含关键信息（资源 ID、参数值）