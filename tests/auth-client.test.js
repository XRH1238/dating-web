const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const authModule = require(path.resolve(__dirname, '..', 'auth-client.js'));

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
  assert.equal(JSON.parse(storage.value('dating-web:auth:v1')).expires_at, 1700003600);
  assert.equal(await client.getAccessToken(), 'fresh-user-jwt');
  assert.equal(calls.length, 1);
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
  assert.equal(calls[1].url, 'https://example.supabase.co/auth/v1/logout?scope=local');
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
      return jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1' } });
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
  const first = createHarness(async () => jsonResponse({ access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: { id: 'u1' } }), options);
  await first.client.signInWithPassword('a@example.com', 'password');
  assert.ok(storage.value('custom-auth-key'));
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
  const second = createHarness(async () => jsonResponse({}), options);
  assert.equal((await second.client.getSession()).access_token, 'jwt');
});

test('登录响应中的 expires_at 保持绝对过期秒', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async () => jsonResponse({
    access_token: 'jwt', refresh_token: 'refresh', expires_at: 1700004321, user: { id: 'u1' },
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
    { access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600 },
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

test('并发 signOut 不会被已开始的 refresh 响应复活', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000060 }),
  });
  let resolveRefresh;
  const { client, calls } = createHarness(async (url) => {
    if (url.includes('grant_type=refresh_token')) {
      return new Promise((resolve) => { resolveRefresh = () => resolve(jsonResponse({ access_token: 'new', refresh_token: 'new-refresh', expires_at: 1700003600 })); });
    }
    return jsonResponse(null, 204);
  }, { storage, now: () => 1700000000 });
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value && value.access_token]));

  const refreshPromise = client.getAccessToken();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  assert.equal(typeof resolveRefresh, 'function');
  await client.signOut();
  resolveRefresh();
  await refreshPromise;

  assert.equal(await client.getSession(), null);
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
});

test('同一会话的并发 getAccessToken 和 getSession 共用单次 refresh', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000060 }),
  });
  let resolveRefresh;
  const refreshResponse = new Promise((resolve) => {
    resolveRefresh = () => resolve(jsonResponse({ access_token: 'new', refresh_token: 'new-refresh', expires_in: 3600 }));
  });
  const { client, calls } = createHarness(async (url) => {
    if (url.includes('grant_type=refresh_token')) return refreshResponse;
    return jsonResponse(null, 204);
  }, { storage, now: () => 1700000000 });

  const tokenPromise = client.getAccessToken();
  const sessionPromise = client.getSession();
  await Promise.resolve();
  assert.equal(calls.length, 1);
  resolveRefresh();
  const [token, session] = await Promise.all([tokenPromise, sessionPromise]);

  assert.equal(token, 'new');
  assert.equal(session.access_token, 'new');
  assert.equal(session.expires_at, 1700003600);
  assert.equal(calls.length, 1);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function wireSession(user) {
  return {
    access_token: 'jwt-' + user.id,
    refresh_token: 'refresh-' + user.id,
    expires_in: 3600,
    user,
  };
}

test('逆序完成的双登录只允许最新 generation 落地', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const first = deferred();
  const second = deferred();
  const { client } = createHarness(async (_url, options) => {
    return JSON.parse(options.body).email === 'first@example.com' ? first.promise : second.promise;
  }, { now: () => 1700000000 });
  const firstLogin = client.signInWithPassword('first@example.com', 'password');
  const secondLogin = client.signInWithPassword('second@example.com', 'password');

  second.resolve(jsonResponse(wireSession({ id: 'second', email: 'second@example.com' })));
  const secondSession = await secondLogin;
  first.resolve(jsonResponse(wireSession({ id: 'first', email: 'first@example.com' })));
  await assert.rejects(() => firstLogin, /操作已过期/);

  assert.equal(secondSession.user.id, 'second');
  assert.equal((await client.getSession()).user.id, 'second');
});

test('pending signIn 被 signOut 立即失效且登录响应不能落地', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const login = deferred();
  const { client } = createHarness(async () => login.promise);
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value]));
  const loginPromise = client.signInWithPassword('a@example.com', 'password');
  await Promise.resolve();
  await client.signOut();
  login.resolve(jsonResponse(wireSession({ id: 'u1', email: 'a@example.com' })));

  await assert.rejects(() => loginPromise, /操作已过期/);
  assert.equal(await client.getSession(), null);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
});

test('recovery 接管 pending signIn，只有最新 mutation 能落地', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const login = deferred();
  const location = {
    href: 'https://example.supabase.co/reset#type=recovery&access_token=recovery&refresh_token=recovery-refresh&expires_in=900',
    hash: '#type=recovery&access_token=recovery&refresh_token=recovery-refresh&expires_in=900',
  };
  const { client } = createHarness(async () => login.promise, { location, now: () => 1700000000 });
  const loginPromise = client.signInWithPassword('a@example.com', 'password');
  await Promise.resolve();
  const recovery = await client.consumeRecoveryRedirect();
  login.resolve(jsonResponse(wireSession({ id: 'u1', email: 'a@example.com' })));

  await assert.rejects(() => loginPromise, /操作已过期/);
  assert.equal(recovery.access_token, 'recovery');
  assert.equal((await client.getSession()).access_token, 'recovery');
});

test('同账号 pending signOut 只局部撤销旧 token，完成后不清除新登录会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'old-refresh', expires_at: 1700003600, user: { id: 'u1' } }),
  });
  const logout = deferred();
  const revokedTokens = [];
  const { client, calls } = createHarness(async (url, options) => {
    if (url.endsWith('/auth/v1/logout?scope=local')) {
      revokedTokens.push(options.headers.Authorization.replace('Bearer ', ''));
      return logout.promise;
    }
    return jsonResponse(wireSession({ id: 'u1', email: 'new@example.com' }));
  }, { storage, now: () => 1700000000 });
  const signOutPromise = client.signOut();
  await Promise.resolve();
  const newSession = await client.signInWithPassword('new@example.com', 'password');
  logout.resolve(jsonResponse(null, 204));
  await signOutPromise;

  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/logout?scope=local');
  assert.deepEqual(revokedTokens, ['old']);
  assert.equal(newSession.user.id, 'u1');
  assert.equal((await client.getSession()).access_token, 'jwt-u1');
});

test('pending updatePassword 被 signOut 后不会更新用户或抛 TypeError', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const update = deferred();
  const { client } = createHarness(async (url) => {
    if (url.endsWith('/auth/v1/user')) return update.promise;
    if (url.endsWith('/auth/v1/logout')) return jsonResponse(null, 204);
    return jsonResponse(wireSession({ id: 'u1', email: 'old@example.com' }));
  });
  await client.signInWithPassword('old@example.com', 'password');
  const updatePromise = client.updatePassword('new-password');
  await Promise.resolve();
  await client.signOut();
  update.resolve(jsonResponse({ id: 'u1', email: 'updated@example.com' }));

  await assert.doesNotReject(() => updatePromise);
  assert.equal(await client.getSession(), null);
});

test('同 tick 的 signOut 不会让 pending updatePassword 写入空会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const update = deferred();
  const { client } = createHarness(async (url) => {
    if (url.endsWith('/auth/v1/user')) return update.promise;
    if (url.endsWith('/auth/v1/logout')) return jsonResponse(null, 204);
    return jsonResponse(wireSession({ id: 'u1', email: 'old@example.com' }));
  });
  await client.signInWithPassword('old@example.com', 'password');
  const updatePromise = client.updatePassword('new-password');
  const signOutPromise = client.signOut();
  await signOutPromise;
  update.resolve(jsonResponse({ id: 'u1', email: 'updated@example.com' }));

  await assert.doesNotReject(() => updatePromise);
  assert.equal(await client.getSession(), null);
});

test('同 tick 的 recovery 使 updatePassword 停止使用旧账号 token', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const location = {
    href: 'https://example.supabase.co/reset#type=recovery&access_token=recovery&refresh_token=recovery-refresh&expires_in=900',
    hash: '#type=recovery&access_token=recovery&refresh_token=recovery-refresh&expires_in=900',
  };
  let userRequests = 0;
  const { client } = createHarness(async (url) => {
    if (url.endsWith('/auth/v1/user')) userRequests += 1;
    return jsonResponse(wireSession({ id: 'u1', email: 'old@example.com' }));
  }, { location, now: () => 1700000000 });
  await client.signInWithPassword('old@example.com', 'password');
  const updatePromise = client.updatePassword('new-password');
  await client.consumeRecoveryRedirect();

  assert.equal(await updatePromise, null);
  assert.equal(userRequests, 0);
  assert.equal((await client.getSession()).access_token, 'recovery');
});

test('pending updatePassword 不会覆盖已切换的新账号', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const update = deferred();
  const { client } = createHarness(async (url, options) => {
    if (url.endsWith('/auth/v1/user')) return update.promise;
    const body = options.body ? JSON.parse(options.body) : {};
    return jsonResponse(wireSession({ id: body.email === 'new@example.com' ? 'new' : 'old', email: body.email }));
  });
  await client.signInWithPassword('old@example.com', 'password');
  const updatePromise = client.updatePassword('new-password');
  await Promise.resolve();
  await client.signInWithPassword('new@example.com', 'password');
  update.resolve(jsonResponse({ id: 'old', email: 'updated-old@example.com' }));

  await assert.doesNotReject(() => updatePromise);
  assert.equal((await client.getSession()).user.email, 'new@example.com');
});

test('Auth 配置只接受绝对 http/https URL 且 key 非空', () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const validFetch = async () => jsonResponse(null, 204);
  for (const url of [
    '', '/relative', 'javascript:alert(1)', 'file:///tmp/auth',
    'https://user:pass@example.supabase.co', 'https://example.supabase.co?redirect=evil', 'https://example.supabase.co#fragment',
  ]) {
    assert.throws(() => authModule.createAuthClient({ url, key: 'publishable', fetchImpl: validFetch }), /URL/);
  }
  assert.throws(() => authModule.createAuthClient({ url: 'https://example.supabase.co', key: '', fetchImpl: validFetch }), /key/);
  assert.doesNotThrow(() => authModule.createAuthClient({ url: 'http://localhost:54321', key: 'publishable', fetchImpl: validFetch }));
});

test('Auth URL 规范化可选基础 path 并去除尾斜杠', async () => {
  const { client, calls } = createHarness(async () => jsonResponse(wireSession({ id: 'u1' })), {
    url: 'https://example.supabase.co/custom-auth///',
  });
  await client.signInWithPassword('a@example.com', 'password');
  assert.equal(calls[0].url, 'https://example.supabase.co/custom-auth/auth/v1/token?grant_type=password');
});

test('密码登录 wire 响应缺少必需字段时拒绝且不持久化', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  for (const payload of [
    { access_token: 'jwt', expires_in: 3600, user: { id: 'u1' } },
    { access_token: 'jwt', refresh_token: 'refresh', expires_in: 3600, user: {} },
    { access_token: 'jwt', refresh_token: 'refresh', user: { id: 'u1' } },
  ]) {
    const storage = createStorage();
    const { client } = createHarness(async () => jsonResponse(payload), { storage });
    await assert.rejects(() => client.signInWithPassword('a@example.com', 'password'), /认证响应无效/);
    assert.equal(storage.value('dating-web:auth:v1'), undefined);
  }
});

test('recovery fragment 缺少有效 expiry 时不创建会话', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  for (const hash of [
    '#type=recovery&access_token=token&refresh_token=refresh',
    '#type=recovery&access_token=token&refresh_token=refresh&expires_in=0',
  ]) {
    const storage = createStorage();
    const location = { href: 'https://example.supabase.co/reset' + hash, hash };
    const { client } = createHarness(async () => jsonResponse({}), { storage, location });
    assert.equal(await client.consumeRecoveryRedirect(), null);
    assert.equal(await client.getSession(), null);
    assert.equal(storage.value('dating-web:auth:v1'), undefined);
  }
});

test('refresh 可以继承旧 refresh_token，但必须返回新的有效 access 与 expiry', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'old-refresh', expires_at: 1700000060 }),
  });
  const { client } = createHarness(async () => jsonResponse({ access_token: 'new', expires_in: 3600 }), {
    storage,
    now: () => 1700000000,
  });

  const session = await client.getSession();
  assert.equal(session.access_token, 'new');
  assert.equal(session.refresh_token, 'old-refresh');
});

test('会话只持久化最小 user 投影，不保留完整用户对象', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage();
  const { client } = createHarness(async () => jsonResponse(wireSession({
    id: 'u1', email: 'a@example.com', role: 'authenticated', password: 'secret',
    user_metadata: { private_note: 'do not persist' }, app_metadata: { secret: 'do not persist' },
  })), { storage });
  await client.signInWithPassword('a@example.com', 'password');
  assert.deepEqual(JSON.parse(storage.value('dating-web:auth:v1')).user, {
    id: 'u1', email: 'a@example.com', role: 'authenticated',
  });
});

test('认证请求超时返回中文超时错误', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const { client } = createHarness(async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), { timeoutMs: 5 });
  await assert.rejects(() => client.signInWithPassword('a@example.com', 'password'), /认证请求超时/);
});

test('refresh 超时释放 single-flight、清会话并通知 SIGNED_OUT', async () => {
  assert.equal(typeof authModule.createAuthClient, 'function');
  const storage = createStorage({
    'dating-web:auth:v1': JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expires_at: 1700000060 }),
  });
  const { client, calls } = createHarness(async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }), { storage, timeoutMs: 5, now: () => 1700000000 });
  const events = [];
  client.onAuthStateChange((event, value) => events.push([event, value]));

  await assert.rejects(() => client.getAccessToken(), /认证请求超时/);
  assert.equal(await client.getAccessToken(), null);
  assert.equal(calls.length, 1);
  assert.equal(storage.value('dating-web:auth:v1'), undefined);
  assert.deepEqual(events, [['SIGNED_OUT', null]]);
});

test('browser UMD 可实例化并使用默认 fetch', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '..', 'auth-client.js'), 'utf8');
  const browserWindow = {};
  const storage = createStorage();
  let called = false;
  const browserFetch = async () => {
    called = true;
    return jsonResponse(wireSession({ id: 'browser', email: 'browser@example.com' }));
  };
  const browserContext = { window: browserWindow, globalThis: {}, module: undefined, fetch: browserFetch, AbortController, setTimeout, clearTimeout };
  vm.runInNewContext(source, browserContext, { filename: 'auth-client.js' });
  const client = browserWindow.AuthClient.createAuthClient({
    url: 'https://example.supabase.co', key: 'publishable', storage, now: () => 1700000000,
  });
  await client.signInWithPassword('browser@example.com', 'password');
  assert.equal(called, true);
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
