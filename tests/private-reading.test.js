const test = require('node:test');
const assert = require('node:assert/strict');
const { handleStorageGateway } = require('../supabase/functions/storage-gateway/core.ts');
const { createCloudDataClient } = require('../cloud-data-client.js');
const fs = require('node:fs');
const vm = require('node:vm');

function readRequest(paths = ['records/photo.jpg'], token) {
  return new Request('https://primary.supabase.co/functions/v1/storage-gateway', {
    method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: JSON.stringify({ action: 'sign-read', backend: 'secondary', bucket: 'love-photos', paths }),
  });
}

test('知道旧公开地址不等于有权签署私密图片；未授权请求不调用 Storage', async () => {
  let signed = 0;
  const deps = { backends: { secondary: { bucket: 'love-photos' } }, async canReadObjects() { return false; }, async createSignedRead() { signed += 1; return 'unexpected'; } };
  const response = await handleStorageGateway(readRequest(), deps);
  assert.equal(response.status, 403);
  assert.equal(signed, 0);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('公开精选可匿名取得短期地址，成员私密读取走相同授权检查', async () => {
  for (const token of [undefined, 'member-jwt']) {
    let checked = 0;
    const deps = { backends: { secondary: { bucket: 'love-photos' } },
      async canReadObjects(received, backend, paths) { checked += 1; assert.equal(received, token || null); assert.equal(backend, 'secondary'); assert.deepEqual(paths, ['records/photo.jpg']); return true; },
      async createSignedRead() { return 'https://secondary.supabase.co/storage/v1/object/sign/love-photos/records/photo.jpg?token=test'; } };
    const response = await handleStorageGateway(readRequest(undefined, token), deps);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).expiresIn, 900);
    assert.equal(checked, 1);
  }
});

test('签名读取拒绝目录穿越、重复路径、超量批次和未配置的读网关', async () => {
  const deps = { backends: { secondary: { bucket: 'love-photos' } } };
  for (const paths of [['records/../secret.jpg'], ['records/a.jpg', 'records/a.jpg'], Array.from({ length: 41 }, (_, index) => 'records/' + index + '.jpg')]) {
    assert.equal((await handleStorageGateway(readRequest(paths), deps)).status, 400);
  }
  assert.equal((await handleStorageGateway(readRequest(), deps)).status, 503);
});

test('客户端拒绝网关提供的外站、用户信息和非请求对象地址', async () => {
  for (const signedUrl of ['https://attacker.example/storage/v1/object/sign/love-photos/records/photo.jpg?token=test',
    'https://user:password@secondary.example/storage/v1/object/sign/love-photos/records/photo.jpg?token=test',
    'https://secondary.example/storage/v1/object/sign/love-photos/records/other.jpg?token=test']) {
    const client = createCloudDataClient({ url: 'https://primary.example', storageUrl: 'https://secondary.example', key: 'publishable', storageGatewayUrl: 'https://primary.example/functions/v1/storage-gateway',
      fetchImpl: async () => new Response(JSON.stringify({ urls: [{ path: 'records/photo.jpg', signedUrl }] }), { status: 200 }) });
    await assert.rejects(client.signRead('love-photos', ['records/photo.jpg'], 'secondary'), /私密媒体地址无效/);
  }
});

function privacyHarness() {
  const context = { console, Date, URL, Intl, setTimeout, clearTimeout,
    document: { querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, body: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, location: { href: 'https://example.com' } };
  context.window = context;
  context.addEventListener = function() {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../script.js'), 'utf8') + `
    updateAuthUi = function() {}; renderAll = function() {}; setCloudStatus = function() {}; showCloudNotice = function() {};
    globalThis.privacy = { setState(next) { Object.assign(state, next); }, getState() { return state; },
      preparePrivateSpace, loadRemoteData, visibleRows, connectPrivateStores, privateMediaUrl, fetchRecords,
      fetchPrivateAnniversary, getStartDate() { return loveStartDate; } };
  `, context);
  return context;
}

test('私密配置未就绪时不读取业务数据；非成员只能得到公开行', async () => {
  const context = privacyHarness();
  let reads = 0;
  context.privacy.setState({ backendReady: true, client: { async rpc() { throw new Error('not configured'); }, async select() { reads += 1; return []; } } });
  await context.privacy.preparePrivateSpace();
  await context.privacy.loadRemoteData();
  assert.equal(reads, 0);
  assert.equal(context.privacy.getState().privacyReady, false);
  context.privacy.setState({ privacyReady: true, isMember: false });
  assert.deepEqual(Array.from(context.privacy.visibleRows([{ id: 'private', is_public: false }, { id: 'public', is_public: true }])), [{ id: 'public', is_public: true }]);
});

test('成员与游客使用分开的缓存，未取得签名时不会返回旧公开媒体 URL', () => {
  const context = privacyHarness();
  const keys = [];
  context.CloudDataClient = { createSnapshotStore(_storage, key) { keys.push(key); return {}; } };
  context.StorageObjectRef = require('../storage-object-ref.js');
  context.privacy.setState({ authUser: { id: 'first' }, isMember: true, privacyReady: true });
  context.privacy.connectPrivateStores();
  context.privacy.setState({ authUser: null, isMember: false });
  context.privacy.connectPrivateStores();
  assert.deepEqual(keys, ['dating-web:data:private:v2:first', 'dating-web:data:private:v2:public']);
  assert.equal(context.privacy.privateMediaUrl('https://msrbqgorhjbzxomexzap.supabase.co/storage/v1/object/public/love-photos/records/private.jpg'), '');
  assert.equal(context.privacy.privateMediaUrl('data:image/jpeg;base64,test'), 'data:image/jpeg;base64,test');
});

test('纪念日起始日期从成员配置读取，游客不请求并清除该日期', async () => {
  const context = privacyHarness();
  let calls = 0;
  context.privacy.setState({ isMember: true, client: { async rpc(name) { assert.equal(name, 'get_love_start_date'); calls += 1; return '2024-01-01'; } } });
  await context.privacy.fetchPrivateAnniversary();
  assert.equal(context.privacy.getStartDate(), '2024-01-01');
  context.privacy.setState({ isMember: false });
  await context.privacy.fetchPrivateAnniversary();
  assert.equal(context.privacy.getStartDate(), null);
  assert.equal(calls, 1);
});
