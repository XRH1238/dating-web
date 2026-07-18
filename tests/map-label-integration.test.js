const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

test('页面在主脚本前加载标签布局模块', () => {
  const layoutIndex = html.search(/<script src="map-label-layout\.js(?:\?v=[^"]+)?"><\/script>/);
  const appIndex = html.search(/<script src="script\.js(?:\?v=[^"]+)?"><\/script>/);
  assert.ok(layoutIndex >= 0, '缺少 map-label-layout.js');
  assert.ok(layoutIndex < appIndex, '布局模块必须先于主脚本加载');
});

test('本地脚本使用版本参数避免浏览器继续运行旧地图代码', () => {
  assert.match(html, /map-label-layout\.js\?v=[^"]+/);
  assert.match(html, /script\.js\?v=[^"]+/);
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

test('SVG 地图内容只由 transform 属性决定缩放中心', () => {
  const mapContentRule = styles.match(/\.map-content\s*\{([^}]*)\}/);
  assert.ok(mapContentRule, '缺少 .map-content 样式规则');
  assert.doesNotMatch(
    mapContentRule[1],
    /transform-origin/,
    'CSS transform-origin 会与 SVG transform 属性叠加，导致放大后地图偏出视野'
  );
});

test('计划和记录共享开始日期与结束日期原生输入', () => {
  assert.match(html, /name="start_date"\s+type="date"/);
  assert.match(html, /name="end_date"\s+type="date"/);
  assert.doesNotMatch(html, /name="date"\s+type="text"/);
});

test('表单统一序列化日期范围且列表统一格式化', () => {
  assert.match(script, /MapLabelLayout\.serializeDateRange/);
  assert.match(script, /MapLabelLayout\.formatDateRange/);
  assert.match(script, /endDateInput\.min\s*=/);
});

test('路线重绘不依赖会被地图替换的overlay节点', () => {
  assert.doesNotMatch(script, /if\s*\(!mapEl\s*\|\|\s*!overlay\s*\|\|\s*!legend\)\s*return/);
  assert.match(script, /if\s*\(!mapEl\s*\|\|\s*!legend\)\s*return/);
});

test('地图标签和路线使用同一个正式行政区索引', () => {
  assert.match(script, /MapLabelLayout\.buildAdministrativeCityIndex/);
  assert.match(script, /MapLabelLayout\.resolveAdministrativeCity/);
  assert.match(script, /cityIndex:\s*cityIndex/);
});

test('六种交通方式拥有共享且不同的主题色配置', () => {
  const expectedColors = {
    高铁: '#4E7FB3',
    飞机: '#6D62B5',
    自驾: '#C06F4C',
    火车: '#7D5A49',
    轮船: '#3F8C8C',
    其他: '#8B6C91'
  };
  assert.match(script, /const transportVisuals\s*=/);
  Object.entries(expectedColors).forEach(([name, color]) => {
    assert.match(script, new RegExp(name + ':\\s*\\{[^}]*color:\\s*"' + color + '"'));
  });
});

test('特色SVG包含交通方式标识并由共享函数输出', () => {
  assert.match(script, /function transportVisual\(transport\)/);
  assert.match(script, /data-transport-icon=/);
  assert.match(script, /aria-hidden="true"/);
  assert.match(script, /transportVisuals\[normalizeTransport\(transport\)\]/);
});
