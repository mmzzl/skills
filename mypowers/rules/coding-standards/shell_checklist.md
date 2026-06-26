# Shell 编码规范

## 用途

本文档供 AI 执行两类任务：**代码生成**（写 Shell 脚本前对照规则）、**代码 Review**（逐条扫描输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## 风格规范

**SHELL-STYLE-01** `[强制]` 函数命名使用全小写下划线或混合大小写，禁止全大写或少于 3 字符；同一源文件中命名风格必须统一。

违规信号：函数名全大写（`MY_FUNC`）；函数名少于 3 字符（`f`）；同一文件中混用 `my_func` 和 `myFunc`。

```bash
❌ MY_FUNC() { ... }                        # 全大写
❌ f() { ... }                               # 少于 3 字符

# 同文件中混用
❌ my_func() { ... }
   myFunc() { ... }                          # 命名风格不一致

✅ my_function() { ... }                     # 全小写下划线
✅ myFunction() { ... }                      # 混合大小写（驼峰）
```

---

**SHELL-STYLE-02** `[强制]` 条件、循环和函数必须使用缩进，缩进为 4 个空格或一个 TAB，同一源文件中保持一致。

违规信号：同一文件中混用空格和 TAB；`if` / `for` / `while` 体内无缩进。

```bash
❌ if [ "$x" = "1" ]; then
echo "yes"                                    # 无缩进
fi

❌ # 同文件中混用空格和 TAB
   if [ "$x" = "1" ]; then
   	echo "yes"                              # TAB 缩进
   fi
   if [ "$y" = "2" ]; then
       echo "no"                              # 4 空格缩进
   fi

✅ if [ "$x" = "1" ]; then
       echo "yes"                             # 统一 4 空格缩进
   fi
```

---

**SHELL-STYLE-03** `[强制]` 源文件头部注释说明用途、注意事项及作者/修改者信息；函数头部注释功能、参数、返回值；调用的外部命令注释用途及参数。

违规信号：源文件无头部注释；函数无头部注释；调用外部命令（如 `awk`、`sed`、`grep`）无注释说明。

```bash
❌ #!/bin/bash
   # 无任何头部注释
   my_func() {
       grep "$pattern" "$file"               # 无注释说明 grep 用途
   }

✅ #!/bin/bash
   # 用途：批量处理日志文件，提取错误关键字并生成汇总报告
   # 注意事项：输入目录需有读权限，输出目录需有写权限
   # 作者: zhangsan
   # 修改者: lisi — 2024-03-15: 新增按日期过滤功能

   # 功能：从日志文件中提取包含关键字的行
   # 参数：$1=关键字, $2=日志文件路径
   # 返回值：0=成功, 1=文件不存在, 2=关键字为空
   extract_errors() {
       local keyword="$1"
       local logfile="$2"
       # grep: 搜索含关键字的行，-i 忽略大小写
       grep -i "$keyword" "$logfile"
   }
```

---

**SHELL-STYLE-04** `[强制]` 每个函数长度不超过 50 行。

违规信号：函数体超过 50 行；函数承担多个职责（应拆分为多个子函数）。

```bash
❌ my_func() {
       # 第1行 ...
       # ...
       # 第60行 — 函数过长，职责过多
   }

✅ my_func() {
       _validate_input "$@"
       _process_data
       _output_result
   }
```

---

**SHELL-STYLE-05** `[强制]` 函数入口用有意义的变量名替代 `$1`、`$2` 等占位符；单参数函数可例外。

违规信号：函数体内直接使用 `$1`、`$2` 而无常量赋值；变量名无意义。

```bash
❌ process_file() {
       cat "$1" | grep "$2"                   # $1 $2 含义不明
   }

✅ process_file() {
       local filename="$1"                     # 单参数可例外：直接用 $1
       cat "$filename"
   }

✅ process_log() {
       local logfile="$1"
       local pattern="$2"
       local output_dir="$3"
       grep "$pattern" "$logfile" > "$output_dir/result.txt"
   }
```

---

## 错误处理

**SHELL-ERR-01** `[强制]` 检查所有来自外部的参数有效性，发现无效参数时执行合理的错误处理并阻止其进入后续流程。

违规信号：未检查参数个数；未检查参数是否为空；未验证参数格式；无效参数直接进入后续处理。

```bash
❌ process_file() {
       local file="$1"
       cat "$file"                            # 未检查 $1 是否存在/是否为空
   }

✅ process_file() {
       local file="$1"
       if [ -z "$file" ]; then
           echo "错误: 参数缺失，请提供文件路径" >&2
           return 1
       fi
       if [ ! -f "$file" ]; then
           echo "错误: 文件不存在: $file" >&2
           return 2
       fi
       cat "$file"
   }
```

---

**SHELL-ERR-02** `[强制]` 检查所有从模块外部读取的数据有效性并执行合适的错误处理，避免不合法数据进入后续流程。

违规信号：读取文件未检查文件是否存在；读取配置未校验格式；从网络/管道读取数据未验证。

```bash
❌ read_config() {
       local config="$(cat /etc/myapp.conf)"   # 未检查文件是否存在
       eval "$config"                          # 危险：未校验直接 eval
   }

✅ read_config() {
       local config_file="/etc/myapp.conf"
       if [ ! -f "$config_file" ]; then
           echo "错误: 配置文件不存在: $config_file" >&2
           return 1
       fi
       # 校验配置格式后再使用
       local config
       config="$(cat "$config_file")"
       if [ -z "$config" ]; then
           echo "错误: 配置文件为空" >&2
           return 2
       fi
   }
```

---

**SHELL-ERR-03** `[强制]` 检查所有命令的返回值，失败时执行合适的错误处理；影响程序逻辑的命令不得忽略（例外需注释说明）。

违规信号：关键命令后无返回值检查；`cd`、`mkdir`、`rm` 等影响逻辑的命令未检查 `$?`。

```bash
❌ mkdir "$output_dir"                        # 未检查是否创建成功
   cd "$output_dir"                           # 未检查是否切换成功
   process_data

✅ if ! mkdir -p "$output_dir"; then
       echo "错误: 无法创建目录: $output_dir" >&2
       return 1
   fi
   if ! cd "$output_dir"; then
       echo "错误: 无法进入目录: $output_dir" >&2
       return 2
   fi
   process_data

✅ # 返回值不影响逻辑，忽略（注释说明）
   # 清理临时文件，失败不影响主流程
   rm -f "$temp_file" || true
```

---

## 语言特性

**SHELL-LANG-01** `[强制]` 未明确为全局的变量必须先定义后使用，使用 `local` 定义局部变量以防误引用。

违规信号：函数内直接赋值未声明变量；函数内修改的变量影响外部同名变量。

```bash
❌ my_func() {
       temp="value"                           # 未声明，可能污染外部 temp 变量
   }

✅ my_func() {
       local temp="value"                     # 局部变量，不影响外部
   }
```

---

**SHELL-LANG-02** `[强制]` 比较字符串时防止变量为空，使用带引号或前缀 `x` 的比较形式。

违规信号：`[ $foo = bar ]` 变量未加引号；变量可能为空导致语法错误。

```bash
❌ [ $foo = "bar" ]                           # foo 为空时变成 [ = bar ]，语法错误

✅ [ "$foo" = "bar" ]                         # 变量加引号
✅ [ "x$foo" = "xbar" ]                       # 前缀 x 比较
```

---

**SHELL-LANG-03** `[强制]` 使用 `[` 测试时在 `[` 和 `]` 及参数间加入空格，且不要在 `[]` 内部使用 `&&`。

违规信号：`[$foo=bar]` 缺少空格；`[ $foo = bar ]` 内使用 `&&`。

```bash
❌ [$foo=bar]                                 # 缺少空格
❌ [ $foo=bar ]                               # 参数间缺少空格
❌ [ $foo = bar ] && [ $baz = qux ]            # [] 内部使用 &&

✅ [ "$foo" = "bar" ]                         # 空格正确
✅ [ "$foo" = "bar" ] && [ "$baz" = "qux" ]   # && 在 [] 外部
```

---

**SHELL-LANG-04** `[强制]` 避免在管道中的多个命令读写同一文件，防止因执行顺序不确定造成数据损坏。

违规信号：`cat file | sed ... > file` 读写同一文件；管道中多个命令操作同一文件。

```bash
❌ cat file.txt | sed 's/foo/bar/g' > file.txt    # 文件可能变为空

✅ sed 's/foo/bar/g' file.txt > temp.txt && mv temp.txt file.txt
```

---

**SHELL-LANG-05** `[强制]` 赋值时在等号两侧不加空格且左侧变量不加 `$`，读取变量时使用 `$`。

违规信号：`foo = bar` 等号两侧加空格；`$foo=bar` 左侧加 `$`；`read $foo` 读取时加 `$`。

```bash
❌ foo = bar                                   # 等号两侧加空格
❌ $foo=bar                                    # 左侧加 $
❌ read $foo                                   # read 时加 $

✅ foo=bar                                     # 赋值：不加空格，不加 $
✅ echo "$foo"                                 # 读取：加 $
✅ read foo                                    # read：不加 $
```

---

**SHELL-LANG-06** `[强制]` 对来自不可信源的命令参数进行防注入处理，至少对变量加引号或进行参数转义。

违规信号：命令参数直接使用未加引号的变量；变量可能含空格或特殊字符导致命令注入。

```bash
❌ ls $foo                                    # foo 含空格时会解析为多个参数
❌ rm -rf $dir                                # dir 为空时变成 rm -rf /

✅ ls "$foo"                                  # 变量加引号
✅ rm -rf "$dir"                              # 变量加引号
✅ eval "rm -rf '${dir}'"                      # 参数转义
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**风格规范**
- [ ] SHELL-STYLE-01 — 函数命名是否全小写下划线或混合大小写（禁全大写、禁少于 3 字符）；同一文件风格是否统一
- [ ] SHELL-STYLE-02 — 条件/循环/函数是否有缩进；同一文件空格/TAB 是否统一
- [ ] SHELL-STYLE-03 — 源文件是否有头部注释（用途、注意事项、作者/修改者）；函数是否有头部注释（功能、参数、返回值）；外部命令调用是否有注释
- [ ] SHELL-STYLE-04 — 每个函数是否不超过 50 行
- [ ] SHELL-STYLE-05 — 多参数函数入口是否用有意义的变量名替代 $1/$2（单参数可例外）

**错误处理**
- [ ] SHELL-ERR-01 — 外部参数是否检查有效性（非空、存在、格式）
- [ ] SHELL-ERR-02 — 模块外部读取的数据（文件、配置、网络）是否校验有效性
- [ ] SHELL-ERR-03 — 命令返回值是否检查；影响逻辑的命令是否有注释说明忽略原因

**语言特性**
- [ ] SHELL-LANG-01 — 函数内变量是否使用 `local` 声明
- [ ] SHELL-LANG-02 — 字符串比较时变量是否加引号或使用前缀 x 比较
- [ ] SHELL-LANG-03 — `[` 和 `]` 及参数间是否有空格；`[]` 内部是否使用了 `&&`
- [ ] SHELL-LANG-04 — 管道中是否存在多个命令读写同一文件
- [ ] SHELL-LANG-05 — 赋值时等号两侧是否加了空格或左侧加了 `$`
- [ ] SHELL-LANG-06 — 来自不可信源的命令参数是否加了引号
