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
});

test('时间胶囊拥有独立表单和确认对话框', () => {
  assert.match(html, /id="capsule-panel"/);
  assert.match(html, /id="capsule-form"/);
  assert.match(html, /name="unlock_date"/);
  assert.match(html, /id="confirm-dialog"/);
});
