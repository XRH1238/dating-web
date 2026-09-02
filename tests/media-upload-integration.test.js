const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('三个入口都接受多选照片和视频并使用拖拽区', () => {
  ['photo-input', 'record-photo-input', 'capsule-photo-input'].forEach(id => {
    assert.match(html, new RegExp(`id="${id}"[^>]*accept="image/\\*,video/\\*"[^>]*multiple`));
  });
  assert.equal((html.match(/data-media-dropzone/g) || []).length, 3);
  assert.match(html, /每次最多 20 个文件/);
  assert.match(html, /最多 20 个照片或视频/);
});

test('媒体核心脚本在主脚本之前加载', () => {
  assert.ok(html.indexOf('media-upload.js') >= 0);
  assert.ok(html.indexOf('media-upload.js') < html.indexOf('script.js'));
  assert.ok(html.indexOf('live-photo.js') < html.indexOf('script.js'));
  assert.ok(html.indexOf('image-compression.js') < html.indexOf('script.js'));
});

test('三个上传入口共用普通图片压缩且实况照片保持原文件', () => {
  assert.match(script, /window\.ImageCompression\.compressFile/);
  assert.match(script, /item\.kind\s*!==\s*["']image["'][\s\S]*?return original/);
  assert.match(script, /async function uploadMediaItem/);
  assert.match(script, /async function uploadPhotos/);
  assert.match(script, /uploadStoryFiles\(recordDraftFiles/);
  assert.match(script, /uploadStoryFiles\(capsuleDraftFiles/);
});

test('拖拽绑定、媒体渲染和高亮样式存在', () => {
  assert.match(script, /function bindMediaDropzone\(/);
  assert.match(script, /var queuedFiles = Array\.from\(files \|\| \[\]\)/);
  assert.match(script, /文件读取失败，请重新选择照片或视频/);
  assert.match(script, /window\.LivePhotoMedia\.selectMedia/);
  assert.match(script, /window\.MediaUpload\.isVideo/);
  assert.match(script, /<video[^>]*controls[^>]*preload="metadata"/);
  assert.match(script, /<img[^>]*loading="lazy"/);
  assert.match(styles, /\.media-dropzone\.is-dragover/);
});

test('胶囊只在成功加入新媒体后替换已有媒体', () => {
  assert.match(script, /if \(!hadDraftMedia && nextDraftMedia\.length\) capsuleExistingPhotos = \[\]/);
});

test('页面数据库与 Storage 使用各自的 Supabase 配置', () => {
  assert.match(
    script,
    /const storageConfig = \{[\s\S]*?msrbqgorhjbzxomexzap\.supabase\.co[\s\S]*?sb_publishable_gGls0-_0bfkwCSmG7MNXJg_2aQLzLnV[\s\S]*?\};/
  );
  assert.match(
    script,
    /createCloudDataClient\(\{[\s\S]*?url:\s*supabaseConfig\.url,[\s\S]*?key:\s*supabaseConfig\.key,[\s\S]*?storageUrl:\s*storageConfig\.url,[\s\S]*?storageKey:\s*storageConfig\.key/
  );
});

test('完整拖拽区具有高亮、隐藏输入和响应式媒体预览', () => {
  assert.match(styles, /\.media-dropzone\s*\{[^}]*border:\s*2px dashed/s);
  assert.match(styles, /\.media-input\s*\{[^}]*clip:/s);
  assert.match(styles, /\.media-dropzone\.is-dragover\s*\{[^}]*background:/s);
  assert.match(styles, /\.story-photo-preview img,\s*\.story-photo-preview video\s*\{/s);
  assert.match(styles, /@media \(max-width:\s*768px\)[\s\S]*\.story-photo-preview/);
});
