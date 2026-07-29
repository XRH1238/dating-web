const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let dataModule = {};
try {
  dataModule = require(path.join(root, 'cloud-data-client.js'));
} catch (_) {
  // The first TDD run intentionally reaches this branch before implementation.
}

test('页面使用本地云端客户端，不再依赖第三方 Supabase CDN', () => {
  assert.doesNotMatch(html, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
  assert.match(html, /<script src="cloud-data-client\.js\?v=[^"]+"><\/script>/);
});

test('本地快照可以保存并恢复四类网站数据', () => {
  assert.equal(typeof dataModule.createSnapshotStore, 'function');
  const values = new Map();
  const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
  const store = dataModule.createSnapshotStore(storage, 'dating-web:test');
  const snapshot = {
    plans: [{ id: 1 }],
    records: [{ id: 2 }],
    todos: [{ id: 3, text: '看日落' }],
    photos: [{ id: 4 }],
  };
  store.save(snapshot);
  assert.deepEqual(store.load(), snapshot);
});

test('损坏的本地快照不会阻止页面启动', () => {
  assert.equal(typeof dataModule.createSnapshotStore, 'function');
  const storage = {
    getItem() { return '{broken'; },
    setItem() {},
  };
  const store = dataModule.createSnapshotStore(storage, 'dating-web:test');
  assert.deepEqual(store.load(), { plans: [], records: [], todos: [], photos: [] });
});

test('轻量云端客户端能直接读取 Supabase REST 表', async () => {
  assert.equal(typeof dataModule.createCloudDataClient, 'function');
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() { return [{ id: 7, text: '一起旅行' }]; },
    };
  };
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    fetchImpl: fakeFetch,
  });
  const rows = await client.select('love_todos');
  assert.deepEqual(rows, [{ id: 7, text: '一起旅行' }]);
  assert.match(calls[0].url, /\/rest\/v1\/love_todos\?select=\*&order=created_at\.desc/);
  assert.equal(calls[0].options.headers.apikey, 'publishable-key');
});

test('云端请求失败时抛出可识别错误', async () => {
  assert.equal(typeof dataModule.createCloudDataClient, 'function');
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    fetchImpl: async () => ({
      ok: false,
      status: 503,
      async text() { return 'unavailable'; },
    }),
  });
  await assert.rejects(() => client.select('love_todos'), /503/);
});

test('云端写入返回空响应时仍视为成功', async () => {
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      async text() { return ''; },
      async json() { throw new Error('empty response'); },
    }),
  });
  await assert.doesNotReject(() => client.insert('love_todos', [{ text: '看日落' }]));
});

test('云端长时间无响应时会结束等待并进入兜底模式', async () => {
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  });
  await assert.rejects(() => client.select('love_todos'), /超时/);
});
