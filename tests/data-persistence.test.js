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

test('本地快照可以保存并恢复五类网站数据', () => {
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
    capsules: [{ id: 5 }],
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
  assert.deepEqual(store.load(), { plans: [], records: [], todos: [], photos: [], capsules: [] });
});

test('旧版四类快照升级时会补上空的时间胶囊', () => {
  const storage = { getItem() { return JSON.stringify({ plans: [1], records: [2], todos: [3], photos: [4] }); }, setItem() {} };
  const store = dataModule.createSnapshotStore(storage, 'dating-web:test');
  assert.deepEqual(store.load().capsules, []);
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

test('Storage 文件可以按路径批量删除', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });
  await client.removeObjects('love-photos', ['records/a.webp', 'records/a.mov']);
  assert.equal(calls[0].url, 'https://example.supabase.co/storage/v1/object/love-photos');
  assert.equal(calls[0].options.method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[0].options.body), { prefixes: ['records/a.webp', 'records/a.mov'] });
});

test('数据库与 Storage 请求分别使用主配置和 Storage 配置', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'primary-key',
    storageUrl: 'https://storage.supabase.co/',
    storageKey: 'storage-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });

  await client.select('love_photos');
  await client.insert('love_photos', [{ name: 'test photo.jpg' }]);
  await client.update('love_photos', 'photo 1', { name: 'renamed.jpg' });
  await client.remove('love_photos', 'photo 1');
  await client.upload('love-photos', 'records/test photo.jpg', { type: 'image/jpeg' });
  await client.removeObjects('love-photos', ['records/test photo.jpg']);

  assert.deepEqual(calls.slice(0, 4).map(call => call.url), [
    'https://primary.supabase.co/rest/v1/love_photos?select=*&order=created_at.desc',
    'https://primary.supabase.co/rest/v1/love_photos',
    'https://primary.supabase.co/rest/v1/love_photos?id=eq.photo%201',
    'https://primary.supabase.co/rest/v1/love_photos?id=eq.photo%201',
  ]);
  calls.slice(0, 4).forEach(call => assert.equal(call.options.headers.apikey, 'primary-key'));
  assert.equal(calls[4].url, 'https://storage.supabase.co/storage/v1/object/love-photos/records/test%20photo.jpg');
  assert.equal(calls[4].options.headers.apikey, 'storage-key');
  assert.equal(calls[5].url, 'https://storage.supabase.co/storage/v1/object/love-photos');
  assert.equal(calls[5].options.headers.apikey, 'storage-key');
  assert.equal(
    client.getPublicUrl('love-photos', 'records/test photo.jpg'),
    'https://storage.supabase.co/storage/v1/object/public/love-photos/records/test%20photo.jpg'
  );
});

test('未提供 Storage 配置时继续使用主 Supabase', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co/',
    key: 'primary-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '{}'; } };
    },
  });

  await client.upload('love-photos', 'gallery/a.jpg', { type: 'image/jpeg' });

  assert.equal(calls[0].url, 'https://primary.supabase.co/storage/v1/object/love-photos/gallery/a.jpg');
  assert.equal(calls[0].options.headers.apikey, 'primary-key');
  assert.equal(
    client.getPublicUrl('love-photos', 'gallery/a.jpg'),
    'https://primary.supabase.co/storage/v1/object/public/love-photos/gallery/a.jpg'
  );
});
