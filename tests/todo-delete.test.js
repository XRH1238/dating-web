const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('想做的事删除前确认且云端失败时保留事项', () => {
  const match = script.match(/async function deleteTodo\(index\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(match, '缺少 deleteTodo 函数');
  const deletion = match[1];
  assert.match(deletion, /await confirmAction\("确定删除这件想做的事吗？删除后无法恢复。"\)/);
  assert.ok(deletion.indexOf('confirmAction') < deletion.indexOf('state.client.remove'), '确认应发生在云端删除前');
  assert.match(deletion, /catch\s*\(_\)\s*\{[\s\S]*?setCloudStatus\("offline"\);[\s\S]*?return;/);
  assert.ok(deletion.indexOf('state.client.remove') < deletion.indexOf('state.todos.splice'), '本地移除应发生在云端删除成功后');
});

test('每条事项渲染完成按钮和带名称的垃圾桶按钮', () => {
  const match = script.match(/function renderTodos\(\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(match, '缺少 renderTodos 函数');
  const render = match[1];
  assert.match(render, /class="todo-actions"/);
  assert.match(render, /data-delete-todo=/);
  assert.match(render, /aria-label="删除想做的事：/);
  assert.match(render, /assets\/icons\/trash\.svg/);
  assert.match(render, /deleteTodo\(parseInt\(btn\.dataset\.deleteTodo\)\)/);
  assert.match(render, /data-delete-todo="' \+ entry\.index/);
});

test('完成与删除按钮并排显示且保持各自状态', () => {
  assert.match(css, /\.todo-actions\s*\{[^}]*display:\s*flex[^}]*gap:\s*10px/s);
  assert.match(css, /\.todo-toggle,\s*\n\.todo-delete\s*\{[^}]*width:\s*28px[^}]*height:\s*28px/s);
  assert.match(css, /\.todo-row\.done \.todo-toggle\s*\{[^}]*background:\s*var\(--rose\)/s);
  assert.match(css, /\.todo-delete\s*\{[^}]*background:\s*rgba\(217,\s*95,\s*120,\s*0\.08\)/s);
  assert.doesNotMatch(css, /\.todo-row\.done button\s*\{/);
  assert.match(css, /\.todo-delete img\s*\{[^}]*width:\s*15px[^}]*height:\s*15px/s);
});
