const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('首页大图保持清晰并只在文字附近使用轻量遮罩', () => {
  const overlayRule = styles.match(/\.hero-media::after\s*\{([\s\S]*?)\n\}/);
  assert.ok(overlayRule, '缺少首页大图文字遮罩');
  assert.match(overlayRule[1], /rgba\(47, 39, 48, 0\.4[0-9]\)/, '左侧遮罩应保持轻量');
  assert.match(overlayRule[1], /transparent\s+6[0-9]%/, '遮罩应在文字区域外变为透明');
  assert.doesNotMatch(overlayRule[1], /blur\(/, '首页大图遮罩不能使用虚化');

  const mediaRule = styles.match(/\.hero-media span\s*\{([\s\S]*?)\n\}/);
  assert.ok(mediaRule, '缺少首页大图样式');
  assert.doesNotMatch(mediaRule[1], /filter\s*:/, '首页大图不能使用滤镜降低清晰度');
});

test('想做的事采用宽版工作区并保留红色情感文案', () => {
  assert.match(html, /<section class="section todo-workspace" id="todo">/);
  assert.match(html, /class="todo-note"[^>]*>\s*<span>一起把日常，过成回忆。<\/span>\s*</);
  assert.match(html, /id="todo-total-count"/);
  assert.match(html, /id="todo-done-count"/);
  assert.match(styles, /\.todo-workspace\s*\{[^}]*display:\s*block/s);
  assert.match(styles, /\.todo-workspace\s*\{[^}]*scroll-margin-top:\s*132px/s);
});

test('事项按双栏排列且操作按钮固定在每行右侧', () => {
  assert.match(script, /class="todo-items-grid"/);
  assert.match(script, /var splitIndex = Math\.ceil\(todos\.length \/ 2\)/);
  assert.match(script, /class="todo-column"/);
  assert.match(styles, /\.todo-items-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,/s);
  assert.match(styles, /\.todo-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+76px/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.todo-items-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});

test('事项总数与已完成数量会随列表重新渲染', () => {
  assert.match(script, /todo-total-count/);
  assert.match(script, /todo-done-count/);
  assert.match(script, /state\.todos\.filter\(function\(todo\)\s*\{\s*return todo\.done;\s*\}\)\.length/);
});

test('想做的事提供可操作的全部、未完成和已完成筛选', () => {
  assert.match(html, /class="todo-filters"/);
  assert.match(html, /data-todo-filter="all"[^>]*aria-pressed="true"/);
  assert.match(html, /data-todo-filter="pending"[^>]*aria-pressed="false"/);
  assert.match(html, /data-todo-filter="done"[^>]*aria-pressed="false"/);
  assert.match(script, /todoFilter:\s*"all"/);
  assert.match(script, /state\.todoFilter === "pending"/);
  assert.match(script, /state\.todoFilter === "done"/);
  assert.match(script, /state\.todoPage = 1/);
});

test('艺术字装饰与筛选后的列表保持截图中的视觉层级', () => {
  assert.match(html, /class="todo-kicker"/);
  assert.match(html, /class="todo-heading-icon"[^>]*>[\s\S]*assets\/icons\/heart-outline\.svg/);
  assert.match(html, /class="todo-note"[^>]*>[\s\S]*<span>一起把日常，过成回忆。<\/span>[\s\S]*class="todo-note-heart"/);
  assert.match(html, /class="todo-note-heart"[^>]*src="assets\/icons\/heart-outline\.svg"/);
  assert.match(styles, /\.todo-note span\s*\{[^}]*font-family:\s*"STXingkai"/s);
  assert.match(styles, /\.todo-note span\s*\{[^}]*font-weight:\s*600/s);
  assert.match(styles, /\.todo-note span\s*\{[^}]*-webkit-text-stroke:\s*0\.25px\s+currentColor/s);
  assert.match(styles, /\.todo-note-heart\s*\{[^}]*width:\s*42px/s);
  assert.match(styles, /\.todo-filters\s*\{[^}]*display:\s*flex/s);
  assert.match(styles, /\.todo-filter\[aria-pressed="true"\]/);
});
