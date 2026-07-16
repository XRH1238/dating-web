const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('页面在主脚本前加载标签布局模块', () => {
  const layoutIndex = html.indexOf('<script src="map-label-layout.js"></script>');
  const appIndex = html.indexOf('<script src="script.js"></script>');
  assert.ok(layoutIndex >= 0, '缺少 map-label-layout.js');
  assert.ok(layoutIndex < appIndex, '布局模块必须先于主脚本加载');
});

test('市级标签携带稳定城市名和顺序元数据', () => {
  assert.match(script, /data-city=/);
  assert.match(script, /data-label-index=/);
});

test('地图变换后调用碰撞布局并规范化重点城市名称', () => {
  assert.match(script, /function updateCityLabelLayout\(\)/);
  assert.match(script, /MapLabelLayout\.layoutCityLabels/);
  assert.match(script, /MapLabelLayout\.canonicalCityName/);
  assert.match(script, /updateCityLabelLayout\(\);/);
});

test('标签样式支持反向缩放并使用 SVG 可见样式控制', () => {
  assert.match(styles, /--city-label-font-size/);
  assert.match(styles, /--city-label-stroke-width/);
  assert.match(script, /label\.style\.display\s*=/);
});

test('窗口尺寸变化时重新计算标签布局', () => {
  assert.match(script, /window\.addEventListener\(['"]resize['"],\s*scheduleMapView\)/);
});

test('应用地图变换前限制平移边界', () => {
  assert.match(script, /MapLabelLayout\.clampMapTranslation\(mapView\)/);
});
