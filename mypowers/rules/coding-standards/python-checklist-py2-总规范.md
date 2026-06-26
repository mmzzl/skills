# Python 2 编码规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写 Python 2 代码前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## 安全

**PY2-SEC-01** `[强制]` 禁止使用 `eval()`、`exec()`、`input()`、`execfile()`、`compile()` 执行不可信字符串；`eval` 用 `ast.literal_eval` 替代；`input` 用 `raw_input` 替代。

违规信号：代码中出现 `eval(user_input)`、`input()` 读取用户数据、`os.system(cmd)` 拼接外部输入。

```python
❌ result = eval(user_input)                # 任意代码执行
❌ data = input("Enter: ")                  # Python 2 input 会执行输入内容
❌ os.system("rm -rf " + user_path)         # 命令注入

✅ result = ast.literal_eval(user_input)    # 仅解析字面量
✅ data = raw_input("Enter: ")              # Python 2 安全输入
✅ subprocess.call(["rm", "-rf", user_path]) # 参数化调用
```

---

**PY2-SEC-02** `[强制]` 禁止 SQL 字符串拼接，必须使用参数化查询。

违规信号：`"SELECT %s FROM table" % var`、`"SELECT {} FROM table".format(var)`、`"SELECT " + column + " FROM table"`。

```python
❌ cursor.execute("SELECT * FROM users WHERE name = '%s'" % username)
❌ cursor.execute("SELECT * FROM users WHERE name = '{}'".format(username))

✅ cursor.execute("SELECT * FROM users WHERE name = %s", (username,))
```

---

**PY2-SEC-03** `[强制]` 反序列化使用安全版本：`yaml.safe_load` 替代 `yaml.load`；禁止使用 `pickle` 处理不可信数据。

违规信号：`yaml.load(data)`、`pickle.loads(data)`。

```python
❌ data = yaml.load(untrusted_yaml)         # 可能执行任意代码
❌ obj = pickle.loads(untrusted_data)       # 代码注入

✅ data = yaml.safe_load(untrusted_yaml)
✅ # 不可信数据不使用 pickle
```

---

**PY2-SEC-04** `[强制]` 安全随机数使用 `os.urandom()` 或 `random.SystemRandom`；密钥长度 RSA/DSA >= 2048 位。

违规信号：`random.random()` 用于密码学场景；DSA 密钥 < 1024 位。

```python
❌ token = str(random.random())             # 伪随机，不可预测性差

✅ token = os.urandom(32)                   # 密码学安全随机数
✅ key = rsa.generate_private_key(
       public_exponent=65537,
       key_size=2048,                       # >= 2048 位
       backend=default_backend()
   )
```

---

**PY2-SEC-05** `[强制]` SSL 请求必须开启验证（`verify=True`）；禁止绑定 `0.0.0.0`；禁止硬编码密码/密钥/Token。

违规信号：`requests.get(url, verify=False)`；`app.run(host='0.0.0.0')`；代码中出现明文密码。

```python
❌ requests.get("https://api.com", verify=False)   # SSL 验证关闭
❌ app.run(host="0.0.0.0")                        # 暴露所有接口
❌ PASSWORD = "admin123"                          # 硬编码密码

✅ requests.get("https://api.com", verify=True)
✅ app.run(host="127.0.0.1")
✅ PASSWORD = os.environ.get("APP_PASSWORD")
```

---

**PY2-SEC-06** `[强制]` XML 解析使用 `defusedxml` 替代系统自带 `xml` 库；临时文件使用 `tempfile` 模块且及时删除。

违规信号：`xml.etree.ElementTree.parse(data)`；直接写 `/tmp/xxx`。

```python
❌ import xml.etree.ElementTree as ET
   ET.parse(untrusted_xml)                  # XXE 漏洞

❌ f = open("/tmp/abc", "w")                # 可预测路径，易被劫持

✅ from defusedxml import ElementTree as ET
   ET.parse(untrusted_xml)

✅ import tempfile
   fd, path = tempfile.mkstemp()
   try:
       os.write(fd, data)
   finally:
       os.close(fd)
       os.remove(path)
```

---

**PY2-SEC-07** `[强制]` 涉及客户数据只允许 DEBUG 日志；用户明文密码不得打印到日志（包括后台日志）。

违规信号：`LOG.info("user=%s, password=%s", user, pwd)`；`LOG.info("token=%s", token)`。

```python
❌ LOG.info("login, user=%s, password=%s", username, password)   # 密码上日志

✅ LOG.debug("login, user=%s", username)                         # 客户数据仅 debug
✅ LOG.info("login, user=%s, password=***", username)            # 密码脱敏
```

---

**PY2-SEC-08** `[强制]` Flask jinja2 `autoescape` 必须为 `True`；禁止 `app.run(debug=True)`；Django 禁止 `mark_safe`。

违规信号：`app.run(debug=True)`；模板中 `{{ data | safe }}`。

```python
❌ app.run(debug=True)                      # 调试模式可修改 py 文件
❌ return render_template("page.html", data=Markup(user_input))   # 不转义

✅ app.config["TEMPLATES_AUTO_RELOAD"] = False
✅ return render_template("page.html", data=user_input)            # 自动转义
```

---

**PY2-SEC-09** `[强制]` 异常必须捕获并处理，禁止空 `except` 吞掉异常或 `except` 内直接 `continue`。

违规信号：`except: pass`；`except: continue`。

```python
❌ try:
       process(data)
   except:
       pass                                    # 吞掉所有异常

❌ for item in items:
       try:
           process(item)
       except:
           continue                            # 忽略异常继续循环

✅ try:
       process(data)
   except ValueError as e:
       LOG.error("process failed, data=%s, error=%s", data, e)
       raise
```

---

## 异常处理

**PY2-ERR-01** `[强制]` 禁止捕获所有异常（`except:` / `except Exception:` / `except StandardError:`）；必须捕获具体异常类型。

违规信号：`except:`、`except Exception:`、捕获范围过于宽泛。

```python
❌ try:
       process(data)
   except:
       LOG.error("failed")

❌ try:
       db.query(sql)
   except Exception as e:
       LOG.error("failed: %s", e)

✅ try:
       process(data)
   except ValueError as e:
       LOG.error("invalid data: %s", e)
   except DatabaseError as e:
       LOG.error("db error: %s", e)
```

---

**PY2-ERR-02** `[强制]` 外部数据（文件、数据库、标准输入、命令行参数、管道、socket、RPC）操作必须 `try/except`；自定义异常继承 `Exception`。

违规信号：读取外部数据无异常处理；自定义异常继承 `BaseException` 或不继承。

```python
❌ data = open("/etc/config").read()          # 未处理文件不存在

❌ class MyError: ...                        # 未继承 Exception

✅ class BusinessError(Exception):
       """业务异常基类"""
       pass

✅ try:
       with open("/etc/config") as f:
           data = f.read()
   except IOError as e:
       LOG.error("read config failed: %s", e)
       raise BusinessError("config read failed")
```

---

**PY2-ERR-03** `[强制]` 抛出异常使用 `raise ValueError('message')` 格式；自定义异常禁止旧式双参数或字符串异常。

违规信号：`raise ValueError, 'message'`；`raise MyException, 'msg'`；`raise 'error'`。

```python
❌ raise ValueError, "invalid"                # Python 2 旧式语法
❌ raise MyException, "error"                 # 双参数形式
❌ raise "error message"                      # 字符串异常

✅ raise ValueError("invalid parameter")
✅ raise MyException("error message")
```

---

**PY2-ERR-04** `[强制]` 捕获多个异常使用 `except (A, B):` 而非 `except A, B:`；异常与 `try` 同级捕获。

违规信号：`except ValueError, TypeError:`（Python 2 中仅捕获 ValueError）；`except` 缩进与 `try` 不对齐。

```python
❌ try:
       process()
   except ValueError, TypeError:              # 仅捕获 ValueError，TypeError 被赋给变量
       pass

✅ try:
       process()
   except (ValueError, TypeError) as e:
       LOG.error("validation failed: %s", e)
```

---

**PY2-ERR-05** `[强制]` 使用基于对象的异常；模块/包应定义自己的异常基类继承 `Exception`。

违规信号：使用字符串异常；模块内直接使用内置异常而不定义业务异常。

```python
❌ raise "database error"                     # 字符串异常

❌ # mymodule.py — 无自定义异常
   raise Exception("not found")               # 使用通用异常

✅ # mymodule/exceptions.py
   class ModuleError(Exception):
       """模块异常基类"""
       pass

   class NotFoundError(ModuleError):
       """资源不存在"""
       pass

✅ raise NotFoundError("user not found")
```

---

## 命名规范

**PY2-NAME-01** `[强制]` 模块/包：全小写，允许下划线；类：大驼峰（CapWords）；函数/变量：小写下划线；常量：全大写下划线；异常：CapWords+Error。

违规信号：类名小写；函数名驼峰；常量小写；异常无 Error 后缀。

```python
❌ class myclass: ...                        # 类名应大驼峰
❌ def myFunc(): ...                         # 函数名应小写下划线
❌ max_count = 100                           # 常量应全大写
❌ class NotFound: ...                       # 异常应加 Error 后缀

✅ class MyClass(object): ...
✅ def my_function(): ...
✅ MAX_COUNT = 100
✅ class NotFoundError(Exception): ...
```

---

**PY2-NAME-02** `[强制]` 禁止使用全局变量，采用类加静态变量实现；同一文件命名风格统一。

违规信号：模块级变量被多函数修改；同一文件中混用 `my_func` 和 `myFunc`。

```python
❌ count = 0                                 # 全局变量
   def increment():
       global count
       count += 1

❌ def my_func(): ...
   def myFunc(): ...                         # 风格混用

✅ class Counter(object):
       _count = 0                            # 类静态变量

       @classmethod
       def increment(cls):
           cls._count += 1
```

---

**PY2-NAME-03** `[强制]` 函数名不少于 3 字符；变量名不用单个字符（循环变量 i/j/k 除外）；变量名不隐藏内置名称。

违规信号：`def f():`、`str = "hello"`、`list = []`。

```python
❌ def f(x): ...                             # 少于 3 字符
❌ str = "hello"                             # 隐藏内置 str
❌ list = [1, 2, 3]                          # 隐藏内置 list

✅ def process_data(data): ...
✅ message = "hello"
✅ items = [1, 2, 3]
```

---

## 代码格式

**PY2-FMT-01** `[强制]` 缩进 4 空格，不用 Tab，不混用；每行不超过 120 列；文件头 `# coding=utf-8` 和 `#!/usr/bin/env python`；UTF-8 无 BOM；Unix 换行符。

违规信号：混用 Tab 和空格；行超过 120 列；无编码声明；文件含 BOM；换行符为 CRLF。

```python
❌ #!/usr/bin/env python
   # 无 coding 声明
   def foo():
   	pass                                    # Tab 缩进

✅ #!/usr/bin/env python
   # coding=utf-8
   def foo():
       pass                                    # 4 空格缩进
```

---

**PY2-FMT-02** `[强制]` 空行：类/top-level 函数间空两行；类方法间空一行；逻辑无关段落间空一行。

违规信号：函数间无空行；类定义前后无空行。

```python
❌ class Foo(object):
       def method1(self):
           pass
       def method2(self):                     # 类方法间应空一行
           pass
   def bar():                                 # top-level 函数前应与类空两行
       pass

✅ class Foo(object):
       def method1(self):
           pass

       def method2(self):
           pass


   def bar():
       pass
```

---

**PY2-FMT-03** `[强制]` 空格规则：右括号前不加空格；逗号/冒号/分号前不加空格；函数/序列左括号前不加空格；操作符左右各一个空格；默认参数赋值符省略空格；不将多语句写一行；if/for/while 单语句也必须另起一行。

违规信号：`func ( arg )`、`a = b` 等号两侧不对齐但多空格、`if x: pass` 同行。

```python
❌ func ( arg )                              # 左括号前有空格，右括号前有空格
❌ a  =  b                                   # 为对齐增加空格
❌ if x: pass                                # 单语句未另起一行

✅ func(arg)
✅ a = b
✅ if x:
       pass
```

---

**PY2-FMT-04** `[强制]` 注释：模块/函数/类用 docstring；行注释在代码上方；禁止用注释屏蔽无用代码；文件头注释功能和作者/修改者信息。

违规信号：`# x += 1` 行尾注释；`# old_code()` 注释掉的代码；函数无 docstring。

```python
❌ x += 1  # 增加计数                          # 行尾注释
❌ # old_function()                           # 用注释屏蔽代码

✅ # 补偿时区转换导致的边界偏移
   x += 1

✅ def process_order(order_id):
       """处理订单

       :param order_id: 订单 ID
       :returns: 处理结果字典
       """
       ...
```

---

## 导入

**PY2-IMPORT-01** `[强制]` 禁止 `import *` / `from A import *`；每个导入独占一行；不导入未使用的模块；不用相对导入；按标准库、第三方库、自己库顺序排列。

违规信号：`import os, sys`；`from module import *`；存在未使用的 import。

```python
❌ import os, sys                            # 多导入同一行
❌ from mymodule import *                    # import *
❌ import unused_lib                         # 未使用的导入

✅ import os
✅ import sys
✅ from thirdparty import some_func
✅ from myproject.mymodule import MyClass
```

---

## 语言特性

**PY2-LANG-01** `[强制]` 不要使用可变对象作为函数默认值；默认参数值在函数定义时求值，不要在默认参数中调用函数。

违规信号：`def foo(a=[]):`、`def foo(t=time.time()):`。

```python
❌ def append_item(item, items=[]):
       items.append(item)                    # 默认列表被共享
       return items

❌ def get_time(t=time.time()):              # 默认值在定义时求值
       return t

✅ def append_item(item, items=None):
       if items is None:
           items = []
       items.append(item)
       return items
```

---

**PY2-LANG-02** `[强制]` 使用隐式 false：`if foo:` 而非 `if foo != []:`；`is`/`is not` 比较 `None`；不用 `==` 比较布尔量；序列空值直接用 `if not seq:`；已知整型可与 0 比较。

违规信号：`if foo == None`、`if foo == True`、`if len(seq) == 0`。

```python
❌ if foo == None: ...                       # 应用 is
❌ if foo == True: ...                       # 应用 if foo:
❌ if len(seq) == 0: ...                     # 应用 if not seq:

✅ if foo is None: ...
✅ if foo:
       ...
✅ if not seq:
       ...
```

---

**PY2-LANG-03** `[强制]` 对象类型比较用 `isinstance()` 而非直接比较；字符串拼接 >2 个用 `join`；用 `startswith()`/`endswith()` 而非切片；用 `str.format()` 而非 `%`（简单格式化可用 `%`）。

违规信号：`type(x) == list`、`a + b + c` 多字符串拼接、`s[:3] == 'abc'`。

```python
❌ if type(x) == list: ...                   # 应用 isinstance
❌ result = a + b + c + d                    # 多字符串拼接
❌ if s[:3] == "abc": ...                    # 应用 startswith

✅ if isinstance(x, list): ...
✅ result = "".join([a, b, c, d])
✅ if s.startswith("abc"): ...
```

---

**PY2-LANG-04** `[强制]` 变量初始化：全局变量使用前初始化；类成员在 `__init__` 初始化；局部变量使用前初始化；遍历列表时不删除元素。

违规信号：变量未赋值直接使用；循环中删除列表元素。

```python
❌ for item in items:
       if item.bad:
           items.remove(item)                # 遍历中删除元素

❌ def foo():
       print(count)                          # count 未初始化

✅ items = [item for item in items if not item.bad]   # 列表推导过滤

✅ def foo():
       count = 0
       print(count)
```

---

**PY2-LANG-05** `[强制]` 使用字符串方法取代字符串模块；用 for 循环取代 `filter()`/`map()`/`reduce()`；列表推导简单场景可用，mapping/loop/filter 单独成行且最多一行，禁止多层 loop。

违规信号：`import string`、`string.upper(s)`、`map(func, items)`。

```python
❌ import string
   result = string.upper(text)               # 旧式字符串模块

❌ result = map(lambda x: x * 2, items)      # 应用列表推导

❌ result = [(x, y) for x in xs for y in ys for z in zs]   # 多层 loop

✅ result = text.upper()
✅ result = [x * 2 for x in items]
```

---

**PY2-LANG-06** `[强制]` 条件表达式仅用于一行内，禁止嵌套；lambda 单行可用，超过 60-80 字符用常规函数；常见操作符用 `operator` 模块替代 lambda。

违规信号：`a if b else c if d else e` 嵌套；lambda 超过一行。

```python
❌ result = a if b else c if d else e        # 三目嵌套

❌ sorted(items, key=lambda x: x.attr.subattr.deep)   # lambda 过复杂

❌ from operator import mul
   # lambda x, y: x * y                       # 应用 operator.mul

✅ if b:
       result = a
   elif d:
       result = c
   else:
       result = e

✅ from operator import attrgetter
   sorted(items, key=attrgetter("attr.subattr.deep"))

✅ from operator import mul
   reduce(mul, [1, 2, 3, 4])
```

---

**PY2-LANG-07** `[强制]` 函数返回值不超过 3 个，超过时用 class/namedtuple/dict 包装；断言 `assert` 不用于安全校验（`python -O` 会移除）。

违规信号：`return a, b, c, d, e`；`assert user is not None` 作为安全检查。

```python
❌ def get_user():
       return name, age, email, phone, addr   # 5 个返回值

❌ assert user is not None, "user required"   # assert 可被 -O 移除

✅ class UserInfo(object):
       def __init__(self, name, age, email, phone, addr):
           ...

   def get_user():
       return UserInfo(name, age, email, phone, addr)

✅ if user is None:
       raise ValueError("user is required")
```

---

**PY2-LANG-08** `[强制]` 禁止遍历列表时删除元素；禁止在循环中进行外部调用（API、数据库），批量查询替代；禁止循环中字符串拼接。

违规信号：`for item in items: items.remove(item)`；循环内 `db.query()`；循环内 `result += string`。

```python
❌ for item in items:
       if item.expired:
           items.remove(item)

❌ for id in ids:
       db.query("SELECT * FROM users WHERE id = %s", id)   # N+1 查询

❌ result = ""
   for s in strings:
       result += s                             # 循环中字符串拼接

✅ items = [item for item in items if not item.expired]

✅ rows = db.query("SELECT * FROM users WHERE id IN %s", tuple(ids))

✅ result = "".join(strings)
```

---

**PY2-LANG-09** `[强制]` 多行字符串用三重双引号 `"""`；禁止使用威力过大的特性（元类、字节码访问、动态继承、反射修改系统内部等）。

违规信号：`'''multi-line'''`；`type.__new__` 动态创建类；`__import__` 黑魔法。

```python
❌ text = '''line1
   line2
   line3'''                                  # 应用三重双引号

❌ MyClass = type("MyClass", (Base,), {"method": func})   # 动态类创建

✅ text = """line1
   line2
   line3"""

✅ class MyClass(Base):                      # 正常类定义
       def method(self):
           pass
```

---

## Python 2 特有

**PY2-SPEC-01** `[强制]` 字符串编码：非 ASCII 返回 utf-8；代码中禁止非 ASCII 字符；编码选择 ASCII 或 utf-8，禁止其他编码；翻译字符串用 `_(u"...")`，占位符用 `%(name)s`。

违规信号：代码中出现中文字符串未加 `u` 前缀；`_("%s")` 无命名占位符；文件编码非 UTF-8。

```python
❌ message = "操作成功"                      # Python 2 中 str 为字节串
❌ _(u"错误: %s" % errno)                   # 先格式化后翻译
❌ _(u"用户 %s 不存在")                     # 无命名占位符

✅ message = u"操作成功"                     # Unicode 字符串
✅ _(u"错误: %(errno)s") % {"errno": errno}
✅ _(u"用户 %(name)s 不存在") % {"name": username}
```

---

**PY2-SPEC-02** `[强制]` Python 2 异常：禁止 `raise MyException, "msg"` 双参数形式；捕获多异常用 `except (A, B):`；所有类继承 `object`（新式类）；后台服务禁止 `print`。

违规信号：`raise ValueError, "invalid"`；`except ValueError, TypeError:`；`class Foo:` 不继承 object；`print "debug"`。

```python
❌ raise ValueError, "invalid"                # 旧式双参数
❌ except ValueError, TypeError:              # 仅捕获 ValueError
❌ class Foo: ...                            # 经典类
❌ print "debug info"                         # Python 2 print 语句

✅ raise ValueError("invalid")
✅ except (ValueError, TypeError):
✅ class Foo(object): ...
✅ # 使用 LOG.debug() 替代 print
```

---

## 国际化

**PY2-I18N-01** `[强制]` 所有需要翻译的字符串用 `_()` 包裹；翻译词条不先格式化后包裹；中文用中文标点，英文用英文标点；分隔同类对象中文用顿号、英文用逗号。

违规信号：`_("hello %s" % name)`；中文字符串用英文逗号分隔。

```python
❌ _(u"用户 %s 登录" % username)             # 先格式化后翻译
❌ _(u"用户,管理员,访客")                   # 中文应用顿号

✅ _(u"用户 %(name)s 登录") % {"name": username}
✅ _(u"用户、管理员、访客")
```

---

## 日志

**PY2-LOG-01** `[强制]` 开发环境 DEBUG/INFO，生产环境 WARNING/ERROR/CRITICAL；错误日志带资源标识（ID 等）；后台服务禁止 `print`。

违规信号：生产环境输出 DEBUG；错误日志无上下文；使用 `print` 调试。

```python
❌ LOG.debug("processing, user=%s", user_id)  # 生产环境不应输出 debug
❌ LOG.error("operation failed")              # 无资源标识
❌ print("debug: x=%s" % x)                   # 后台服务禁止 print

✅ LOG.warning("invalid input, userId=%s", user_id)
✅ LOG.error("db query failed, sql=%s, table=%s", sql, table)
```

---

## 并发

**PY2-CONC-01** `[强制]` 父任务结束回收协程；协程内禁用阻塞函数；CPU 密集型禁用多线程用多进程；避免全局变量并发修改。

违规信号：协程未回收；协程内调用阻塞 IO；多线程处理 CPU 密集型任务；全局变量无锁保护。

```python
❌ # 协程未回收
   def parent():
       spawn(child)                           # 子协程未回收

❌ # CPU 密集型用多线程
   from threading import Thread
   for i in range(10):
       Thread(target=cpu_intensive_task).start()

✅ # 多进程处理 CPU 密集型
   from multiprocessing import Pool
   pool = Pool(4)
   pool.map(cpu_intensive_task, items)
   pool.close()
   pool.join()
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**安全**
- [ ] PY2-SEC-01 — 是否使用 eval/exec/input 处理不可信数据；是否用 os.system 拼接外部输入
- [ ] PY2-SEC-02 — SQL 是否使用参数化查询（禁止字符串拼接）
- [ ] PY2-SEC-03 — yaml 是否用 safe_load；是否用 pickle 处理不可信数据
- [ ] PY2-SEC-04 — 安全随机数是否用 os.urandom()；密钥长度是否 >= 2048
- [ ] PY2-SEC-05 — SSL verify 是否为 True；是否绑定 0.0.0.0；是否硬编码密码
- [ ] PY2-SEC-06 — XML 是否用 defusedxml；临时文件是否用 tempfile
- [ ] PY2-SEC-07 — 客户数据是否只打 DEBUG 日志；密码是否脱敏
- [ ] PY2-SEC-08 — Flask autoescape 是否为 True；是否 debug=True；Django 是否 mark_safe
- [ ] PY2-SEC-09 — 是否存在空 except / except 内 continue 吞掉异常

**异常处理**
- [ ] PY2-ERR-01 — 是否捕获过于宽泛的异常（except: / except Exception:）
- [ ] PY2-ERR-02 — 外部数据操作是否有 try/except；自定义异常是否继承 Exception
- [ ] PY2-ERR-03 — 是否使用 raise ValueError, "msg" 旧式语法或字符串异常
- [ ] PY2-ERR-04 — 捕获多异常是否用 except (A, B): 而非 except A, B:
- [ ] PY2-ERR-05 — 模块是否定义自定义异常基类

**命名规范**
- [ ] PY2-NAME-01 — 模块/类/函数/变量/常量/异常命名是否符合规范
- [ ] PY2-NAME-02 — 是否使用全局变量；同一文件命名风格是否统一
- [ ] PY2-NAME-03 — 函数名是否少于 3 字符；变量是否隐藏内置名称

**代码格式**
- [ ] PY2-FMT-01 — 缩进是否 4 空格（无 Tab）；每行是否 <= 120 列；是否有编码声明
- [ ] PY2-FMT-02 — 空行使用是否正确（类/函数间空行）
- [ ] PY2-FMT-03 — 空格规则是否正确（括号、操作符、多语句一行等）
- [ ] PY2-FMT-04 — 是否有 docstring；是否用注释屏蔽代码

**导入**
- [ ] PY2-IMPORT-01 — 是否有 import *；是否多导入同一行；是否有未使用的导入

**语言特性**
- [ ] PY2-LANG-01 — 是否使用可变对象作为函数默认值
- [ ] PY2-LANG-02 — None 比较是否用 is；序列空值是否用 if not seq:
- [ ] PY2-LANG-03 — 类型比较是否用 isinstance；多字符串拼接是否用 join
- [ ] PY2-LANG-04 — 变量是否初始化；遍历列表时是否删除元素
- [ ] PY2-LANG-05 — 是否使用字符串模块；是否多层列表推导
- [ ] PY2-LANG-06 — 三目运算符是否嵌套；lambda 是否过复杂
- [ ] PY2-LANG-07 — 返回值是否超过 3 个；assert 是否用于安全检查
- [ ] PY2-LANG-08 — 循环中是否删除列表元素；是否 N+1 查询；循环中是否字符串拼接
- [ ] PY2-LANG-09 — 多行字符串是否用三重双引号；是否使用元类/反射等威力过大特性

**Python 2 特有**
- [ ] PY2-SPEC-01 — 中文字符串是否加 u 前缀；翻译占位符是否用 %(name)s
- [ ] PY2-SPEC-02 — 是否使用 raise A, "msg" 旧式语法；类是否继承 object；是否使用 print

**国际化**
- [ ] PY2-I18N-01 — 翻译字符串是否先格式化后 _()；中文标点是否正确

**日志**
- [ ] PY2-LOG-01 — 生产环境是否输出 DEBUG；错误日志是否有资源标识；是否使用 print

**并发**
- [ ] PY2-CONC-01 — 协程是否回收；CPU 密集型是否误用多线程；全局变量是否有并发问题
