const test = require('node:test');
const assert = require('node:assert/strict');
const StoryData = require('../story-data.js');

test('旧记录会获得城市、心情和照片的安全默认值', () => {
  assert.deepEqual(StoryData.normalizeRecord({ title: '厦门', date: '2026-08-06' }), {
    title: '厦门', date: '2026-08-06', city: '厦门', moods: [], photos: []
  });
});

test('记录按旅程开始日期倒序排列并生成统计', () => {
  const records = [
    { date: '2026-01-02/2026-01-03', city: '厦门', photos: [{ url: 'a' }] },
    { date: '2026-08-06', city: '杭州', photos: [{ url: 'b' }, { url: 'c' }] },
    { date: '2025-10-01', city: '厦门' },
  ];
  assert.equal(StoryData.sortRecords(records)[0].city, '杭州');
  assert.deepEqual(StoryData.summarizeRecords(records), { trips: 3, cities: 2, photos: 3 });
});

test('两人的同城同起止日期记录只算一次旅程，保留所有照片和原记录', () => {
  const records = [
    { title: '我的回忆', city: '厦门', date: '2026-09-01/2026-09-03', photos: [{ url: 'a' }] },
    { title: '她的回忆', city: '厦门', date: '2026-09-01/2026-09-03', photos: [{ url: 'b' }] },
  ];
  const before = JSON.stringify(records);
  assert.deepEqual(StoryData.summarizeRecords(records), { trips: 1, cities: 1, photos: 2 });
  assert.equal(JSON.stringify(records), before);
});

test('城市、开始日期、结束日期任一不同均算另一旅程，重叠日期不合并', () => {
  const records = [
    { city: '厦门', date: '2026-09-01/2026-09-03' },
    { city: '厦门', date: '2026-09-02/2026-09-03' },
    { city: '厦门', date: '2026-09-01/2026-09-04' },
    { city: '杭州', date: '2026-09-01/2026-09-03' },
  ];
  assert.deepEqual(StoryData.summarizeRecords(records), { trips: 4, cities: 2, photos: 0 });
});

test('同城名称的市后缀和单日旧格式不产生重复旅程', () => {
  assert.deepEqual(StoryData.summarizeRecords([
    { city: ' 厦门市 ', date: '2026.09.01' },
    { city: '厦门', date: '2026-09-01/2026-09-01' },
  ]), { trips: 1, cities: 1, photos: 0 });
});

test('日期缺失或无效时保留独立旅程，空列表统计为零', () => {
  assert.deepEqual(StoryData.summarizeRecords([
    { city: '厦门' }, { city: '厦门' },
    { city: '厦门', date: '未知' }, { city: '厦门', date: '未知' },
  ]), { trips: 4, cities: 1, photos: 0 });
  assert.deepEqual(StoryData.summarizeRecords([]), { trips: 0, cities: 0, photos: 0 });
});

test('胶囊创建后 24 小时内可编辑，之后锁定直到解锁日', () => {
  const capsule = { created_at: '2026-08-01T00:00:00.000Z', unlock_date: '2026-08-10' };
  assert.equal(StoryData.getCapsuleState(capsule, new Date('2026-08-01T12:00:00.000Z')).editable, true);
  assert.equal(StoryData.getCapsuleState(capsule, new Date('2026-08-03T00:00:00.000Z')).editable, false);
  assert.equal(StoryData.getCapsuleState(capsule, new Date('2026-08-10T12:00:00.000Z')).unlocked, true);
});

test('未解锁胶囊的公开视图不包含正文和照片', () => {
  const capsule = { title: '写给明年', body: '秘密', photos: [{ url: 'secret' }], created_at: '2026-08-01T00:00:00Z', unlock_date: '2026-09-01' };
  const hidden = StoryData.toPublicCapsule(capsule, new Date('2026-08-04T00:00:00Z'));
  assert.equal('body' in hidden, false);
  assert.equal('photos' in hidden, false);
  const open = StoryData.toPublicCapsule(capsule, new Date('2026-09-02T00:00:00Z'));
  assert.equal(open.body, '秘密');
  assert.equal(open.photos.length, 1);
});
