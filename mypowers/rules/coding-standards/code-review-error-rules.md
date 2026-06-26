<coding-redlines severity="error" description="违反以下任何一条规则的代码禁止提交">

<auto-scanned description="以下规则由 redline-scanner hook 自动检测，违规会被实时拦截并要求修复">
  <rule id="E1.1">禁止空 except 吞异常，至少要记录日志</rule>
  <rule id="E1.6">禁止裸 except，必须指定具体异常类型</rule>
  <rule id="E1.7">禁止在 except 块中写 continue</rule>
  <rule id="E2.1">禁止命令注入，禁止 os.system/os.popen/shell=True</rule>
  <rule id="E2.2">禁止硬编码密钥、token、密码</rule>
  <rule id="E2.4">禁止 SQL 字符串拼接，必须使用参数化查询</rule>
  <rule id="E2.5">禁止使用 eval()，使用 ast.literal_eval() 替代</rule>
  <rule id="E2.6">禁止使用 pickle 进行序列化/反序列化</rule>
  <rule id="E2.7">禁止使用 yaml.load()，必须使用 yaml.safe_load()</rule>
  <rule id="E2.8">HTTP 请求必须启用 SSL 证书验证（verify=True）</rule>
  <rule id="E2.9">禁止使用系统自带 xml 库，使用 defusedxml 替代</rule>
  <rule id="E2.10">Flask 生产环境禁止开启 debug 模式</rule>
  <rule id="E2.12">禁止对 0.0.0.0 地址绑定监听</rule>
  <rule id="E3.6">浮点数禁止用 == 或 != 直接比较</rule>
  <rule id="E4.1">文件/连接必须在 with 或 finally 中关闭</rule>
  <rule id="E7.1">用户可见中文字符串必须用 _() 或 i18n.I() 包裹</rule>
  <rule id="E8.1">日志必须使用延迟格式化，禁止 f-string/format/%</rule>
  <rule id="E8.6">后台服务禁止使用 print，必须使用日志框架</rule>
  <rule id="E9.1">函数/变量名禁止使用单字符或无意义命名</rule>
  <rule id="E9.2">标识符禁止与 Python 内置名称重名</rule>
  <rule id="E10.1">禁止使用全局变量，配置项使用配置文件管理</rule>
  <rule id="E10.2">函数参数不超过 5 个</rule>
  <rule id="E10.8">遍历列表时禁止同时删除元素</rule>
  <rule id="E10.9">默认参数禁止使用可变对象（list/dict/set）</rule>
  <rule id="E11.1">禁止使用 import * 和 from X import *</rule>
  <rule id="E11.2">禁止导入未使用的模块</rule>
  <rule id="E11.3">禁止使用相对路径导入</rule>
  <rule id="E14.1" lang="go">函数返回的 err 必须检查，禁止忽略</rule>
  <rule id="E14.4" lang="go">map 和 channel 必须使用 make 初始化</rule>
  <rule id="E14.7" lang="go">一个文件只定义一个 init 函数</rule>
  <rule id="E14.8" lang="go">禁止使用 . 简化导入</rule>
</auto-scanned>

<manual description="以下规则需要主动遵守，无自动扫描，违反不会被拦截">

  <category name="E1. 异常处理">
    <rule id="E1.2">异常处理后必须确认：catch/except 块中是否为后续依赖的变量赋了默认值，函数是否有明确的返回值（禁止因异常导致变量未定义或函数返回 None）</rule>
    <rule id="E1.3">raise 异常前必须打 error 级别日志</rule>
    <rule id="E1.4">禁止 raise ValueError/RuntimeError/TypeError/Exception 等语言内置异常，必须使用项目自定义异常类（VisibleEx/InvisibleEx 体系，见 E6.2）</rule>
    <rule id="E1.5">异常信息统一定义在异常类中，禁止动态拼接异常消息</rule>
  </category>

  <category name="E2. 安全">
    <rule id="E2.3">敏感信息（密码/token/手机号/邮箱）在日志和返回值中必须脱敏</rule>
    <rule id="E2.11">Jinja2 模板必须设置 autoescape=True</rule>
    <rule id="E2.13">random 模块不得用于安全/加密场景，使用 os.urandom() 或 secrets</rule>
    <rule id="E2.14">密钥长度不得小于 32 位，必须使用推荐的密码算法</rule>
    <rule id="E2.15">密钥文件权限必须为 400，密钥目录权限为 600</rule>
    <rule id="E2.16">接口必须有认证机制和角色权限校验</rule>
    <rule id="E2.17">文件上传必须校验类型（白名单）、限制大小、限制路径</rule>
  </category>

  <category name="E3. 空值与输入防护">
    <rule id="E3.1">从外部获取的对象/字段使用前必须做 None/空值判断</rule>
    <rule id="E3.2">接口函数的所有参数必须做有效性校验</rule>
    <rule id="E3.3">从文件、数据库、网络等外部来源读取的数据必须校验有效性</rule>
    <rule id="E3.4">用作除数/求余右操作数的变量必须先判断不为 0</rule>
    <rule id="E3.5">移位运算的右操作数必须在有效范围内</rule>
  </category>

  <category name="E4. 资源管理">
    <rule id="E4.2">临时文件必须使用 tempfile 模块，用完必须删除</rule>
    <rule id="E4.3">父任务结束时必须回收所有子协程</rule>
    <rule id="E4.4">协程内禁止使用阻塞函数（time.sleep/同步IO 等）</rule>
  </category>

  <category name="E5. 数据查询">
    <rule id="E5.1">分页查询必须设置 LIMIT 上限（单次查询不超过 1000 条），禁止不带 LIMIT 的全量拉取</rule>
    <rule id="E5.2">涉及客户敏感数据的查询只允许打 DEBUG 级别日志</rule>
  </category>

  <category name="E6. 错误码">
    <rule id="E6.1">错误码必须全局唯一，新增错误码需确认不与已有的冲突</rule>
    <rule id="E6.2">自定义异常类必须按可见性命名：用户可见异常以 VisibleEx 开头，用户不可见异常以 InvisibleEx 开头，禁止使用不带可见性前缀的异常类名</rule>
    <rule id="E6.3">VisibleEx 异常的 message_format 必须包含：位置信息 + 错误原因 + 处理建议，格式为 [模块名>功能名] 错误原因。处理建议</rule>
    <rule id="E6.4">InvisibleEx 异常的 message_format 必须包含：[模块-资源-操作] 前缀 + 技术详情</rule>
    <rule id="E6.5">每个异常类必须定义 errcode 属性，使用已分配的十六进制错误码</rule>
  </category>

  <category name="E7. 国际化（i18n）">
    <rule id="E7.2">禁止硬编码拼接用户可见文本，必须使用参数化国际化函数</rule>
    <rule id="E7.3">技术性字符串（日志、配置键、API 路径）无需国际化，不要误加</rule>
    <rule id="E7.4">i18n 占位符必须使用语义化命名（{username}），禁止使用序号（{0}）</rule>
    <rule id="E7.5">翻译词条不得是格式化后的字符串，必须保留占位符原文</rule>
  </category>

  <category name="E8. 日志规范">
    <rule id="E8.2">日志消息必须使用英文，消息中的键名使用驼峰命名（userId=，非 user_id=）</rule>
    <rule id="E8.3">日志级别必须匹配场景：ERROR=意外故障、WARNING=预期异常已处理、INFO=关键业务事件、DEBUG=排查详情</rule>
    <rule id="E8.4">禁止在循环（迭代>10次）或高频方法（>100次/秒）中使用 INFO 及以上级别</rule>
    <rule id="E8.5">日志中禁止暴露敏感信息，密码/token/手机号等必须脱敏</rule>
    <rule id="E8.7">增删改查接口和敏感数据查询必须有 INFO 级别日志记录，日志内容包含操作类型、操作对象、操作结果</rule>
  </category>

  <category name="E9. 命名规范">
    <rule id="E9.3">同一文件内命名风格必须统一</rule>
    <rule id="E9.4">Python：模块/包全小写、类大驼峰、函数/变量 snake_case、常量全大写、异常类以 Error 结尾且必须带可见性前缀（VisibleEx/InvisibleEx，见 E6.2）</rule>
    <rule id="E9.5">Go：使用 gofmt 格式化、左大括号不换行、运算符两侧留空格</rule>
    <rule id="E9.6">函数/变量名不得少于 3 个字符</rule>
  </category>

  <category name="E10. 代码结构">
    <rule id="E10.3">禁止使用布尔参数或标识参数控制函数执行逻辑</rule>
    <rule id="E10.4">三目运算符/条件表达式禁止嵌套</rule>
    <rule id="E10.5">一行只写一条语句，if/for/while 即使一行也要换行</rule>
    <rule id="E10.6">禁止用注释屏蔽无用代码，直接删除</rule>
    <rule id="E10.7">递归必须有明确的收敛条件</rule>
  </category>

  <category name="E12. 并发安全">
    <rule id="E12.1">禁止全局变量并发读写，必须加锁保护（Python: threading.Lock、Go: sync.Mutex）</rule>
    <rule id="E12.2">CPU 密集型任务禁止使用多线程（Python GIL），改用多进程</rule>
    <rule id="E12.3">并发读写文件/数据库必须及时 flush 保证数据一致性，禁止依赖缓冲区自动刷新</rule>
    <rule id="E12.4">Go channel 必须使用 make 初始化，多生产者场景禁止在发送端关闭后继续发送，接收端必须用 val, ok := &lt;-ch 检测 channel 关闭</rule>
  </category>

  <category name="E13. API 设计">
    <rule id="E13.1">API 资源命名必须使用复数形式（/users，禁止 /user）、完整英文单词（禁止自造缩写，公认缩写如 ID、URL、API 除外）</rule>
    <rule id="E13.2">引用其他资源的属性名必须以 ID 结尾明确表达关联关系（如 groupID），禁止使用裸名（如 group）导致歧义</rule>
    <rule id="E13.3">编辑类接口必须使用基于 schema 的参数校验（禁止手动逐字段校验），编辑类用户提示文案必须使用统一文案生成器（禁止硬编码提示文本）</rule>
    <rule id="E13.4">接口返回参数必须与接口文档定义一致，禁止返回文档未定义的多余字段</rule>
  </category>

  <category name="E14. Go 专项">
    <rule id="E14.2">panic 仅用于不可恢复的错误，正常错误必须 return error</rule>
    <rule id="E14.3">error 必须作为函数最后一个返回值</rule>
    <rule id="E14.5">判断 map 中键是否存在必须使用 val, ok := m[key] 模式</rule>
    <rule id="E14.6">切片形参不使用指针传递</rule>
  </category>

  <category name="E15. DFX">
    <rule id="E15.1">页面中的密码、token、手机号、邮箱、身份证号等敏感信息必须默认脱敏显示（如 138****1234），禁止明文展示</rule>
    <rule id="E15.2">安全配置项默认启用（默认安全）</rule>
    <rule id="E15.3">存在会话标识的 cookie 必须设置 httponly 和 secure 属性</rule>
    <rule id="E15.4">必须使用安全传输协议（HTTPS），L4 级敏感信息传输必须加密</rule>
    <rule id="E15.5">密钥用途必须唯一，禁止将密钥回显到前端</rule>
  </category>

</manual>

</coding-redlines>
