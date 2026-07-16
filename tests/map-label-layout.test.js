const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalCityName, layoutCityLabels } = require('../map-label-layout.js');

const baseView = { scale: 3, x: 0, y: 0, width: 1000, height: 720 };

test('重叠时重点城市优先于普通城市', () => {
  const visible = layoutCityLabels([
    { name: '普通市', x: 500, y: 360, priority: false, index: 0 },
    { name: '重点市', x: 501, y: 360, priority: true, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['重点市']);
});

test('互不重叠的市级标签全部显示', () => {
  const visible = layoutCityLabels([
    { name: '甲市', x: 450, y: 360, priority: false, index: 0 },
    { name: '乙市', x: 550, y: 360, priority: false, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['甲市', '乙市']);
});

test('继续放大后逐步显示距离较近的城市', () => {
  const labels = [
    { name: '甲城市', x: 500, y: 360, priority: false, index: 0 },
    { name: '乙城市', x: 508, y: 360, priority: false, index: 1 }
  ];
  assert.equal(layoutCityLabels(labels, baseView).size, 1);
  assert.equal(layoutCityLabels(labels, { ...baseView, scale: 8 }).size, 2);
});

test('视口外标签不参与布局', () => {
  const visible = layoutCityLabels([
    { name: '视口外', x: 900, y: 360, priority: true, index: 0 }
  ], { ...baseView, x: 1000 });
  assert.equal(visible.size, 0);
});

test('低于市级详情缩放阈值时不显示市级标签', () => {
  const visible = layoutCityLabels([
    { name: '甲市', x: 500, y: 360, priority: true, index: 0 }
  ], { ...baseView, scale: 2.9 });
  assert.equal(visible.size, 0);
});

test('多个重点标签重叠时按原始顺序稳定保留', () => {
  const visible = layoutCityLabels([
    { name: '先出现', x: 500, y: 360, priority: true, index: 0 },
    { name: '后出现', x: 501, y: 360, priority: true, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['先出现']);
});

test('窄屏使用更大的标签避让间距', () => {
  const labels = [
    { name: '甲城市', x: 500, y: 360, priority: false, index: 0 },
    { name: '乙城市', x: 509, y: 360, priority: false, index: 1 }
  ];
  assert.equal(layoutCityLabels(labels, { ...baseView, scale: 6 }).size, 2);
  assert.equal(layoutCityLabels(labels, { ...baseView, scale: 6, compact: true }).size, 1);
});

test('重点城市名称忽略常见行政区后缀', () => {
  assert.equal(canonicalCityName('厦门市'), canonicalCityName('厦门'));
  assert.equal(canonicalCityName('阿坝藏族羌族自治州'), canonicalCityName('阿坝藏族羌族自治'));
});
