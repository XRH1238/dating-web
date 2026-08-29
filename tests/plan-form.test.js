const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const planForm = html.match(/<form id="quick-form">([\s\S]*?)<\/form>/)[1];

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

test('打开计划面板只重置计划日期', () => {
  assert.match(script, /resetRouteEditor\(\);\s*resetPlanDatePicker\(\);/);
  assert.doesNotMatch(script, /resetRouteEditor\(\);\s*resetRecordDatePicker\(\);/);
});

test('空计划描述不会渲染空段落', () => {
  const render = script.match(/function renderPlans\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(render, /String\(p\.description\s*\|\|\s*""\)\.trim\(\)/);
  assert.match(render, /description\s*\?\s*'<p>'/);
});
