# 第二个 Supabase Storage 临时公开策略设计

## 目标

第二个 Supabase 项目的 `love-photos` Bucket 暂时采用与第一个 Supabase Storage 相同的公开访问策略，使网站能够匿名读取、上传和删除新媒体。后续实现登录鉴权时，再同时收紧两个 Supabase 项目的匿名权限。

## 范围

- 只调整第二个 Supabase 项目的 `storage.objects` RLS policy。
- Bucket 固定为 `love-photos`，保持 Public。
- 为 `anon` 与 `authenticated` 角色允许 `SELECT`、`INSERT` 和 `DELETE`，并通过 `bucket_id = 'love-photos'` 限定范围。
- 不增加 `UPDATE` 权限。
- 不修改主 Supabase 的数据库表、RLS、数据或旧 Storage 文件。
- 不修改页面 UI、数据库 schema、媒体 URL 或双 Supabase 路由代码。

## 实现

仓库新增一份可重复执行的 SQL 文件。SQL 使用稳定且明确的 policy 名称，先删除同名策略，再创建以下三项策略：

1. 公开读取 `love-photos` 中的对象；
2. 公开上传对象到 `love-photos`；
3. 公开删除 `love-photos` 中的对象。

SQL 必须在第二个 Supabase 项目的 SQL Editor 中执行，不能在主 Supabase 中执行。现有 Public Bucket 配置保持不变。

## 数据流与清理行为

数据库 CRUD 继续访问第一个 Supabase。新媒体上传、公开 URL 生成和媒体文件删除访问第二个 Supabase。删除或替换媒体时，现有 `removeObjects()` 可以在第二个 Storage 执行清理，因此不会再因缺少匿名删除策略而必然留下旧文件。

该策略不能保证绝对零残留：如果上传成功后浏览器关闭、网络中断，或后续数据库保存失败，仍可能产生孤立文件。此类极端情况留待登录鉴权和更完整的服务端清理机制处理。

## 安全影响

这是一项明确接受的临时风险：在登录鉴权上线前，任何持有公开 publishable key 的访问者都可以枚举 `love-photos` 中的对象路径，并删除其中任意对象，不需要预先知道路径。网站匿名及登录客户端获得的 Storage 能力与第一个 Supabase 当前的公开策略一致；第二个项目的策略角色范围显式限制为 `anon, authenticated`。

下一阶段必须实现登录鉴权，并把两个 Supabase 项目的匿名写入和删除策略一起改为仅授权用户可用。

## 验证

- 静态检查 SQL 只针对 `love-photos`，且仅创建 `SELECT`、`INSERT`、`DELETE` 策略。
- 运行现有完整测试，确认双 Supabase 路由不变。
- 在线验证时上传一个唯一命名的临时对象，再删除同一对象；不得触碰已有文件。
- 检查第二个 Supabase 的策略列表，确认三项策略存在。
- 更新当前 Pull Request，写明修改文件、测试结果和临时匿名删除风险。
