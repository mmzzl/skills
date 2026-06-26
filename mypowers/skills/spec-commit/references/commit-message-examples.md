# Commit Message Examples

> 参考 `templates/commit-message-template.md` 完整模板格式。

## ADD Type Example

```
[AI-COMMIT][ADD] 新增用户权限校验模块

##### 问题描述
当前系统缺少细粒度权限控制，所有已登录用户可访问全部 API 接口，无法满足多租户场景下的权限隔离需求。
Use cases:
- 租户 A 的管理员不应能操作租户 B 的资源
- 普通用户不应能访问管理后台 API

##### 改动思路
- 添加 PermissionChecker 类实现基于 RBAC 的细粒度权限控制
- 新增 permission_middleware 中间件，在路由层拦截未授权请求
- 补充单元测试覆盖核心逻辑

##### 备选方案
- NA

##### 数据模型影响
- 新增 permissions 表（permission_id, role_id, resource, action）
- 新增 role_permissions 关联表

##### REST API影响
- 新增 GET /api/permissions 查询权限列表
- 新增 PUT /api/roles/:id/permissions 更新角色权限

##### 安全影响
- 增强：从无权限控制升级为 RBAC 权限模型

##### 消息通知影响
- NA

##### 性能影响
- 每次 API 请求增加一次权限查询，已通过 Redis 缓存优化，P99 延迟增加 <2ms

##### 部署影响
- 需执行数据库迁移脚本 migrate_001_add_permissions.sql

##### 文档影响
- API 文档需新增权限相关接口说明

##### 做了哪些测试
- 单元测试：PermissionChecker 权限判断逻辑
- 集成测试：中间件拦截未授权请求返回 403
- 性能测试：缓存命中率 >99%，P99 <2ms

##### BUG ID
NA

##### 知识合规报告
- 本次提交涉及 2 篇规范文档
- 合规检查结果：全部通过
- 检查规则 30 条：通过 25 条 / 未涉及 5 条 / 违规 0 条
- 缓存命中：2 篇 | 本次检查：0 篇（实现阶段已通过 code-compliance-check）
- 合规文档清单：Python编码规范, 安全编码规范

##### Agent-Rules 使用信息
- 使用模式：plugin
- 版本：4.1.18

##### Checklist
- [x] commit格式遵循提交消息规范
- [x] commit量遵循提交量的规范
- [x] 改动代码均有增加单测覆盖
- [x] 覆盖率>=80%
- [x] 单元测试通过
- [x] 代码扫描通过

Co-Authored-By: Claude Code <noreply@anthropic.com>
```

## FIX Type Example

```
[AI-COMMIT][FIX] 修复用户登录超时问题

##### 问题描述
用户在登录后 30 分钟内频繁掉线，影响所有使用 SSO 登录的用户。
原因是 session 过期时间配置过短（30min），且缺少 token 自动续期机制。
Use cases:
- 用户通过 SSO 登录后操作超过 30 分钟被强制登出
- 长时间填写表单提交时提示登录过期，数据丢失

##### 改动思路
- 调整 session 过期时间从 30min 到 2h
- 增加 token 自动续期逻辑，在过期前 5min 自动刷新
- 添加前端 token 过期拦截器，静默续期

##### 备选方案
- 方案B：改用长期 token + 手动刷新，不选择原因：安全风险更高
- 方案C：改用 sliding session，不选择原因：现有中间件不支持，改动量过大

##### 数据模型影响
- NA

##### REST API影响
- 新增 POST /api/auth/refresh-token 接口

##### 安全影响
- token 续期增加了 refresh_token 校验，无安全降级

##### 消息通知影响
- NA

##### 性能影响
- NA

##### 部署影响
- NA

##### 文档影响
- NA

##### 做了哪些测试
- 单元测试：token 续期逻辑、session 过期边界
- 集成测试：SSO 登录 → 等待 → 自动续期 → 继续操作

##### BUG ID
BUG-2024-1234

##### 知识合规报告
- 本次提交涉及 3 篇规范文档
- 合规检查结果：全部通过
- 检查规则 45 条：通过 38 条 / 未涉及 7 条 / 违规 0 条
- 缓存命中：0 篇 | 本次检查：3 篇
- 合规文档清单：Python编码规范, 安全编码规范, 日志规范

##### Agent-Rules 使用信息
- 使用模式：plugin
- 版本：4.1.18

##### Checklist
- [x] commit格式遵循提交消息规范
- [x] commit量遵循提交量的规范
- [x] 改动代码均有增加单测覆盖
- [ ] 覆盖率>=80%
- [x] 单元测试通过
- [x] 代码扫描通过

Co-Authored-By: Claude Code <noreply@anthropic.com>
```
