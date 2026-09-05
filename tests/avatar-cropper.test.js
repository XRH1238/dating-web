const test = require('node:test');
const assert = require('node:assert/strict');

const AvatarCropper = require('../avatar-cropper.js');

test('初始缩放完全覆盖固定裁剪框', () => {
  assert.equal(AvatarCropper.fitScale(1200, 800, 280), 0.35);
  assert.equal(AvatarCropper.fitScale(600, 1200, 280), 280 / 600);
  assert.equal(AvatarCropper.fitScale(500, 500, 280), 0.56);
});

test('偏移不会让裁剪框露出空白', () => {
  assert.deepEqual(AvatarCropper.clampOffset({
    x: 500, y: -500, imageWidth: 1200, imageHeight: 800, scale: 0.5, frameSize: 280,
  }), { x: 160, y: -60 });
});

test('输出裁剪区域映射回原图像素', () => {
  assert.deepEqual(AvatarCropper.cropSourceRect({
    x: 20, y: -10, imageWidth: 1200, imageHeight: 800, scale: 0.5, frameSize: 280,
  }), { sx: 280, sy: 140, size: 560 });
});

test('缩放倍率被限制在 1 到 3 倍', () => {
  assert.equal(AvatarCropper.clampZoom(0.3), 1);
  assert.equal(AvatarCropper.clampZoom(2.25), 2.25);
  assert.equal(AvatarCropper.clampZoom(9), 3);
});
