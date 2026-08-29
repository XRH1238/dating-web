const test = require('node:test');
const assert = require('node:assert/strict');
const Moods = require('../record-moods.js');

test('自定义心情会清除首尾空格并追加到选项', () => {
  assert.deepEqual(Moods.addMood(['开心'], ' 期待 '), {
    moods: ['开心', '期待'], value: '期待', added: true, error: ''
  });
});

test('重复心情复用已有选项且空内容被拒绝', () => {
  assert.deepEqual(Moods.addMood(['开心'], '开心'), {
    moods: ['开心'], value: '开心', added: false, error: ''
  });
  assert.equal(Moods.addMood(['开心'], '   ').error, '请输入心情');
});

test('恢复草稿时合并示例与自定义心情并保持顺序', () => {
  assert.deepEqual(Moods.mergeMoodOptions(['开心', '浪漫'], ['浪漫', '放松', '开心']),
    ['开心', '浪漫', '放松']);
});
