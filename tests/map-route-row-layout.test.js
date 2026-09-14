const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('地图路线的每个交通段拥有独立的一行', () => {
  const render = script.match(/function renderFootprintMap\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(render, /class="map-route-segment"/);
  assert.match(render, /class="route-segment-text"/);
  assert.match(render, /s\.direction === "return" \? "返" : "去"/);
});

test('单段路线不换行，去程和返程按行排列', () => {
  assert.match(css, /\.map-route-list p\s*\{[^}]*display:\s*grid[^}]*gap:/s);
  assert.match(css, /\.map-route-list \.map-route-segment\s*\{[^}]*flex-wrap:\s*nowrap[^}]*white-space:\s*nowrap/s);
  assert.match(css, /\.map-route-list \.route-segment-text\s*\{[^}]*white-space:\s*nowrap/s);
});

test('桌面端路线列表有足够宽度显示常见路线', () => {
  assert.match(css, /\.map-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(330px,/s);
});
