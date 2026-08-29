const test = require('node:test');
const assert = require('node:assert/strict');

const DatePicker = require('../record-date-picker.js');

test('闰年与普通年份返回正确的二月天数', () => {
  assert.equal(DatePicker.daysInMonth(2024, 2), 29);
  assert.equal(DatePicker.daysInMonth(2026, 2), 28);
});

test('ISO 日期与年月日可以双向转换', () => {
  assert.deepEqual(DatePicker.createParts('2026-08-05'), { year: '2026', month: '8', day: '5' });
  assert.equal(DatePicker.toIsoDate({ year: '2026', month: '8', day: '5' }), '2026-08-05');
});

test('仅填写年月时保持未选择日期', () => {
  const result = DatePicker.validateParts({ year: '2026', month: '8', day: '' });
  assert.equal(result.complete, false);
  assert.equal(result.valid, true);
  assert.equal(DatePicker.toIsoDate({ year: '2026', month: '8', day: '' }), '');
});

test('非法日期返回明确的中文错误', () => {
  const result = DatePicker.validateParts({ year: '2026', month: '2', day: '30' });
  assert.equal(result.valid, false);
  assert.match(result.message, /日期不存在/);
  assert.equal(DatePicker.toIsoDate({ year: '2026', month: '2', day: '30' }), '');
});

test('月份切换可以正确跨年', () => {
  assert.deepEqual(DatePicker.shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(DatePicker.shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test('日历网格包含星期前置空位与当月全部日期', () => {
  const grid = DatePicker.buildMonthGrid(2026, 8);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid.filter(Boolean).length, 31);
  assert.equal(grid.indexOf(1), new Date(2026, 7, 1).getDay());
  assert.equal(grid[grid.lastIndexOf(31)], 31);
});

test('中文摘要支持完整日期和空值文案', () => {
  assert.equal(DatePicker.formatChineseDate('2026-08-05', '选择开始日期'), '2026年8月5日');
  assert.equal(DatePicker.formatChineseDate('', '选择开始日期'), '选择开始日期');
});

test('开始日期首次变为完整有效日期后切换到结束日期', () => {
  assert.equal(DatePicker.shouldAdvanceToEnd('start', '', '2026-08-05'), true);
  assert.equal(DatePicker.shouldAdvanceToEnd('start', '2026-08-04', '2026-08-05'), false);
  assert.equal(DatePicker.shouldAdvanceToEnd('end', '', '2026-08-05'), false);
  assert.equal(DatePicker.shouldAdvanceToEnd('start', '', ''), false);
});
