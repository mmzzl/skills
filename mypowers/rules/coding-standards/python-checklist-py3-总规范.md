# Python 3 编码规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写代码前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## Python 3 关键点

|关键点  |  Python 3 |
|--------|---------|
| 字符串 | 默认 Unicode，无需 `u` 前缀 |
| print | `print("msg")` 函数 |
| 类 |  所有类默认新式类 |
| 异常抛出 | `raise ValueError("msg")` |
| 异常捕获 | `except ValueError as e:` |
| 迭代器 | `range()` / `next(iterator)` |
| 除法 |`5/2 = 2.5` |
| 字符串格式化 | 推荐 f-strings (3.6+) |
| 类型系统 | 支持类型注解 + `typing` |
| 并发 | 推荐 `asyncio` / `async await` |

---

## 规则详情

### 编码与文件头

**PY3-ENC-01** `[强制]` 每个模块必须以 `#!/usr/bin/env python3` 开头，编码声明为 UTF-8。
违规信号：文件头缺失 shebang 或仍使用 `python` / `python2`。
```python
❌ #!/usr/bin/env python
   # coding=utf-8
❌ #!/usr/bin/env python2
✅ #!/usr/bin/env python3
   # coding=utf-8
```

---

**PY3-ENC-02** `[强制]` 代码文件编码格式必须为 UTF-8 无 BOM，换行符采用 Unix 格式（LF）。
违规信号：文件含 BOM 头、CRLF 换行符。

---

**PY3-ENC-03** `[强制]` 禁止代码中出现非 ASCII 字符（字符串内容除外）。
违规信号：标识符、注释中出现中文标点或全角字符。
```python
❌ def 获取用户(): ...
❌ # 作者：张三
✅ def get_user(): ...
✅ # author: zhangsan
```

---

### 命名规范

**PY3-NAM-01** `[强制]` 模块与包命名全部小写，允许下划线，使用名词，尽量短小。
违规信号：模块名含大写字母或过长。
```python
❌ import MyModule
❌ import user_management_system
✅ import user_mgr
```

---

**PY3-NAM-02** `[强制]` 类命名采用大驼峰（CapWords），使用名词。
违规信号：类名全小写或含下划线。
```python
❌ class user_info: ...
❌ class userInfo: ...
✅ class UserInfo: ...
```

---

**PY3-NAM-03** `[强制]` 函数命名采用动宾结构，全小写加下划线，不使用少于 3 个字符的名字。
违规信号：函数名过短、使用驼峰或不含动词。
```python
❌ def get(): ...
❌ def getUser(): ...
✅ def get_user(): ...
```

---

**PY3-NAM-04** `[强制]` 变量使用全小写加下划线，不使用单字符变量名（循环计数器 i/j/k 除外）。
违规信号：变量名为 `a` / `x` / `tmp` 等无意义单字符。
```python
❌ n = get_name()
✅ user_name = get_name()
```

---

**PY3-NAM-05** `[强制]` 常量命名使用全大写加下划线。
违规信号：常量使用小写或驼峰。
```python
❌ max_retry = 3
✅ MAX_RETRY = 3
```

---

**PY3-NAM-06** `[强制]` 异常命名使用 CapWords + Error 后缀。
违规信号：异常名无 Error 后缀或使用全小写。
```python
❌ class not_found: ...
✅ class NotFoundError(Exception): ...
```

---

**PY3-NAM-07** `[强制]` 禁止使用全局变量，采用类加静态变量的方式实现。
违规信号：模块顶层存在可变状态变量。
```python
❌ counter = 0
   def increment(): global counter; counter += 1
✅ class Counter:
       count = 0
       @classmethod
       def increment(cls): cls.count += 1
```

---

**PY3-NAM-08** `[强制]` 枚举类使用大驼峰命名，枚举值使用全大写加下划线。
```python
✅ class StatusCode(enum.Enum):
       OK = 200
       NOT_FOUND = 404
```

---

**PY3-NAM-09** `[建议]` 类型别名使用 CapWords，类型变量使用短名称，协变/逆变加后缀。
```python
✅ from typing import TypeVar
   T = TypeVar('T')
   T_co = TypeVar('T_co', covariant=True)
```

---

### 代码格式

**PY3-FMT-01** `[强制]` 缩进采用 4 个空格，不使用 Tab，禁止混用 Tab 和空格。
违规信号：缩进含 `\t` 或缩进长度非 4 的倍数。

---

**PY3-FMT-02** `[强制]` 类和顶层函数定义之间空两行；类中方法之间空一行；函数内逻辑无关段落之间空一行。
违规信号：所有定义间无空行或空行过多。

---

**PY3-FMT-03** `[强制]` 每行代码不允许超过 120 列；建议通过优化代码缩短行长度，换行建议用圆括号隐式续行。
违规信号：行长度超过 120 字符且未换行。
```python
❌ result = some_function(arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9, arg10)
✅ result = some_function(
       arg1, arg2, arg3, arg4, arg5,
       arg6, arg7, arg8, arg9, arg10,
   )
```

---

**PY3-FMT-04** `[强制]` 各种右括号前不要加空格；逗号、冒号、分号前不要加空格。
违规信号：`) ` / `, ` / `: ` 前出现空格。
```python
❌ func( a, b )
✅ func(a, b)
```

---

**PY3-FMT-05** `[强制]` 函数和序列的左括号前不要加空格；操作符左右各加一个空格。
违规信号：`func (` / `list [0]` / `a+b`。
```python
❌ func (1)
❌ list [0]
❌ a+b
✅ func(1)
✅ list[0]
✅ a + b
```

---

**PY3-FMT-06** `[强制]` 函数默认参数使用的赋值符左右省略空格；不要将多句语句写在同一行。
违规信号：`def f(a = 1):` / `a = 1; b = 2`。
```python
❌ def f(a = 1, b = 2): ...
❌ a = 1; b = 2
✅ def f(a=1, b=2): ...
✅ a = 1
   b = 2
```

---

**PY3-FMT-07** `[强制]` if / for / while 语句中，即使执行语句只有一句，也必须另起一行。
违规信号：单行条件体写在同一行。
```python
❌ if x: return True
✅ if x:
       return True
```

---

### 注释与文档

**PY3-DOC-01** `[强制]` 模块、类、函数必须使用文档字符串（docstring）说明功能和参数。
违规信号：公共接口无 docstring。
```python
❌ def calculate(a, b): return a + b
✅ def calculate(a: int, b: int) -> int:
       """计算两个整数的和。

       Args:
           a: 被加数
           b: 加数

       Returns:
           两数之和
       """
       return a + b
```

---

**PY3-DOC-02** `[强制]` 文件头部注释需包含功能说明和作者信息；行注释放在行上方，不推荐行尾注释。
违规信号：行尾注释或文件头缺失。
```python
❌ x = 1  # 初始化计数器
✅ # 初始化计数器
   x = 1
```

---

**PY3-DOC-03** `[强制]` 禁止用注释屏蔽无用代码，应直接删除。
违规信号：代码中存在被注释掉的旧代码块。
```python
❌ # old_func()
   # result = old_func()
✅ （直接删除无用代码）
```

---

**PY3-DOC-04** `[建议]` TODO / FIXME / XXX 注释使用标准格式：`# TODO(作者名): 描述`。
```python
✅ # TODO(alice): 支持批量操作
   # FIXME(bob): 处理边界条件
   # XXX(carol): 考虑性能优化
```

---

### 导入规范

**PY3-IMP-01** `[强制]` 禁止使用 `import *`、`from A import *`；每个导入独占一行。
违规信号：`import os, sys` / `from module import *`。
```python
❌ import os, sys
❌ from module import *
✅ import os
   import sys
   from module import specific_func
```

---

**PY3-IMP-02** `[强制]` 不要导入不使用的模块；导入时使用完整包名，禁止使用相对导入。
违规信号：存在未使用的 import 或 `from . import module`。
```python
❌ import json  # 未使用
❌ from . import utils
✅ from mypkg.utils import helper
```

---

**PY3-IMP-03** `[建议]` 导入按顺序排列：标准库 → 第三方库 → 自己的库，每组之间空一行。
```python
✅ import os
   import sys

   import requests

   from mypkg import utils
```

---

### 异常处理

**PY3-EXC-01** `[强制]` 禁止使用空 `except:` 捕获所有异常；禁止捕获过于宽泛的 `Exception`（最外层兜底或重新抛出除外）。
违规信号：`except:` / `except Exception:` 未重新抛出。
```python
❌ except:
       pass
❌ except Exception as e:
       LOG.error("failed")
✅ except ValueError as e:
       LOG.error("Invalid value, error=%s", str(e))
```

---

**PY3-EXC-02** `[强制]` 抛出异常使用 `raise ValueError("msg")`，禁止使用旧式双参数语法。
违规信号：`raise ValueError, "msg"`。
```python
❌ raise ValueError, "invalid"
✅ raise ValueError("invalid")
```

---

**PY3-EXC-03** `[强制]` 捕获多个异常使用 `except (A, B) as e:`，必须使用 `as` 关键字绑定异常对象。
违规信号：`except ValueError, e:` / `except (A, B):` 无 as。
```python
❌ except ValueError, e:
❌ except (ValueError, TypeError):
✅ except (ValueError, TypeError) as e:
       LOG.error("Validation failed, error=%s", str(e))
```

---

**PY3-EXC-04** `[强制]` 模块或包应当定义自己的异常基类，继承自内置的 `Exception`。
违规信号：自定义异常直接继承 `BaseException` 或未定义基类。
```python
❌ class MyError(BaseException): ...
✅ class MyPkgError(Exception): ...
   class ConfigError(MyPkgError): ...
```

---

**PY3-EXC-05** `[强制]` 对于处理从外部读取的数据（文件、数据库、网络等），必须增加 try/except 防止程序异常退出。
违规信号：IO / RPC 操作无异常处理。
```python
❌ data = json.load(open(path))
✅ try:
       with open(path) as f:
           data = json.load(f)
   except (IOError, json.JSONDecodeError) as e:
       LOG.error("Load config failed, path=%s, error=%s", path, str(e))
       raise ConfigError("config load failed") from e
```

---

**PY3-EXC-06** `[建议]` 使用 `raise from` 保留原始异常信息；使用 `finally` 确保资源清理。
```python
✅ try:
       conn = create_connection()
       return conn.query(sql)
   except ConnectionError as e:
       raise QueryError("DB query failed") from e
   finally:
       conn.close()
```

---

**PY3-EXC-07** `[强制]` 禁止在 except 里写 `continue` 忽略异常，必须对每个异常捕获并输出错误信息。
违规信号：`except ...: continue` 无日志记录。
```python
❌ for item in items:
       try:
           process(item)
       except ValueError:
           continue
✅ for item in items:
       try:
           process(item)
       except ValueError as e:
           LOG.warning("Skip invalid item, itemId=%s, error=%s", item.id, str(e))
```

---

### 字符串处理

**PY3-STR-01** `[强制]` Python 3 默认 Unicode 字符串，不需要 `u` 前缀；禁止混用字节和字符串。
违规信号：`u"str"` / `b"str".decode()` 不必要的编码转换。
```python
❌ name = u"张三"
❌ if isinstance(s, unicode): ...
✅ name = "张三"
✅ if isinstance(s, str): ...
```

---

**PY3-STR-02** `[强制]` 多于 2 个字符串的拼接禁止使用 `+`，应使用 `join`；不要在循环中用 `+=` 累加字符串。
违规信号：循环内字符串拼接或大量 `+` 连接。
```python
❌ result = ""
   for s in strings:
       result += s
❌ path = dir + "/" + filename + "." + ext
✅ result = "".join(strings)
✅ path = "/".join([dir, filename + "." + ext])
```

---

**PY3-STR-03** `[强制]` 多行字符串使用三重双引号 `"""`；使用 `startswith()` / `endswith()` 而非字符切片检测前缀/后缀。
违规信号：`'''multi-line'''` / `s[:3] == "abc"`。
```python
❌ s = '''line1
       line2'''
❌ if s[:3] == "abc": ...
✅ s = """line1
       line2"""
✅ if s.startswith("abc"): ...
```

---

**PY3-STR-04** `[建议]` 推荐使用 f-strings（Python 3.6+）进行字符串格式化；复杂场景可用 `str.format()`。
违规信号：过度使用 `%` 格式化或字符串拼接。
```python
❌ "Hello, %s" % name
❌ "Hello, " + name
✅ f"Hello, {name}"
✅ "Hello, {}".format(name)
```

---

### 语言特性

**PY3-LANG-01** `[强制]` print 是函数，必须使用 `print()` 语法；后台服务禁止使用 print 打印调试信息。
违规信号：`print "msg"` / `print msg` / 服务代码中使用 print。
```python
❌ print "hello"
❌ print msg
✅ print("hello")
✅ LOG.info("hello")
```

---

**PY3-LANG-02** `[强制]` 所有类默认都是新式类，不需要显式继承 `object`。
违规信号：`class MyClass(object):`（冗余，虽不违规但建议省略）。
```python
❌ class MyClass(object): ...
✅ class MyClass: ...
```

---

**PY3-LANG-03** `[强制]` 使用 `range()` 代替 `xrange()`；使用 `next(iterator)` 代替 `iterator.next()`。
违规信号：代码中出现 `xrange` / `.next()`。
```python
❌ for i in xrange(10): ...
❌ value = iterator.next()
✅ for i in range(10): ...
✅ value = next(iterator)
```

---

**PY3-LANG-04** `[强制]` 简单场景可使用列表推导，mapping/loop/filter 部分单独成行且最多一行，禁止多层 loop 或 filter。
违规信号：嵌套列表推导或条件过于复杂。
```python
❌ result = [f(x) for x in items if g(x) for y in x if h(y)]
✅ result = [
       transform(x)
       for x in items
       if is_valid(x)
   ]
```

---

**PY3-LANG-05** `[强制]` 条件表达式仅用于一行之内，禁止嵌套使用。
违规信号：多层三元表达式。
```python
❌ result = a if x else b if y else c if z else d
✅ result = a if x else default_value
```

---

**PY3-LANG-06** `[强制]` 可以使用 `property`，但禁止在派生类里改写 property 实现。
违规信号：子类中重写父类的 `@property` 方法。

---

**PY3-LANG-07** `[强制]` 尽可能使用隐式的 false；永远不要用 `==` 或 `!=` 比较单件（如 `None`），使用 `is` 或 `is not`。
违规信号：`if x == None` / `if x == True` / `if len(seq) == 0`。
```python
❌ if x == None: ...
❌ if x == True: ...
❌ if len(seq) == 0: ...
✅ if x is None: ...
✅ if x: ...
✅ if not seq: ...
```

---

**PY3-LANG-08** `[强制]` 对于常见操作符，使用 `operator` 模块中的函数代替 lambda。
违规信号：`lambda x, y: x * y`。
```python
❌ from functools import reduce
   reduce(lambda x, y: x * y, nums)
✅ from operator import mul
   from functools import reduce
   reduce(mul, nums)
```

---

**PY3-LANG-09** `[强制]` 对象类型比较必须使用 `isinstance()` 而非直接比较 `type()`。
违规信号：`type(obj) == dict`。
```python
❌ if type(obj) == dict: ...
✅ if isinstance(obj, dict): ...
```

---

**PY3-LANG-10** `[强制]` 遍历列表或数组时，不允许删除列表或数组里面的元素。
违规信号：`for` 循环体内 `list.remove()` / `del list[i]`。
```python
❌ for item in items:
       if should_remove(item):
           items.remove(item)
✅ items = [item for item in items if not should_remove(item)]
```

---

**PY3-LANG-11** `[强制]` 不要使用可变对象作为函数默认值（列表、字典等）；不要使用在定义时求值的默认参数（如 `now=time.time()`）。
违规信号：`def f(a=[])` / `def f(t=time.time())`。
```python
❌ def append_item(item, items=[]):
       items.append(item)
       return items
❌ def log(msg, t=time.time()):
       ...
✅ def append_item(item, items=None):
       if items is None:
           items = []
       items.append(item)
       return items
```

---

**PY3-LANG-12** `[强制]` 函数返回值必须小于等于 3 个；3 个以上时必须通过 class / namedtuple / dict 等具名形式包装。
违规信号：函数返回 4 个以上无名字段。
```python
❌ def get_user():
       return uid, name, email, phone, addr
✅ from typing import NamedTuple
   class UserInfo(NamedTuple):
       uid: int
       name: str
       email: str
       phone: str
       addr: str
   def get_user() -> UserInfo: ...
```

---

**PY3-LANG-13** `[建议]` 推荐使用类型注解（Python 3.5+）为公共函数添加类型提示，使用 `typing` 模块定义复杂类型。
```python
✅ from typing import List, Optional, Dict
   def process_users(
       users: List[Dict[str, str]],
       threshold: Optional[int] = None,
   ) -> Dict[str, int]: ...
```

---

**PY3-LANG-14** `[建议]` 支持关键字参数（`*` 后的参数必须为关键字参数），增强接口可读性。
```python
✅ def connect(host: str, port: int, *, timeout: float = 30.0) -> Connection:
       """timeout 必须通过关键字传入。"""
```

---

**PY3-LANG-15** `[建议]` 使用字典推导式和集合推导式替代循环构造。
```python
❌ result = {}
   for k, v in items:
       if v > 0:
           result[k] = v
✅ result = {k: v for k, v in items if v > 0}
```

---

**PY3-LANG-16** `[建议]` 使用 `yield from`（Python 3.3+）委托子生成器，简化嵌套生成器。
```python
❌ def combined():
       for item in subgen1():
           yield item
       for item in subgen2():
           yield item
✅ def combined():
       yield from subgen1()
       yield from subgen2()
```

---

**PY3-LANG-17** `[建议]` `super()` 可以不带参数调用（Python 3）。
```python
❌ super(MyClass, self).__init__()
✅ super().__init__()
```

---

### 参数与数据有效性

**PY3-VAL-01** `[强制]` 作为模块间接口的函数，必须检查所有参数的有效性，并执行合适的错误处理。
违规信号：公共函数直接操作参数未校验。
```python
❌ def divide(a, b):
       return a / b
✅ def divide(a: float, b: float) -> float:
       if b == 0:
           raise ValueError("divisor cannot be zero")
       return a / b
```

---

**PY3-VAL-02** `[强制]` 所有从模块外部读取的数据（文件、数据库、网络、命令行等），必须先检查有效性，并执行合适的错误处理。
违规信号：外部输入直接用于 SQL / 命令 / 路径拼接。

---

**PY3-VAL-03** `[建议]` 函数参数个数不能超过 5 个，超过时采用对象或字典形式传递。
```python
❌ def create_user(a, b, c, d, e, f, g): ...
✅ def create_user(config: UserConfig): ...
```

---

### 并发编程

**PY3-CONC-01** `[建议]` Python 多线程受 GIL 限制，IO 密集型推荐 `asyncio` / `async await`（Python 3.5+）代替多线程。
违规信号：大量线程创建或线程锁密集竞争。
```python
❌ import threading
   def fetch_all(urls):
       threads = [threading.Thread(target=fetch, args=(u,)) for u in urls]
       for t in threads: t.start()
       for t in threads: t.join()
✅ import asyncio
   import aiohttp
   async def fetch_all(urls):
       async with aiohttp.ClientSession() as session:
           tasks = [fetch(session, u) for u in urls]
           return await asyncio.gather(*tasks)
```

---

**PY3-CONC-02** `[强制]` 父任务结束时必须回收协程，避免资源泄漏；协程内禁用阻塞函数，使用异步版本替代。
违规信号：`async def` 内调用 `time.sleep()` / `requests.get()` 等同步阻塞函数。
```python
❌ async def fetch(url):
       import requests
       return requests.get(url)  # 阻塞！
✅ async def fetch(url):
       import aiohttp
       async with aiohttp.ClientSession() as session:
           async with session.get(url) as resp:
               return await resp.text()
```

---

**PY3-CONC-03** `[强制]` CPU 密集型任务禁用多线程，应使用多进程。
违规信号：CPU 计算密集任务使用 threading。
```python
❌ import threading
   threads = [threading.Thread(target=heavy_compute) for _ in range(4)]
✅ from multiprocessing import Pool
   with Pool(4) as p:
       p.map(heavy_compute, tasks)
```

---

**PY3-CONC-04** `[强制]` 避免全局变量的并发修改；大对象频繁更新禁用 `multiprocessing`，应使用共享内存或其他机制。

---

### 安全编程

**PY3-SEC-01** `[强制]` 禁止硬编码密码、Token 和敏感信息；禁止对 `0.0.0.0` 地址进行绑定。
违规信号：代码中出现明文密码或 `app.run(host='0.0.0.0')`。
```python
❌ PASSWORD = "admin123"
❌ app.run(host='0.0.0.0', debug=True)
✅ PASSWORD = os.getenv("DB_PASSWORD")
✅ app.run(host='127.0.0.1')
```

---

**PY3-SEC-02** `[强制]` `eval` 可导致命令注入，使用 `ast.literal_eval` 代替；禁止使用 Linux 命令通配符。
违规信号：代码中使用 `eval()` / `exec()` / `os.system()` 处理不可信输入。
```python
❌ result = eval(user_input)
✅ import ast
   result = ast.literal_eval(user_input)
```

---

**PY3-SEC-03** `[强制]` 使用 `tempfile` 创建临时文件，不要在 `/tmp`、`/var/tmp`、`/dev/shm` 中创建临时文件，创建后记得删除。
违规信号：`open('/tmp/abc', 'w')`。
```python
❌ f = open('/tmp/abc', 'w')
✅ import tempfile
   with tempfile.NamedTemporaryFile(delete=True) as f:
       f.write(data)
```

---

**PY3-SEC-04** `[强制]` `random` 模块中的随机数为伪随机数，不能用于安全加密，使用 `os.urandom()` 或 `secrets` 模块。
违规信号：`random.choice()` / `random.randint()` 用于密码学场景。
```python
❌ import random
   token = ''.join(random.choices(chars, k=32))
✅ import secrets
   token = secrets.token_urlsafe(32)
```

---

**PY3-SEC-05** `[强制]` 不使用系统自带的 xml 库解析不可信数据，使用 `defusedxml`；不使用 `pickle` 反序列化不可信数据。
违规信号：`import xml.etree.ElementTree` 处理外部 XML / `pickle.loads()` 处理网络数据。
```python
❌ import xml.etree.ElementTree as ET
   ET.parse(untrusted_xml)
❌ import pickle
   pickle.loads(network_data)
✅ import defusedxml.ElementTree as ET
✅ import json
   json.loads(network_data)
```

---

**PY3-SEC-06** `[强制]` `requests` 使用时必须开启 SSL 认证（`verify=True`）；使用高版本 SSL 协议，禁止低版本。
违规信号：`requests.get(url, verify=False)`。
```python
❌ requests.get('https://api.example.com', verify=False)
✅ requests.get('https://api.example.com', verify=True)
```

---

**PY3-SEC-07** `[强制]` 不使用 `yaml.load` 反序列化，使用 `yaml.safe_load`；不使用 SQL 字符串拼接，使用参数化查询。
违规信号：`yaml.load(data)` / `"SELECT %s FROM table" % var`。
```python
❌ yaml.load(untrusted_data)
❌ cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)
✅ yaml.safe_load(untrusted_data)
✅ cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

---

**PY3-SEC-08** `[强制]` Flask 模板 `jinja2` 的 `autoescape` 必须设为 `True`，禁止关闭自动转义；禁止开启 debug 模式。
违规信号：`app.run(debug=True)` / `autoescape=False`。

---

**PY3-SEC-09** `[强制]` 涉及客户数据的内容只允许打 debug 日志，不能打 info 及以上；用户明文密码不得直接打到日志中。
违规信号：`LOG.info("user password=%s", password)`。
```python
❌ LOG.info("User login, password=%s", password)
✅ LOG.debug("User login, userId=%s", user_id)
```

---

**PY3-SEC-10** `[强制]` 避免以 root 权限执行；不要使用 `assert` 做安全校验（`python -O` 会移除断言）。
违规信号：`assert user.is_admin` 作为权限检查。
```python
❌ assert user.is_admin, "Permission denied"
✅ if not user.is_admin:
       raise PermissionError("Permission denied")
```

---

### 日志规范

**PY3-LOG-01** `[强制]` 开发环境可使用 DEBUG 或 INFO 级别日志；生产环境应使用 WARNING 或更高级别。
违规信号：`logging.basicConfig(level=logging.DEBUG)` 未做环境判断。
```python
❌ logging.basicConfig(level=logging.DEBUG)
✅ import os
   level = logging.DEBUG if os.getenv("ENV") == "dev" else logging.INFO
   logging.basicConfig(level=level)
```

---

**PY3-LOG-02** `[强制]` 错误日志（含异常日志）需要带操作的资源信息（ID 等）；后台服务不允许使用 print 打印调试信息。
违规信号：`LOG.error("failed")` 无上下文 / 代码中使用 `print`。
```python
❌ LOG.error("Query failed")
❌ print("debug info")
✅ LOG.error("Query failed, table=%s, queryId=%s", table, query_id)
✅ LOG.debug("debug info")
```

---

### 性能优化

**PY3-PERF-01** `[强制]` 避免循环中字符串拼接，使用 `join` 方法。
```python
❌ result = ""
   for s in data:
       result += s
✅ result = "".join(data)
```

---

**PY3-PERF-02** `[建议]` 频繁 `in` 运算避免使用列表，应使用集合或字典；合理选择数据结构。
```python
❌ if item in large_list: ...  # O(n)
✅ item_set = set(large_list)
   if item in item_set: ...    # O(1)
```

---

**PY3-PERF-03** `[建议]` 使用列表推导式替代简单循环；减少循环内的函数调用；避免在循环中创建不必要的对象。
```python
❌ result = []
   for x in items:
       result.append(transform(x))
✅ result = [transform(x) for x in items]
```

---

**PY3-PERF-04** `[建议]` 当返回较长列表数据时建议使用 `yield` 和 generator 函数。
```python
❌ def read_large_file(path):
       return [line for line in open(path)]
✅ def read_large_file(path):
       for line in open(path):
           yield line.strip()
```

---

### 第三方库与工具

**PY3-TOOL-01** `[强制]` 对第三方库有改动时，改动的代码需要遵守此编码规范；未改动的代码需进行代码扫描，安全特性和 bug 类型问题需要修改。

---

**PY3-TOOL-02** `[建议]` 推荐使用 `black`、`isort`、`flake8`、`pylint` 等工具进行代码格式化和检查。
配置建议：最大行长度 120 字符，忽略特定规则如 E501、E302。

---

### 国际化

**PY3-I18N-01** `[强制]` 翻译中英文使用英文标点，中文使用中文标点；分隔同类对象时中文用顿号，英文用逗号。

---

**PY3-I18N-02** `[强制]` 所有需要翻译的字符串都需要用 `_()` 包裹；翻译词条不应为格式化后的字符串；禁止使用 `%s` 占位符，使用 `%(name)s` 命名占位符。
违规信号：`_("error: %s" % code)` / `_("error: %s")`。
```python
❌ _(u"未知错误！errno: %s" % errno)
❌ _("Error: %s")
✅ _("Error: %(errno)s") % {"errno": errno}
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**编码与文件头**
- [ ] PY3-ENC-01 — 文件头是否为 `#!/usr/bin/env python3`
- [ ] PY3-ENC-02 — 编码是否为 UTF-8 无 BOM，换行符是否为 LF
- [ ] PY3-ENC-03 — 是否存在非 ASCII 标识符或注释

**命名规范**
- [ ] PY3-NAM-01 — 模块名是否全小写
- [ ] PY3-NAM-02 — 类名是否大驼峰
- [ ] PY3-NAM-03 — 函数名是否小写加下划线、动宾结构
- [ ] PY3-NAM-04 — 变量名是否全小写加下划线、非单字符
- [ ] PY3-NAM-05 — 常量是否全大写加下划线
- [ ] PY3-NAM-06 — 异常名是否 CapWords + Error
- [ ] PY3-NAM-07 — 是否存在全局变量（应改为类静态变量）
- [ ] PY3-NAM-08 — 枚举类/值命名是否规范

**代码格式**
- [ ] PY3-FMT-01 — 缩进是否为 4 空格、无 Tab
- [ ] PY3-FMT-02 — 空行使用是否合理
- [ ] PY3-FMT-03 — 行长度是否超过 120 列
- [ ] PY3-FMT-04 — 右括号/逗号/冒号前是否有空格
- [ ] PY3-FMT-05 — 左括号前是否有空格、操作符是否左右加空格
- [ ] PY3-FMT-06 — 默认参数赋值符是否有空格、是否多语句同行
- [ ] PY3-FMT-07 — if/for/while 单语句是否另起一行

**注释与文档**
- [ ] PY3-DOC-01 — 模块/类/函数是否有 docstring
- [ ] PY3-DOC-02 — 文件头是否有功能说明和作者信息
- [ ] PY3-DOC-03 — 是否存在被注释屏蔽的无用代码
- [ ] PY3-DOC-04 — TODO/FIXME/XXX 格式是否标准

**导入规范**
- [ ] PY3-IMP-01 — 是否禁止 `import *`、是否每导入独占一行
- [ ] PY3-IMP-02 — 是否存在未使用的导入、是否使用相对导入
- [ ] PY3-IMP-03 — 导入顺序是否标准库→第三方→自己

**异常处理**
- [ ] PY3-EXC-01 — 是否禁止空 except / 是否避免捕获过于宽泛的 Exception
- [ ] PY3-EXC-02 — 异常抛出是否使用 `raise ValueError("msg")`
- [ ] PY3-EXC-03 — 捕获多异常是否使用 `except (A, B) as e:`
- [ ] PY3-EXC-04 — 自定义异常是否继承自 Exception
- [ ] PY3-EXC-05 — 外部 IO/RPC 操作是否有 try/except
- [ ] PY3-EXC-06 — 是否使用 raise from / finally 清理资源
- [ ] PY3-EXC-07 — except 中是否有 continue 忽略异常

**字符串处理**
- [ ] PY3-STR-01 — 是否默认 Unicode、是否不必要的 `u` 前缀
- [ ] PY3-STR-02 — 多字符串拼接是否使用 `+` 或循环 `+=`
- [ ] PY3-STR-03 — 多行字符串是否用 `"""`、是否用切片检测前缀/后缀
- [ ] PY3-STR-04 — 字符串格式化是否推荐 f-strings

**语言特性**
- [ ] PY3-LANG-01 — print 是否为函数调用、服务是否使用 print
- [ ] PY3-LANG-02 — 类是否显式继承 object（冗余）
- [ ] PY3-LANG-03 — 是否使用 `xrange` / `.next()`
- [ ] PY3-LANG-04 — 列表推导是否嵌套或多层
- [ ] PY3-LANG-05 — 条件表达式是否嵌套
- [ ] PY3-LANG-06 — 派生类是否改写 property
- [ ] PY3-LANG-07 — 是否用 `== None` / `== True` / `len(seq) == 0`
- [ ] PY3-LANG-08 — 是否可用 operator 代替 lambda
- [ ] PY3-LANG-09 — 类型比较是否用 `isinstance()`
- [ ] PY3-LANG-10 — 遍历中是否删除列表元素
- [ ] PY3-LANG-11 — 是否使用可变默认参数 / 定义时求值默认参数
- [ ] PY3-LANG-12 — 函数返回值是否超过 3 个未包装
- [ ] PY3-LANG-13 — 公共函数是否添加类型注解
- [ ] PY3-LANG-14 — 关键字参数是否使用 `*` 分隔
- [ ] PY3-LANG-15 — 字典/集合构造是否可用推导式
- [ ] PY3-LANG-16 — 嵌套生成器是否可用 `yield from`
- [ ] PY3-LANG-17 — `super()` 是否带冗余参数

**参数与数据有效性**
- [ ] PY3-VAL-01 — 接口函数是否校验参数有效性
- [ ] PY3-VAL-02 — 外部输入数据是否校验有效性
- [ ] PY3-VAL-03 — 函数参数是否超过 5 个未封装

**并发编程**
- [ ] PY3-CONC-01 — 是否应使用 asyncio 代替多线程
- [ ] PY3-CONC-02 — 协程内是否调用阻塞函数
- [ ] PY3-CONC-03 — CPU 密集型是否误用多线程
- [ ] PY3-CONC-04 — 是否存在全局变量并发修改

**安全编程**
- [ ] PY3-SEC-01 — 是否存在硬编码密码/Token、是否绑定 0.0.0.0
- [ ] PY3-SEC-02 — 是否使用 eval/exec/os.system 处理不可信输入
- [ ] PY3-SEC-03 — 临时文件是否使用 tempfile、是否手动操作 /tmp
- [ ] PY3-SEC-04 — 安全随机数是否使用 random 模块
- [ ] PY3-SEC-05 — 是否使用系统 xml/pickle 处理不可信数据
- [ ] PY3-SEC-06 — requests 是否关闭 SSL 验证
- [ ] PY3-SEC-07 — 是否使用 yaml.load / SQL 字符串拼接
- [ ] PY3-SEC-08 — Flask autoescape 是否关闭、debug 是否开启
- [ ] PY3-SEC-09 — 敏感信息是否误打 info 及以上日志
- [ ] PY3-SEC-10 — 是否用 assert 做安全校验、是否 root 执行

**日志规范**
- [ ] PY3-LOG-01 — 日志级别是否通过环境变量控制
- [ ] PY3-LOG-02 — 错误日志是否含资源信息、是否使用 print

**性能优化**
- [ ] PY3-PERF-01 — 循环中是否有字符串拼接
- [ ] PY3-PERF-02 — 频繁 in 运算是否使用列表
- [ ] PY3-PERF-03 — 简单循环是否可用列表推导、循环内是否创建不必要对象
- [ ] PY3-PERF-04 — 长列表返回是否可用生成器

**第三方库与工具**
- [ ] PY3-TOOL-01 — 第三方库改动是否遵循规范、未改动是否扫描安全
- [ ] PY3-TOOL-02 — 是否使用 black/flake8/pylint 等工具

**国际化**
- [ ] PY3-I18N-01 — 翻译标点是否规范
- [ ] PY3-I18N-02 — 翻译字符串是否用 `_()`、是否用 `%s` 占位符
