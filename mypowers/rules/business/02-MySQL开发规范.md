# MySQL 开发规范

## 用途

本文档供 AI 执行两类任务：**数据库设计**（新建表/索引/SQL 前对照规范）、**代码 Review**（逐条扫描 SQL 和 ORM 代码输出违规）。

违规报告格式：`[规则ID] <文件>:<行号> — <描述>`

强制等级：`[强制]` 必须遵守 / `[建议]` 推荐遵守

---

## 规则详情

### 表设计

**MYSQL-TBL-01** `[强制]` 所有表使用 InnoDB 存储引擎，默认字符集 utf8。

违规信号：建表语句使用 MyISAM 等其他引擎；字符集使用 latin1 或 gbk。

```sql
❌ CREATE TABLE t (...) ENGINE=MyISAM DEFAULT CHARSET=utf8;
✅ CREATE TABLE t (...) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

---

**MYSQL-TBL-02** `[强制]` 所有表必须有一个自增主键 `id`，禁止使用联合主键。联合主键改用自增主键 + 联合唯一索引实现。

违规信号：表无主键；使用联合主键；主键非自增。

```sql
❌ CREATE TABLE t (user_id INT, role_id INT, PRIMARY KEY (user_id, role_id));
✅ CREATE TABLE t (id BIGINT AUTO_INCREMENT, user_id INT, role_id INT,
                   PRIMARY KEY (id), UNIQUE KEY uniq_user_role (user_id, role_id));
```

---

**MYSQL-TBL-03** `[强制]` 库名、表名、字段名使用英文字母、数字和下划线组成，全部小写，以英文字母开头。禁止使用连字符（-）和保留关键字。

违规信号：名称含大写字母、连字符；使用 `order`、`group` 等保留字作表名或字段名。

```
参考：MySQL 5.7 关键字清单（可查阅官方文档）
```

---

**MYSQL-TBL-04** `[建议]` 命名语义化，见名知意，一般不超过三个英文单词；使用单数形式（如 `app_version` 而非 `app_versions`）。

违规信号：表名 `a1`、`tbl1` 等无意义命名；表名超过 4 个单词。

---

**MYSQL-TBL-05** `[建议]` 单表数据量控制在 500 万以内；超过时采用分表等策略。

违规信号：单表行数接近千万级未分表。

---

**MYSQL-TBL-06** `[建议]` 避免在数据库中存储文件等大的二进制数据，防止随机 IO 性能下降和单表数据快速增长。

违规信号：使用 BLOB 字段存储文件内容；数据库体积异常增长。

---

### 字段规范

**MYSQL-FLD-01** `[强制]` 避免使用 TEXT、BLOB 大字段类型。

违规信号：表字段出现 `TEXT`、`MEDIUMTEXT`、`BLOB`、`LONGBLOB`。

```
原因：
  MySQL 内存临时表不支持 TEXT/BLOB，排序等操作必须使用磁盘临时表，效率极低
  不能设置默认值、不便于排序、不便于建立索引
```

---

**MYSQL-FLD-02** `[建议]` 避免使用 NULL，尽量提供默认值或使用数字 0 / 空字符串代替。

违规信号：字段无 NOT NULL 约束且无默认值；表中存在大量 NULL 值字段。

```
原因：
  NULL 值在 MySQL 内部需要特殊处理，增加处理复杂度
  表中有较多空字段时处理性能降低
  NULL 值难以查询优化且占用额外索引空间
```

---

**MYSQL-FLD-03** `[建议]` 合理设置 varchar 长度，按业务需要设定，不过度预留。

违规信号：varchar(2000) 默认值远大于业务实际需要。

```
原因：更长的字段消耗更多内存，影响排序和基于内存的临时表性能
```

---

**MYSQL-FLD-04** `[强制]` 小数类型使用 `decimal`，禁止使用 `float` 和 `double`。

违规信号：建表语句出现 `FLOAT`、`DOUBLE` 字段。

```sql
❌ price FLOAT
❌ amount DOUBLE
✅ price DECIMAL(10, 2)
✅ amount DECIMAL(18, 4)
```

---

**MYSQL-FLD-05** `[建议]` 当数据超出 `decimal` 范围时，将值拆分为整数和小数分别存储。

违规信号：超大数值使用字符串存储代替 decimal 拆分。

---

### 索引规范

**MYSQL-IDX-01** `[建议]` 在必要字段上积极建立索引以提升查询性能（InnoDB 索引数据结构为 B+Tree）。

违规信号：查询频繁的字段无索引导致全表扫描。

---

**MYSQL-IDX-02** `[强制]` 普通索引以 `idx_字段1_字段2` 命名；唯一索引以 `uniq_字段1_字段2` 命名。

违规信号：索引命名不符合 `idx_` / `uniq_` 前缀规范。

---

**MYSQL-IDX-03** `[建议]` 仅在需要时创建索引，单字段索引不超过三个，单表索引总数不超过五个，避免冗余和重复索引。

违规信号：单表存在 6 个以上索引；存在(字段1)和(字段1,字段2)重复覆盖的冗余索引。

---

**MYSQL-IDX-04** `[建议]` 不在低基数列（如状态、类型、性别）上建立索引；不在频繁更新的列上建立索引。

违规信号：`status`、`type` 等低区分度字段建有独立索引。

```
索引选择性 = 基数 / 数据行数，值越接近 1 效果越好
```

---

**MYSQL-IDX-05** `[强制]` 禁止在索引列上进行数学运算和函数运算，否则索引失效。

违规信号：WHERE 条件中索引列被函数包裹，如 `WHERE DATE(create_time) = '2024-01-01'`。

```sql
❌ SELECT * FROM t WHERE YEAR(create_time) = 2024;
❌ SELECT * FROM t WHERE price + 10 > 100;
✅ SELECT * FROM t WHERE create_time >= '2024-01-01' AND create_time < '2025-01-01';
```

---

**MYSQL-IDX-06** `[建议]` 默认使用普通索引而非唯一索引（除非业务需要唯一约束）。普通索引利用 change buffer，更新性能优于唯一索引。

违规信号：无业务约束需求仍用唯一索引代替普通索引。

---

**MYSQL-IDX-07** `[建议]` 当频繁使用固定几个字段进行条件查询时，建立复合索引。将单独出现最多的字段放在前面，以满足更多查询场景。

违规信号：多个单字段索引覆盖同一查询，未建复合索引。

```sql
-- 查询场景
-- A: SELECT * FROM t WHERE a = 1 AND b = 2;
-- B: SELECT * FROM t WHERE a = 2;

✅ CREATE INDEX idx_a_b ON t(a, b);  -- A 和 B 均可使用
❌ CREATE INDEX idx_b_a ON t(b, a);  -- 仅 A 可使用
```

---

**MYSQL-IDX-08** `[强制]` 复合索引遵循最左前缀匹配原则。MySQL 从左向右匹配，遇到范围查询（`>`、`<`、`between`、`like`）即停止匹配。范围查询字段应放在复合索引最后。

违规信号：复合索引中范围查询字段排在最前或中间。

```sql
-- SELECT * FROM t WHERE a = 1 AND b = 2 AND c > 3 AND d = 4;
✅ CREATE INDEX idx_a_b_d_c ON t(a, b, d, c);  -- c 是范围查询，放最后
❌ CREATE INDEX idx_a_b_c_d ON t(a, b, c, d);  -- c 后的 d 无法利用索引
```

---

**MYSQL-IDX-09** `[建议]` 尽量利用覆盖索引避免回表，提高查询效率。

违规信号：查询字段不在索引中导致额外回表。

```sql
-- 复合索引 idx_name_age (name, age)
✅ SELECT name, age FROM t WHERE name LIKE '赵%';  -- 覆盖索引，无需回表
```

---

**MYSQL-IDX-10** `[建议]` 字段过长时使用前缀索引（关注区分度）；前缀索引无法利用覆盖索引，身份证等可倒序存放优化。

违规信号：varchar(255) 全字段索引；无区分度评估。

```sql
✅ CREATE INDEX idx_addr_prefix ON t(addr(64));
```

---

**MYSQL-IDX-11** `[建议]` 优先扩展现有索引而非新增索引；where 条件字段顺序无须手动调整（优化器自动处理）；建立或调整索引后使用 `EXPLAIN` 验证。

违规信号：新增索引与已有索引功能重叠可扩展；索引变更后未执行 EXPLAIN 验证。

---

### SQL 编写

**MYSQL-SQL-01** `[建议]` 单字段 OR 场景用 `IN` 代替 `OR`（可有效利用索引）；多字段 OR 场景在每个字段建单字段索引后使用 `UNION` 组合。

违规信号：`WHERE a = 1 OR a = 2` 未用 `WHERE a IN (1, 2)`。

```sql
❌ SELECT * FROM t WHERE a = 1 OR a = 2;
✅ SELECT * FROM t WHERE a IN (1, 2);

-- 多字段场景
❌ SELECT * FROM t WHERE a = 1 OR b = 2;
✅ SELECT * FROM t WHERE a = 1 UNION SELECT * FROM t WHERE b = 2;
```

---

**MYSQL-SQL-02** `[建议]` 在可能时用 `JOIN` 替代 `IN` 子查询提升查询效率。

违规信号：`WHERE id IN (SELECT ... FROM large_table)`。

---

**MYSQL-SQL-03** `[建议]` 避免全模糊匹配 `LIKE '%xxx%'`，优先使用右模糊 `LIKE 'xxx%'` 以命中索引。

违规信号：`LIKE '%keyword%'` 前导通配导致索引失效。

```sql
❌ SELECT * FROM t WHERE name LIKE '%赵%';
✅ SELECT * FROM t WHERE name LIKE '赵%';
```

---

**MYSQL-SQL-04** `[建议]` 让 `GROUP BY` 尽量使用索引，避免临时表和额外排序。

违规信号：GROUP BY 字段无索引导致 `Using temporary; Using filesort`。

---

**MYSQL-SQL-05** `[建议]` 避免在 WHERE 条件中对属性使用函数或复杂表达式；将计算逻辑移到服务层。

违规信号：WHERE 条件中出现 `CONCAT()`、`DATE_FORMAT()` 等函数调用。

---

**MYSQL-SQL-06** `[建议]` 大批量 DELETE/INSERT 操作拆分为多条分批执行。

违规信号：单条 SQL 删除/插入百万级数据。

---

**MYSQL-SQL-07** `[建议]` 避免 `SELECT *`，按需列出字段以利于覆盖索引，减少 CPU/IO/内存/带宽消耗。

违规信号：代码中 `SELECT *` 仅用其中 2-3 个字段。

```sql
❌ SELECT * FROM t WHERE name LIKE '赵%';
✅ SELECT name, age FROM t WHERE name LIKE '赵%';
```

---

**MYSQL-SQL-08** `[强制]` 服务层必须捕获 SQL 异常并做相应处理，禁止裸抛异常导致上层崩溃。

违规信号：数据库操作无 try/except（或等价的 error check）；异常仅打印日志未做业务处理。

---

### ORM 使用

**MYSQL-ORM-01** `[强制]` 关联增删改操作放在事务中执行，保证原子性。

违规信号：关联操作分散在多个独立 DB 调用中，未包裹事务。

---

**MYSQL-ORM-02** `[强制]` 禁止在事务中执行 IO 操作（API 请求等）；与数据库无关操作避免放在事务中；增删改操作尽量放在事务末尾，减少锁占用时间。

违规信号：事务内有 HTTP 调用；数据库无关的复杂计算放在事务中；增删改前有长耗时操作。

---

**MYSQL-ORM-03** `[建议]` 建议使用 `relationship`，但禁止将 `lazy` 参数设为 `False`（避免隐式全量加载）。

违规信号：`relationship('User', lazy=False)`。

---

**MYSQL-ORM-04** `[建议]` 在 model 中自定义 `to_dict` 方法进行数据序列化。

违规信号：直接在视图层操作 ORM 对象属性拼装返回数据。

---

**MYSQL-ORM-05** `[强制]` 表初始化脚本中的表结构定义必须与 ORM 定义完全一致。

违规信号：SQL 脚本与 ORM Model 字段类型/约束不同步。

---

**MYSQL-ORM-06** `[建议]` 谨慎设置级联删除，避免误操作导致数据丢失。

违规信号：`cascade='all, delete-orphan'` 无业务必要性评估。

---

**MYSQL-ORM-07** `[强制]` 谨慎使用 `execute()` 直接执行 SQL；如使用须做严格参数检查，使用预编译防止 SQL 注入。

违规信号：`execute(f"SELECT * FROM t WHERE name = '{user_input}'")` 拼接用户输入。

```python
❌ session.execute(f"SELECT * FROM t WHERE name = '{user_input}'")
✅ session.execute("SELECT * FROM t WHERE name = :name", {"name": user_input})
```

---

### 禁止项

**MYSQL-BAN-01** `[强制]` 禁止使用存储过程。

违规信号：`CREATE PROCEDURE`；业务代码调用 `CALL proc()`。

---

**MYSQL-BAN-02** `[强制]` 禁止使用视图。

违规信号：`CREATE VIEW`；业务代码查询视图。

---

**MYSQL-BAN-03** `[强制]` 禁止使用触发器。

违规信号：`CREATE TRIGGER`。

---

**MYSQL-BAN-04** `[强制]` 禁止使用 Event 事件调度器。

违规信号：`CREATE EVENT`；数据库定时任务调度。

```
禁止复杂功能的设计理念：
  将计算转移到服务层，解放数据库 CPU
  高并发下这些功能可能将数据库拖死
  业务逻辑放在服务层具备更好的扩展性，能实现"增机器就加性能"
  数据库擅长存储与索引，CPU 计算上移到服务层
```

---

## Code Review Checklist

逐项扫描，违规输出 `[规则ID] <文件>:<行号> — <描述>`。

**表设计**
- [ ] MYSQL-TBL-01 — 存储引擎是否为 InnoDB；字符集是否为 utf8
- [ ] MYSQL-TBL-02 — 是否有自增主键；是否使用联合主键
- [ ] MYSQL-TBL-03 — 命名是否全小写、下划线分隔、字母开头；是否含保留关键字
- [ ] MYSQL-TBL-04 — 命名是否语义化、不超过三个单词、单数形式（建议）
- [ ] MYSQL-TBL-05 — 单表数据量是否控制在 500 万以内（建议）
- [ ] MYSQL-TBL-06 — 是否避免了在数据库中存储大文件（建议）

**字段规范**
- [ ] MYSQL-FLD-01 — 是否避免使用 TEXT、BLOB 类型
- [ ] MYSQL-FLD-02 — 是否避免使用 NULL，提供默认值（建议）
- [ ] MYSQL-FLD-03 — varchar 长度是否合理（建议）
- [ ] MYSQL-FLD-04 — 小数是否使用 decimal，禁止 float/double
- [ ] MYSQL-FLD-05 — 超 decimal 范围数值是否拆分存储（建议）

**索引规范**
- [ ] MYSQL-IDX-01 — 高频查询字段是否建立索引（建议）
- [ ] MYSQL-IDX-02 — 索引命名是否为 `idx_` / `uniq_` 前缀
- [ ] MYSQL-IDX-03 — 索引数量是否不超过 5 个，无冗余索引（建议）
- [ ] MYSQL-IDX-04 — 是否避免在低基数/频繁更新列建索引（建议）
- [ ] MYSQL-IDX-05 — 索引列是否被函数或运算包裹
- [ ] MYSQL-IDX-06 — 是否无必要唯一约束时使用普通索引（建议）
- [ ] MYSQL-IDX-07 — 频繁组合查询是否建立复合索引，字段顺序是否合理（建议）
- [ ] MYSQL-IDX-08 — 复合索引是否遵循最左前缀匹配，范围查询字段是否在最后
- [ ] MYSQL-IDX-09 — 是否利用覆盖索引避免回表（建议）
- [ ] MYSQL-IDX-10 — 长字段是否使用前缀索引（建议）
- [ ] MYSQL-IDX-11 — 是否优先扩展而非新增索引；是否用 EXPLAIN 验证（建议）

**SQL 编写**
- [ ] MYSQL-SQL-01 — 单字段 OR 是否用 IN 代替；多字段 OR 是否用 UNION（建议）
- [ ] MYSQL-SQL-02 — 是否用 JOIN 替代 IN 子查询（建议）
- [ ] MYSQL-SQL-03 — LIKE 是否避免全模糊（%x%），优先右模糊（x%）（建议）
- [ ] MYSQL-SQL-04 — GROUP BY 是否使用索引避免临时表（建议）
- [ ] MYSQL-SQL-05 — WHERE 条件是否避免函数和复杂表达式（建议）
- [ ] MYSQL-SQL-06 — 大批量 DELETE/INSERT 是否拆分执行（建议）
- [ ] MYSQL-SQL-07 — 是否避免 SELECT *，按需列出字段（建议）
- [ ] MYSQL-SQL-08 — 服务层是否捕获 SQL 异常并处理

**ORM 使用**
- [ ] MYSQL-ORM-01 — 关联增删改是否放入事务保证原子性
- [ ] MYSQL-ORM-02 — 事务中是否避免了 IO 操作；增删改是否放在事务末尾
- [ ] MYSQL-ORM-03 — relationship lazy 是否禁止设为 False（建议）
- [ ] MYSQL-ORM-04 — 是否自定义 to_dict 方法序列化（建议）
- [ ] MYSQL-ORM-05 — 建表脚本是否与 ORM 定义一致
- [ ] MYSQL-ORM-06 — 级联删除设置是否经过评估（建议）
- [ ] MYSQL-ORM-07 — 直接执行 SQL 是否使用参数化查询防注入

**禁止项**
- [ ] MYSQL-BAN-01 — 是否使用存储过程
- [ ] MYSQL-BAN-02 — 是否使用视图
- [ ] MYSQL-BAN-03 — 是否使用触发器
- [ ] MYSQL-BAN-04 — 是否使用 Event 事件调度器
