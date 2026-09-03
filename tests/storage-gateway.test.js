const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let gatewayModule = {};
try {
  gatewayModule = require(path.resolve(__dirname, '../supabase/functions/storage-gateway/core.ts'));
} catch (_) {
  // The first TDD run intentionally reaches this branch before implementation.
}

const GATEWAY_URL = 'https://primary.supabase.co/functions/v1/storage-gateway';
const SIGNED_URL = 'https://storage.supabase.co/storage/v1/object/upload/sign/love-photos/records/a.jpg?token=short-lived';
const validSignRequest = {
  action: 'sign-upload',
  backend: 'secondary',
  bucket: 'love-photos',
  path: 'records/a.jpg',
};

function makeDeps(overrides = {}) {
  const calls = { verify: [], sign: [], remove: [] };
  const deps = {
    backends: { secondary: { bucket: 'love-photos' } },
    async verifyUser(token) {
      calls.verify.push(token);
      return token === 'valid-user-jwt' ? { id: 'user-1' } : null;
    },
    async createSignedUpload(backend, bucket, objectPath) {
      calls.sign.push({ backend, bucket, path: objectPath });
      return SIGNED_URL;
    },
    async removeObjects(backend, bucket, paths) {
      calls.remove.push({ backend, bucket, paths });
    },
    ...overrides,
  };
  return { deps, calls };
}

function gatewayRequest(body, token = 'valid-user-jwt', options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return new Request(GATEWAY_URL, {
    method: options.method || 'POST',
    headers,
    body: options.body === undefined ? JSON.stringify(body) : options.body,
  });
}

async function invoke(body, token, overrides) {
  const { deps, calls } = makeDeps(overrides);
  const response = await gatewayModule.handleStorageGateway(gatewayRequest(body, token), deps);
  return { response, calls };
}

test('Storage Gateway exports a testable request handler', () => {
  assert.equal(typeof gatewayModule.handleStorageGateway, 'function');
});

test('OPTIONS returns CORS headers without trying to authenticate', async () => {
  const { deps, calls } = makeDeps();
  const response = await gatewayModule.handleStorageGateway(new Request(GATEWAY_URL, {
    method: 'OPTIONS',
    headers: { Origin: 'https://xrh1238.github.io' },
  }), deps);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://xrh1238.github.io');
  assert.match(response.headers.get('access-control-allow-methods'), /POST/);
  assert.match(response.headers.get('access-control-allow-headers'), /authorization/i);
  assert.deepEqual(calls.verify, []);
});

test('CORS does not grant an untrusted website access to gateway responses', async () => {
  const { deps } = makeDeps();
  const response = await gatewayModule.handleStorageGateway(new Request(GATEWAY_URL, {
    method: 'OPTIONS',
    headers: { Origin: 'https://evil.example' },
  }), deps);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

test('all JSON error responses include CORS headers', async () => {
  const { response } = await invoke(validSignRequest, null);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('content-type'), /application\/json/);
});

test('non-POST methods are rejected before authentication', async () => {
  const { deps, calls } = makeDeps();
  const response = await gatewayModule.handleStorageGateway(new Request(GATEWAY_URL, { method: 'GET' }), deps);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'POST, OPTIONS');
  assert.deepEqual(calls.verify, []);
});

test('invalid JSON is rejected without calling dependencies', async () => {
  const { deps, calls } = makeDeps();
  const response = await gatewayModule.handleStorageGateway(
    gatewayRequest(null, 'valid-user-jwt', { body: '{broken' }),
    deps,
  );
  assert.equal(response.status, 400);
  assert.deepEqual(calls.verify, []);
  assert.deepEqual(calls.sign, []);
});

test('missing, malformed and invalid bearer credentials are rejected', async () => {
  for (const authorization of [null, 'Basic abc', 'Bearer', 'Bearer one two', 'Bearer invalid-jwt']) {
    const { deps, calls } = makeDeps();
    const headers = authorization ? { Authorization: authorization } : {};
    const response = await gatewayModule.handleStorageGateway(
      gatewayRequest(validSignRequest, null, { headers }),
      deps,
    );
    assert.equal(response.status, 401, authorization || 'missing header');
    assert.deepEqual(calls.sign, []);
    assert.deepEqual(calls.remove, []);
  }
});

test('verification errors are returned as generic 401 responses', async () => {
  const { response } = await invoke(validSignRequest, 'valid-user-jwt', {
    async verifyUser() { throw new Error('auth internals and secret details'); },
  });
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), /auth internals|secret/i);
});

test('unknown backend, wrong bucket and unsupported action are rejected', async () => {
  const cases = [
    { ...validSignRequest, backend: 'unknown' },
    { ...validSignRequest, bucket: 'other-bucket' },
    { ...validSignRequest, action: 'list' },
  ];
  for (const body of cases) {
    const { response, calls } = await invoke(body, 'valid-user-jwt');
    assert.equal(response.status, 400);
    assert.deepEqual(calls.sign, []);
    assert.deepEqual(calls.remove, []);
  }
});

test('valid authenticated upload signs the exact allowlisted path', async () => {
  const { response, calls } = await invoke(validSignRequest, 'valid-user-jwt');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { signedUrl: SIGNED_URL });
  assert.deepEqual(calls.verify, ['valid-user-jwt']);
  assert.deepEqual(calls.sign, [{ backend: 'secondary', bucket: 'love-photos', path: 'records/a.jpg' }]);
});

test('safe Unicode gallery folder and supported fixed folders are accepted', async () => {
  for (const objectPath of [
    '厦门市/海边 日落.jpg',
    'capsules/memory.mov',
    'unplaced/live-photo.heic',
  ]) {
    const { response, calls } = await invoke({ ...validSignRequest, path: objectPath }, 'valid-user-jwt');
    assert.equal(response.status, 200, objectPath);
    assert.equal(calls.sign[0].path, objectPath);
  }
});

test('unsafe raw and percent-encoded traversal paths are rejected', async () => {
  const unsafePaths = [
    '/records/a.jpg', 'records/a.jpg/', 'records//a.jpg', 'records/./a.jpg',
    'records/../a.jpg', '../secret', 'records\\a.jpg', 'records/a\u0000.jpg',
    'records/%2e%2e/secret', 'records/%2E./secret', 'records/%2fsecret',
    'records/%5Csecret', 'records/%00secret', '%2e%2e/secret',
    'records/%252e%252e/secret', 'records/%252fsecret', 'records/%2500secret',
  ];
  for (const objectPath of unsafePaths) {
    const { response, calls } = await invoke({ ...validSignRequest, path: objectPath }, 'valid-user-jwt');
    assert.equal(response.status, 400, objectPath);
    assert.deepEqual(calls.sign, []);
  }
});

test('unsafe city folder names are rejected', async () => {
  for (const objectPath of [' city/a.jpg', 'city /a.jpg', 'city<script>/a.jpg', '🏖️/a.jpg']) {
    const { response, calls } = await invoke({ ...validSignRequest, path: objectPath }, 'valid-user-jwt');
    assert.equal(response.status, 400, objectPath);
    assert.deepEqual(calls.sign, []);
  }
});

test('delete requires one to forty unique safe paths and removes exact paths', async () => {
  const paths = ['records/a.webp', 'records/a.mov'];
  const { response, calls } = await invoke({
    action: 'delete', backend: 'secondary', bucket: 'love-photos', paths,
  }, 'valid-user-jwt');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: 2 });
  assert.deepEqual(calls.remove, [{ backend: 'secondary', bucket: 'love-photos', paths }]);

  for (const invalidPaths of [[], Array.from({ length: 41 }, (_, i) => `records/${i}.jpg`), paths.concat(paths[0])]) {
    const result = await invoke({
      action: 'delete', backend: 'secondary', bucket: 'love-photos', paths: invalidPaths,
    }, 'valid-user-jwt');
    assert.equal(result.response.status, 400);
    assert.deepEqual(result.calls.remove, []);
  }
});

test('delete validates every path before removing anything', async () => {
  const { response, calls } = await invoke({
    action: 'delete', backend: 'secondary', bucket: 'love-photos',
    paths: ['records/a.jpg', '../secret'],
  }, 'valid-user-jwt');
  assert.equal(response.status, 400);
  assert.deepEqual(calls.remove, []);
});

test('storage dependency failures do not expose server secrets', async () => {
  const { response } = await invoke(validSignRequest, 'valid-user-jwt', {
    async createSignedUpload() { throw new Error('server credential do-not-leak'); },
  });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /server credential|do-not-leak/i);
});

test('Edge adapter verifies users and uses only server environment Storage credentials', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../supabase/functions/storage-gateway/index.ts'), 'utf8');
  const config = fs.readFileSync(path.resolve(__dirname, '../supabase/config.toml'), 'utf8');

  assert.match(source, /requiredEnv\("STORAGE_BACKENDS_JSON"\)/);
  assert.match(source, /backend\.secretKey\.startsWith\("sb_secret_"\)/);
  assert.match(source, /mainClient\.auth\.getUser\(token\)/);
  assert.match(source, /createSignedUploadUrl\(path,\s*\{\s*upsert:\s*false\s*\}\)/);
  assert.match(source, /storageClient\.storage\.from\(bucket\)\.remove\(paths\)/);
  assert.doesNotMatch(source, /sb_secret_[A-Za-z0-9_-]+/);
  assert.match(config, /\[functions\.storage-gateway\]\s*verify_jwt\s*=\s*false/);
});
