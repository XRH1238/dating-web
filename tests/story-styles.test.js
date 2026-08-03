const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');

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
