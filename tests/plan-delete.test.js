const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('计划卡使用带名称的垃圾桶图标按钮', () => {
  const render = script.match(/function renderPlans\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.doesNotMatch(render, />×<\/button>/);
  assert.match(render, /class="plan-delete"/);
  assert.match(render, /assets\/icons\/trash\.svg/);
  assert.match(render, /aria-label="删除出游计划：/);
  assert.match(render, /escapeHtml\(p\.title/);
});

test('计划删除先确认且失败时保留本地计划', () => {
  const deletion = script.match(/async function deletePlan\(index\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(deletion, /await confirmAction\("确定删除这个出游计划吗？删除后无法恢复。"\)/);
  assert.ok(deletion.indexOf('confirmAction') < deletion.indexOf('state.client.remove'), '确认应发生在云端删除前');
  assert.match(deletion, /catch\s*\(_\)\s*\{[\s\S]*?setCloudStatus\("offline"\);[\s\S]*?return;/);
  assert.ok(deletion.indexOf('state.client.remove') < deletion.indexOf('state.plans.splice'), '本地移除应发生在云端删除成功后');
});

test('计划删除按钮为圆形并拥有悬停与键盘焦点状态', () => {
  assert.match(css, /\.plan-delete\s*\{[^}]*min-width:\s*40px[^}]*border-radius:\s*50%/s);
  assert.match(css, /\.plan-delete img/);
  assert.match(css, /\.plan-delete:hover,[\s\S]*?\.plan-delete:focus-visible/);
});
