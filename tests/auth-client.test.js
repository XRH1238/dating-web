const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

let authModule = {};
try {
  authModule = require(path.resolve(__dirname, '..', 'auth-client.js'));
} catch (_) {
  // The first TDD run intentionally reaches this branch before implementation.
}

function createStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  const removed = [];
  return {
    removed,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { removed.push(key); values.delete(key); },
    value(key) { return values.get(key); },
  };
}

function jsonResponse(value, status) {
  const actualStatus = status || 200;
  return {
    ok: actualStatus >= 200 && actualStatus < 300,
    status: actualStatus,
    async text() { return value == null ? '' : JSON.stringify(value); },
  };
}

function createHarness(fetchImpl, options) {
  const storage = (options && options.storage) || createStorage();
  const calls = [];
  const client = authModule.createAuthClient(Object.assign({
    url: 'https://example.supabase.co/',
    key: 'publishable-key',
    storage,
    fetchImpl: async (url, requestOptions) => {
      calls.push({ url, options: requestOptions });
      return fetchImpl(url, requestOptions);
    },
  }, options || {}));
  return { client, calls, storage };
}

test('邮箱密码登录使用 Auth REST 并持久化不含密码的会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const sessionPayload = {
    access_token: 'user-jwt',
    refresh_token: 'refresh-jwt',
    expires_in: 3600,
    user: { id: 'u1', email: 'a@example.com' },
  };
  const { client, calls } = createHarness(async () => jsonResponse(sessionPayload), { storage, now: () => 1700000000 });

  const session = await client.signInWithPassword('a@example.com', 'password');

  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/token?grant_type=password');
  assert.deepEqual(calls[0].options.headers, { apikey: 'publishable-key', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'a@example.com', password: 'password' });
  assert.equal(session.access_token, 'user-jwt');
  assert.equal(session.expires_at, 1700003600);
  assert.equal(JSON.stringify(session).includes('password'), false);
  assert.equal(JSON.stringify(storage.value('dating-web:auth:v1')).includes('password'), false);
});

test('损坏的 Auth 会话会安全清除并返回 null', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({ 'dating-web:auth:v1': '{broken' });
  const { client } = createHarness(async () => jsonResponse({}), { storage });

  assert.equal(await client.getSession(), null);
  assert.deepEqual(storage.removed, ['dating-web:auth:v1']);
});

test('即将过期的会话通过 refresh_token 刷新并持久化新令牌', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({
      access_token: 'old-jwt', refresh_token: 'old-refresh', expires_at: 1700000050,
      user: { id: 'u1', email: 'a@example.com' },
    }),
  });
  const responses = [jsonResponse({
    access_token: 'fresh-user-jwt', refresh_token: 'fresh-refresh', expires_in: 3600,
    user: { id: 'u1', email: 'a@example.com' },
  })];
  const { client, calls } = createHarness(async () => responses.shift(), {
    storage,
    now: () => 1700000000,
  });

  assert.equal(await client.getAccessToken(), 'fresh-user-jwt');
  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(calls[0].options.headers, { apikey: 'publishable-key', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[0].options.body), { refresh_token: 'old-refresh' });
  assert.equal(JSON.parse(storage.value('dating-web:auth:v1')).access_token, 'fresh-user-jwt');
});

test('刷新失败会清除会话并通知 TOKEN_REFRESHED 失败后的 SIGNED_OUT', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000050 }),
  });
  const { client } = createHarness(async () => jsonResponse({ message: 'expired' }, 401), {
    storage,
    now: () => 1700000000,
  });
  const events = [];
  client.onAuthStateChange((event, session) => events.push([event, session]));

  await assert.rejects(() => client.getAccessToken(), /401/);
  assert.equal(await client.getSession(), null);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
});

test('signOut 带用户 Bearer 且无论网络结果都清除本地会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const { client, calls } = createHarness(async (_url, options) => {
    if (options.method === 'POST' && calls.length === 1) {
      return jsonResponse({ access_token: 'user-jwt', refresh_token: 'refresh-jwt', expires_in: 3600, user: { id: 'u1' } });
    }
    return jsonResponse(null, 503);
  }, {
    storage,
  });
  await client.signInWithPassword('a@example.com', 'password');
  await assert.rejects(() => client.signOut(), /503/);
  assert.equal(calls[1].url, 'https://example.supabase.co/auth/v1/logout');
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(calls[1].options.headers, {
    apikey: 'publishable-key',
    'Content-Type': 'application/json',
    Authorization: 'Bearer user-jwt',
  });
  assert.equal(await client.getSession(), null);
});

test('resetPasswordForEmail 编码 redirect_to 并只提交邮箱', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client, calls } = createHarness(async () => jsonResponse(null, 200));
  await client.resetPasswordForEmail('a@example.com', 'https://site.example/reset?x=1');

  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fsite.example%2Freset%3Fx%3D1');
  assert.deepEqual(calls[0].options.headers, { apikey: 'publishable-key', 'Content-Type': 'application/json' });
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'a@example.com' });
});

test('consumeRecoveryRedirect 保存恢复会话、通知并清理 URL fragment', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const location = { hash: '#type=recovery&access_token=recovery-token&refresh_token=recovery-refresh&expires_in=900' };
  const historyCalls = [];
  const history = { replaceState(...args) { historyCalls.push(args); } };
  const { client } = createHarness(async () => jsonResponse({}), { storage, location, history, now: () => 1700000000 });
  const events = [];
  client.onAuthStateChange((event, session) => events.push([event, session]));

  const session = await client.consumeRecoveryRedirect();

  assert.equal(session.access_token, 'recovery-token');
  assert.equal(session.refresh_token, 'recovery-refresh');
  assert.equal(session.expires_at, 1700000900);
  assert.deepEqual(historyCalls, [['', '', 'https://example.supabase.co/']]);
  assert.deepEqual(events, [['PASSWORD_RECOVERY', session]]);
  assert.deepEqual(await client.getSession(), session);
});

test('没有 recovery fragment 时 consumeRecoveryRedirect 返回 null', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async () => jsonResponse({}), { location: { hash: '#foo=bar' } });
  assert.equal(await client.consumeRecoveryRedirect(), null);
});

test('updatePassword 使用当前用户 Bearer 并更新返回的用户信息', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const { client, calls } = createHarness(async (_url, options) => {
    if (options.method === 'PUT') return jsonResponse({ user: { id: 'u1', email: 'new@example.com' } });
    return jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1', email: 'old@example.com' } });
  }, { storage });
  await client.signInWithPassword('old@example.com', 'password');

  const result = await client.updatePassword('new-password');

  assert.equal(calls[1].url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(calls[1].options.headers, {
    apikey: 'publishable-key',
    'Content-Type': 'application/json',
    Authorization: 'Bearer jwt',
  });
  assert.deepEqual(JSON.parse(calls[1].options.body), { password: 'new-password' });
  assert.deepEqual(result, { user: { id: 'u1', email: 'new@example.com' } });
  assert.equal((await client.getSession()).user.email, 'new@example.com');
});

test('认证状态订阅接收状态事件并可取消订阅', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const { client } = createHarness(async () => jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1' } }), { storage });
  const events = [];
  const unsubscribe = client.onAuthStateChange((event, session) => events.push([event, session && session.access_token]));

  await client.signInWithPassword('a@example.com', 'password');
  unsubscribe();
  await client.signOut();

  assert.deepEqual(events, [['SIGNED_IN', 'jwt']]);
});
