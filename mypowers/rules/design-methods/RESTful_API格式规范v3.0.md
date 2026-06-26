# RESTful API 设计规范

## 用途

本文档供 AI 执行两类任务：**接口设计**（写 URL/接口前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <接口路径> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## HTTP 方法决策树

```
操作类型？
  只读取/列举资源，不修改数据 → GET
  创建新资源（非幂等）        → POST
  整体替换资源（包含全量字段）→ PUT
  部分更新资源（仅含需变更字段）→ PATCH
  删除资源                    → DELETE
  查询资源支持的方法          → OPTIONS
  获取资源元数据（无响应体）  → HEAD
```

```
URL 路径结构？
  标准 CRUD 操作                        → /resources 或 /resources/{id}
  非 CRUD 动作（启动/停止/重启等）      → /resources/{id}/actions/{verb}
  批量操作                              → /resources/bulk
  资源存在所属关系且必须通过父资源访问  → /parents/{id}/children（最多两层嵌套）
  资源可独立存在                        → /children?parentId={id}（扁平化，推荐）
```

---

## 规则详情

### URL 路径设计

**URL-PATH-01** `[强制]` URL 路径段必须全部小写，多词直接拼接，不使用任何分隔符，正则规则 `^[0-9a-z]+$`。
违规信号：路径段含大写字母、下划线 `_`、横线 `-` 或其他非字母数字字符。
```
❌ GET /api/v1/emailSetting/testEmail
❌ GET /api/v1/email_setting/test_email
❌ GET /api/v1/email-setting/test-email
✅ GET /api/v1/emailsettings/testemail
```

---

**URL-PATH-02** `[强制]` 禁止在 URL 路径段中使用下划线分割单词。
违规信号：路径段含 `_` 字符（不含路径参数变量名本身）。
```
❌ GET /api/v1/user_profile
❌ GET /api/v1/device_list
✅ GET /api/v1/userprofiles
✅ GET /api/v1/devices
```

---

**URL-PATH-03** `[强制]` 使用复数形式命名资源路径段。
违规信号：资源路径段为单数名词，如 `/user`、`/device`、`/policy`。
```
❌ GET /api/v1/user/123
❌ GET /api/v1/device
✅ GET /api/v1/users/123
✅ GET /api/v1/devices
```

---

**URL-PATH-04** `[强制]` 资源路径嵌套深度不超过两层（不含前缀和版本号）。
违规信号：`/a/{id}/b/{id}/c` 出现三层及以上嵌套。
```
❌ GET /api/v1/orgs/{orgId}/departments/{deptId}/users/{userId}
✅ GET /api/v1/users/{userId}?orgId={orgId}&deptId={deptId}
✅ GET /api/v1/departments/{deptId}/users/{userId}
```

---

**URL-PATH-05** `[强制]` 对非 CRUD 动作使用 `actions` 虚拟资源路径，格式为 `/resources/{id}/actions/{verb}`。
违规信号：路径中出现动词（`start`、`stop`、`restart`、`enable`、`disable`），但未使用 `actions` 子路径。
```
❌ POST /api/v1/vms/{id}/start
❌ PUT  /api/v1/vms/{id}?action=stop
✅ POST /api/v1/vms/{id}/actions/start
✅ POST /api/v1/vms/{id}/actions/stop
✅ POST /api/v1/vms/{id}/actions/restart
```

---

**URL-PATH-06** `[强制]` 批量操作提供统一的 `bulk` 接口，格式为 `/resources/bulk`。
违规信号：批量操作使用非标准路径（如 `/batchDelete`、`/deleteAll`、`/multi`）。
```
❌ POST /api/v1/devices/batchDelete
❌ DELETE /api/v1/devices/deleteMulti
✅ DELETE /api/v1/devices/bulk
✅ POST   /api/v1/devices/bulk        # 批量创建
```

---

**URL-PATH-07** `[强制]` URL 前缀中必须采用预分配路径（separatePath）标识产品或子系统。
违规信号：URL 直接以版本号开头，缺少产品/子系统标识前缀，导致多服务无法通过反向代理区分路由。
```
❌ https://host/v1/devices
✅ https://host/api/sip/v1/devices
✅ https://host/open/api/xdr/v1/events
✅ https://host/api/internal/v1/
```

---

### HTTP 方法语义

**URL-METHOD-01** `[强制]` GET 用于获取或列举资源，不得有任何副作用（不得修改资源状态）。
违规信号：GET 请求处理函数中含写操作（INSERT / UPDATE / DELETE / 状态变更）。
```
❌ GET /api/v1/tasks/{id}  → handler 内同时将任务标记为"已读"（副作用）
✅ GET /api/v1/tasks/{id}  → 仅返回任务数据，不修改任何状态
```

---

**URL-METHOD-02** `[强制]` POST 用于创建资源，操作为非幂等（多次调用产生多个资源）。
违规信号：POST 接口被用于替换或更新现有资源的全部字段。
```
❌ POST /api/v1/devices/{id}  # 更新操作误用 POST
✅ POST /api/v1/devices        # 创建新设备，返回新资源的 id
```

---

**URL-METHOD-03** `[强制]` PUT 用于整体替换资源，请求体必须包含资源的所有字段（缺少字段视为清空该字段）。
违规信号：PUT 请求体仅含部分字段后端做增量合并而非整体替换；或 PUT 路径不含资源 ID。
```
❌ PUT /api/v1/users/{id}  Body: {"email": "new@example.com"}         # 仅含部分字段
✅ PUT /api/v1/users/{id}  Body: {"name": "Tom", "email": "new@example.com", "role": "admin"}  # 全量
```

---

**URL-METHOD-04** `[强制]` PATCH 用于部分更新资源，请求体仅包含需要变更的字段；不得将未传入字段视为"清空"。
违规信号：PATCH 请求体被要求包含所有字段；或后端将 PATCH 未传入的字段清空。
```
❌ PATCH /api/v1/users/{id}  Body: {"name":"Tom","email":"old@example.com","role":"admin"}  # 全量，应用 PUT
✅ PATCH /api/v1/users/{id}  Body: {"email": "new@example.com"}  # 仅变更 email，其余字段保留
```

---

**URL-METHOD-05** `[强制]` DELETE 用于删除资源，操作必须幂等（重复调用返回成功或 404，不报 5xx）；允许携带请求体，实现不支持时使用 `POST ?_method=DELETE` 覆盖方案。
违规信号：DELETE 重复调用返回 500；批量删除强制使用 URL 参数而不支持请求体。
```
❌ DELETE /api/v1/devices/{id}  → 第二次调用返回 500
✅ DELETE /api/v1/devices/{id}  → 第二次调用返回 200 或 404（均可接受）
✅ POST   /api/v1/devices?_method=DELETE  Body: {"ids": ["id1","id2"]}  # DELETE Over POST
```

---

**URL-METHOD-06** `[强制]` 将 GET、PUT、DELETE、HEAD、OPTIONS 视为幂等方法，以便客户端和网关安全重试。
违规信号：PUT 或 DELETE 接口因重复调用产生不同副作用（如重复记录操作日志、触发多次通知）。
```
❌ PUT /api/v1/devices/{id}  → 每次调用额外新增一条操作记录（非幂等副作用）
✅ PUT /api/v1/devices/{id}  → 覆盖更新，多次调用结果一致，仅保留最后一次状态
```

---

**URL-METHOD-07** `[建议]` 使用 OPTIONS 查询资源支持的方法（响应 `Allow` 头部），使用 HEAD 获取资源元数据（无响应体）。
```
✅ OPTIONS /api/v1/devices      → Response Header: Allow: GET, POST, DELETE
✅ HEAD    /api/v1/devices/{id} → 确认资源是否存在，不返回响应体
```

---

### 请求参数

**URL-PARAM-01** `[强制]` 查询参数与 JSON 字段名使用驼峰法命名，允许以单下划线起始，正则规则 `/^_?[a-z][0-9A-Za-z]*$/`。
违规信号：查询参数或 JSON 字段含 snake_case（`user_id`）或 PascalCase（`UserId`）。
```
❌ GET /api/v1/users?user_id=123&Page=1
❌ Body: {"user_name": "tom", "UserAge": 18}
✅ GET /api/v1/users?userId=123&page=1
✅ Body: {"userName": "tom", "userAge": 18, "_cache": false}
```

---

**URL-PARAM-02** `[强制]` 查询参数中的数组值采用逗号分隔，禁止 JSON 数组字符串或重复同名参数。
违规信号：`?ids=["id1","id2"]`（JSON 数组字符串）或 `?ids=id1&ids=id2`（重复同名参数）。
```
❌ GET /api/v1/devices?ids=["id1","id2"]
❌ GET /api/v1/devices?ids=id1&ids=id2
✅ GET /api/v1/devices?ids=id1,id2
```

---

**URL-PARAM-03** `[强制]` 对所有输入进行参数校验，必须覆盖：漏传必填参数、多传非法参数、参数类型错误三类场景。
违规信号：接口未对参数做校验；仅校验部分字段；漏传必填字段时返回 500 而非 400。
```
❌ def create_vm(body):
       name = body.get("name")      # 未校验是否必传
       cpu = int(body.get("cpu"))   # 未校验类型，可能 ValueError → 500

✅ # 通过 Pydantic / OpenAPI schema 等框架统一校验
   # 漏传必填字段 → 400 {"code":"InvalidParameter","message":"name is required"}
   # 类型错误     → 400 {"code":"InvalidParameter","message":"cpu must be integer"}
   # 多传非法字段 → 400 {"code":"InvalidParameter","message":"unknown field: extraField"}
```

---

**URL-PARAM-04** `[强制]` HTTP 请求头部必须携带 `Content-Type: application/json; charset=utf-8` 与 `Accept: application/json; charset=utf-8`。
违规信号：请求体为 JSON 但 Content-Type 为 `text/plain` 或缺失；缺少 charset 声明。
```
❌ Content-Type: text/plain
❌ Content-Type: application/json          （缺少 charset）
✅ Content-Type: application/json; charset=utf-8
✅ Accept: application/json; charset=utf-8
```

---

**URL-PARAM-05** `[强制]` 敏感信息（Token、密码、密钥等）必须放在 HTTP 头部传递，禁止出现在 URL 中。
违规信号：URL 路径或查询参数中含 `token=`、`password=`、`secret=`、`key=` 等字样。
```
❌ GET /api/v1/users?token=abc123&password=secret
✅ GET /api/v1/users
   Authorization: Bearer abc123
```

---

**URL-PARAM-06** `[强制]` 当 GET 请求参数过长或过于复杂（超过约 2000 字符或含嵌套对象）时，改用 POST（`?_method=GET`）；服务端检测到 URL 过长时必须返回 414 状态码。
违规信号：GET 请求携带嵌套 JSON 对象参数；或已知参数可能超长但未做 POST 覆盖处理。
```
❌ GET /api/v1/status?urls=url1,url2,...,url500  # URL 可能超长
✅ POST /api/v1/status/tasks?_method=GET
   Body: {"urls": ["url1", "url2", ..., "url500"]}
```

---

**URL-PARAM-07** `[强制]` 列举接口必须支持以下标准查询参数：`filters`（过滤条件）、`fields`（返回字段）、`sort`（排序）、`offset`（偏移量）、`limit`（每页数量）。
违规信号：列举接口不支持分页（无 `offset` / `limit`）；或过滤字段散乱定义而不使用标准 `filters`。
```
❌ GET /api/v1/devices?status=online&pageNo=1&pageSize=20     # 非标准分页和过滤参数名
✅ GET /api/v1/devices?filters=status:online&sort=createdAt:desc&offset=0&limit=20
✅ GET /api/v1/devices?fields=id,name,status&offset=0&limit=20
```

---

**URL-PARAM-08** `[建议]` 对数组字段的增删操作采用显式操作语法（如 `?_arrayop=add/remove`）或遵循 RFC 6902 标准补丁规范，而非整体替换数组。
```
# 删除好友列表中的某一项（不整体替换）
✅ PATCH /api/v1/users/{id}?_arrayop=remove
   Body: {"friends": ["Jim"]}

# 或使用 RFC 6902 JSON Patch 格式
✅ PATCH /api/v1/users/{id}
   Content-Type: application/json-patch+json
   Body: [{"op": "remove", "path": "/friends/0"}]
```

---

### 响应格式

**URL-RESP-01** `[强制]` 使用 JSON 作为所有 API 响应的默认格式。
违规信号：接口响应为纯文本、XML 或其他非 JSON 格式且未经内容协商。
```
❌ HTTP 200  Body: "success"
❌ HTTP 200  Content-Type: application/xml  Body: <result>ok</result>
✅ HTTP 200  Content-Type: application/json; charset=utf-8
             Body: {"code": "OK", "message": "success", "data": {}}
```

---

**URL-RESP-02** `[强制]` 采用统一响应格式 `{"code": "", "message": "", "data": {}}`；新 API 中 `code` 必须使用字符串类型。
违规信号：响应缺少 `code` 或 `message` 字段；新接口 `code` 为数字类型。
```
❌ {"status": 0, "result": {...}}                               # 非标准字段名
❌ {"code": 0, "message": "success", "data": {...}}             # code 为数字（仅旧 API 允许）
✅ {"code": "OK", "message": "success", "data": {...}}
✅ {"code": "RequestLimitExceeded", "message": "请求频率超限", "data": {}}
```

---

**URL-RESP-03** `[强制]` HTTP 状态码 >= 400 时必须返回结构化错误信息，包含应用层错误码与可读消息。
违规信号：4xx/5xx 响应返回空 body 或纯文本错误；新接口 HTTP 状态码始终为 200。
```
❌ HTTP 400  Body: "Bad Request"
❌ HTTP 200  Body: {"code": 22, "message": "invalid param"}    # 错误时新接口应使用 4xx
✅ HTTP 400  Body: {"code": "InvalidParameter", "message": "userId is required", "data": {}}
✅ HTTP 404  Body: {"code": "NotFound.Device", "message": "设备不存在", "data": {}}
```

---

**URL-RESP-04** `[强制]` 创建（POST）或更新（PUT/PATCH）成功后，响应体必须返回资源对象的完整基本信息（至少含 id 及关键状态字段）。
违规信号：创建成功仅返回 `{"code":"OK","data":{}}` 而不含新建资源的 id 和状态。
```
❌ HTTP 201  Body: {"code": "OK", "message": "created", "data": {}}
✅ HTTP 201  Body: {"code": "OK", "message": "success", "data": {"id": "vm-123", "name": "MySQL Server", "status": "creating"}}
```

---

**URL-RESP-05** `[强制]` 删除成功后返回空响应体或使用 204 状态码。
违规信号：DELETE 成功后响应体含被删除资源的全量数据。
```
❌ HTTP 200  Body: {"code":"OK","data":{"id":"vm-123","name":"...","config":{...}}}  # 返回全量数据
✅ HTTP 204  Body: (empty)
✅ HTTP 200  Body: {"code": "OK", "message": "deleted", "data": {}}
```

---

**URL-RESP-06** `[强制]` 异步操作响应体中必须包含任务 ID（`taskID`）和目标资源 ID（`targetID`），以便客户端轮询进度。
违规信号：异步接口仅返回 `{"code":"OK"}` 而不含 taskID；或 taskID 与 targetID 字段命名不统一。
```
❌ HTTP 202  Body: {"code": "OK", "message": "任务已提交"}
✅ HTTP 202  Body: {"code": "OK", "message": "任务已提交", "data": {"taskID": "task-abc123", "targetID": "vm-456"}}
```

---

**URL-RESP-07** `[强制]` 必须正确使用 HTTP 状态码语义：200 成功、201 创建成功、202 已受理、204 无内容、400 参数错误、401 未认证、403 无权限、404 不存在、409 冲突、429 限频、500 服务错误。
违规信号：新接口所有响应统一返回 200；创建成功返回 200 而非 201；认证失败返回 400 而非 401。
```
❌ POST /api/v1/vms         → HTTP 200（创建成功应为 201）
❌ 未携带 Token 访问        → HTTP 400（应为 401）
❌ 无权限访问资源           → HTTP 404（不应以 404 隐藏权限，应为 403）
✅ POST   创建成功          → HTTP 201
✅ DELETE 删除成功          → HTTP 204
✅ 参数缺失/类型错误        → HTTP 400
✅ 资源冲突（重复创建）     → HTTP 409
```

---

### 错误码

**URL-ERR-01** `[强制]` 新 API 的应用层错误码必须使用字符串格式，按"形容词|名词"或"名词+被动形容词"结构定义，单词首字母大写。
违规信号：新接口 `code` 字段为数字；错误码全部小写或含下划线（如 `invalid_param`）。
```
❌ {"code": 22, "message": "invalid param"}
❌ {"code": "invalid_parameter", "message": "..."}
✅ {"code": "InvalidParameter", "message": "..."}
✅ {"code": "NotFound.Device", "message": "设备不存在"}
✅ {"code": "RequestLimitExceeded", "message": "请求频率超限"}
```

---

**URL-ERR-02** `[强制]` 在框架层支持应用层错误码到 HTTP 状态码的自动映射，禁止在业务代码中手动设置 HTTP 状态码。
违规信号：业务代码中出现 `response.status_code = 400` 或 `abort(404)` 等硬编码状态码。
```python
❌ def get_device(device_id):
       if not device:
           return Response(status=404, body={"code": "NotFound"})  # 手动设置状态码

✅ def get_device(device_id):
       if not device:
           raise NotFoundError("NotFound.Device")  # 框架自动映射到 HTTP 404
```

---

**URL-ERR-03** `[强制]` 服务端业务错误码必须带上公共错误码前缀，以便框架识别并映射到对应 5xx 状态码。
违规信号：服务端错误（存储不可用、第三方超时等）返回了无前缀的自定义错误码，被误映射到 400。
```
❌ {"code": "DatabaseTimeout", "message": "数据库超时"}            # 无公共前缀，被映射到 400
✅ {"code": "ServiceUnavailable.DatabaseTimeout", "message": "数据库超时"}  # 映射到 503
✅ {"code": "InternalError", "message": "内部错误"}                # 映射到 500
```

---

**URL-ERR-04** `[建议]` 公共错误码应集中注册管理，避免各产品线重复定义或语义冲突。
```
❌ 产品 A: NotFound → HTTP 404
❌ 产品 B: NotFound → HTTP 400   # 同名但语义不同，产生冲突
✅ 统一在公共错误码定义表注册，产品线直接引用，不自行重定义公共错误码
```

---

**URL-ERR-05** `[建议]` 错误响应中应同时包含便于程序处理的错误码（`code`）与便于人工阅读的错误消息（`message`）。
```
❌ {"code": "E1042"}                              # 仅有机器码，无可读消息
❌ {"message": "输入的设备 ID 不存在"}            # 仅有消息，程序无法分支处理
✅ {"code": "NotFound.Device", "message": "设备 ID vm-999 不存在，请确认后重试", "data": {}}
```

---

### 版本管理

**URL-VER-01** `[强制]` URL 路径中必须包含版本号，格式为 `/v{number}`（如 `/v1/`、`/v2/`）。
违规信号：URL 中无版本号，或版本号通过查询参数（`?version=2`）或 HTTP 头部传递。
```
❌ GET /api/devices
❌ GET /api/devices?version=2
✅ GET /api/v1/devices
✅ GET /open/api/sip/v2/devices
```

---

**URL-VER-02** `[强制]` 发布新版本时必须同步更新 API 文档，并明确���注与旧版本的兼容性影响（新增/变更/废弃）。
违规信号：新版本接口上线但文档未更新；或文档中无兼容性说明。
```
# API 文档兼容性说明示例
✅ v2 新增字段：data.taskID（向后兼容，旧客户端无影响）
✅ v2 变更字段：code 类型由 int 改为 string（不兼容，需客户端适配）
✅ v1 废弃计划：2025-Q2 下线，请迁移至 v2，迁移指南见 /docs/migration-v2
```

---

**URL-VER-03** `[强制]` 框架中必须区分不同版本的错误码格式与响应格式，以支持多版本并存。
违规信号：v1（数字 code）与 v2（字符串 code）接口共用同一套响应序列化逻辑，导致版本混用。
```python
✅ # 框架根据 URL 前缀自动选择序列化器
   if url.startswith("/v1/"):
       return serialize_v1(result)   # code: int（旧格式）
   elif url.startswith("/v2/"):
       return serialize_v2(result)   # code: string（新格式）
```

---

### 向后兼容

**URL-COMPAT-01** `[强制]` 避免对已发布 API 做未文档化的不兼容变更（删除字段、变更字段类型、改变语义）。
违规信号：已发布接口响应体中字段被静默删除或类型更改，但版本号未升级，文档未标注。
```
❌ /api/v1/users 原响应含 "age" 字段 → 直接删除 "age" 字段，未升级版本号
✅ 升级为 v2，文档中标注：v2 不再���回 "age" 字段，v1 继续维护至废弃日期
```

---

**URL-COMPAT-02** `[强制]` 当资源 URL 发生变更时，旧 URL 必须做永久重定向（301）到新 URL。
违规信号：旧 URL 直接返回 404 而未重定向；或使用临时重定向 302。
```
❌ GET /api/v1/vm/{id}   → HTTP 404（旧路径废弃后直接 404）
✅ GET /api/v1/vm/{id}   → HTTP 301  Location: /api/v1/vms/{id}
```

---

**URL-COMPAT-03** `[强制]` 在错误码迁移期（数字 → 字符串）内，同时支持旧 `code`（数字）和新 `codestr`（字符串）双字段，直到旧客户端完成迁移。
违规信号：直接将 v1 的 `code: int` 改为 `code: string` 而不保留旧字段，导致旧客户端解析失败。
```
❌ v1 直接升级: {"code": "InvalidParameter", "message": "..."}  # 旧客户端期望 code 为 int
✅ 迁移期响应:  {"code": 22, "codestr": "InvalidParameter", "message": "..."}
✅ v2 完成迁移: {"code": "InvalidParameter", "message": "..."}
```

---

**URL-COMPAT-04** `[建议]` 进行破坏性变更时通过版本号隔离（升级到新版本），并为客户端提供明确的迁移路径文档。
```
✅ 迁移指南示例：
   - v1 废弃时间：2025-06-30
   - 主要差异：code 类型由 int 改为 string；分页参数由 pageNo/pageSize 改为 offset/limit
   - 迁移步骤：1) 升级 SDK 到 2.x  2) 替换错误码判断逻辑  3) 更新分页调用
```

---

### 参数校验

**URL-VALID-01** `[强制]` 必传字段必须明确声明为必填（`required=True` 或等效方式），选传字段必须声明为可选，二者均不得省略。
违规信号：字段缺少必要性声明，框架无法区分漏传与有意省略；从 OpenAPI/Markdown 转换 schema 时丢失必要性声明。
```python
# Pydantic 写法
❌ class CreateVMBody(BaseModel):
       name: str = None      # 未声明必要性，框架无法校验漏传
       cpu: str = None       # 类型不精确且未声明必要性

✅ class CreateVMBody(BaseModel):
       name: str             # 必填字段（无默认值）
       cpu: int              # 必填，整数类型
       memory: Optional[int] = None  # 选填，单位 MB
```

---

**URL-VALID-02** `[强制]` 嵌套结构参数必须定义独立的数据模型并直接引用；多态结构（类型由另一字段决定）需显式处理类型分支；禁止将嵌套对象声明为字符串类型。
违规信号：嵌套结构字段类型为字符串；多态结构缺少类型分支处理。
```python
# 固定嵌套结构 → 直接引用子模型
❌ class CreatePolicyBody(BaseModel):
       name: str
       rule: str   # 嵌套对象退化为字符串

✅ class RuleDetail(BaseModel):
       action: str    # 'allow' 或 'deny'
       priority: int  # 优先级，数值越小优先级越高

   class CreatePolicyBody(BaseModel):
       name: str
       rule: RuleDetail   # 直接引用子模型

# 多态结构（类型由 vm_type 字段决定）→ 使用 Union 或 discriminated union
✅ from typing import Union, Literal
   class VMwareConfig(BaseModel):
       type: Literal['vmware']
       cluster: str
       datastore: str

   class HCIConfig(BaseModel):
       type: Literal['hci']
       pool: str
       level: str  # 'L', 'M', 'H'

   class CreateVMBody(BaseModel):
       vm_config: Union[VMwareConfig, HCIConfig]
       vm_name: str
```

---

**URL-VALID-03** `[强制]` 参数类型必须精确匹配字段语义，禁止将所有字段默认声明为字符串类型。
违规信号：字段类型统一使用 `str`；设计文档未指定字段类型粒度，导致类型校验缺失。

常用字段 → 正确类型速查：

| 字段含义 | 错误写法 | 正确类型 |
|---------|---------|---------|
| UUID/资源 ID | `str` | `UUID` 或带格式校验的 `str` |
| 端口号 | `str` | `int`（范围 1-65535） |
| 启用/禁用（0/1） | `str` | `int` 或 `bool` |
| 布尔值 | `str` | `bool` |
| IPv4 地址 | `str` | 带格式校验的 `str`（如 `IPv4Address`） |
| 枚举值 | `str` | `Literal[...]` 或 `Enum` 子类 |
| 时间戳 | `str` | `int` 或 `datetime` |
| 资源名称 | `str` | 带长度约束的 `str`（如 `constr(min_length=1, max_length=64)`） |

```python
❌ class QueryDeviceParams(BaseModel):
       device_id: str   # 应带 UUID 格式校验
       port: str        # 应为 int，范围 1-65535
       enabled: str     # 应为 bool 或 int
       ip: str          # 应带 IP 格式校验

✅ from pydantic import BaseModel, conint, constr
   from typing import Optional
   class QueryDeviceParams(BaseModel):
       device_id: str                       # 可进一步加 UUID 格式校验
       port: Optional[conint(ge=1, le=65535)] = None
       enabled: Optional[bool] = None
       ip: Optional[str] = None             # 可配合 validator 校验 IPv4 格式
```

---

**URL-VALID-04** `[强制]` 字段描述（`description`）必须统一使用中文，禁止中英文混用。
违规信号：描述为纯英文（如 `"user id"`）；描述中英文混合（如 `"用户 id，required"` 或 `"状态 0=disabled"`）。
```python
❌ class UpdateUserBody(BaseModel):
       user_id: str  # 'user id'
       status: int   # '用户状态 0=disabled'

✅ class UpdateUserBody(BaseModel):
       """更新用户信息"""
       user_id: str  # 用户 ID
       status: int   # 用户状态，0=禁用，1=启用
       role: Optional[str] = None  # 用户角色
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <接口路径> — <描述>`。

**URL 路径设计**
- [ ] URL-PATH-01 — 路径段是否全小写且符合 `^[0-9a-z]+$`
- [ ] URL-PATH-02 — 路径段是否含下划线（禁止）
- [ ] URL-PATH-03 — 资源路径段是否为复数形式
- [ ] URL-PATH-04 — 资源嵌套是否超过两层
- [ ] URL-PATH-05 — 非 CRUD 动作是否使用 `/actions/{verb}` 子路径
- [ ] URL-PATH-06 — 批量操作是否使用标准 `/bulk` 接口
- [ ] URL-PATH-07 — URL 前缀是否含产品/子系统标识路径（separatePath）

**HTTP 方法语义**
- [ ] URL-METHOD-01 — GET 是否有副作用（禁止）
- [ ] URL-METHOD-02 — POST 是否被用于更新操作（禁止）
- [ ] URL-METHOD-03 — PUT 请求体是否包含全量字段
- [ ] URL-METHOD-04 — PATCH 请求体是否仅含需变更字段
- [ ] URL-METHOD-05 — DELETE 是否幂等；批量删除是否支持请求体或 POST 覆盖
- [ ] URL-METHOD-06 — GET/PUT/DELETE/HEAD/OPTIONS 是否保证幂等性
- [ ] URL-METHOD-07 — 是否提供 OPTIONS/HEAD 支持（建议）

**请求参数**
- [ ] URL-PARAM-01 — 查询参数和 JSON 字段是否为 camelCase
- [ ] URL-PARAM-02 — 数组参数是否为逗号分隔（禁止 JSON 数组字符串和重复参数名）
- [ ] URL-PARAM-03 — 是否覆盖漏传/多传/类型错误三类校验
- [ ] URL-PARAM-04 — 是否携带正确的 Content-Type / Accept 头部
- [ ] URL-PARAM-05 — URL 中是否含敏感信息（禁止）
- [ ] URL-PARAM-06 — GET 参数过长时是否提供 POST 覆盖方案或 414 处理
- [ ] URL-PARAM-07 — 列举接口是否支持 filters/fields/sort/offset/limit
- [ ] URL-PARAM-08 — 数组增删是否用显式操作语法或 RFC 6902（建议）

**响应格式**
- [ ] URL-RESP-01 — 响应是否为 JSON 格式
- [ ] URL-RESP-02 — 是否使用 code/message/data 统一格式，且新 API code 为字符串
- [ ] URL-RESP-03 — HTTP >= 400 时是否有结构化错误体（新接口禁止统一返回 200）
- [ ] URL-RESP-04 — 创建/更新成功后是否返回资源基本信息（含 id）
- [ ] URL-RESP-05 — 删除成功是否返回空体或 204
- [ ] URL-RESP-06 — 异步操作是否返回 taskID 和 targetID
- [ ] URL-RESP-07 — HTTP 状态码是否语义正确

**错误码**
- [ ] URL-ERR-01 — 新 API 错误码是否为字符串且符合命名格式
- [ ] URL-ERR-02 — HTTP 状态码是否由框架自动映射（禁止业务代码手动设置）
- [ ] URL-ERR-03 — 服务端业务错误码是否含公共错误码前缀
- [ ] URL-ERR-04 — 公共错误码是否统一注册管理（建议）
- [ ] URL-ERR-05 — 错误响应是否同时含 code 和 message（建议）

**版本管理**
- [ ] URL-VER-01 — URL 是否含 `/v{number}` 版本号
- [ ] URL-VER-02 — 新版本上线是否同步更新文档并标注兼容性影响
- [ ] URL-VER-03 — 框架是否支持多版本并存（不同版本使用不同序列化器）

**向后兼容**
- [ ] URL-COMPAT-01 — 是否存在未文档化的不兼容变更（静默删除/变更字段类型）
- [ ] URL-COMPAT-02 — 旧 URL 变更时是否做 301 永久重定向
- [ ] URL-COMPAT-03 — 迁移期是否双写 code（数字）和 codestr（字符串）
- [ ] URL-COMPAT-04 — 破坏性变更是否通过版本号隔离并提供迁移文档（建议）

**参数校验**
- [ ] URL-VALID-01 — 必传/选传字段是否明确声明必填与可选
- [ ] URL-VALID-02 — 嵌套结构是否使用独立数据模型（禁止退化为字符串）
- [ ] URL-VALID-03 — 字段类型是否精确指定（禁止全用字符串类型）
- [ ] URL-VALID-04 — 字段描述是否统一使用中文（禁止中英文混用）
