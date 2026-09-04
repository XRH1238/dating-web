const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function functionStartsWithGuard(name) {
  return new RegExp(`(?:async\\s+)?function\\s+${name}\\([^)]*\\)\\s*\\{\\s*(?:event\\.preventDefault\\(\\);\\s*)?if\\s*\\(!requireAuthenticated\\(`);
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
  assert.match(script, /await loadRemoteData\(\);[\s\S]*?await syncPendingRecords\(\);/);
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
