const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    if (options.method === 'PUT') return jsonResponse({ id: 'u1', email: 'new@example.com', role: 'authenticated' });
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
  assert.deepEqual(result, { id: 'u1', email: 'new@example.com', role: 'authenticated' });
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

test('HTTP 认证错误携带数值 status 和中文状态消息', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async () => jsonResponse({ error: 'invalid' }, 401));
  await assert.rejects(() => client.signInWithPassword('a@example.com', 'bad'), (error) => {
    assert.equal(error.status, 401);
    assert.match(error.message, /认证请求失败/);
    assert.match(error.message, /401/);
    return true;
  });
});

test('刷新返回缺少新 access_token 的 200 响应时清除会话并报错', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000050 }),
  });
  const { client } = createHarness(async () => jsonResponse({ expires_in: 3600 }), {
    storage,
    now: () => 1700000000,
  });
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value]));

  await assert.rejects(() => client.getAccessToken(), /刷新响应无效/);
  assert.equal(await client.getSession(), null);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
});

test('刷新返回新 access_token 但缺少新过期字段时仍视为无效', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000050 }),
  });
  const { client } = createHarness(async () => jsonResponse({ access_token: 'new' }), {
    storage,
    now: () => 1700000000,
  });
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value]));

  await assert.rejects(() => client.getAccessToken(), /刷新响应无效/);
  assert.equal(await client.getSession(), null);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
});

test('成功刷新通知 TOKEN_REFRESHED 并返回新会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000050 }),
  });
  const { client } = createHarness(async () => jsonResponse({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600 }), {
    storage,
    now: () => 1700000000,
  });
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value && value.access_token]));

  assert.equal(await client.getAccessToken(), 'new');
  assert.deepEqual(events, [['TOKEN_REFRESHED', 'new']]);
});

test('成功退出通知 SIGNED_OUT 并清除会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async (_url, options) => {
    if (options.method === 'POST' && options.body) {
      return jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600 });
    }
    return jsonResponse(null, 204);
  });
  await client.signInWithPassword('a@example.com', 'password');
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value]));

  await client.signOut();
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
  assert.equal(await client.getSession(), null);
});

test('自定义 storageKey 持久化并恢复会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const options = { storage, storageKey: 'custom-auth-key', now: () => 1700000000 };
  const first = createHarness(async () => jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600 }), options);
  await first.client.signInWithPassword('a@example.com', 'password');
  assert.ok(storage.value('custom-auth-key'));
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
  const second = createHarness(async () => jsonResponse({}), options);
  assert.equal((await second.client.getSession()).access_token, 'jwt');
});

test('登录响应中的 expires_at 保持绝对过期秒', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async () => jsonResponse({
    access_token: 'jwt', refresh_token: 'refresh', expires_at: 1700004321,
  }), { now: () => 1700000000 });
  assert.equal((await client.signInWithPassword('a@example.com', 'password')).expires_at, 1700004321);
});

test('过期且没有 refresh_token 的持久化会话被清除', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'expired', expires_at: 1699999999 }),
  });
  const { client } = createHarness(async () => jsonResponse({}), { storage, now: () => 1700000000 });
  assert.equal(await client.getAccessToken(), null);
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
});

test('缺 refresh_token 或过期字段的损坏持久化会话被清除', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  for (const value of [
    { access_token: 'jwt', expires_in: 3600 },
    { access_token: 'jwt', refresh_token: 'refresh' },
  ]) {
    const storage = createStorage({ 'dating-web:auth:v1': JSON.stringify(value) });
    const { client } = createHarness(async () => jsonResponse({}), { storage, now: () => 1700000000 });
    assert.equal(await client.getSession(), null);
    assert.equal(storage.value('dating-web:auth:v1'), undefined);
  }
});

test('解构调用 updatePassword 不依赖 this 且 USER_UPDATED 携带顶层用户', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const { client } = createHarness(async (_url, options) => {
    if (options.method === 'PUT') return jsonResponse({ id: 'u1', email: 'updated@example.com' });
    return jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1', email: 'old@example.com' } });
  }, { storage });
  await client.signInWithPassword('old@example.com', 'password');
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value && value.user && value.user.email]));
  const updatePassword = client.updatePassword;

  const result = await updatePassword('new-password');

  assert.deepEqual(result, { id: 'u1', email: 'updated@example.com' });
  assert.deepEqual(events, [['USER_UPDATED', 'updated@example.com']]);
  assert.equal((await client.getSession()).user.email, 'updated@example.com');
});

test('recovery fragment 解析异常或字段不完整时也清理 fragment 且不泄漏 URIError', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  for (const hash of [
    '#type=recovery&access_token=%E0%A4%A&refresh_token=refresh',
    '#type=recovery&access_token=only-token',
  ]) {
    const location = { href: 'https://example.supabase.co/reset?from=email' + hash, hash };
    const historyCalls = [];
    const history = { replaceState(...args) { historyCalls.push(args); } };
    const { client } = createHarness(async () => jsonResponse({}), { location, history });
    assert.equal(await client.consumeRecoveryRedirect(), null);
    assert.deepEqual(historyCalls, [['', '', 'https://example.supabase.co/reset?from=email']]);
  }
});

test('recovery 成功清理时保留页面 path 和 query', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const location = {
    href: 'https://example.supabase.co/reset?from=email&lang=zh#type=recovery&access_token=token&refresh_token=refresh&expires_in=900',
    hash: '#type=recovery&access_token=token&refresh_token=refresh&expires_in=900',
  };
  const historyCalls = [];
  const history = { replaceState(...args) { historyCalls.push(args); } };
  const { client } = createHarness(async () => jsonResponse({}), { location, history });
  await client.consumeRecoveryRedirect();
  assert.equal(historyCalls[0][2], 'https://example.supabase.co/reset?from=email&lang=zh');
});

test('PASSWORD_RECOVERY 通知触发前已清除 recovery fragment', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const location = {
    href: 'https://example.supabase.co/reset?from=email#type=recovery&access_token=token&refresh_token=refresh&expires_in=900',
    hash: '#type=recovery&access_token=token&refresh_token=refresh&expires_in=900',
  };
  const historyCalls = [];
  const history = {
    replaceState(...args) {
      historyCalls.push(args);
      location.hash = '';
    },
  };
  const { client } = createHarness(async () => jsonResponse({}), { location, history });
  let hashAtNotification;
  client.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') hashAtNotification = location.hash;
  });

  await client.consumeRecoveryRedirect();

  assert.equal(hashAtNotification, '');
  assert.equal(historyCalls.length, 1);
});

test('过期阈值为 now+60 时刷新，而 now+61 时不刷新', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const nearExpiryStorage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old-60', refresh_token: 'refresh-60', expires_at: 1700000060 }),
  });
  const nearExpiry = createHarness(async () => jsonResponse({ access_token: 'new-60', refresh_token: 'new-refresh-60', expires_in: 3600 }), {
    storage: nearExpiryStorage,
    now: () => 1700000000,
  });
  assert.equal(await nearExpiry.client.getAccessToken(), 'new-60');
  assert.equal(nearExpiry.calls.length, 1);

  const safeStorage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old-61', refresh_token: 'refresh-61', expires_at: 1700000061 }),
  });
  const safe = createHarness(async () => jsonResponse({}), {
    storage: safeStorage,
    now: () => 1700000000,
  });
  assert.equal(await safe.client.getAccessToken(), 'old-61');
  assert.equal(safe.calls.length, 0);
});

test('CommonJS 不污染 globalThis，浏览器 UMD 挂载 window.AuthClient', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'auth-client.js'), 'utf8');
  const commonJsContext = { module: { exports: {} }, exports: {}, globalThis: {} };
  vm.runInNewContext(source, commonJsContext, { filename: 'auth-client.js' });
  assert.equal(typeof commonJsContext.module.exports.createAuthClient, 'function');
  assert.equal(commonJsContext.globalThis.AuthClient, undefined);

  const browserWindow = {};
  const browserContext = { window: browserWindow, globalThis: {}, module: undefined };
  vm.runInNewContext(source, browserContext, { filename: 'auth-client.js' });
  assert.equal(typeof browserWindow.AuthClient.createAuthClient, 'function');
  assert.equal(browserContext.globalThis.AuthClient, undefined);
});
