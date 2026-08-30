const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('实况模块在主脚本前加载且三个入口提供说明', () => {
  assert.match(html, /<script src="live-photo\.js\?v=[^"]+"><\/script>/);
  assert.ok(html.indexOf('live-photo.js') < html.indexOf('script.js'));
  assert.equal((html.match(/实况照片请同时选择原图和同名 MOV 文件/g) || []).length, 3);
});

test('三个入口按逻辑媒体项计算上限并报告配对', () => {
  assert.match(script, /LivePhotoMedia\.selectMedia\(files,\s*current\.length,\s*20\)/);
  assert.match(script, /LivePhotoMedia\.selectMedia\(files,\s*0,\s*20\)/);
  assert.match(script, /pairedCount/);
  assert.match(script, /unmatchedMotionCount/);
});

test('本地预览引用保留实况照片的静态图和动态资源', () => {
  assert.match(script, /async function localMediaRef\(item\)/);
  assert.match(script, /motion_name:/);
  assert.match(script, /motion_type:/);
  assert.match(script, /motion_url:/);
});
