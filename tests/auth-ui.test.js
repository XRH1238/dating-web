const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function functionStartsWithGuard(name) {
  return new RegExp(`(?:async\\s+)?function\\s+${name}\\([^)]*\\)\\s*\\{\\s*(?:event\\.preventDefault\\(\\);\\s*)?if\\s*\\(!requireAuthenticated\\(`);
}

function createScriptHarness(overrides = {}) {
  const body = { dataset: {} };
  const panelStub = () => ({ classList: { add() {}, remove() {} }, setAttribute() {} });
  const elements = {
    '#quick-panel': panelStub(),
    '#record-panel': panelStub(),
    '#capsule-panel': panelStub(),
  };
  const document = {
    body,
    addEventListener() {},
    querySelector(selector) { return elements[selector] || null; },
    querySelectorAll() { return []; },
  };
  const context = {
    console,
    document,
    location: { href: 'https://example.com/' },
    setTimeout,
    clearTimeout,
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    FormData,
    Blob,
    URL,
    fetch: overrides.fetch || (async () => { throw new Error('unexpected fetch'); }),
  };
  context.window = context;
  context.window.addEventListener = function() {};
  context.window.confirm = function() { return true; };
  context.window.localStorage = null;
  Object.assign(context.window, overrides.window || {});
  vm.createContext(context);
  vm.runInContext(script + `\n;globalThis.__authUiHooks = {
    setState: function(next) { Object.assign(state, next); },
    getState: function() { return state; },
    restoreAuth: restoreAuth,
    loadRemoteData: loadRemoteData,
    syncPendingRecords: syncPendingRecords,
    uploadPhotos: uploadPhotos,
    handleAuthStateChange: handleAuthStateChange,
    afterSuccessfulSave: typeof afterSuccessfulSave === 'function' ? afterSuccessfulSave : undefined
  };`, context);
  return { context, hooks: context.__authUiHooks, body };
}

test('页面先加载 Auth 客户端并提供无注册入口的登录与恢复对话框', () => {
  assert.ok(html.indexOf('auth-client.js') >= 0);
  assert.ok(html.indexOf('auth-client.js') < html.indexOf('cloud-data-client.js'));
  assert.ok(html.indexOf('auth-client.js') < html.indexOf('script.js'));
  assert.match(html, /id="auth-login-button"/);
  assert.match(html, /id="auth-account"/);
  assert.match(html, /id="auth-logout-button"/);
  assert.match(html, /<dialog[^>]*id="auth-dialog"[^>]*aria-labelledby="auth-dialog-title"/);
  assert.match(html, /<form[^>]*id="auth-login-form"/);
  assert.match(html, /type="email"[^>]*autocomplete="email"/);
  assert.match(html, /type="password"[^>]*autocomplete="current-password"/);
  assert.match(html, /id="auth-forgot-password"/);
  assert.match(html, /<dialog[^>]*id="password-recovery-dialog"[^>]*aria-labelledby="password-recovery-title"/);
  assert.match(html, /autocomplete="new-password"/);
  assert.doesNotMatch(html, /注册账号|创建账号|立即注册/);
});

test('所有静态写入口都标记为登录后可用', () => {
  assert.match(html, /data-open-panel="plan"[^>]*data-auth-write|data-auth-write[^>]*data-open-panel="plan"/);
  assert.match(html, /data-open-record[^>]*data-auth-write|data-auth-write[^>]*data-open-record/);
  assert.match(html, /<form[^>]*id="todo-form"[^>]*data-auth-write/);
  assert.match(html, /<div[^>]*class="gallery-actions"[^>]*data-auth-write/);
  assert.match(html, /data-media-dropzone="gallery"[^>]*data-auth-write|data-auth-write[^>]*data-media-dropzone="gallery"/);
  assert.match(html, /id="quick-panel"[^>]*data-auth-write|data-auth-write[^>]*id="quick-panel"/);
  assert.match(html, /id="record-panel"[^>]*data-auth-write|data-auth-write[^>]*id="record-panel"/);
  assert.match(html, /id="capsule-panel"[^>]*data-auth-write|data-auth-write[^>]*id="capsule-panel"/);
  assert.match(styles, /body\[data-authenticated="false"\]\s+\[data-auth-write\]\s*\{[^}]*display:\s*none/s);
});

test('认证先恢复再连接云端并把用户 JWT 动态交给数据客户端', () => {
  assert.match(script, /const state = \{[\s\S]*?authClient:\s*null[\s\S]*?authUser:\s*null/);
  assert.match(script, /async function init\(\)[\s\S]*?connectAuth\(\);[\s\S]*?await restoreAuth\(\);[\s\S]*?connectSupabase\(\);[\s\S]*?await loadRemoteData\(\);/);
  assert.match(script, /getAccessToken:\s*function\(\)\s*\{\s*return state\.authClient\.getAccessToken\(\);\s*\}/);
  assert.match(script, /storageGatewayUrl:\s*supabaseConfig\.url\s*\+\s*"\/functions\/v1\/storage-gateway"/);
  assert.match(script, /storageBackend:\s*"secondary"/);
  assert.match(script, /storageUrl:\s*storageConfig\.url/);
  assert.match(script, /storageKey:\s*storageConfig\.key/);
  assert.match(script, /state\.authClient\.onAuthStateChange\(/);
  assert.match(script, /state\.authClient\.consumeRecoveryRedirect\(\)/);
});

test('认证状态控制只读模式并在退出或失效时关闭写面板', () => {
  assert.match(script, /function updateAuthUi\(/);
  assert.match(script, /document\.body\.dataset\.authenticated\s*=\s*state\.authUser\s*\?\s*"true"\s*:\s*"false"/);
  assert.match(script, /function closeWritePanels\([\s\S]*?closePanel\(\)[\s\S]*?closePanelById\(recordPanel\)[\s\S]*?closePanelById\(capsulePanel\)/);
  assert.match(script, /if\s*\(!state\.authUser\)\s*\{[\s\S]*?closeWritePanels\(\)/);
  assert.match(script, /becameAuthenticated\s*&&\s*event\s*!==\s*"TOKEN_REFRESHED"[\s\S]*?await loadRemoteData\(\);/);
});

test('所有数据库与媒体写入底层函数都先检查登录状态', () => {
  [
    'savePlan', 'deletePlan', 'persistPendingRecord', 'syncPendingRecords',
    'saveRecord', 'uploadDataUrlResource', 'uploadMediaItem', 'removeRecordMedia',
    'submitRecordForm', 'deleteRecord', 'saveCapsule', 'submitCapsuleForm',
    'deleteCapsule', 'saveTodo', 'toggleTodo', 'deleteTodo', 'uploadPhotos',
  ].forEach(name => assert.match(script, functionStartsWithGuard(name), `${name} 缺少底层登录守卫`));
});

test('动态计划、记录、Todo 和胶囊写控件只为登录用户渲染', () => {
  assert.match(script, /state\.authUser\s*\?\s*'<button[^']*data-delete-plan/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-edit-record-id/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-delete-record/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-new-capsule/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-delete-capsule/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-toggle-todo/);
  assert.match(script, /state\.authUser\s*\?[\s\S]*?data-delete-todo/);
});

test('登录、忘记密码、恢复密码与退出均接入 Auth 客户端', () => {
  assert.match(script, /state\.authClient\.signInWithPassword\(/);
  assert.match(script, /state\.authClient\.resetPasswordForEmail\(/);
  assert.match(script, /state\.authClient\.updatePassword\(/);
  assert.match(script, /state\.authClient\.signOut\(\)/);
  assert.match(script, /function authErrorMessage\(/);
});

test('等待删除确认期间若会话失效则不会继续删除', () => {
  [['deletePlan', 'fetchRecords'], ['deleteRecord', 'fetchCapsules'], ['deleteCapsule', 'confirmAction'], ['deleteTodo', 'fetchPhotos']].forEach(([name, next]) => {
    const start = script.indexOf(`async function ${name}(`);
    const end = script.indexOf(`function ${next}(`, start + 1);
    const body = script.slice(start, end);
    assert.match(body, /confirmAction\(/);
    assert.equal((body.match(/requireAuthenticated\(\)/g) || []).length, 2, `${name} 应在确认前后检查登录`);
  });
});

test('pending Live Photo 每个资源上传成功后立即持久化 checkpoint', async () => {
  const snapshots = [];
  let uploadCount = 0;
  const uploadedPaths = [];
  const pending = {
    local_id: 'local-live', pending_sync: true, title: '海边',
    photos: [{ kind: 'live-photo', name: 'a.jpg', type: 'image/jpeg', url: 'data:image/jpeg;base64,AA', motion_name: 'a.mov', motion_type: 'video/quicktime', motion_url: 'data:video/quicktime;base64,BB' }],
  };
  const harness = createScriptHarness({
    fetch: async () => ({ blob: async () => new Blob(['x'], { type: uploadCount ? 'video/quicktime' : 'image/jpeg' }) }),
    window: {
      RecordRecovery: {
        toCloudRecord(record) { const next = { ...record, photos: record.photos.map(photo => ({ ...photo })) }; delete next.local_id; delete next.pending_sync; return next; },
        mergeRemoteRecords(remote) { return remote; },
      },
    },
  });
  harness.hooks.setState({
    authUser: { id: 'user-1' }, backendReady: true, records: [pending],
    snapshotStore: { save(value) { snapshots.push(JSON.parse(JSON.stringify(value))); return true; } },
    client: {
      async upload(_bucket, path) { uploadedPaths.push(path); uploadCount += 1; if (uploadCount === 2) throw new Error('MOV failed'); },
      getPublicUrl(_bucket, path) { return 'https://storage.example/' + path; },
      async insert() {},
      async select() { return []; },
    },
  });

  await assert.rejects(harness.hooks.syncPendingRecords(), /MOV failed/);
  assert.equal(pending.photos[0].url.startsWith('https://storage.example/records/'), true);
  assert.equal(pending.photos[0].motion_url.startsWith('data:'), true);
  assert.equal(snapshots.some(snapshot => snapshot.records[0].photos[0].url.startsWith('https://storage.example/records/')), true);

  await harness.hooks.syncPendingRecords();
  assert.equal(uploadedPaths.filter(path => path.endsWith('a.jpg')).length, 1, '重试不应再次上传已 checkpoint 的静态图');
  assert.equal(uploadedPaths.filter(path => path.endsWith('a.mov')).length, 2, '重试只应补传失败的 MOV');
});

test('pending 媒体全部上传后即使数据库插入失败也不会丢失新 URL', async () => {
  const snapshots = [];
  const pending = {
    local_id: 'local-image', pending_sync: true, title: '日落',
    photos: [{ kind: 'image', name: 'sun.jpg', type: 'image/jpeg', url: 'data:image/jpeg;base64,AA' }],
  };
  const harness = createScriptHarness({
    fetch: async () => ({ blob: async () => new Blob(['x'], { type: 'image/jpeg' }) }),
    window: { RecordRecovery: { toCloudRecord(record) { const next = { ...record, photos: record.photos.map(photo => ({ ...photo })) }; delete next.local_id; delete next.pending_sync; return next; } } },
  });
  harness.hooks.setState({
    authUser: { id: 'user-1' }, backendReady: true, records: [pending],
    snapshotStore: { save(value) { snapshots.push(JSON.parse(JSON.stringify(value))); return true; } },
    client: {
      async upload() {},
      getPublicUrl(_bucket, path) { return 'https://storage.example/' + path; },
      async insert() { throw new Error('database failed'); },
    },
  });

  await assert.rejects(harness.hooks.syncPendingRecords(), /database failed/);
  assert.equal(pending.photos[0].url.startsWith('https://storage.example/records/'), true);
  assert.equal(snapshots.at(-1).records[0].photos[0].url, pending.photos[0].url);
});

test('Gallery 本地媒体转换期间退出登录不会写入本地相册', async () => {
  let finishRead;
  class DeferredFileReader {
    readAsDataURL() { finishRead = () => { this.result = 'data:image/jpeg;base64,AA'; this.onload(); }; }
  }
  const harness = createScriptHarness({ window: { FileReader: DeferredFileReader } });
  harness.context.FileReader = DeferredFileReader;
  const photos = [];
  harness.hooks.setState({ authUser: { id: 'user-1' }, backendReady: false, photos, snapshotStore: { save() { return true; } } });
  const pendingUpload = harness.hooks.uploadPhotos([{ kind: 'image', file: { name: 'a.jpg', type: 'image/jpeg' } }]);
  await new Promise(resolve => setImmediate(resolve));
  harness.hooks.setState({ authUser: null });
  finishRead();

  assert.equal(await pendingUpload, false);
  assert.deepEqual(photos, []);
});

test('密码恢复 USER_UPDATED 只触发一次远端刷新且 TOKEN_REFRESHED 留给启动流程', async () => {
  let clientCreations = 0;
  let selects = 0;
  let inserts = 0;
  const pending = { local_id: 'local-recovery', pending_sync: true, title: '待同步', photos: [] };
  const harness = createScriptHarness({
    window: {
      CloudDataClient: {
        createCloudDataClient() {
          clientCreations += 1;
          return {
            async select() { selects += 1; return []; },
            async insert() { inserts += 1; },
          };
        },
      },
      RecordRecovery: {
        toCloudRecord(record) { const next = { ...record }; delete next.local_id; delete next.pending_sync; return next; },
        mergeRemoteRecords(remote, local) { return (local || []).filter(record => record.pending_sync).concat(remote); },
      },
      MediaUpload: { isVideo() { return false; } },
    },
  });
  harness.hooks.setState({ authUser: null, records: [pending], snapshotStore: { save() { return true; } } });
  await harness.hooks.handleAuthStateChange('TOKEN_REFRESHED', { user: { id: 'user-1', email: 'a@example.com' } });
  assert.equal(clientCreations, 0);
  harness.hooks.setState({ authUser: null });
  await harness.hooks.handleAuthStateChange('USER_UPDATED', { user: { id: 'user-1', email: 'a@example.com' } });
  assert.equal(clientCreations, 1);
  assert.equal(selects, 6, '一次完整远端刷新加上 pending 写入后的 records 回读，不应重复执行');
  assert.equal(inserts, 1, '恢复完成后应同步登录前已有的 pending record');
});

test('匿名初始读取期间登录会排队认证刷新且 pending 只插入一次', async () => {
  let releaseAnonymousReads;
  const authenticatedTables = [];
  let inserts = 0;
  let releaseInsert;
  const anonymousReads = new Promise(resolve => { releaseAnonymousReads = resolve; });
  const insertGate = new Promise(resolve => { releaseInsert = resolve; });
  const pending = { local_id: 'local-race', pending_sync: true, title: '只写一次', photos: [] };
  const authenticatedClient = {
    async select(table) { authenticatedTables.push(table); return []; },
    async insert() { inserts += 1; await insertGate; },
  };
  const harness = createScriptHarness({
    window: {
      CloudDataClient: { createCloudDataClient() { return authenticatedClient; } },
      RecordRecovery: {
        toCloudRecord(record) { const next = { ...record }; delete next.local_id; delete next.pending_sync; return next; },
        mergeRemoteRecords(remote, local) { return (local || []).filter(record => record.pending_sync).concat(remote); },
      },
      MediaUpload: { isVideo() { return false; } },
    },
  });
  harness.hooks.setState({
    authClient: { getAccessToken() { return 'jwt'; } }, authUser: null, backendReady: true, records: [pending],
    snapshotStore: { save() { return true; } },
    client: { async select() { await anonymousReads; return []; } },
  });

  const initialLoad = harness.hooks.loadRemoteData();
  await new Promise(resolve => setImmediate(resolve));
  const loginLoad = harness.hooks.handleAuthStateChange('SIGNED_IN', { user: { id: 'user-1' } });
  await new Promise(resolve => setImmediate(resolve));
  releaseAnonymousReads();
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
  releaseInsert();
  await Promise.all([initialLoad, loginLoad]);

  assert.equal(inserts, 1, '并发的匿名读取和登录刷新不得重复插入同一 pending record');
  ['love_plans', 'love_records', 'love_todos', 'love_photos', 'love_capsules'].forEach(table => {
    assert.ok(authenticatedTables.includes(table), `登录后认证刷新缺少 ${table}`);
  });
});

test('旧代 pending 插入失败不能阻断认证替换后的排队刷新', async () => {
  let rejectOldInsert;
  let oldInsertStarted;
  const oldInsertGate = new Promise((_, reject) => { rejectOldInsert = reject; });
  const oldInsertReady = new Promise(resolve => { oldInsertStarted = resolve; });
  const freshTables = [];
  let freshInserts = 0;
  const pending = { local_id: 'local-old-generation', pending_sync: true, title: '换登录后同步', photos: [] };
  const freshClient = {
    async select(table) { freshTables.push(table); return []; },
    async insert() { freshInserts += 1; },
  };
  const harness = createScriptHarness({
    window: {
      CloudDataClient: { createCloudDataClient() { return freshClient; } },
      RecordRecovery: {
        toCloudRecord(record) { const next = { ...record }; delete next.local_id; delete next.pending_sync; return next; },
        mergeRemoteRecords(remote, local) { return (local || []).filter(record => record.pending_sync).concat(remote); },
      },
      MediaUpload: { isVideo() { return false; } },
    },
  });
  harness.hooks.setState({
    authClient: { getAccessToken() { return 'fresh-jwt'; } }, authUser: { id: 'old-user' }, backendReady: true,
    records: [pending], snapshotStore: { save() { return true; } },
    client: {
      async select() { return []; },
      async insert() { oldInsertStarted(); return oldInsertGate; },
    },
  });

  const oldLoad = harness.hooks.loadRemoteData();
  await oldInsertReady;
  await harness.hooks.handleAuthStateChange('SIGNED_OUT', null);
  const freshLoad = harness.hooks.handleAuthStateChange('SIGNED_IN', { user: { id: 'fresh-user' } });
  rejectOldInsert(new Error('old insert failed'));
  await Promise.all([oldLoad, freshLoad]);

  ['love_plans', 'love_records', 'love_todos', 'love_photos', 'love_capsules'].forEach(table => {
    assert.ok(freshTables.includes(table), `认证替换后未重新读取 ${table}`);
  });
  assert.equal(freshInserts, 1);
  assert.equal(harness.hooks.getState().backendReady, true);
});

test('当前认证代确实离线时结束加载并标记 backend 不可用', async () => {
  let selects = 0;
  let inserts = 0;
  const pending = { local_id: 'local-current-generation', pending_sync: true, title: '离线保留', photos: [] };
  const harness = createScriptHarness({
    window: {
      RecordRecovery: {
        toCloudRecord(record) { const next = { ...record }; delete next.local_id; delete next.pending_sync; return next; },
        mergeRemoteRecords(remote, local) { return (local || []).filter(record => record.pending_sync).concat(remote); },
      },
      MediaUpload: { isVideo() { return false; } },
    },
  });
  harness.hooks.setState({
    authUser: { id: 'current-user' }, backendReady: true, records: [pending], snapshotStore: { save() { return true; } },
    client: {
      async select() { selects += 1; return []; },
      async insert() { inserts += 1; throw new Error('offline'); },
    },
  });

  await harness.hooks.loadRemoteData();

  assert.equal(selects, 5, '当前代失败后不应自旋重试');
  assert.equal(inserts, 1);
  assert.equal(harness.hooks.getState().backendReady, false);
});

test('restoreAuth 的旧空结果不会覆盖等待期间完成的新登录', async () => {
  let finishRestore;
  const harness = createScriptHarness();
  harness.hooks.setState({
    authClient: {
      async consumeRecoveryRedirect() { return null; },
      async getSession() { return new Promise(resolve => { finishRestore = resolve; }); },
    },
    authUser: null,
  });

  const restoring = harness.hooks.restoreAuth();
  await new Promise(resolve => setImmediate(resolve));
  await harness.hooks.handleAuthStateChange('TOKEN_REFRESHED', { user: { id: 'new-user', email: 'new@example.com' } });
  finishRestore(null);
  await restoring;

  assert.equal(harness.hooks.getState().authUser.id, 'new-user');
});

test('保存失败不执行表单清理，成功后只清理一次', async () => {
  const harness = createScriptHarness();
  let cleanupCount = 0;
  assert.equal(await harness.hooks.afterSuccessfulSave(Promise.resolve(false), () => { cleanupCount += 1; }), false);
  assert.equal(cleanupCount, 0);
  assert.equal(await harness.hooks.afterSuccessfulSave(Promise.resolve(true), () => { cleanupCount += 1; }), true);
  assert.equal(cleanupCount, 1);
  assert.match(script, /afterSuccessfulSave\(savePlan\(entry\)/);
  assert.match(script, /afterSuccessfulSave\(saveTodo\(input\.value\.trim\(\)\)/);
});

test('核心页面资源使用一致的新缓存版本', () => {
  const styleVersion = html.match(/styles\.css\?v=([^"']+)/)?.[1];
  const scriptVersion = html.match(/script\.js\?v=([^"']+)/)?.[1];
  assert.ok(styleVersion);
  assert.equal(scriptVersion, styleVersion);
  assert.notEqual(styleVersion, '20260830-7');
});

test('退出和动态胶囊入口使用当前鉴权语义', () => {
  assert.match(script, /hadUser\s*&&\s*event\s*!==\s*"SIGNED_OUT"/);
  assert.match(script, /newCapsuleButton\.addEventListener\("click", function\(\) \{\s*if \(!requireAuthenticated\(\)\) return;/);
  assert.doesNotMatch(html, /下一版可以继续开发登录/);
});
