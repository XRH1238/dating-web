const test = require('node:test');
const assert = require('node:assert/strict');
const LivePhoto = require('../live-photo.js');

const file = (name, type) => ({ name, type });

test('同名图片和 MOV 自动组成一个实况照片', () => {
  const result = LivePhoto.selectMedia([
    file('IMG_1234.HEIC', 'image/heic'),
    file('IMG_1234.MOV', 'video/quicktime'),
  ], 0, 20);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].kind, 'live-photo');
  assert.equal(result.items[0].photoFile.name, 'IMG_1234.HEIC');
  assert.equal(result.items[0].motionFile.name, 'IMG_1234.MOV');
  assert.equal(result.pairedCount, 1);
});

test('空 MIME、混合大小写和逻辑媒体上限都能处理', () => {
  const result = LivePhoto.selectMedia([
    file('holiday.HeIc', ''),
    file('HOLIDAY.mov', ''),
    file('single.jpg', 'image/jpeg'),
  ], 19, 20);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].kind, 'live-photo');
  assert.equal(result.overflowCount, 1);
});

test('未匹配 MOV 保持普通视频并被报告', () => {
  const result = LivePhoto.selectMedia([file('clip.mov', '')], 0, 20);
  assert.equal(result.items[0].kind, 'video');
  assert.equal(result.unmatchedMotionCount, 1);
});

test('不支持的文件会被忽略并计数', () => {
  const result = LivePhoto.selectMedia([file('notes.txt', 'text/plain')], 0, 20);
  assert.deepEqual(result.items, []);
  assert.equal(result.rejectedCount, 1);
});
