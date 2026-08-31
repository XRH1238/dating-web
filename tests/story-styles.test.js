const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

test('高清查看器全屏显示原图并提供清晰焦点', () => {
  assert.match(css, /\.media-viewer\s*\{[^}]*width:\s*100vw[^}]*height:\s*100dvh/s);
  assert.match(css, /\.media-viewer-stage img[^}]*object-fit:\s*contain/s);
  assert.match(css, /\.media-viewer-stage\s*\{[^}]*position:\s*relative/s);
  assert.match(css, /\.media-viewer-stage img[^}]*position:\s*absolute[^}]*inset:\s*0/s);
  assert.match(css, /\.media-viewer-media\s*\{[^}]*-webkit-user-drag:\s*none/s);
  assert.match(css, /\.media-viewer-trigger:focus-visible/);
  assert.match(css, /\.live-photo-badge/);
});

test('查看器适配手机安全区并尊重减少动态效果', () => {
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*\.media-viewer-toolbar/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.media-viewer/s);
});

test('触摸与触控板手势过程中停用照片变换过渡', () => {
  assert.match(css, /\.media-viewer-stage\.is-gesturing[\s\S]*transition:\s*none/);
});

test('故事区桌面端使用时间轴与胶囊双栏布局', () => {
  assert.match(css, /\.story-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.7fr\)\s+minmax\(300px,\s*\.8fr\)/s);
  assert.match(css, /\.story-timeline::before/);
  assert.match(css, /\.story-timeline-shell/);
});

test('记录删除按钮是圆形图标按钮且窄屏改为单列', () => {
  assert.match(css, /\.records-section\s*\{[^}]*scroll-margin-top:\s*150px/s);
  assert.match(css, /\.story-delete\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.story-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('日期摘要和三段式手动输入拥有清晰的当前状态', () => {
  assert.match(css, /\.record-date-summary\s*\{[^}]*grid-template-columns/s);
  assert.match(css, /\.record-date-summary-button\.is-active\s*\{[^}]*border-color:\s*var\(--rose\)/s);
  assert.match(css, /\.record-date-manual\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /\.record-date-manual input\s*\{[^}]*text-align:\s*center/s);
});

test('自定义日历使用七列网格并突出选中日期', () => {
  assert.match(css, /\.record-calendar-weekdays,[\s\S]*?\.record-date-grid\s*\{[^}]*grid-template-columns:\s*repeat\(7,\s*1fr\)/s);
  assert.match(css, /\.record-calendar-day\s*\{[^}]*min-height:\s*40px/s);
  assert.match(css, /\.record-calendar-day\.is-selected\s*\{[^}]*background:\s*var\(--rose\)/s);
  assert.match(css, /\.record-calendar-day\.is-today/);
  assert.match(css, /\.record-date-picker\s+button:focus-visible/);
});

test('窄屏日期摘要与手动输入可以安全换行', () => {
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.record-date-summary\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /@media \(max-width:\s*768px\)[\s\S]*?\.record-date-manual\s*\{[^}]*flex-wrap:\s*wrap/s);
});
