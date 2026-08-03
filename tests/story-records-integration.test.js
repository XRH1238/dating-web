const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('记录表单独立保存完整故事字段', () => {
  assert.match(script, /#record-form/);
  assert.match(script, /MapLabelLayout\.serializeDateRange/);
  assert.match(script, /moods:/);
  assert.match(script, /photos:/);
  assert.match(script, /StoryData\.normalizeRecord/);
});

test('记录失败时保留表单并可确认删除', () => {
  assert.match(script, /record-form-status/);
  assert.match(script, /confirmAction/);
  assert.match(script, /deleteRecord/);
  assert.match(script, /data-delete-record/);
});

test('记录图片限制为六张并生成预览', () => {
  assert.match(script, /slice\(0,\s*6\)/);
  assert.match(script, /record-photo-preview/);
});
