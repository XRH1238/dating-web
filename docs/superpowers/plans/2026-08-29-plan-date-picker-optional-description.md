# 出游计划日期选择器与可选描述实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让添加出游计划复用出游记录的日期选择体验，并允许简短描述为空。

**架构：** 计划表单使用现有日期选择器的 CSS 类和 `record-date-picker.js` 日期算法，但保留独立的 DOM ID、状态对象和事件函数，避免影响记录草稿。计划继续通过 `MapLabelLayout.serializeDateRange` 保存原有日期范围字符串，描述继续保存字符串但空值不渲染段落。

**技术栈：** 原生 HTML/CSS/JavaScript、Node.js `node:test`、现有 `RecordDatePicker` 与 `MapLabelLayout` 模块。

---

## 文件结构

- 修改 `index.html`：替换计划原生日期输入，取消描述必填，更新脚本缓存版本。
- 修改 `script.js`：增加计划专属日期状态、交互、校验和空描述渲染逻辑。
- 修改 `tests/map-label-integration.test.js`：更新计划日期表单的集成约束。
- 创建 `tests/plan-form.test.js`：覆盖计划日期结构、独立交互和可选描述。
- 验证 `record-date-picker.js`、`styles.css`：复用现有模块与样式，不修改其行为。

### 任务 1：锁定计划表单的新结构与描述约束

**文件：**
- 创建：`tests/plan-form.test.js`
- 修改：`tests/map-label-integration.test.js`
- 修改：`index.html:260-286`

- [ ] **步骤 1：编写失败的结构测试**

在 `tests/plan-form.test.js` 中读取 `index.html`，提取 `quick-form`，加入以下断言：

```js
test('计划日期使用独立的中文摘要、手动输入和月历', () => {
  assert.doesNotMatch(planForm, /type="date"/);
  assert.match(planForm, /id="plan-date-picker"/);
  assert.match(planForm, /name="start_date" type="hidden"/);
  assert.match(planForm, /name="end_date" type="hidden"/);
  ['start', 'end'].forEach(target => {
    assert.match(planForm, new RegExp(`data-plan-date-target="${target}"`));
  });
  ['year', 'month', 'day'].forEach(part => {
    assert.match(planForm, new RegExp(`data-plan-date-part="${part}"[^>]*inputmode="numeric"`));
  });
  ['plan-date-prev', 'plan-date-next', 'plan-date-heading', 'plan-date-grid', 'plan-date-status'].forEach(id => {
    assert.match(planForm, new RegExp(`id="${id}"`));
  });
});

test('计划简短描述允许为空', () => {
  const description = planForm.match(/<textarea name="description"[^>]*>/)[0];
  assert.doesNotMatch(description, /\srequired(?:\s|>)/);
});
```

把 `tests/map-label-integration.test.js` 中“计划保留原生日期”测试改为断言计划和记录都使用隐藏 ISO 日期，且各自拥有独立容器。

- [ ] **步骤 2：运行测试验证正确失败**

运行：

```bash
node --test tests/plan-form.test.js tests/map-label-integration.test.js
```

预期：FAIL，指出计划仍包含 `type="date"`、缺少 `plan-date-picker`，且描述仍有 `required`。

- [ ] **步骤 3：写入最少 HTML 实现**

在 `quick-form` 中用与记录相同的视觉结构替换 `.date-range-fields`：

```html
<div class="record-date-picker" id="plan-date-picker">
  <div class="record-date-summary" role="group" aria-label="计划日期范围">
    <button class="record-date-summary-button is-active" type="button" data-plan-date-target="start" aria-pressed="true"><span>开始日期</span><strong>选择开始日期</strong></button>
    <span class="record-date-arrow" aria-hidden="true">至</span>
    <button class="record-date-summary-button" type="button" data-plan-date-target="end" aria-pressed="false"><span>结束日期</span><strong>选择结束日期</strong></button>
  </div>
  <input name="start_date" type="hidden" />
  <input name="end_date" type="hidden" />
  <div class="record-date-manual" role="group" aria-label="手动填写当前计划日期">
    <label><span>年</span><input data-plan-date-part="year" inputmode="numeric" autocomplete="off" maxlength="4" aria-label="年份" /></label><span aria-hidden="true">年</span>
    <label><span>月</span><input data-plan-date-part="month" inputmode="numeric" autocomplete="off" maxlength="2" aria-label="月份" /></label><span aria-hidden="true">月</span>
    <label><span>日</span><input data-plan-date-part="day" inputmode="numeric" autocomplete="off" maxlength="2" aria-label="日期" /></label><span aria-hidden="true">日</span>
  </div>
  <div class="record-calendar" aria-labelledby="plan-date-heading">
    <div class="record-calendar-head">
      <button id="plan-date-prev" type="button" aria-label="上一个月">‹</button>
      <strong id="plan-date-heading">选择日期</strong>
      <button id="plan-date-next" type="button" aria-label="下一个月">›</button>
    </div>
    <div class="record-calendar-weekdays" aria-hidden="true"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
    <div class="record-date-grid" id="plan-date-grid" role="grid" aria-label="日期"></div>
  </div>
  <p class="record-date-status" id="plan-date-status" role="status" aria-live="polite"></p>
</div>
```

移除计划描述文本域的 `required`，保留名称、行数和占位文案。

- [ ] **步骤 4：运行结构测试确认通过**

运行：

```bash
node --test tests/plan-form.test.js tests/map-label-integration.test.js
```

预期：结构相关测试 PASS；行为测试尚未加入。

- [ ] **步骤 5：提交结构变更**

```bash
git add index.html tests/plan-form.test.js tests/map-label-integration.test.js
git commit -m "feat: align plan date picker markup"
```

### 任务 2：实现计划专属日期状态和校验

**文件：**
- 修改：`tests/plan-form.test.js`
- 修改：`script.js:65-470`

- [ ] **步骤 1：编写失败的交互测试**

在 `tests/plan-form.test.js` 中读取 `script.js` 并加入：

```js
test('计划日期拥有独立状态和事件入口', () => {
  assert.match(script, /planDateState\s*=\s*\{[\s\S]*active:\s*"start"[\s\S]*start:[\s\S]*end:/);
  assert.match(script, /function bindPlanDatePicker\(\)/);
  assert.match(script, /function activatePlanDateTarget\(target\)/);
  assert.match(script, /function updatePlanDateFromManual\(part, value\)/);
  assert.match(script, /function selectPlanCalendarDay\(day\)/);
  assert.match(script, /function changePlanCalendarMonth\(offset\)/);
});

test('计划提交先校验日期范围并保持原有序列化格式', () => {
  assert.match(script, /function validatePlanDateRange\(\)/);
  assert.match(script, /MapLabelLayout\.serializeDateRange\(planDateState\.start\.iso, planDateState\.end\.iso\)/);
  const submit = script.match(/form\.addEventListener\("submit", async function\(e\) \{([\s\S]*?)\n  \}\);/)[1];
  assert.match(submit, /date\s*=\s*validatePlanDateRange\(\)/);
  assert.match(submit, /if\s*\(!date\)\s*return/);
});

test('打开计划面板会重置计划日期但不调用记录日期重置', () => {
  const opener = script.match(/document\.querySelectorAll\("\[data-open-panel\]"\)[\s\S]*?\n  \}\);/)[0];
  assert.match(opener, /resetPlanDatePicker\(\)/);
  assert.doesNotMatch(opener, /resetRecordDatePicker\(\)/);
});
```

- [ ] **步骤 2：运行测试验证正确失败**

运行：

```bash
node --test tests/plan-form.test.js
```

预期：FAIL，指出 `planDateState` 和计划日期函数尚不存在。

- [ ] **步骤 3：实现独立计划日期状态**

在 DOM 引用区添加：

```js
const planDatePicker = document.querySelector("#plan-date-picker");
const planDateState = {
  active: "start",
  start: { parts: { year: "", month: "", day: "" }, iso: "" },
  end: { parts: { year: "", month: "", day: "" }, iso: "" },
  viewYear: new Date().getFullYear(),
  viewMonth: new Date().getMonth() + 1,
};
```

新增 `bindPlanDatePicker`、`activatePlanDateTarget`、`updatePlanDateFromManual`、`selectPlanCalendarDay`、`changePlanCalendarMonth`、`renderPlanDatePicker`、`setPlanDateStatus`、`resetPlanDatePicker` 和 `validatePlanDateRange`。这些函数读取 `data-plan-*` 和 `#plan-date-*`，日期计算调用现有 `window.RecordDatePicker`。

`validatePlanDateRange` 的成功分支必须是：

```js
return window.MapLabelLayout.serializeDateRange(planDateState.start.iso, planDateState.end.iso);
```

失败时分别显示“请选择完整的开始日期”“请选择完整的结束日期”或“结束日期不能早于开始日期”，并返回空字符串。

- [ ] **步骤 4：接入打开、提交和初始化流程**

- 打开计划面板时调用 `resetPlanDatePicker()`。
- 计划提交时先调用 `validatePlanDateRange()`，空结果直接返回且不清空表单。
- 成功保存后 `form.reset()` 并再次重置计划日期状态。
- `bindEvents()` 末尾同时调用 `bindPlanDatePicker()` 和现有 `bindRecordDatePicker()`。
- 删除原生日期输入专用的 `syncEndDateMinimum` 监听和函数。

- [ ] **步骤 5：运行交互测试确认通过**

运行：

```bash
node --test tests/plan-form.test.js tests/record-date-picker.test.js tests/story-records-integration.test.js
```

预期：全部 PASS，记录日期测试保持通过。

- [ ] **步骤 6：提交日期行为变更**

```bash
git add script.js tests/plan-form.test.js
git commit -m "feat: add plan date picker behavior"
```

### 任务 3：避免空描述产生空白卡片内容

**文件：**
- 修改：`tests/plan-form.test.js`
- 修改：`script.js:1060-1080`

- [ ] **步骤 1：编写失败的渲染测试**

```js
test('空计划描述不会渲染空段落', () => {
  const render = script.match(/function renderPlans\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(render, /String\(p\.description\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(render, /description\s*\?\s*'<p>'/);
});
```

- [ ] **步骤 2：运行测试验证正确失败**

运行：

```bash
node --test tests/plan-form.test.js
```

预期：FAIL，现有渲染逻辑无条件输出 `<p>`。

- [ ] **步骤 3：实现条件描述渲染**

在每个计划映射回调中规范化描述：

```js
var description = String(p.description || "").trim();
```

标题后只在 `description` 非空时拼接经过 `escapeHtml` 的 `<p>`。

- [ ] **步骤 4：运行计划表单测试确认通过**

运行：

```bash
node --test tests/plan-form.test.js
```

预期：全部 PASS。

- [ ] **步骤 5：提交空描述渲染变更**

```bash
git add script.js tests/plan-form.test.js
git commit -m "fix: omit empty plan descriptions"
```

### 任务 4：完整验证与浏览器检查

**文件：**
- 修改：`index.html:370-375`（仅在主脚本内容变化后更新缓存版本）

- [ ] **步骤 1：更新脚本缓存版本**

将 `script.js` 的查询版本更新为本次日期版本，确保浏览器不会继续运行旧脚本。

- [ ] **步骤 2：运行完整自动化测试**

运行：

```bash
node --test tests/*.test.js
```

预期：0 个失败，输出无未处理异常。

- [ ] **步骤 3：检查实际变更范围**

运行：

```bash
git diff --check
git status --short
git diff -- index.html script.js tests/plan-form.test.js tests/map-label-integration.test.js
```

预期：无空白错误；只有批准范围内文件发生变化，其他用户文件保持未动。

- [ ] **步骤 4：在本地浏览器验证**

- 打开网站并进入“添加出游计划”。
- 桌面端检查开始/结束摘要、年月日输入、翻月和选日。
- 窄屏检查摘要单列、手动输入换行且无横向滚动。
- 不填写简短描述，使用有效日期保存计划；确认列表不出现空白描述段落。
- 再打开“写一条出游记录”，确认其日期控件仍独立工作。

- [ ] **步骤 5：提交验证相关版本更新**

```bash
git add index.html
git commit -m "chore: refresh plan form assets"
```
