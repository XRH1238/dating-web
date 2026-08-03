# 出游故事时间轴与时间胶囊实施计划

> **执行方式：** 在隔离分支 `codex/story-timeline-capsule` 中按测试驱动方式逐项实现；本计划只包含本地代码与迁移文件，不直接修改线上 Supabase，也不发布 GitHub Pages。

**目标：** 将“出游记录”升级为有统计、时间轴和照片故事卡的展示区；提供独立的记录表单；加入带 24 小时编辑期和到期解锁规则的时间胶囊，同时兼容已有记录。

**架构：** 新建无 DOM 依赖的 `story-data.js`，统一负责记录归一化、排序、统计和胶囊状态判断。`script.js` 继续负责界面与 Supabase/localStorage 协调；`cloud-data-client.js` 增加胶囊快照兼容；数据库结构以幂等 SQL 迁移文件交付，待用户授权后再执行线上迁移。

**技术栈：** 原生 HTML/CSS/JavaScript、Node.js 内置测试运行器、Supabase JS v2、GitHub Pages。

---

## 任务 1：建立故事数据领域模块

**文件：**
- 新建：`story-data.js`
- 新建：`tests/story-data.test.js`

1. 先写失败测试，覆盖：
   - 老记录缺少 `city`、`moods`、`photos` 时补成安全默认值；
   - `YYYY-MM-DD/YYYY-MM-DD` 日期范围按开始日期倒序排列；
   - 城市去重、旅程数与照片数统计；
   - 时间胶囊在创建后 24 小时内可编辑，之后锁定；
   - 解锁日前的公开视图不返回正文和照片。
2. 运行 `node --test tests/story-data.test.js`，确认测试先失败。
3. 实现 UMD 模块，导出：
   - `normalizeRecord(record)`
   - `sortRecords(records)`
   - `summarizeRecords(records)`
   - `getCapsuleState(capsule, now)`
   - `toPublicCapsule(capsule, now)`
4. 重跑测试并提交：`feat: add story timeline data model`。

## 任务 2：扩展本地快照与云端数据契约

**文件：**
- 修改：`cloud-data-client.js`
- 修改：`tests/data-persistence.test.js`
- 新建：`supabase/story-timeline-capsule.sql`
- 修改：`SUPABASE_SETUP.md`
- 新建：`tests/story-schema.test.js`

1. 先修改测试，要求空快照和旧快照都含有 `capsules: []`，旧的四类数据快照仍可恢复。
2. 新增迁移文件测试，检查：
   - `love_records` 增加 `city text`、`moods jsonb`、`photos jsonb`；
   - 新建 `love_capsules`，包含标题、正文、照片、解锁日期、创建/更新时间；
   - 胶囊表具有公开读取和写入策略（与现有站点一致）。
3. 运行相关测试，确认先失败。
4. 扩展 `emptySnapshot()` 与 `normalizeSnapshot()`；添加幂等 SQL（`add column if not exists` / `create table if not exists`）。
5. 在 `SUPABASE_SETUP.md` 中说明该迁移需要在发布前经用户授权执行。
6. 重跑测试并提交：`feat: extend persistence for stories and capsules`。

## 任务 3：搭建记录区与两个独立表单的语义结构

**文件：**
- 修改：`index.html`
- 修改：`tests/home-layout.test.js`

1. 先添加结构测试，要求页面包含：
   - 旅程/城市/照片统计；
   - `story-timeline` 时间轴容器；
   - `time-capsule` 胶囊区；
   - 独立的 `record-panel` 与 `capsule-panel`；
   - 记录表单中的起止日期、城市、标题、描述、心情、照片与预览；
   - 胶囊表单中的标题、正文、照片、解锁日期；
   - 可访问的确认对话框。
2. 运行结构测试，确认先失败。
3. 修改 HTML，并将 `story-data.js` 放在 `script.js` 前加载；保留原“出游计划”表单不变。
4. 重跑结构测试并提交：`feat: add story and capsule interface structure`。

## 任务 4：实现已确认的视觉方案与响应式布局

**文件：**
- 修改：`styles.css`
- 新建：`tests/story-styles.test.js`

1. 先写样式契约测试，检查：
   - 桌面端统计、时间轴与胶囊双区布局；
   - 记录卡为交错时间轴，带圆点和连接线；
   - 删除按钮为圆形图标按钮；
   - 表单照片网格与心情标签；
   - 768px 以下切换为单列且时间轴靠左。
2. 运行测试，确认先失败。
3. 按效果图风格实现奶油白、豆沙红与深色正文的层级，避免空旷；保留站点现有设计变量。
4. 重跑测试并提交：`style: redesign records as a story timeline`。

## 任务 5：实现独立记录表单与时间轴行为

**文件：**
- 修改：`script.js`
- 新建：`tests/story-records-integration.test.js`

1. 先写集成契约测试，覆盖：
   - 记录表单不再复用计划表单；
   - 起止日期通过 `MapLabelLayout.serializeDateRange` 保存；
   - 心情多选与最多 6 张照片预览；
   - 新记录保存 `city/moods/photos`，老记录仍可渲染；
   - 保存失败时表单不关闭，输入与预览不清空；
   - 删除记录先出现确认，再调用云端删除或本地删除。
2. 运行测试，确认先失败。
3. 扩展应用状态与数据加载，渲染统计和时间轴；记录照片在线时上传到现有 `love-photos` bucket，离线时保留本地 Data URL。
4. 实现表单校验、上传状态、错误重试和确认删除。
5. 重跑测试并提交：`feat: add rich travel record workflow`。

## 任务 6：实现时间胶囊生命周期

**文件：**
- 修改：`script.js`
- 新建：`tests/time-capsule-integration.test.js`

1. 先写集成契约测试，覆盖：
   - 加载、保存、更新、删除 `love_capsules`；
   - 创建后 24 小时内显示编辑入口；
   - 24 小时后且未到解锁日只显示标题、创建日期和倒计时；
   - 锁定时不把正文和照片渲染到 DOM；
   - 解锁后显示正文和照片；
   - 删除操作需要确认。
2. 运行测试，确认先失败。
3. 接入本地缓存与云端表，使用 `StoryData.toPublicCapsule` 决定可见内容；实现创建、编辑、预览、删除和倒计时。
4. 重跑测试并提交：`feat: add locked time capsules`。

## 任务 7：回归验证与本地浏览器验收

**文件：**
- 仅在发现问题时修改上述文件，并为问题补回归测试。

1. 运行全部自动化验证：

   ```bash
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check script.js
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check story-data.js
   ```

2. 检查工作区差异，确认没有修改计划、地图、纪念日、想做的事和相册的既有行为。
3. 启动本地静态服务器，在 Codex 内置浏览器打开 `#records`：
   - 验收桌面和窄屏布局；
   - 添加一条有心情和照片的记录；
   - 验证老记录；
   - 创建未解锁与已解锁胶囊；
   - 验证 24 小时编辑提示和删除确认。
4. 运行最终测试并提交修复（如有）。
5. 向用户展示本地页面；待用户确认后，再单独请求线上 Supabase 迁移与 GitHub 发布授权。

## 完成标准

- 所有自动化测试通过，两个 JavaScript 文件语法检查通过；
- 旧记录不丢失且可正常展示；
- 新记录表单与计划表单互不影响；
- 未解锁胶囊的正文和照片不出现在 DOM；
- 云端失败不会悄悄清空用户刚填写的内容；
- 本地页面已在内置浏览器打开供用户验收；
- 未经再次授权，不执行线上数据库迁移和 GitHub 发布。
