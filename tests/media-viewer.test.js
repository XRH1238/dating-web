const test = require('node:test');
const assert = require('node:assert/strict');
const Viewer = require('../media-viewer.js');

test('查看器循环切换并限制缩放范围', () => {
  const state = Viewer.createState([{ url: 'a.jpg' }, { url: 'b.jpg' }], 0);
  assert.equal(Viewer.move(state, -1).index, 1);
  assert.equal(Viewer.move(state, 1).index, 1);
  assert.equal(Viewer.clampScale(0.2), 1);
  assert.equal(Viewer.clampScale(8), 5);
});

test('切换媒体时恢复缩放与 Apple 播放状态', () => {
  const state = { items: [{ url: 'a.jpg' }], index: 0, scale: 3, appleFailed: true };
  const next = Viewer.move(state, 1);
  assert.equal(next.scale, 1);
  assert.equal(next.appleFailed, false);
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
