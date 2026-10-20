const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');


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



test('功能概览在宽屏占满整行并在中等桌面尺寸放大卡片', () => {
  assert.match(styles, /\.intro-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /\.feature-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.feature-item\s*\{[^}]*min-height:\s*clamp\(/s);
  assert.match(
    styles,
    /@media \(max-width:\s*1100px\)[\s\S]*?\.feature-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s
  );
});



test('首页行程摘要由计划数据驱动且动态初始化尊重系统偏好', () => {
  assert.match(script, /function renderNextTripSummary\(\)/);
  assert.match(script, /renderPlans\(\);\s*renderNextTripSummary\(\);/);
  assert.match(script, /next-trip-title/);
  assert.match(script, /next-trip-date/);
  assert.match(script, /next-trip-days/);
  assert.match(script, /next-trip-countdown/);
  assert.match(script, /function initHeroMotion\(\)/);
  assert.match(script, /TravelCorridor\.create/);
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

test('本次修改的页面资源使用正确缓存版本', () => {
  ['styles.css', 'script.js'].forEach(asset => {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20261020-1'));
  });
  ['storage-object-ref.js'].forEach(asset => {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260915-1'));
  });
  assert.match(html, /cloud-data-client\.js\?v=20261013-1/);
  ['record-date-picker.js', 'record-moods.js', 'trip-planning.js'].forEach(asset => {
    assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260830-1'));
  });
});

const corridorCss = fs.readFileSync(path.join(root, 'travel-corridor.css'), 'utf8');
const corridorScript = fs.readFileSync(path.join(root, 'travel-corridor.js'), 'utf8');
test('首页使用真实相册长廊并保留全部功能锚点', () => {
  assert.match(html, /id="travel-corridor"/);
  assert.match(html, /一起走过的地方。/);
  assert.match(html, /慢慢看，都是我们的回忆。/);
  assert.doesNotMatch(html, /hero-effects|hero-glow|hero-sparkle|images.unsplash.com/);
  ['anniversary','plans','records','todo','gallery'].forEach(id=>assert.match(html,new RegExp('id="'+id+'"')));
  assert.match(script, /photos: state.photos, records: state.records/);
});
test('长廊提供平面模式、键盘按钮和系统减少动态效果适配', () => {
  assert.match(html, /data-corridor-mode/);
  assert.match(html, /data-corridor-step="-1"/);
  assert.match(html, /data-corridor-step="1"/);
  assert.match(html, /跳过长廊/);
  assert.match(corridorScript, /prefers-reduced-motion: reduce/);
  assert.match(corridorScript, /gsap.matchMedia/);
  assert.match(corridorScript, /quickTo/);
  assert.match(corridorCss, /prefers-reduced-motion:reduce/);
  assert.match(corridorCss, /object-fit: contain|object-fit:contain/);
  assert.doesNotMatch(corridorCss, /(?:^|[;\s])filter:|backdrop-filter:\s*blur|text-shadow:/);
});
