# 主 Supabase 登录鉴权与 Storage 网关实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让网站公开可读、登录后可写，并让第二 Supabase 的媒体上传与删除通过验证主 Supabase 用户的安全网关完成。

**架构：** 主 Supabase Auth 是唯一身份源，浏览器中的轻量 Auth 客户端维护用户 JWT；数据库客户端把该 JWT 用于主数据库写请求。第二 Storage 的 secret key 只存在主 Supabase Edge Function 中，浏览器通过网关取得短时上传 URL并直传文件，删除也由网关代理。

**技术栈：** 原生 HTML/CSS/JavaScript、Supabase Auth REST API、Supabase Storage signed upload、Supabase Edge Functions（Deno/TypeScript）、Node.js `node:test`

---

## 文件结构

- 创建 `auth-client.js`：浏览器 Auth REST 客户端、会话存储与刷新。
- 修改 `cloud-data-client.js`：动态用户 JWT、网关签名上传和网关删除。
- 修改 `index.html`：最小登录/密码恢复对话框与写入口标记。
- 修改 `styles.css`：登录区域、对话框和只读状态的现有风格适配。
- 修改 `script.js`：认证状态、事件、写操作守卫和登录后 pending 同步。
- 创建 `supabase/functions/storage-gateway/core.ts`：可测试的请求校验和网关流程。
- 创建 `supabase/functions/storage-gateway/index.ts`：Supabase Auth 与 Storage SDK 适配器。
- 创建 `supabase/config.toml`：为网关关闭旧式前置 JWT 检查，由函数内 `getUser` 验证。
- 创建 `supabase/authenticated-write-policies.sql`：主数据库公开读、登录写策略。
- 删除 `supabase/secondary-storage-public-policies.sql`。
- 创建 `supabase/secondary-storage-gateway-policies.sql`：撤销第二 Storage 匿名写删策略。
- 修改 `SUPABASE_SETUP.md`：账号、Redirect URL、secret、部署和收紧顺序。
- 创建 `tests/auth-client.test.js`、`tests/auth-ui.test.js`、`tests/storage-gateway.test.js`、`tests/auth-policies.test.js`。
- 修改 `tests/data-persistence.test.js`、`tests/media-upload-integration.test.js`、`tests/secondary-storage-policies.test.js`。

### 任务 1：轻量 Auth 客户端

**文件：**
- 创建：`tests/auth-client.test.js`
- 创建：`auth-client.js`

- [ ] **步骤 1：编写失败的登录与会话测试**

```js
test('邮箱密码登录保存主 Supabase 会话', async () => {
  const client = createAuthClient({ url: MAIN_URL, key: 'publishable', storage, fetchImpl });
  const session = await client.signInWithPassword('a@example.com', 'password');
  assert.equal(calls[0].url, MAIN_URL + '/auth/v1/token?grant_type=password');
  assert.equal(calls[0].options.headers.apikey, 'publishable');
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal((await client.getSession()).access_token, session.access_token);
});

test('即将过期的会话使用 refresh_token 自动刷新', async () => {
  const token = await client.getAccessToken();
  assert.equal(calls.at(-1).url, MAIN_URL + '/auth/v1/token?grant_type=refresh_token');
  assert.equal(token, 'fresh-user-jwt');
});
```

同时覆盖：损坏存储、退出后本地清除、恢复邮件 `redirect_to`、从 URL fragment 接收 recovery session、更新密码和认证状态通知。

- [ ] **步骤 2：运行 Auth 测试并确认因模块缺失而失败**

运行：

```bash
node --test tests/auth-client.test.js
```

预期：FAIL，`auth-client.js` 不存在或 `createAuthClient` 未定义。

- [ ] **步骤 3：实现最小 Auth 客户端**

公开接口固定为：

```js
createAuthClient({ url, key, storage, storageKey, fetchImpl, now })
// -> signInWithPassword, signOut, getSession, getAccessToken,
//    resetPasswordForEmail, consumeRecoveryRedirect, updatePassword,
//    onAuthStateChange
```

Auth 请求头只放：

```js
{ apikey: key, 'Content-Type': 'application/json' }
```

只有需要用户身份的退出与更新密码请求才增加：

```js
{ Authorization: 'Bearer ' + session.access_token }
```

在过期前 60 秒刷新，刷新失败时清除会话并通知订阅者。解析 recovery fragment 后使用 `history.replaceState` 去掉令牌。

- [ ] **步骤 4：运行 Auth 测试确认通过**

运行：`node --test tests/auth-client.test.js`

预期：所有 Auth 测试 PASS。

- [ ] **步骤 5：提交 Auth 客户端**

```bash
git add auth-client.js tests/auth-client.test.js
git commit -m "feat: add Supabase auth session client"
```

### 任务 2：数据库 JWT 与签名 Storage 客户端

**文件：**
- 修改：`tests/data-persistence.test.js`
- 修改：`cloud-data-client.js`

- [ ] **步骤 1：先写失败的请求路由测试**

增加断言：

```js
const client = createCloudDataClient({
  url: MAIN_URL,
  key: 'main-publishable',
  storageUrl: STORAGE_URL,
  storageKey: 'storage-publishable',
  storageGatewayUrl: MAIN_URL + '/functions/v1/storage-gateway',
  storageBackend: 'secondary',
  getAccessToken: async () => 'user-jwt',
  fetchImpl,
});

await client.insert('love_todos', [{ text: '看海' }]);
assert.equal(calls[0].options.headers.Authorization, 'Bearer user-jwt');

await client.upload('love-photos', 'records/a.jpg', imageBlob);
assert.equal(calls[1].url, MAIN_URL + '/functions/v1/storage-gateway');
assert.deepEqual(JSON.parse(calls[1].options.body), {
  action: 'sign-upload', backend: 'secondary', bucket: 'love-photos', path: 'records/a.jpg'
});
assert.equal(calls[2].url, 'https://signed-upload.example/object');
assert.equal(calls[2].options.method, 'PUT');
```

覆盖：匿名 SELECT 无 Bearer、生产模式写请求缺 JWT 直接拒绝、网关删除、`getPublicUrl()` 仍为第二 Storage、未配置网关时旧调用方式保持兼容。

- [ ] **步骤 2：运行数据客户端测试并确认新增断言失败**

运行：`node --test tests/data-persistence.test.js`

预期：FAIL，尚未支持 `getAccessToken` 或网关请求。

- [ ] **步骤 3：实现动态请求头和网关模式**

数据库头生成改为异步：

```js
async function databaseHeaders(extra, requireUser) {
  var token = getAccessToken ? await getAccessToken() : null;
  if (requireUser && getAccessToken && !token) throw new Error('请先登录后再保存');
  return Object.assign({ apikey: key }, token ? { Authorization: 'Bearer ' + token } : {}, extra || {});
}
```

配置网关时，`upload()` 先请求 `{ action: 'sign-upload' }`，再以 PUT 上传；Blob 使用带 `cacheControl=3600` 的 FormData。`removeObjects()` 发送 `{ action: 'delete', paths }`。没有网关时保留当前直接 Storage 请求作为库级向后兼容路径，但网页生产配置必须使用网关。

- [ ] **步骤 4：运行数据客户端测试确认通过**

运行：`node --test tests/data-persistence.test.js`

预期：所有数据持久化测试 PASS。

- [ ] **步骤 5：提交数据客户端**

```bash
git add cloud-data-client.js tests/data-persistence.test.js
git commit -m "feat: authenticate database writes and storage gateway calls"
```

### 任务 3：Storage Gateway 核心与 Edge Function

**文件：**
- 创建：`tests/storage-gateway.test.js`
- 创建：`supabase/functions/storage-gateway/core.ts`
- 创建：`supabase/functions/storage-gateway/index.ts`
- 创建：`supabase/config.toml`

- [ ] **步骤 1：编写失败的网关核心测试**

```js
test('未登录请求被拒绝', async () => {
  const response = await handleStorageGateway(new Request(GATEWAY_URL, {
    method: 'POST', body: JSON.stringify(validSignRequest)
  }), deps);
  assert.equal(response.status, 401);
});

test('未知后端与非法路径被拒绝', async () => {
  assert.equal((await request({ backend: 'unknown' })).status, 400);
  assert.equal((await request({ path: '../secret' })).status, 400);
});

test('已验证用户只能为 allowlist 路径取得上传 URL', async () => {
  const response = await request(validSignRequest, 'valid-user-jwt');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { signedUrl: SIGNED_URL });
});
```

再覆盖 CORS、无效 JSON、不支持动作、错误 Bucket、空删除和超过 40 个删除路径。

- [ ] **步骤 2：运行网关测试并确认失败**

运行：`node --test tests/storage-gateway.test.js`

预期：FAIL，网关核心文件不存在。

- [ ] **步骤 3：实现可注入依赖的网关核心**

```ts
export async function handleStorageGateway(request: Request, deps: GatewayDeps): Promise<Response> {
  // OPTIONS -> CORS
  // POST only -> parse JSON
  // require Bearer token -> await deps.verifyUser(token)
  // backend/bucket/path allowlist
  // sign-upload -> deps.createSignedUpload(...)
  // delete -> deps.removeObjects(...)
}
```

路径必须是相对路径、不能含空段/`.`/`..`/反斜杠/控制字符，且首段只允许 `records`、`capsules`、`unplaced` 或安全城市目录。单次删除限制为 40 个对象。

- [ ] **步骤 4：实现 Edge Function 适配器**

`index.ts` 使用 `npm:@supabase/supabase-js@2`：

```ts
const main = createClient(mainUrl, publishableKey, { auth: { persistSession: false } });
const { data, error } = await main.auth.getUser(token);

const target = createClient(backend.url, backend.secretKey, { auth: { persistSession: false } });
const { data, error } = await target.storage.from(backend.bucket)
  .createSignedUploadUrl(path, { upsert: false });
```

删除使用 `target.storage.from(bucket).remove(paths)`。`supabase/config.toml`：

```toml
[functions.storage-gateway]
verify_jwt = false
```

业务请求仍由函数内 `getUser(token)` 强制验证；关闭前置检查只用于兼容 CORS OPTIONS 和新式 JWT。

- [ ] **步骤 5：运行网关测试确认通过**

运行：`node --test tests/storage-gateway.test.js`

预期：所有网关测试 PASS。

- [ ] **步骤 6：提交网关**

```bash
git add supabase/config.toml supabase/functions/storage-gateway tests/storage-gateway.test.js
git commit -m "feat: add authenticated storage gateway"
```

### 任务 4：主数据库和第二 Storage 权限 SQL

**文件：**
- 创建：`tests/auth-policies.test.js`
- 修改：`tests/secondary-storage-policies.test.js`
- 创建：`supabase/authenticated-write-policies.sql`
- 删除：`supabase/secondary-storage-public-policies.sql`
- 创建：`supabase/secondary-storage-gateway-policies.sql`

- [ ] **步骤 1：编写失败的策略测试**

主数据库测试逐表断言：

```js
for (const table of ['love_plans', 'love_records', 'love_todos', 'love_photos', 'love_capsules']) {
  assert.match(sql, new RegExp(`on\\s+public\\.${table}\\s+for\\s+select\\s+to\\s+anon\\s*,\\s*authenticated`, 'i'));
  for (const operation of ['insert', 'update', 'delete']) {
    assert.match(sql, new RegExp(`on\\s+public\\.${table}\\s+for\\s+${operation}\\s+to\\s+authenticated`, 'i'));
  }
}
assert.doesNotMatch(sql, /for\s+(insert|update|delete)\s+to\s+anon/i);
```

第二 Storage 测试断言脚本只撤销旧策略，不创建匿名 INSERT、DELETE、UPDATE 或 SELECT/list 策略。

- [ ] **步骤 2：运行策略测试确认失败**

运行：`node --test tests/auth-policies.test.js tests/secondary-storage-policies.test.js`

预期：FAIL，安全策略文件尚不存在且旧文件仍公开写入。

- [ ] **步骤 3：编写可重复执行的 SQL**

每张业务表先启用 RLS、删除已知旧 public policy 名，再建立：

```sql
create policy "public read love_plans"
on public.love_plans for select to anon, authenticated using (true);

create policy "authenticated insert love_plans"
on public.love_plans for insert to authenticated with check (true);
```

UPDATE 同时写 `using (true) with check (true)`，DELETE 写 `using (true)`。第二 Storage 文件只包含三个旧策略的 `drop policy if exists`，不创建浏览器写策略。

- [ ] **步骤 4：运行策略测试确认通过**

运行：`node --test tests/auth-policies.test.js tests/secondary-storage-policies.test.js`

预期：所有策略测试 PASS。

- [ ] **步骤 5：提交权限脚本**

```bash
git add supabase tests/auth-policies.test.js tests/secondary-storage-policies.test.js
git commit -m "security: require authentication for cloud writes"
```

### 任务 5：页面登录 UI 与写操作守卫

**文件：**
- 创建：`tests/auth-ui.test.js`
- 修改：`tests/media-upload-integration.test.js`
- 修改：`index.html`
- 修改：`styles.css`
- 修改：`script.js`

- [ ] **步骤 1：编写失败的页面集成测试**

```js
test('页面先加载 Auth 客户端并提供登录与恢复对话框', () => {
  assert.ok(html.indexOf('auth-client.js') < html.indexOf('script.js'));
  assert.match(html, /id="auth-dialog"/);
  assert.match(html, /id="password-recovery-dialog"/);
  assert.doesNotMatch(html, /注册账号/);
});

test('生产数据客户端使用主 JWT 和 Storage Gateway', () => {
  assert.match(script, /getAccessToken:\s*function/);
  assert.match(script, /storageGatewayUrl:\s*supabaseConfig\.url\s*\+\s*"\/functions\/v1\/storage-gateway"/);
  assert.match(script, /storageBackend:\s*"secondary"/);
});
```

再断言所有静态写入口带 `data-auth-write`，动态计划/记录/Todo/胶囊操作按 `state.authUser` 渲染，并且关键写函数调用 `requireAuthenticated()`。

- [ ] **步骤 2：运行页面测试确认失败**

运行：`node --test tests/auth-ui.test.js tests/media-upload-integration.test.js`

预期：FAIL，页面尚无 Auth UI 或网关配置。

- [ ] **步骤 3：添加最小 HTML/CSS**

在页头添加 `#auth-login-button`、`#auth-account`、`#auth-logout-button`；添加原生 `<dialog>` 登录表单和密码恢复表单。给添加计划、写记录、Todo 表单、Gallery 上传区等静态入口加 `data-auth-write`。

CSS 只复用现有色彩、圆角和按钮规则；`body[data-authenticated="false"] [data-auth-write] { display: none; }`。不重排页面或重做视觉系统。

- [ ] **步骤 4：接入认证状态与双重守卫**

初始化顺序：

```js
connectAuth();
await restoreAuth();
connectSupabase();
await loadRemoteData();
```

状态与守卫：

```js
function requireAuthenticated(message) {
  if (state.authUser) return true;
  showAuthDialog(message || '请先登录后再继续');
  return false;
}
```

认证变化时更新 `body.dataset.authenticated`、页头账号和动态列表；退出/刷新失败时关闭所有写入面板。登录成功后重新连接云端、刷新远程数据并调用 `syncPendingRecords()`。

计划、记录、Todo、Gallery、胶囊所有入口和底层写方法都调用守卫。`syncPendingRecords()` 增加 `state.authUser` 条件，确保公开访问不会尝试写库。

- [ ] **步骤 5：运行页面和媒体测试确认通过**

运行：

```bash
node --test tests/auth-ui.test.js tests/media-upload-integration.test.js tests/story-records-integration.test.js tests/time-capsule-integration.test.js tests/todo-delete.test.js tests/plan-delete.test.js
```

预期：全部 PASS。

- [ ] **步骤 6：提交页面鉴权**

```bash
git add auth-client.js index.html styles.css script.js tests/auth-ui.test.js tests/media-upload-integration.test.js
git commit -m "feat: require login for website editing"
```

### 任务 6：配置与部署文档

**文件：**
- 修改：`SUPABASE_SETUP.md`

- [ ] **步骤 1：编写文档测试断言并确认失败**

在 `tests/auth-policies.test.js` 中断言文档包含：关闭公开注册、创建用户、Site URL/Redirect URL、`STORAGE_BACKENDS_JSON`、部署网关、先验证再收紧、回滚说明，且不包含真实 `sb_secret_` 值。

运行：`node --test tests/auth-policies.test.js`

预期：FAIL，部署文档尚未覆盖鉴权流程。

- [ ] **步骤 2：按安全顺序更新文档**

明确命令模板但不写 secret：

```bash
supabase secrets set STORAGE_BACKENDS_JSON='<在本机终端填写，不提交>'
supabase functions deploy storage-gateway
```

说明正式站点 `https://xrh1238.github.io/dating-web/` 和本地地址应加入 Auth Redirect allowlist；账号由 Dashboard 添加；执行 SQL 和收紧策略前先验证网关。

- [ ] **步骤 3：运行文档策略测试并提交**

运行：`node --test tests/auth-policies.test.js`

预期：PASS。

```bash
git add SUPABASE_SETUP.md tests/auth-policies.test.js
git commit -m "docs: add authenticated deployment runbook"
```

### 任务 7：完整验证、审查与浏览器检查

**文件：**
- 检查：本计划涉及的全部文件

- [ ] **步骤 1：运行完整自动化测试**

运行：

```bash
node --test tests/*.test.js
```

预期：0 failed、0 cancelled。

- [ ] **步骤 2：运行静态检查**

```bash
node --check auth-client.js
node --check cloud-data-client.js
node --check script.js
git diff --check origin/master...HEAD
```

预期：全部退出码 0，无语法错误和空白错误。

- [ ] **步骤 3：请求独立代码审查**

以 `origin/master` 为 BASE SHA、当前 HEAD 为 HEAD SHA，请审查者重点核对：匿名写是否仍可能绕过、JWT 是否错误使用 publishable key、Storage secret 是否泄露、所有媒体调用点是否继续走统一客户端、未登录 UI 是否有底层守卫。

- [ ] **步骤 4：处理 Critical/Important 反馈并重新运行完整测试**

对每个真实缺陷先补失败测试，再最小修复。再次运行 `node --test tests/*.test.js`，预期 0 failed。

- [ ] **步骤 5：启动本地服务器并在 Codex 内置浏览器验证**

验证：

1. 未登录可浏览五类远程数据；
2. 所有写入口隐藏，直接触发写方法也会提示登录；
3. 登录弹窗、错误状态、忘记密码表单和恢复密码表单可用；
4. 使用测试替身或本地 mock 验证登录后写入口恢复、Gateway 请求包含用户 JWT；
5. 桌面与手机宽度不出现明显布局破坏。

- [ ] **步骤 6：最终提交和状态核对**

```bash
git status --short
git log --oneline origin/master..HEAD
```

预期：工作树干净，只有本功能提交。

完成后使用 `finishing-a-development-branch` 提供本地合并、推送创建 PR、保留分支或丢弃四个选项；任何 GitHub 推送或线上 Supabase 配置变更都在执行前取得用户确认。
