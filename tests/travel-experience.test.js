const test = require('node:test');
const assert = require('node:assert/strict');
const travel = require('../travel-experience.js');

test('同城同日期范围归为一趟旅行；不同日期和不完整历史数据保持独立', () => {
  const records = [
    { id: 'a', city: '湖州', date: '2026-08-31/2026-09-02', photos: [{ url: 'a.jpg' }] },
    { id: 'b', city: '湖州市', date: '2026-08-31/2026-09-02', photos: [{ url: 'a.jpg' }, { url: 'b.jpg' }] },
    { id: 'c', city: '湖州', date: '2026-08-31', photos: [] },
    { id: 'd', city: '湖州', date: '', photos: [] },
    { id: 'e', city: '湖州', date: '', photos: [] },
  ];
  const plan = { destination: '湖州市', date: '2026-08-31/2026-09-02' };
  const groups = travel.groupTrips(records, [plan, { destination: '湖州', date: '2026-09-03' }]);
  assert.equal(groups.length, 4);
  assert.deepEqual(groups[0].records.map(record => record.id), ['a', 'b']);
  assert.deepEqual(groups[0].photos.map(photo => photo.url), ['a.jpg', 'b.jpg']);
  assert.deepEqual(groups[0].plans, [plan]);
  assert.equal(records[1].photos.length, 2, '共同相册去重不能改变原记录');
});

test('路线边界适配确保所有点可见，单城、全国和空数据也有效', () => {
  for (const points of [[[700, 400], [740, 445], [715, 460]], [[200, 100], [850, 600]], [[970, 690]]]) {
    const view = travel.fitMapPoints(points);
    assert.ok(view.scale >= 1 && view.scale <= 8);
    points.forEach(([x, y]) => {
      const visibleX = view.x + 500 + (x - 500) * view.scale;
      const visibleY = view.y + 360 + (y - 360) * view.scale;
      assert.ok(visibleX >= 0 && visibleX <= 1000);
      assert.ok(visibleY >= 0 && visibleY <= 720);
    });
  }
  assert.deepEqual(travel.fitMapPoints([]), { scale: 1, x: 0, y: 0 });
});

test('纪念日优先未来；当天显示今日；使用日期差避免时区和夏令时偏差', () => {
  const milestones = travel.anniversaryMilestones('2025-09-06', '2026-10-13', [300, 365, 520, 666]);
  assert.equal(milestones.days, 402);
  assert.equal(milestones.upcoming[0].date, '2027-02-08');
  assert.equal(milestones.upcoming[0].remaining, 118);
  assert.deepEqual(milestones.past.map(item => item.target), [365, 300]);
  const today = travel.anniversaryMilestones('2025-09-06', '2026-09-06', [365, 520]);
  assert.equal(today.upcoming[0].remaining, 0);
  assert.equal(today.past.length, 0);
});
