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

test('开始与结束日期拥有独立状态并可切换编辑目标', () => {
  assert.match(script, /recordDateState\s*=\s*\{[\s\S]*active:\s*"start"[\s\S]*start:[\s\S]*end:/);
  assert.match(script, /function activateRecordDateTarget\(target\)/);
  assert.match(script, /data-record-date-target/);
  assert.match(script, /aria-pressed/);
});

test('手动年月会跳转日历且完整日期同步到隐藏字段', () => {
  assert.match(script, /function updateRecordDateFromManual\(part, value\)/);
  assert.match(script, /recordDateState\.viewYear\s*=\s*year/);
  assert.match(script, /recordDateState\.viewMonth\s*=\s*month/);
  assert.match(script, /RecordDatePicker\.validateParts/);
  assert.match(script, /RecordDatePicker\.toIsoDate/);
  assert.match(script, /recordForm\.elements\.start_date\.value/);
  assert.match(script, /recordForm\.elements\.end_date\.value/);
});

test('日历选日会反填当前日期且支持前后翻月', () => {
  assert.match(script, /function selectRecordCalendarDay\(day\)/);
  assert.match(script, /function changeRecordCalendarMonth\(offset\)/);
  assert.match(script, /RecordDatePicker\.shiftMonth/);
  assert.match(script, /RecordDatePicker\.buildMonthGrid/);
});

test('日期校验早于照片上传且失败时不会清空表单', () => {
  assert.match(script, /function validateRecordDateRange\(\)/);
  assert.match(script, /请选择完整的开始日期/);
  assert.match(script, /结束日期不能早于开始日期/);
  const submit = script.match(/async function submitRecordForm\(event\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.ok(submit.indexOf('validateRecordDateRange()') < submit.indexOf('uploadStoryFiles'), '应先验证日期再上传照片');
  assert.match(submit, /if\s*\(!date\)\s*return/);
  assert.match(submit, /resetRecordDatePicker\(\)/);
});
