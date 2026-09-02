# 双 Supabase Storage 设计

## 目标

在不迁移数据库、不修改现有数据与旧媒体 URL 的前提下，让所有新媒体上传到第二个 Supabase Storage。数据库表的读取与写入继续使用当前主 Supabase。

## 边界

- 不修改页面 UI、数据库 schema 或已有数据库记录。
- 不迁移或批量删除任何现有文件。
- 仅使用两个项目各自的 publishable key，不使用 secret 或 service role key。
- 保留 `createCloudDataClient()` 仅配置 `url`、`key` 时的现有行为。

## 方案

继续使用一个统一的云端客户端，并在客户端内部维护两组端点与凭据：

- REST 数据库请求使用 `options.url` 与 `options.key`。
- Storage 请求使用 `options.storageUrl` 与 `options.storageKey`。
- `storageUrl` 或 `storageKey` 未提供时，分别回退到 `url` 或 `key`。

`select`、`insert`、`update`、`remove` 保持使用主 Supabase。`upload`、`getPublicUrl` 与 `removeObjects` 使用 Storage 配置。把 `removeObjects` 一并路由到第二个 Storage，可以让记录编辑失败后的清理以及新媒体移除操作作用于实际上传位置；这不会触发任何迁移或主动删除。

## 调用覆盖

`script.js` 中所有上传均通过统一客户端完成：

- `uploadMediaItem()` 覆盖 Gallery、出游记录、时间胶囊、普通图片、视频，以及 Live Photo 的静态图片和 MOV。
- `uploadDataUrlResource()` 覆盖离线出游记录重新同步时的普通媒体与 Live Photo 双资源。

因此只需在 `connectSupabase()` 中传入第二组 Storage 配置，无需修改各业务上传函数。数据库中已有的完整媒体 URL 会继续原样渲染，不会被重写。

## 错误与兜底行为

现有离线与失败兜底逻辑保持不变：未上传的媒体仍可保存在本地；已成功上传并保存了公开 URL 的待同步记录只需重试数据库写入；编辑记录保存失败时，现有清理逻辑会删除本次新上传的文件并保留原记录和表单内容。

## 测试

在 `tests/data-persistence.test.js` 增加客户端行为测试，验证：

1. REST 请求仍发送到主 Supabase，并使用主 key。
2. Storage 上传发送到 `storageUrl`，并使用 `storageKey`。
3. `getPublicUrl()` 返回第二个 Supabase 的公开 URL。
4. `removeObjects()` 使用第二个 Storage。
5. 未提供 Storage 配置时，Storage URL 与 key 回退到主配置。

增加一项 `script.js` 集成断言，确认主配置保留、第二 Storage 配置存在，且 `connectSupabase()` 将四个选项传入统一客户端。最后运行全部现有 Node 测试。
