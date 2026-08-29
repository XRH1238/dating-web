const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('出游记录区包含统计、时间轴和时间胶囊', () => {
  ['trip-count', 'city-count', 'story-photo-count', 'story-timeline', 'time-capsule'].forEach(id => assert.match(html, new RegExp(`id="${id}"`)));
});

test('记录拥有独立的完整表单和预览', () => {
  assert.match(html, /id="record-panel"/);
  ['start_date', 'end_date', 'city', 'title', 'description', 'moods', 'photos'].forEach(name => assert.match(html, new RegExp(`name="${name}"`)));
  assert.match(html, /id="record-photo-preview"/);
  const recordForm = html.match(/<form id="record-form">([\s\S]*?)<\/form>/)[1];
  assert.match(recordForm, /id="custom-mood-input"/);
  assert.match(recordForm, /id="add-custom-mood"/);
  assert.match(recordForm, /id="mood-status"[^>]*role="status"/);
  assert.match(recordForm, /data-default-mood/);
});

test('记录日期使用中文摘要、手动年月日和共享日历', () => {
  const recordForm = html.match(/<form id="record-form">([\s\S]*?)<\/form>/)[1];
  assert.doesNotMatch(recordForm, /type="date"/);
  assert.match(recordForm, /name="start_date" type="hidden"/);
  assert.match(recordForm, /name="end_date" type="hidden"/);
  assert.match(recordForm, />选择开始日期</);
  assert.match(recordForm, />选择结束日期</);
  ['year', 'month', 'day'].forEach(part => assert.match(recordForm, new RegExp(`data-record-date-part="${part}"[^>]*inputmode="numeric"`)));
  ['record-date-prev', 'record-date-next', 'record-date-heading', 'record-date-grid', 'record-date-status'].forEach(id => assert.match(recordForm, new RegExp(`id="${id}"`)));
  assert.match(html, /<script src="record-date-picker\.js[^>]*><\/script>[\s\S]*<script src="script\.js/);
});

test('时间胶囊拥有独立表单和确认对话框', () => {
  assert.match(html, /id="capsule-panel"/);
  assert.match(html, /id="capsule-form"/);
  assert.match(html, /name="unlock_date"/);
  assert.match(html, /id="confirm-dialog"/);
});
