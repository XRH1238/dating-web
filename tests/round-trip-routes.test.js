const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');

test('计划表单分别提供去程和返程多段编辑器', () => {
  assert.match(html, /id="outbound-route-segments"/);
  assert.match(html, /id="return-route-segments"/);
  assert.match(html, /data-add-route-direction="outbound"/);
  assert.match(html, /data-add-route-direction="return"/);
  assert.match(script, /function addRouteSegment\(direction\)/);
  assert.match(script, /row\.dataset\.direction\s*=\s*direction/);
  assert.match(script, /direction:\s*row\.dataset\.direction/);
});

test('地图保留路线方向并为返程使用相反弧线', () => {
  assert.match(script, /direction:\s*s\.direction/);
  assert.match(script, /seg\.direction\s*===\s*"return"/);
  assert.match(script, /curveSign/);
});

test('移动端路线行改为单列且不横向溢出', () => {
  assert.match(styles, /@media \(max-width:[\s\S]*?\.route-segment-row\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
