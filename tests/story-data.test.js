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
