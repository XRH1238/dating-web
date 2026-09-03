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

function testWatchdog(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('测试看门狗超时')), ms));
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
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('登录后数据库 SELECT 使用主用户 JWT，匿名时不发送 Authorization', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });

  await client.select('love_todos');

  assert.equal(calls[0].options.headers.apikey, 'main-publishable');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer user-jwt');
});

test('三种数据库写入使用主用户 JWT，而不是 publishable key', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 204, async text() { return ''; } };
    },
  });

  await client.insert('love_todos', [{ text: '看海' }]);
  await client.update('love_todos', 'todo 1', { text: '看云' });
  await client.remove('love_todos', 'todo 1');

  assert.deepEqual(calls.map(call => call.options.headers.Authorization), [
    'Bearer user-jwt', 'Bearer user-jwt', 'Bearer user-jwt',
  ]);
  calls.forEach(call => assert.equal(call.options.headers.apikey, 'main-publishable'));
});

test('配置认证但没有 JWT 时数据库写入会在请求前拒绝', async () => {
  for (const token of [null, '']) {
    const calls = [];
    const client = dataModule.createCloudDataClient({
      url: 'https://primary.supabase.co',
      key: 'main-publishable',
      getAccessToken: async () => token,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 204, async text() { return ''; } };
      },
    });

    await assert.rejects(() => client.insert('love_todos', [{ text: '看海' }]), /请先登录/);
    await assert.rejects(() => client.update('love_todos', 'todo 1', { text: '看云' }), /请先登录/);
    await assert.rejects(() => client.remove('love_todos', 'todo 1'), /请先登录/);
    assert.equal(calls.length, 0);
  }
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
    allowAnonymousWrites: true,
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      async text() { return ''; },
      async json() { throw new Error('empty response'); },
    }),
  });
  await assert.doesNotReject(() => client.insert('love_todos', [{ text: '看日落' }]));
});

test('数据库写入默认要求登录，显式兼容开关才允许匿名写入', async () => {
  const deniedCalls = [];
  const denied = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    fetchImpl: async (url, options) => {
      deniedCalls.push({ url, options });
      return { ok: true, status: 204, async text() { return ''; } };
    },
  });

  await assert.rejects(() => denied.insert('love_todos', [{ text: '看日落' }]), /请先登录/);
  await assert.rejects(() => denied.update('love_todos', 'todo 1', { text: '看日落' }), /请先登录/);
  await assert.rejects(() => denied.remove('love_todos', 'todo 1'), /请先登录/);
  assert.equal(deniedCalls.length, 0);

  const legacyCalls = [];
  const legacy = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    allowAnonymousWrites: true,
    fetchImpl: async (url, options) => {
      legacyCalls.push({ url, options });
      return { ok: true, status: 204, async text() { return ''; } };
    },
  });

  await legacy.insert('love_todos', [{ text: '看日落' }]);
  await legacy.update('love_todos', 'todo 1', { text: '看日落' });
  await legacy.remove('love_todos', 'todo 1');
  assert.equal(legacyCalls.length, 3);
  legacyCalls.forEach(call => assert.equal(call.options.headers.Authorization, undefined));
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

test('整个数据库操作的 deadline 覆盖挂起的认证 getter 与响应 body', async () => {
  const getterCalls = [];
  const getterClient = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    timeoutMs: 5,
    getAccessToken: async () => new Promise(() => {}),
    fetchImpl: async (url, options) => {
      getterCalls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });
  await assert.rejects(
    () => Promise.race([getterClient.select('love_todos'), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(getterCalls.length, 0);

  const bodyCalls = [];
  const bodyClient = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    timeoutMs: 5,
    fetchImpl: async (url, options) => {
      bodyCalls.push({ url, options });
      return { ok: true, status: 200, async text() { return new Promise(() => {}); } };
    },
  });
  await assert.rejects(
    () => Promise.race([bodyClient.select('love_todos'), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(bodyCalls.length, 1);

  const jsonCalls = [];
  const jsonClient = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co',
    key: 'publishable-key',
    timeoutMs: 5,
    fetchImpl: async (url, options) => {
      jsonCalls.push({ url, options });
      return { ok: true, status: 200, async json() { return new Promise(() => {}); } };
    },
  });
  await assert.rejects(
    () => Promise.race([jsonClient.select('love_todos'), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(jsonCalls.length, 1);
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
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test('网关签名上传使用主 JWT，并以不带凭据的 FormData PUT 上传 Blob', async () => {
  const calls = [];
  const file = new Blob(['image-data'], { type: 'image/jpeg' });
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageUrl: 'https://storage.supabase.co',
    storageKey: 'storage-publishable',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return {
          ok: true,
          status: 200,
          async text() { return JSON.stringify({ signedUrl: 'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=one' }); },
        };
      }
      return { ok: true, status: 200, async text() { return '{}'; } };
    },
  });

  await client.upload('love-photos', 'records/a.jpg', file);

  assert.equal(calls[0].url, 'https://primary.supabase.co/functions/v1/storage-gateway');
  assert.deepEqual(calls[0].options.headers, {
    apikey: 'main-publishable', Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json',
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    action: 'sign-upload', backend: 'secondary', bucket: 'love-photos', path: 'records/a.jpg',
  });
  assert.equal(calls[1].url, 'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=one');
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(calls[1].options.headers, { 'x-upsert': 'false' });
  assert.equal(calls[1].options.body instanceof FormData, true);
  assert.equal(calls[1].options.body.get('cacheControl'), '3600');
  assert.equal(calls[1].options.body.get('') instanceof Blob, true);
});

test('网关返回跨站或错误路径的签名 URL 时拒绝上传', async () => {
  for (const signedUrl of [
    'https://attacker.example/storage/v1/object/upload/sign/love-photos/records/a.jpg',
    'https://storage.supabase.co/storage/v1/object/public/love-photos/records/a.jpg',
    'https://attacker@storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg',
    'https://storage.supabase.co:444/storage/v1/object/upload/sign/love-photos/records/a.jpg',
    'https://storage.supabase.co/storage/v1/object/upload/sign%2Frecords/a.jpg',
  ]) {
    const calls = [];
    const client = dataModule.createCloudDataClient({
      url: 'https://primary.supabase.co',
      key: 'main-publishable',
      storageUrl: 'https://storage.supabase.co',
      storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
      getAccessToken: async () => 'user-jwt',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, async text() { return JSON.stringify({ signedUrl }); } };
      },
    });

    await assert.rejects(() => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])));
    assert.equal(calls.length, 1);
  }
});

test('签名 URL 必须精确匹配 bucket/path 且只有一个非空 token', async () => {
  const signedUrls = [
    'https://storage.supabase.co/storage/v1/object/upload/sign/other-bucket/records/a.jpg?token=one',
    'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/other.jpg?token=one',
    'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records%2Fa.jpg?token=one',
    'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg',
    'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=',
    'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=one&token=two',
  ];
  for (const signedUrl of signedUrls) {
    const calls = [];
    const client = dataModule.createCloudDataClient({
      url: 'https://primary.supabase.co',
      key: 'main-publishable',
      storageUrl: 'https://storage.supabase.co',
      storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
      getAccessToken: async () => 'user-jwt',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, async text() { return JSON.stringify({ signedUrl }); } };
      },
    });
    await assert.rejects(() => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])));
    assert.equal(calls.length, 1);
  }
});

test('无效、错误或抛错的认证 getter 都会让 SELECT 匿名读取', async () => {
  const key = 'main-publishable';
  const getters = [
    async () => null,
    async () => '',
    async () => '   ',
    async () => ({ access_token: 'not-a-string' }),
    async () => { throw new Error('认证服务不可用'); },
    async () => key,
    async () => 'storage-publishable',
    async () => 'sb_publishable_third_party',
    async () => 'sb_secret_third_party',
  ];

  for (const getAccessToken of getters) {
    const calls = [];
    const client = dataModule.createCloudDataClient({
      url: 'https://primary.supabase.co',
      key,
      storageKey: 'storage-publishable',
      getAccessToken,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, async text() { return '[]'; } };
      },
    });

    await assert.doesNotReject(() => client.select('love_todos'));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options.headers, { apikey: key });
  }
});

test('任一公开 key 或空 token 不能授权数据库写入或网关操作', async () => {
  for (const token of [null, 'main-publishable', 'storage-publishable', 'sb_publishable_third_party', 'sb_secret_third_party']) {
    const calls = [];
    const client = dataModule.createCloudDataClient({
      url: 'https://primary.supabase.co',
      key: 'main-publishable',
      storageUrl: 'https://storage.supabase.co',
      storageKey: 'storage-publishable',
      storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
      getAccessToken: async () => token,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, status: 200, async text() { return '[]'; } };
      },
    });

    await assert.rejects(() => client.insert('love_todos', [{ text: '看海' }]), /请先登录/);
    await assert.rejects(() => client.update('love_todos', 'todo 1', { text: '看云' }), /请先登录/);
    await assert.rejects(() => client.remove('love_todos', 'todo 1'), /请先登录/);
    await assert.rejects(() => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])), /请先登录/);
    await assert.rejects(() => client.removeObjects('love-photos', ['records/a.jpg']), /请先登录/);
    assert.equal(calls.length, 0);
  }
});

test('认证 getter 抛错时写入与网关操作会在 fetch 前传播错误', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    getAccessToken: async () => { throw new Error('认证服务不可用'); },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });

  await assert.rejects(() => client.insert('love_todos', [{ text: '看海' }]), /认证服务不可用/);
  await assert.rejects(() => client.update('love_todos', 'todo 1', { text: '看云' }), /认证服务不可用/);
  await assert.rejects(() => client.remove('love_todos', 'todo 1'), /认证服务不可用/);
  await assert.rejects(() => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])), /认证服务不可用/);
  await assert.rejects(() => client.removeObjects('love-photos', ['records/a.jpg']), /认证服务不可用/);
  assert.equal(calls.length, 0);
});

test('网关签名失败时带 status 抛错且不继续 PUT', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: false, status: 500, async text() { return 'gateway unavailable'; } };
    },
  });

  await assert.rejects(
    () => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])),
    error => error.status === 500 && /500/.test(error.message)
  );
  assert.equal(calls.length, 1);
});

test('签名 PUT 失败时保留 HTTP status', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return { ok: true, status: 200, async text() { return JSON.stringify({ signedUrl: 'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=one' }); } };
      }
      return { ok: false, status: 403, async text() { return 'expired'; } };
    },
  });

  await assert.rejects(
    () => client.upload('love-photos', 'records/a.jpg', new Blob(['image'])),
    error => error.status === 403 && /403/.test(error.message)
  );
  assert.equal(calls.length, 2);
});

test('网关删除失败时保留 HTTP status', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: false, status: 503, async text() { return 'gateway unavailable'; } };
    },
  });

  await assert.rejects(
    () => client.removeObjects('love-photos', ['records/a.jpg']),
    error => error.status === 503 && /503/.test(error.message)
  );
  assert.equal(calls.length, 1);
});

test('网关整次上传和删除操作的 deadline 覆盖签名、PUT 与删除 body', async () => {
  const signCalls = [];
  const signClient = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co', key: 'main-publishable', storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway', timeoutMs: 5,
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      signCalls.push({ url, options });
      return { ok: true, status: 200, async text() { return new Promise(() => {}); } };
    },
  });
  await assert.rejects(
    () => Promise.race([signClient.upload('love-photos', 'records/a.jpg', new Blob(['image'])), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(signCalls.length, 1);

  const putCalls = [];
  const putClient = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co', key: 'main-publishable', storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway', timeoutMs: 5,
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      putCalls.push({ url, options });
      if (putCalls.length === 1) return { ok: true, status: 200, async text() { return JSON.stringify({ signedUrl: 'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=one' }); } };
      return { ok: true, status: 200, async text() { return new Promise(() => {}); } };
    },
  });
  await assert.rejects(
    () => Promise.race([putClient.upload('love-photos', 'records/a.jpg', new Blob(['image'])), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(putCalls.length, 2);

  const deleteCalls = [];
  const deleteClient = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co', key: 'main-publishable',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway', timeoutMs: 5,
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      deleteCalls.push({ url, options });
      return { ok: true, status: 200, async text() { return new Promise(() => {}); } };
    },
  });
  await assert.rejects(
    () => Promise.race([deleteClient.removeObjects('love-photos', ['records/a.jpg']), testWatchdog(50)]),
    /云端请求超时/
  );
  assert.equal(deleteCalls.length, 1);
});

test('上传与删除路径必须是有效的非空字符串数组，且不会请求', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://example.supabase.co', key: 'publishable-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });
  for (const invalidPath of ['', '   ', null, 1, {}]) {
    await assert.rejects(() => client.upload('love-photos', invalidPath, { type: 'image/jpeg' }));
  }
  for (const invalidPaths of [undefined, 'records/a.jpg', ['', 'records/a.jpg'], ['   '], [1]]) {
    await assert.rejects(() => client.removeObjects('love-photos', invalidPaths));
  }
  assert.equal(calls.length, 0);
});

test('配置网关时 Storage 删除使用主 JWT，空路径不请求', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-publishable',
    storageUrl: 'https://storage.supabase.co',
    storageGatewayUrl: 'https://primary.supabase.co/functions/v1/storage-gateway',
    storageBackend: 'secondary',
    getAccessToken: async () => 'user-jwt',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '[]'; } };
    },
  });

  assert.deepEqual(await client.removeObjects('love-photos', []), []);
  await client.removeObjects('love-photos', ['records/a.jpg']);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://primary.supabase.co/functions/v1/storage-gateway');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(calls[0].options.headers, {
    apikey: 'main-publishable', Authorization: 'Bearer user-jwt', 'Content-Type': 'application/json',
  });
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    action: 'delete', backend: 'secondary', bucket: 'love-photos', paths: ['records/a.jpg'],
  });
});

test('数据库与 Storage 请求分别使用主配置和 Storage 配置', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'primary-key',
    storageUrl: 'https://storage.supabase.co/',
    storageKey: 'storage-key',
    allowAnonymousWrites: true,
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
  calls.slice(0, 4).forEach(call => assert.equal(call.options.headers.Authorization, undefined));
  assert.equal(calls[4].url, 'https://storage.supabase.co/storage/v1/object/love-photos/records/test%20photo.jpg');
  assert.equal(calls[4].options.headers.apikey, 'storage-key');
  assert.equal(calls[4].options.headers.Authorization, undefined);
  assert.equal(calls[5].url, 'https://storage.supabase.co/storage/v1/object/love-photos');
  assert.equal(calls[5].options.headers.apikey, 'storage-key');
  assert.equal(calls[5].options.headers.Authorization, undefined);
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

test('只配置 storageUrl 时 Storage key 回退到主 key', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-key',
    storageUrl: 'https://storage.supabase.co',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '{}'; } };
    },
  });

  await client.upload('love-photos', 'gallery/a.jpg', { type: 'image/jpeg' });
  assert.equal(calls[0].url, 'https://storage.supabase.co/storage/v1/object/love-photos/gallery/a.jpg');
  assert.equal(calls[0].options.headers.apikey, 'main-key');
});

test('只配置 storageKey 时 Storage URL 回退到主 URL', async () => {
  const calls = [];
  const client = dataModule.createCloudDataClient({
    url: 'https://primary.supabase.co',
    key: 'main-key',
    storageKey: 'storage-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, async text() { return '{}'; } };
    },
  });

  await client.upload('love-photos', 'gallery/a.jpg', { type: 'image/jpeg' });
  assert.equal(calls[0].url, 'https://primary.supabase.co/storage/v1/object/love-photos/gallery/a.jpg');
  assert.equal(calls[0].options.headers.apikey, 'storage-key');
});
