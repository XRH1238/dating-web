const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
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
