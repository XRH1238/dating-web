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

test('相册迁移增加实况照片可空字段', () => {
  const sqlPath = path.join(root, 'supabase', 'live-photo-gallery.sql');
  assert.equal(fs.existsSync(sqlPath), true, '应创建相册实况照片迁移');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  ['type', 'media_kind', 'motion_name', 'motion_type', 'motion_path', 'motion_url'].forEach(column => {
    assert.match(sql, new RegExp(`add column if not exists ${column}\\s+text`, 'i'));
  });
});

test('实况照片上传双资源并保存完整引用', () => {
  assert.match(script, /async function uploadMediaItem\(item, folder, index\)/);
  assert.match(script, /item\.photoFile/);
  assert.match(script, /item\.motionFile/);
  assert.match(script, /motion_path:/);
  assert.match(script, /motion_url:/);
  assert.match(script, /云端尚未启用实况照片字段/);
});

test('待同步的本地实况照片会同时上传两份资源', () => {
  assert.match(script, /async function uploadPendingMediaRef\(photo, localId, index\)/);
  assert.match(script, /photo\.motion_url/);
  assert.match(script, /motion_path/);
});
