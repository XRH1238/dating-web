const test = require('node:test');
const assert = require('node:assert/strict');
const Planning = require('../trip-planning.js');
const Dates = require('../map-label-layout.js');

test('旧路线默认为去程且返程方向被保留', () => {
  const segments = Planning.normalizePlanSegments({ segments: [
    { from: '杭州', to: '厦门', transport: '飞机' },
    { from: '厦门', to: '武汉', transport: '飞机', direction: 'return' },
    { from: '武汉', to: '杭州', transport: '高铁', direction: 'return' }
  ] }, value => value);
  assert.deepEqual(segments.map(item => item.direction), ['outbound', 'return', 'return']);
});

test('正在进行的计划优先于未来计划', () => {
  const result = Planning.selectTopTrip([
    { title: '未来', date: '2026-09-10' },
    { title: '正在旅行', date: '2026-08-28/2026-08-30' }
  ], '2026-08-29', Dates.parseDateRange);
  assert.equal(result.status, 'ongoing');
  assert.equal(result.plan.title, '正在旅行');
});

test('未来计划选择最近的一条', () => {
  const result = Planning.selectTopTrip([
    { title: '较晚', date: '2026-10-01' },
    { title: '最近', date: '2026-09-02' }
  ], '2026-08-29', Dates.parseDateRange);
  assert.equal(result.status, 'upcoming');
  assert.equal(result.plan.title, '最近');
});

test('全部计划结束或日期无效时返回空状态', () => {
  const result = Planning.selectTopTrip([
    { title: '过去', date: '2026-08-01/2026-08-03' },
    { title: '未知', date: '待确认' }
  ], '2026-08-29', Dates.parseDateRange);
  assert.deepEqual(result, { status: 'empty', plan: null, range: null });
});
