# 主 Supabase 登录鉴权与多 Storage 网关设计

## 背景

网站当前使用主 Supabase 保存全部业务表，并把新媒体上传到第二个 Supabase 的 Public Bucket `love-photos`。数据库与 Storage 都允许匿名写入和删除，因此任何拿到网页配置的人都能绕过页面直接修改数据或文件。

本次改造增加一套统一登录鉴权，同时保持以下既有行为：

- 所有数据库表和已有数据继续留在主 Supabase；
- 已保存的旧媒体 URL 不修改、不迁移；
- 未登录访客仍可浏览网站和通过已有公开 URL 查看媒体；
- 第二个以及未来增加的 Supabase 只扩充 Storage 容量，不复制数据库或账号；
- 页面整体 UI、数据库 Schema 和现有离线记录机制保持不变。

## 已确认的产品决策

- 使用主 Supabase Auth 作为唯一身份来源；登录方式为邮箱和密码。
- 不开放网站注册入口。账号由管理员在主 Supabase Dashboard 的 Authentication → Users 中添加。
- 所有已添加账号拥有相同的共享编辑权限，不增加 `user_id` 或角色表。
- 会话默认保持登录并自动刷新，直到用户主动退出或刷新令牌失效。
- 支持邮件找回密码；恢复邮件返回网站后由网站完成新密码设置。
- 未登录用户可读，只有登录用户能新增、修改、删除或上传。
- Public Bucket 继续公开读取，因此知道媒体 URL 的人仍可访问对应文件；本次保护写入和删除权限，不把媒体改为私有。

## 总体架构

### 主 Supabase

主项目继续承担：

1. Auth：登录、会话刷新、退出和密码恢复；
2. Database：`love_plans`、`love_records`、`love_todos`、`love_photos`、`love_capsules`；
3. Edge Function：验证主项目用户身份，为受控 Storage 后端签发上传许可或执行删除。

数据库 SELECT 策略允许 `anon` 和 `authenticated`，INSERT / UPDATE / DELETE 策略只允许 `authenticated`。浏览器始终在 `apikey` 请求头发送主项目 publishable key；登录后才在 `Authorization` 请求头发送用户 JWT。publishable key 不再冒充 Bearer token。

### Storage 后端

第二个及未来的 Storage 项目只保存媒体。`love-photos` Bucket 保持 Public 以维持旧 URL 和公开浏览；匿名 INSERT / DELETE / LIST 权限被撤销。

浏览器不保存 Storage secret key，也不直接取得跨项目管理权限。Edge Function 从 `STORAGE_BACKENDS_JSON` 环境变量读取受控后端映射，例如：

```json
{
  "secondary": {
    "url": "https://msrbqgorhjbzxomexzap.supabase.co",
    "secretKey": "由第二个 Supabase 生成并只保存于 Edge Function 的 sb_secret_...",
    "bucket": "love-photos"
  }
}
```

客户端只能发送后端别名 `secondary`，不能提交任意 Supabase URL、密钥或 Bucket。未来扩容时只增加受控后端配置；本次不实现自动轮换或容量调度。

## 浏览器认证客户端

新增本地 `auth-client.js`，继续保持项目不依赖第三方 CDN。它通过主 Supabase Auth REST API 提供：

- `signInWithPassword(email, password)`；
- `signOut()`；
- `getSession()` 和自动刷新；
- `getAccessToken()`，供数据库客户端和 Storage 网关按需取得新鲜 JWT；
- `resetPasswordForEmail(email, redirectTo)`；
- 解析密码恢复回跳并调用 `updatePassword(newPassword)`；
- 认证状态订阅。

会话存放在浏览器 `localStorage`，仅包含 Supabase 返回的访问令牌、刷新令牌、过期时间和必要用户信息。恢复令牌从 URL fragment 读取后立即从地址栏移除。登录、退出、刷新失败都会通知页面重绘权限状态。

## 数据客户端改造

`createCloudDataClient(options)` 保留现有主数据库和 Storage URL 配置，并新增：

- `getAccessToken`：异步返回当前主 Supabase 用户 JWT；
- `storageGatewayUrl`：主 Supabase Edge Function 地址；
- `storageBackend`：允许的 Storage 后端别名，当前为 `secondary`。

行为如下：

- SELECT 可在没有用户 JWT 时继续访问主数据库；
- INSERT / UPDATE / DELETE 使用用户 JWT，缺少登录时在发请求前报出明确错误；
- `upload()` 先向网关请求签名上传 URL，再把文件直接上传到目标 Storage；大文件不会经过 Edge Function；
- `removeObjects()` 由网关删除明确路径；
- `getPublicUrl()` 继续根据 `storageUrl` 生成相同格式的公开 URL，不修改旧记录。

上传许可为短时有效且不可覆盖既有对象。浏览器使用网关返回的完整签名 URL执行上传，不接受页面输入的任意目标地址。

## Edge Function

新增 `supabase/functions/storage-gateway/index.ts`：

1. 处理固定允许来源的 CORS 和 OPTIONS；
2. 从 `Authorization: Bearer <JWT>` 读取主项目用户令牌；
3. 通过主 Supabase Auth `getUser(jwt)` 做服务端身份校验；
4. 解析请求动作 `sign-upload` 或 `delete`；
5. 查找服务端 allowlist 中的后端别名并固定 Bucket；
6. 只允许安全相对路径，并限制在 `records/`、`capsules/` 或 Gallery 使用的城市/`unplaced` 目录；
7. `sign-upload` 通过目标 Storage 的服务端 secret key 创建不可覆盖的短时上传 URL；
8. `delete` 限制单次路径数量，删除精确路径，不提供列目录、移动或任意管理能力；
9. 返回结构化错误，不在响应或日志中输出 secret key。

由于密码恢复和 CORS 预检需要在函数逻辑中自行处理，函数关闭平台旧式 `verify_jwt` 前置检查，但每个业务请求都会调用主 Supabase Auth `getUser(jwt)` 验证用户，不能仅凭 publishable key访问。

## 页面权限与交互

页面头部只增加最小登录状态区域：

- 未登录显示“登录”；
- 已登录显示账号邮箱和“退出”；
- 登录弹窗包含邮箱、密码和“忘记密码”；
- 密码恢复回跳时显示设置新密码表单；
- 不显示注册入口。

未登录时隐藏或禁用以下写入口：

- 添加/删除出游计划；
- 新建、编辑、删除出游记录；
- 新增、完成、删除 Todo；
- Gallery 城市输入和照片/视频上传区；
- 新建、编辑、删除时间胶囊；
- 表单内媒体选择与移除操作。

页面事件处理和数据方法还会执行认证守卫，防止仅通过修改 DOM 绕过界面限制。会话过期且刷新失败时立即切回只读状态、关闭写入面板并提示重新登录。

## 离线与失败处理

- 数据库读取失败仍使用现有本地快照展示。
- 未登录不是“离线”：未登录写操作不会创建本地修改。
- 只有已登录用户才能触发待同步记录上传；未登录加载页面时不会尝试同步。
- 出游记录已经上传媒体但数据库插入失败时，沿用现有 pending record：已上传的公开 URL 直接保留，重试时只上传仍为 Data URL 的资源，因此不要求重新选择照片。
- 编辑记录失败时沿用现有尽力清理本次新增媒体；清理失败只提示残留风险，不删除旧文件。
- 不自动迁移或删除任何现有数据库行和 Storage 文件。

## 权限 SQL 与安全边界

新增可重复执行的主数据库策略 SQL：

- 删除现有匿名写策略；
- 为五张业务表建立公开 SELECT；
- 为五张业务表建立仅 `authenticated` 的 INSERT / UPDATE / DELETE。

新增第二 Storage 收紧策略 SQL：

- 删除当前 `anon, authenticated` 的 SELECT / INSERT / DELETE 策略；
- Bucket 保持 Public，公开 URL 读取不受影响；
- 不给浏览器角色创建 INSERT、DELETE 或 LIST 策略；
- Edge Function 使用目标项目 secret key 执行签名和删除。

主项目如仍需清理旧 Storage 文件，可单独保留“authenticated 对 `love-photos` 写/删”的策略；本次网站的新媒体路径全部指向第二 Storage。

## 部署顺序与回滚

为避免写入中断，按以下顺序上线：

1. 在主 Supabase 启用邮箱密码登录、关闭公开注册，并配置正式站点及密码恢复 Redirect URL；
2. 在第二 Supabase 创建 `sb_secret_...`，直接写入主 Edge Function secret，不进入本机文件、聊天或 Git；
3. 部署 Storage Gateway，配置 `STORAGE_BACKENDS_JSON`，先验证未登录被拒绝、登录后可签发和删除测试路径；
4. 在主数据库执行 authenticated 写策略；
5. 部署网站登录版本并验证读取、五类数据写入和所有媒体上传路径；
6. 最后执行第二 Storage 收紧策略，撤销匿名上传和删除；
7. 再次验证 Gallery、Record、Capsule、Live Photo 和 pending record 重试。

如果网关验证失败，在修复前暂不执行第 6 步；如果收紧后出现故障，只回滚第二 Storage 的匿名写策略，不回滚或迁移任何数据。

## 测试范围

- Auth REST 请求 URL、请求头、会话持久化、自动刷新、退出和恢复回跳；
- 数据库 SELECT 匿名可用，写方法缺少 JWT 时拒绝，登录后使用主 JWT；
- Storage 上传先调用主网关，再使用签名 URL直传第二 Storage；
- Storage 删除只经过网关；公开 URL仍指向第二 Storage；
- Edge Function 拒绝无 JWT、未知后端、错误 Bucket、非法路径、过多删除路径和不支持动作；
- RLS SQL 不再允许匿名写，第二 Storage SQL 不再创建匿名写/删/list策略；
- 页面未登录隐藏全部写入口，登录后恢复，认证丢失后回到只读；
- Gallery、Record、Capsule、Live Photo 和 pending record 上传路径仍统一调用 `state.client.upload()`；
- 运行全部现有 Node 测试并在 Codex 内置浏览器做登录前只读和登录界面验证。

## 不在本次范围

- 用户自助注册、网站内账号管理、管理员/普通成员角色；
- 按创建者隔离数据或新增 `user_id`；
- 把 Public Bucket 改为 Private；
- 自动选择 Storage、容量监控或跨 Storage 迁移；
- 重构页面视觉系统；
- 修改现有业务表 Schema、数据或旧媒体 URL。

## 依据

- Supabase Auth 用户 JWT 应放在 `Authorization`，publishable key 应放在 `apikey`。
- Supabase `getUser(jwt)` 会向 Auth 服务验证令牌，适合作为服务端授权依据。
- Signed Upload URL 用于让客户端在没有目标项目长期密钥的情况下直接上传，默认有效期为两小时。
- secret/service-role 权限只能放在服务端环境变量中，不能暴露到浏览器。

相关官方文档：

- https://supabase.com/docs/guides/functions/auth-headers
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl
- https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl
- https://supabase.com/docs/guides/auth/passwords
