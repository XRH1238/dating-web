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

test('首页采用梦幻主视觉与杂志式横向下一次出游信息条', () => {
  assert.match(html, /<section class="hero hero-stage">/);
  assert.match(html, /class="hero-effects" aria-hidden="true"/);
  assert.match(html, /class="next-trip-strip"/);
  assert.match(html, /id="next-trip-title"/);
  assert.match(html, /id="next-trip-date"/);
  assert.match(html, /id="next-trip-days"/);
  assert.match(html, /id="next-trip-countdown"/);
  assert.match(html, /assets\/images\/hero-romantic-santorini\.jpg/);
  assert.match(html, /assets\/images\/trip-xiamen\.jpg/);
});

test('炫目动态包含分层入场、景深和行程流光', () => {
  assert.match(styles, /@keyframes hero-title-reveal/);
  assert.match(styles, /@keyframes hero-photo-drift/);
  assert.match(styles, /@keyframes trip-strip-shine/);
  assert.match(styles, /--hero-pointer-x/);
  assert.match(styles, /\.hero-effects/);
  assert.match(styles, /\.next-trip-strip\s*\{[^}]*grid-template-columns:/s);
});

test('功能概览在宽屏占满整行并在中等桌面尺寸放大卡片', () => {
  assert.match(styles, /\.intro-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.feature-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.feature-item\s*\{[^}]*min-height:\s*clamp\(/s);
  assert.match(
    styles,
    /@media \(max-width:\s*1100px\)[\s\S]*?\.feature-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
  );
});

test('首页主图首次移入通过逐帧缓动过渡而不是直接跳到鼠标偏移', () => {
  assert.match(script, /pointerenter/);
  assert.match(script, /currentX\s*\+=\s*\(targetX\s*-\s*currentX\)\s*\*\s*0\.1[0-9]/);
  assert.match(script, /currentY\s*\+=\s*\(targetY\s*-\s*currentY\)\s*\*\s*0\.1[0-9]/);

  const heroMediaRule = styles.match(/\.hero-stage \.hero-media\s*\{([\s\S]*?)\n\}/);
  assert.ok(heroMediaRule, '缺少首页主图容器样式');
  assert.doesNotMatch(heroMediaRule[1], /transition:\s*transform/, '主图动画不应与 transform transition 竞争');
});

test('减少动态效果会停用首页动画和景深变化', () => {
  const reducedMotion = styles.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(reducedMotion, '缺少减少动态效果规则');
  assert.match(reducedMotion[1], /\.hero-media span/);
  assert.match(reducedMotion[1], /\.hero-content/);
  assert.match(reducedMotion[1], /\.next-trip-strip/);
  assert.match(reducedMotion[1], /animation:\s*none/);
  assert.match(reducedMotion[1], /transform:\s*none/);
});

test('首页行程摘要由计划数据驱动且动态初始化尊重系统偏好', () => {
  assert.match(script, /function renderNextTripSummary\(\)/);
  assert.match(script, /renderPlans\(\);\s*renderNextTripSummary\(\);/);
  assert.match(script, /next-trip-title/);
  assert.match(script, /next-trip-date/);
  assert.match(script, /next-trip-days/);
  assert.match(script, /next-trip-countdown/);
  assert.match(script, /function initHeroMotion\(\)/);
  assert.match(script, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(script, /pointermove/);
});

test('顶部行程条只显示进行中或未来计划且标签随状态变化', () => {
  assert.match(html, /id="next-trip-label"/);
  assert.match(script, /TripPlanning\.selectTopTrip/);
  assert.match(script, /status\s*===\s*"ongoing"/);
  assert.match(script, /正在出游/);
  assert.match(script, /暂时没有下一次出游/);
  assert.doesNotMatch(script, /\|\|\s*plans\[0\]/);
});

test('云端同步成功后状态条会自动收起', () => {
  assert.match(script, /cloudStatus\.classList\.toggle\("is-hidden",\s*!status\)/);
  assert.match(script, /setTimeout\(function\(\)\s*\{\s*setCloudStatus\(""\);\s*\},\s*4000\)/);
});

test('本次修改的页面资源使用同一组新缓存版本', () => {
  ['styles.css', 'script.js'].forEach(asset => {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260830-6'));
  });
  ['record-date-picker.js', 'record-moods.js', 'trip-planning.js'].forEach(asset => {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260830-1'));
  });
});
