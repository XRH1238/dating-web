const test = require('node:test');
const assert = require('node:assert/strict');
const ImageCompression = require('../image-compression.js');

test('最长边限制为 3200 且按比例缩小', () => {
  assert.deepEqual(ImageCompression.targetDimensions(6000, 4000, 3200), { width: 3200, height: 2133 });
  assert.deepEqual(ImageCompression.targetDimensions(4000, 6000, 3200), { width: 2133, height: 3200 });
});

test('尺寸小于限制时不会放大', () => {
  assert.deepEqual(ImageCompression.targetDimensions(1200, 800, 3200), { width: 1200, height: 800 });
});

test('压缩文件不更小时保留原文件', () => {
  const original = { size: 1000 };
  const larger = { size: 1200 };
  const smaller = { size: 700 };
  assert.equal(ImageCompression.preferSmaller(original, larger), original);
  assert.equal(ImageCompression.preferSmaller(original, smaller), smaller);
  assert.equal(ImageCompression.preferSmaller(original, null), original);
});

test('WebP 文件名会替换原扩展名', () => {
  assert.equal(ImageCompression.webpName('IMG_1234.JPG'), 'IMG_1234.webp');
  assert.equal(ImageCompression.webpName('memory'), 'memory.webp');
});

test('只压缩普通图片文件', () => {
  assert.equal(ImageCompression.canCompress({ type: 'image/jpeg', name: 'a.jpg' }), true);
  assert.equal(ImageCompression.canCompress({ type: 'video/mp4', name: 'a.mp4' }), false);
  assert.equal(ImageCompression.canCompress({ type: 'image/gif', name: 'a.gif' }), false);
});
