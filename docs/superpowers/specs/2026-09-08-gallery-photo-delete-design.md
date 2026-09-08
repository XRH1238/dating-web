# 相册照片删除设计

## 目标

登录用户可在页面底部相册中删除照片、视频或 Live Photo。新上传仍固定进入第二个 Supabase。

## 行为

- 每个相册媒体右上角显示现有风格的垃圾桶按钮，仅登录后显示。
- 点击后先确认；确认后先删除 `love_photos` 记录，再从页面移除。
- 从标准 Supabase Public URL 严格解析项目、Bucket 与路径：主项目映射 `primary`，第二项目映射 `secondary`。
- Live Photo 同时解析静态图和 MOV；去重后按后端分别删除。
- 无法安全识别的 URL 不猜路径，只删除数据库记录并提示未清理文件。
- 数据库删除失败时保留照片；Storage 清理失败时记录仍保持删除，并提示残留风险。

## 网关

- `sign-upload` 仍只允许 `secondary`，防止新文件上传回主项目。
- `delete` 允许 `primary` 和 `secondary`，仍要求主项目登录 JWT、固定 `love-photos` Bucket 和安全路径。
- 主 Storage 使用 Edge Function 自带的 `SUPABASE_SERVICE_ROLE_KEY`；第二 Storage 继续使用 `STORAGE_BACKENDS_JSON` 中的 secret，不新增配置。

## 验证

- URL 解析、非法 URL、Live Photo、删除顺序与失败分支测试。
- 网关验证主/第二后端删除，并确认主后端不能签发上传。
- 全量测试、语法检查和本地页面检查。
