const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalCityName,
  buildAdministrativeCityIndex,
  clampMapTranslation,
  formatDateRange,
  layoutCityLabels,
  parseDateRange,
  resolveAdministrativeCity,
  serializeDateRange
} = require('../map-label-layout.js');

global.window = global;
require('../china-cities-data.js');

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

test('同名但位置不同的标签使用稳定标识分别控制', () => {
  const visible = layoutCityLabels([
    { id: 'city-1', name: '境界', x: 450, y: 360, priority: false, index: 0 },
    { id: 'city-2', name: '境界', x: 550, y: 360, priority: false, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['city-1', 'city-2']);
});

test('碰撞检测使用 SVG 实际渲染比例', () => {
  const labels = [
    { name: '甲城市', x: 480, y: 360, priority: false, index: 0 },
    { name: '乙城市', x: 500, y: 360, priority: false, index: 1 }
  ];
  assert.equal(layoutCityLabels(labels, baseView).size, 2);
  assert.equal(layoutCityLabels(labels, {
    ...baseView,
    width: 500,
    height: 360,
    renderScale: 0.5
  }).size, 1);
});

test('极端拖动会被限制在地图视口边界内', () => {
  assert.deepEqual(
    clampMapTranslation({ scale: 3, x: 2914, y: 2479 }),
    { x: 1000, y: 720 }
  );
  assert.deepEqual(
    clampMapTranslation({ scale: 1, x: -400, y: 300 }),
    { x: 0, y: 0 }
  );
});

test('多日日期范围使用稳定格式存储和显示', () => {
  assert.equal(
    serializeDateRange('2026-08-06', '2026-08-08'),
    '2026-08-06/2026-08-08'
  );
  assert.deepEqual(parseDateRange('2026-08-06/2026-08-08'), {
    start: '2026-08-06',
    end: '2026-08-08',
    valid: true
  });
  assert.equal(
    formatDateRange('2026-08-06/2026-08-08'),
    '2026.08.06 — 2026.08.08'
  );
});

test('旧单日期按单日行程显示', () => {
  assert.deepEqual(parseDateRange('2026.08.06'), {
    start: '2026-08-06',
    end: '2026-08-06',
    valid: true
  });
  assert.equal(formatDateRange('2026.08.06'), '2026.08.06');
});

test('结束日期早于开始日期时拒绝序列化', () => {
  assert.throws(
    () => serializeDateRange('2026-08-08', '2026-08-06'),
    /结束日期不能早于开始日期/
  );
});

test('无法识别的旧日期文本原样显示', () => {
  assert.deepEqual(parseDateRange('等有空再去'), {
    start: '',
    end: '',
    valid: false,
    original: '等有空再去'
  });
  assert.equal(formatDateRange('等有空再去'), '等有空再去');
});

test('行政区索引恰好包含333个地级行政区和4个直辖市', () => {
  const index = buildAdministrativeCityIndex(global.CHINA_CITIES_GEOJSON.features);
  assert.equal(index.prefectureCount, 333);
  assert.equal(index.entries.length, 337);
  assert.equal(new Set(index.entries.map((entry) => entry.name)).size, 337);
});

test('地级市、自治州、地区、盟和直辖市使用正式全称', () => {
  const index = buildAdministrativeCityIndex(global.CHINA_CITIES_GEOJSON.features);
  assert.equal(resolveAdministrativeCity(index, '马鞍山').name, '马鞍山市');
  assert.equal(resolveAdministrativeCity(index, '北京').name, '北京市');
  assert.equal(resolveAdministrativeCity(index, '甘南藏族自治').name, '甘南藏族自治州');
  assert.equal(resolveAdministrativeCity(index, '阿克苏地').name, '阿克苏地区');
  assert.equal(resolveAdministrativeCity(index, '锡林郭勒').name, '锡林郭勒盟');
});

test('正式全称和简称解析到同一个行政区', () => {
  const index = buildAdministrativeCityIndex(global.CHINA_CITIES_GEOJSON.features);
  assert.deepEqual(
    resolveAdministrativeCity(index, '厦门'),
    resolveAdministrativeCity(index, '厦门市')
  );
});

test('保护区、马场和县级单位不会进入城市索引', () => {
  const index = buildAdministrativeCityIndex(global.CHINA_CITIES_GEOJSON.features);
  assert.equal(resolveAdministrativeCity(index, '太子山天然林保护'), null);
  assert.equal(resolveAdministrativeCity(index, '莲花山风景林自然保护'), null);
  assert.equal(resolveAdministrativeCity(index, '中农发山丹马'), null);
  assert.equal(resolveAdministrativeCity(index, '石河子市'), null);
});
