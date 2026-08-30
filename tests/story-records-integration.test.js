const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('记录表单独立保存完整故事字段', () => {
  assert.match(script, /#record-form/);
  assert.match(script, /MapLabelLayout\.serializeDateRange/);
  assert.match(script, /moods:/);
  assert.match(script, /photos:/);
  assert.match(script, /StoryData\.normalizeRecord/);
});

test('记录正文保留输入时的换行和空行', () => {
  assert.match(script, /<p class="story-card-description">/);
  assert.match(css, /\.story-card-description\s*\{[^}]*white-space:\s*pre-wrap/s);
});

test('记录失败时保留表单并可确认删除', () => {
  assert.match(script, /record-form-status/);
  assert.match(script, /confirmAction/);
  assert.match(script, /deleteRecord/);
  assert.match(script, /data-delete-record/);
});

test('记录媒体限制为二十个并生成预览', () => {
  assert.match(script, /LivePhotoMedia\.selectMedia\([^,]+,\s*current\.length,\s*20\)/);
  assert.match(script, /function appendRecordDraftMedia\(files\)/);
  assert.match(script, /LivePhotoMedia\.selectMedia\(files,\s*existingCount,\s*20\)/);
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
  assert.match(submit, /clearRecordEditor\((?:true)?\)/);
  assert.match(script, /function clearRecordEditor\(preserveDraft\)[\s\S]*?resetRecordDatePicker\(\)/);
});

test('记录表单输入会写入本机草稿并在刷新后恢复', () => {
  assert.match(html, /<script src="record-recovery\.js\?v=[^"]+"><\/script>[\s\S]*<script src="script\.js/);
  assert.match(script, /RecordRecovery\.createDraftStore/);
  assert.match(script, /recordForm\.addEventListener\("input",\s*saveRecordDraft\)/);
  assert.match(script, /function restoreRecordDraft\(\)/);
  assert.match(script, /已恢复上次未保存的草稿/);
});

test('自定义心情可以添加、随草稿恢复并在清空时移除', () => {
  assert.match(script, /function addCustomMood\(\)/);
  assert.match(script, /function createMoodOption\(value, isDefault\)/);
  assert.match(script, /function restoreMoodOptions\(selectedMoods\)/);
  assert.match(script, /RecordMoods\.addMood/);
  assert.match(script, /event\.key === "Enter"/);
  assert.match(script, /input\.checked = selectedMoods\.includes\(input\.value\)/);
  assert.match(script, /\[data-custom-mood\]/);
});

test('离线保存与网络失败都会生成待同步的本机记录', () => {
  const submit = script.match(/async function submitRecordForm\(event\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(submit, /persistPendingRecord/);
  assert.match(script, /RecordRecovery\.createPendingRecord/);
  assert.match(script, /RecordRecovery\.mergeRemoteRecords/);
  assert.match(script, /async function syncPendingRecords\(\)/);
});

test('记录卡片提供编辑入口并按记录 ID 打开表单', () => {
  assert.match(script, /data-edit-record-id/);
  assert.match(script, /function openRecordEditor\(recordId\)/);
  assert.match(script, /String\(item\.id\)\s*===\s*String\(recordId\)/);
  assert.match(script, /restoreRecordDateRange\(record\.date\)/);
  assert.match(script, /MapLabelLayout\.parseDateRange\(value\)/);
  assert.match(html, /id="record-submit-button"/);
});

test('编辑模式保留旧媒体并允许移除旧媒体或新增媒体', () => {
  assert.match(script, /let editingRecordId = null/);
  assert.match(script, /let recordExistingPhotos = \[\]/);
  assert.match(script, /let recordRemovedPhotos = \[\]/);
  assert.match(script, /data-remove-existing-record-media/);
  assert.match(script, /data-remove-new-record-media/);
  assert.match(script, /recordExistingPhotos\.length \+ recordDraftFiles\.length/);
  assert.match(css, /\.record-media-remove/);
});

test('编辑记录按 ID 更新并在成功后删除被移除的旧照片', () => {
  const submitStart = script.indexOf('async function submitRecordForm');
  const deleteStart = script.indexOf('async function deleteRecord', submitStart);
  const submit = script.slice(submitStart, deleteStart);
  assert.match(submit, /state\.client\.update\(tables\.records,\s*editingRecordId/);
  assert.match(submit, /await removeRecordMedia\(recordRemovedPhotos\)/);
  assert.ok(submit.indexOf('state.client.update') < submit.indexOf('removeRecordMedia(recordRemovedPhotos)'), '必须先更新记录再删除旧媒体');
  assert.match(script, /cleanupUploadedRecordMedia/);
});

test('编辑保存期间禁用提交按钮且失败时保留表单', () => {
  assert.match(script, /recordSubmitButton\.disabled = true/);
  assert.match(script, /recordSubmitButton\.disabled = false/);
  assert.match(script, /修改没有成功，原记录没有变化/);
});
