const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('登录用户可以从计划卡打开编辑表单', () => {
  const render = script.match(/function renderPlans\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(render, /class="plan-edit"/);
  assert.match(render, /data-edit-plan=/);
  assert.match(render, /openPlanEditor\(parseInt\(btn\.dataset\.editPlan\)\)/);
});

test('编辑计划会回填日期、路线和文字字段', () => {
  const editor = script.match(/function openPlanEditor\(index\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(editor, /form\.elements\.title\.value\s*=\s*plan\.title/);
  assert.match(editor, /form\.elements\.description\.value\s*=\s*plan\.description/);
  assert.match(editor, /restorePlanDateRange\(plan\.date\)/);
  assert.match(editor, /restoreRouteEditor\(normalizePlanSegments\(plan\)\)/);
  assert.match(editor, /setPlanFormMode\("edit"\)/);
});

test('编辑保存按原记录更新且失败时保留表单', () => {
  const update = script.match(/async function updatePlan\(index, entry\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(update, /state\.client\.update\(tables\.plans, plan\.id, entry\)/);
  assert.match(update, /catch\s*\(_\)\s*\{[\s\S]*?return false;/);
  assert.ok(update.indexOf('state.client.update') < update.indexOf('Object.assign'), '云端成功后才能改变本地计划');
  const submit = script.match(/form\.addEventListener\("submit", async function\(e\) \{([\s\S]*?)\n  \}\);/)[1];
  assert.match(submit, /submittedPlanIndex\s*=\s*editingPlanIndex/);
  assert.match(submit, /submittedPlanIndex\s*>=\s*0\s*\?\s*updatePlan\(submittedPlanIndex, entry\)\s*:\s*savePlan\(entry\)/);
});

test('关闭计划面板会退出编辑模式', () => {
  const close = script.match(/function closePanel\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(close, /editingPlanIndex\s*=\s*-1/);
  assert.match(close, /setPlanFormMode\("create"\)/);
});

test('计划编辑和删除操作在卡片右侧整齐排列', () => {
  assert.match(css, /\.plan-actions\s*\{[^}]*display:\s*flex[^}]*gap:/s);
  assert.match(css, /\.plan-edit\s*\{[^}]*min-height:\s*40px/s);
});
