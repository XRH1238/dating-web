const test = require('node:test');
const assert = require('node:assert/strict');
const Viewer = require('../media-viewer.js');

test('查看器循环切换并允许缩小到适屏比例以下', () => {
  const state = Viewer.createState([{ url: 'a.jpg' }, { url: 'b.jpg' }], 0);
  assert.equal(Viewer.move(state, -1).index, 1);
  assert.equal(Viewer.move(state, 1).index, 1);
  assert.equal(Viewer.clampScale(0.2), 0.25);
  assert.equal(Viewer.clampScale(0), 0.25);
  assert.equal(Viewer.clampScale(0.6), 0.6);
  assert.equal(Viewer.clampScale(8), 5);
});

test('切换媒体时恢复适屏缩放、平移位置与 Apple 播放状态', () => {
  const state = { items: [{ url: 'a.jpg' }], index: 0, scale: 3, x: 40, y: -60, appleFailed: true };
  const next = Viewer.move(state, 1);
  assert.equal(next.scale, 1);
  assert.equal(next.x, 0);
  assert.equal(next.y, 0);
  assert.equal(next.appleFailed, false);
});

test('放大后平移被限制在仍能看到照片的范围内', () => {
  assert.deepEqual(
    Viewer.clampPan({ x: 500, y: -500 }, 2, { width: 300, height: 200 }),
    { x: 150, y: -100 }
  );
  assert.deepEqual(
    Viewer.clampPan({ x: 80, y: 60 }, 0.75, { width: 300, height: 200 }),
    { x: 0, y: 0 }
  );
});

test('双指距离和中点计算使用有效坐标', () => {
  assert.equal(Viewer.pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(
    Viewer.pointerMidpoint({ x: 10, y: 20 }, { x: 30, y: 50 }),
    { x: 20, y: 35 }
  );
});

test('围绕非中心焦点缩放时保持焦点下的图片内容稳定', () => {
  const next = Viewer.zoomAroundPoint(
    { scale: 1, x: 0, y: 0 },
    2,
    { x: 225, y: 100 },
    { width: 300, height: 200 }
  );
  assert.deepEqual(next, { scale: 2, x: -75, y: 0 });
});

test('焦点缩放接受边缘零坐标并继续限制缩放和平移边界', () => {
  assert.deepEqual(
    Viewer.zoomAroundPoint(
      { scale: 1, x: 0, y: 0 },
      2,
      { x: 0, y: 0 },
      { width: 300, height: 200 }
    ),
    { scale: 2, x: 150, y: 100 }
  );
  const next = Viewer.zoomAroundPoint(
    { scale: 4, x: 0, y: 0 },
    8,
    { x: 300, y: 200 },
    { width: 300, height: 200 }
  );
  assert.equal(next.scale, 5);
  assert.deepEqual({ x: next.x, y: next.y }, { x: -37.5, y: -25 });
});

test('双指距离与中点同时变化时缩放并跟随手势移动', () => {
  assert.deepEqual(
    Viewer.applyPinchGesture(
      { scale: 1, x: 0, y: 0 },
      { distance: 100, midpoint: { x: 150, y: 100 } },
      { distance: 200, midpoint: { x: 170, y: 120 } },
      { width: 300, height: 200 }
    ),
    { scale: 2, x: 20, y: 20 }
  );
});

test('只有完整双资源引用才启用实况播放', () => {
  assert.equal(Viewer.canPlayLive({ kind: 'live-photo', url: 'a.jpg', motion_url: 'a.mov' }), true);
  assert.equal(Viewer.canPlayLive({ media_kind: 'live-photo', url: 'a.jpg', motion_url: 'a.mov' }), true);
  assert.equal(Viewer.canPlayLive({ kind: 'live-photo', url: 'a.jpg' }), false);
});

test('Apple 播放错误后锁定到原生视频回退', () => {
  const state = Viewer.markAppleFailed(Viewer.createState([{ url: 'a.jpg', motion_url: 'a.mov' }], 0));
  assert.equal(state.appleFailed, true);
});
