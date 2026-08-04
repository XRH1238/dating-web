# 出游计划删除按钮与记录双轨日期选择实施计划

> **执行方式：** 在隔离分支 `codex/plan-delete-dual-date` 中按测试驱动方式逐项实现。只修改本地页面代码和测试；不修改 Supabase 数据结构，不推送 GitHub，不发布线上页面。

**目标：** 将出游计划卡片上的文字叉号替换成圆形垃圾桶图标并在删除前确认；将“写一条出游记录”的原生日期框替换成“手动填写年月日 + 可视日历”双轨选择器，解决空值时显示 `yyyy/mm/dd` 的问题，并保证两种输入方式实时同步。

**架构：** 新建无 DOM 依赖的 `record-date-picker.js` UMD 模块，集中处理 ISO 日期、年月日合法性、月份切换与日历网格。`index.html` 提供两组摘要按钮、隐藏的标准日期字段、年月日输入和一个共享日历；`script.js` 负责开始/结束日期的独立状态、事件同步、校验和现有记录保存流程。计划删除继续复用现有 `confirmAction` 与 `assets/icons/trash.svg`。

**技术栈：** 原生 HTML/CSS/JavaScript、Node.js 内置测试运行器、现有 Supabase REST 客户端、GitHub Pages。

---

## 任务 1：建立日期选择器纯逻辑模块

**文件：**
- 新建：`record-date-picker.js`
- 新建：`tests/record-date-picker.test.js`

1. 先写失败测试，覆盖：
   - 闰年与普通年份的每月天数；
   - `2026-08-05` 与 `{ year: 2026, month: 8, day: 5 }` 的双向转换；
   - 年月完整但日期为空时可切换日历月份、尚不产生已选日期；
   - 非法日期（如 2026 年 2 月 30 日）返回明确错误；
   - 前后月份切换跨年正确；
   - 日历网格包含星期前置空格与当月全部日期；
   - 中文摘要输出 `2026年8月5日`，空值输出调用者给定的占位文案。
2. 运行并确认先失败：

   ```bash
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/record-date-picker.test.js
   ```

3. 实现并导出以下纯函数：

   ```js
   createParts(isoValue)
   validateParts(parts)
   toIsoDate(parts)
   formatChineseDate(isoValue, emptyLabel)
   shiftMonth(year, month, offset)
   buildMonthGrid(year, month)
   ```

4. 重跑测试并提交：`feat: add record date picker model`。

## 任务 2：替换记录表单的原生日期结构

**文件：**
- 修改：`index.html`
- 修改：`tests/story-interface.test.js`
- 修改：`tests/map-label-integration.test.js`

1. 先补结构测试，要求：
   - `quick-form` 仍保留原生 `type="date"`，计划添加方式不变；
   - `record-form` 不再包含原生 `type="date"`；
   - 记录表单仍保留 `name="start_date"` 和 `name="end_date"` 的隐藏 ISO 字段，确保 `FormData` 与现有保存逻辑兼容；
   - 存在“选择开始日期”“选择结束日期”两个摘要按钮；
   - 存在年、月、日三类数字输入，且带 `inputmode="numeric"` 和可访问标签；
   - 存在上月、下月按钮、月份标题、星期标题、日历网格和状态提示；
   - 在 `script.js` 前加载 `record-date-picker.js`。
2. 运行相关测试并确认先失败。
3. 将记录表单日期区替换为类似下面的语义结构：

   ```html
   <div class="record-date-picker" id="record-date-picker">
     <div class="record-date-summary" role="group" aria-label="行程日期范围">
       <button type="button" data-record-date-target="start">选择开始日期</button>
       <span aria-hidden="true">至</span>
       <button type="button" data-record-date-target="end">选择结束日期</button>
     </div>
     <input name="start_date" type="hidden" />
     <input name="end_date" type="hidden" />
     <div class="record-date-manual">…年 / 月 / 日输入…</div>
     <div class="record-calendar">…月份导航、星期与日期网格…</div>
     <p id="record-date-status" role="status"></p>
   </div>
   ```

4. 重跑测试并提交：`feat: add dual entry record date form`。

## 任务 3：实现双轨日期同步与表单校验

**文件：**
- 修改：`script.js`
- 修改：`tests/story-records-integration.test.js`

1. 先补集成契约测试，覆盖：
   - 日期状态明确分开保存 `start` 与 `end`，切换目标不会覆盖另一端；
   - 手动输入有效年份和月份后调用日历跳转；
   - 补齐有效日期后更新隐藏 ISO 字段与中文摘要；
   - 点击日历日期后反填年、月、日并更新摘要；
   - 开始日期晚于结束日期时阻止提交并显示“结束日期不能早于开始日期”；
   - 日期为空或非法时不上传照片、不关闭表单、不清空用户输入；
   - 成功保存仍调用 `MapLabelLayout.serializeDateRange`，保存后重置日期选择器。
2. 运行集成测试并确认先失败。
3. 在 `script.js` 增加记录日期状态和 UI 辅助函数：

   ```js
   const recordDateState = {
     active: "start",
     start: { parts: { year: "", month: "", day: "" }, iso: "" },
     end: { parts: { year: "", month: "", day: "" }, iso: "" },
     viewYear: new Date().getFullYear(),
     viewMonth: new Date().getMonth() + 1,
   };

   activateRecordDateTarget(target)
   updateRecordDateFromManual()
   selectRecordCalendarDay(day)
   changeRecordCalendarMonth(offset)
   renderRecordDatePicker()
   resetRecordDatePicker()
   validateRecordDateRange()
   ```

4. 事件规则：
   - 摘要按钮切换当前编辑“开始”或“结束”；
   - 年、月输入一旦同时有效，立即更新 `viewYear/viewMonth` 并重绘日历；
   - 日输入完整且日期有效时更新 ISO；非法日期只显示错误，不吞掉输入；
   - 日历按钮用事件委托选择日期，并完整反填手动输入；
   - 表单打开时聚焦“选择开始日期”按钮，不再聚焦隐藏字段；
   - 表单成功保存后才清空日期状态，失败时完整保留。
5. 重跑测试并提交：`feat: synchronize record date inputs and calendar`。

## 任务 4：完成日期选择器视觉与响应式布局

**文件：**
- 修改：`styles.css`
- 修改：`tests/story-styles.test.js`

1. 先补样式契约测试，检查：
   - 摘要按钮有当前目标高亮；
   - 年月日输入为同一行三段式布局，标签与数字清晰；
   - 日历为七列网格，选中日期使用玫红色圆形底；
   - 今天、不可用日期、悬停和键盘焦点都有可辨状态；
   - 768px 以下摘要与手动输入自动换行，按钮触控区域不少于 40px；
   - 空日期完全由中文按钮文案呈现，不依赖浏览器原生占位符。
2. 运行样式测试并确认先失败。
3. 使用现有奶油白、豆沙红、深灰变量实现已确认的效果图，不改变计划表单和胶囊日期控件。
4. 重跑测试并提交：`style: polish dual entry record date picker`。

## 任务 5：美化出游计划删除入口并加入确认

**文件：**
- 修改：`script.js`
- 修改：`styles.css`
- 新建：`tests/plan-delete.test.js`

1. 先写失败测试，要求：
   - `renderPlans()` 不再输出文字 `×`；
   - 每张计划卡输出圆形图标按钮和 `assets/icons/trash.svg`；
   - 删除按钮有包含计划名称的 `aria-label`；
   - `deletePlan()` 先调用 `confirmAction("确定删除这个出游计划吗？删除后无法恢复。")`；
   - 用户取消时不改本地数组、不调用云端删除；
   - 云端删除失败时不从界面悄悄移除计划；
   - 样式包含圆形、合适触控面积和清晰的 hover/focus 状态。
2. 运行测试并确认先失败。
3. 让计划删除按钮复用垃圾桶资源和现有确认对话框：

   ```html
   <button class="plan-delete" type="button" aria-label="删除出游计划：厦门">
     <img src="assets/icons/trash.svg" alt="" />
   </button>
   ```

4. 调整 `deletePlan()`：确认后再删除；云端失败时保留计划并显示离线状态。
5. 重跑测试并提交：`fix: confirm plan deletion with icon button`。

## 任务 6：完整回归与内置浏览器验收

**文件：**
- 仅在发现问题时修改上述文件，并补相应回归测试。

1. 运行全部自动化验证：

   ```bash
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check record-date-picker.js
   /Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check script.js
   ```

2. 检查 Git 差异，确认未修改 Supabase 配置、地图、纪念日、想做的事、相册、计划日期和胶囊日期行为。
3. 启动本地静态服务器并在 Codex 内置浏览器打开 `#records`，人工验收：
   - 空日期不显示 `yyyy/mm/dd`；
   - 开始/结束日期可独立切换；
   - 手动输入年份和月份时日历立即跳转；
   - 手动补齐日期与日历点击能双向同步；
   - 非法日期与反向日期范围会给出中文提示且保留表单；
   - 记录保存后的日期格式和旧数据一致；
   - 计划垃圾桶按钮美观，取消确认不删除，确认后才删除；
   - 桌面和窄屏均无溢出或遮挡。
4. 运行最终测试并提交修复（如有）。
5. 在内置浏览器中把本地页面交给用户验收。只有用户另行明确同意后，才合并到主分支并发布 GitHub Pages。

## 完成标准

- 所有自动化测试与 JavaScript 语法检查通过；
- 记录日期空值不出现浏览器原生 `yyyy/mm/dd`；
- 手动输入和日历点击双向同步，开始/结束状态互不干扰；
- 继续使用原有 ISO 日期范围存储格式，旧记录与线上数据无需迁移；
- 计划删除使用圆形垃圾桶图标并带确认，失败时不误删；
- 修改仅在本地分支完成，并已在 Codex 内置浏览器打开供用户验收；
- 未经再次授权，不修改 Supabase、不推送 GitHub、不发布线上页面。
