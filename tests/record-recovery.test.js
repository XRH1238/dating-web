const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let recovery = {};
try {
  recovery = require(path.join(__dirname, '..', 'record-recovery.js'));
} catch (_) {
  // The first TDD run intentionally reaches this branch before implementation.
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test('出游记录草稿刷新后可以从本机恢复并在成功保存后清除', () => {
  assert.equal(typeof recovery.createDraftStore, 'function');
  const store = recovery.createDraftStore(memoryStorage(), 'dating-web:record-draft:test');
  const draft = {
    city: '杭州市',
    title: '西湖边的傍晚',
    description: '一起看了日落',
    moods: ['开心', '浪漫'],
    startDate: '2026-08-20',
    endDate: '2026-08-21',
  };

  assert.equal(store.save(draft), true);
  assert.deepEqual(store.load(), draft);
  store.clear();
  assert.equal(store.load(), null);
});

test('云端刷新结果不会覆盖仍待同步的本机出游记录', () => {
  assert.equal(typeof recovery.createPendingRecord, 'function');
  assert.equal(typeof recovery.mergeRemoteRecords, 'function');
  const pending = recovery.createPendingRecord(
    { city: '厦门市', title: '海边散步', date: '2026-08-01', photos: [] },
    'local-1'
  );
  const remote = [{ id: 'remote-1', city: '上海市', title: '外滩' }];

  assert.deepEqual(recovery.mergeRemoteRecords(remote, [pending]), [pending, remote[0]]);
});

test('待同步记录写入云端前会移除本机状态字段', () => {
  assert.equal(typeof recovery.toCloudRecord, 'function');
  const pending = {
    local_id: 'local-2',
    pending_sync: true,
    title: '山顶日出',
    photos: [],
  };

  assert.deepEqual(recovery.toCloudRecord(pending), { title: '山顶日出', photos: [] });
});
