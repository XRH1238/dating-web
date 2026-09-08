# 相册照片删除实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为相册媒体增加登录后删除，并安全清理主、第二 Supabase Storage 文件。

**架构：** 前端严格解析已保存的 Public URL，再通过统一客户端把路径按 `primary` / `secondary` 发送给现有网关。网关保持上传只到 `secondary`，删除支持两个固定后端。

**技术栈：** 原生 JavaScript、Supabase REST/Storage、Deno Edge Function、Node test runner。

---

### 任务 1：Storage 路由

**文件：** `cloud-data-client.js`、`supabase/functions/storage-gateway/core.ts`、`supabase/functions/storage-gateway/index.ts`、对应测试。

- [ ] 先写失败测试：删除请求可指定 `primary`，但 `primary` 不能上传。
- [ ] 运行目标测试，确认因功能缺失失败。
- [ ] 最小实现双后端删除和主项目 Storage 客户端。
- [ ] 运行目标测试，确认通过并提交。

### 任务 2：相册删除

**文件：** `script.js`、`styles.css`、`index.html`、`tests/gallery-delete.test.js`。

- [ ] 先写失败测试：可信 URL 解析、登录按钮、确认、数据库优先、双后端清理和失败提示。
- [ ] 运行目标测试，确认因功能缺失失败。
- [ ] 最小实现解析、删除流程、按钮样式和缓存版本。
- [ ] 运行目标测试及全量测试，检查页面并提交。
