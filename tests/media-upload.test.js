const test = require('node:test');
const assert = require('node:assert/strict');
const MediaUpload = require('../media-upload.js');

function file(name, type) { return { name, type }; }

test('只接收照片和视频并报告被拒文件', () => {
  const result = MediaUpload.selectFiles([
    file('a.jpg', 'image/jpeg'), file('b.mp4', 'video/mp4'), file('c.pdf', 'application/pdf')
  ], 0, 20);
  assert.deepEqual(result.files.map(item => item.name), ['a.jpg', 'b.mp4']);
  assert.equal(result.rejectedCount, 1);
  assert.equal(result.overflowCount, 0);
});

test('已有草稿计入 20 个总上限', () => {
  const files = Array.from({ length: 5 }, (_, index) => file(`${index}.jpg`, 'image/jpeg'));
  const result = MediaUpload.selectFiles(files, 18, 20);
  assert.equal(result.files.length, 2);
  assert.equal(result.overflowCount, 3);
  assert.equal(result.limit, 20);
});

test('通过 MIME、Data URL 或扩展名识别视频', () => {
  assert.equal(MediaUpload.isVideo({ type: 'video/webm', name: 'clip.bin' }), true);
  assert.equal(MediaUpload.isVideo({ url: 'data:video/mp4;base64,AAAA' }), true);
  assert.equal(MediaUpload.isVideo({ name: 'memory.MOV' }), true);
  assert.equal(MediaUpload.isVideo({ name: 'memory.jpg', type: 'image/jpeg' }), false);
});
