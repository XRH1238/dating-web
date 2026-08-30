# 双 Supabase Storage 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 数据库请求继续访问主 Supabase，同时让所有新媒体 Storage 请求访问第二个 Supabase，并保持单端点配置向后兼容。

**架构：** `createCloudDataClient()` 内部分离 REST 与 Storage 的 base URL 和鉴权 header；数据库方法只使用主配置，Storage 方法只使用 Storage 配置并逐项回退。`script.js` 仅增加 `storageConfig` 并在统一客户端初始化时传入，不改任何业务上传路径。

**技术栈：** 浏览器 JavaScript、Supabase REST/Storage HTTP API、Node.js 内置 test runner。

---

## 文件职责

- 修改 `tests/data-persistence.test.js`：验证客户端 REST/Storage 路由、凭据与向后兼容行为。
- 修改 `tests/media-upload-integration.test.js`：验证页面配置将两组端点传入统一客户端，并保留统一上传入口覆盖。
- 修改 `cloud-data-client.js`：实现 REST 与 Storage 端点、key 分离。
- 修改 `script.js`：声明第二个 Storage 配置并传给客户端。

### 任务 1：添加双端点客户端失败测试

**文件：**
- 修改：`tests/data-persistence.test.js`

- [ ] **步骤 1：编写失败的 REST 与 Storage 路由测试**

增加测试，使用同一个 `fetchImpl` 捕获请求：

```js
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
  await client.upload('love-photos', 'records/test photo.jpg', { type: 'image/jpeg' });
  await client.removeObjects('love-photos', ['records/test photo.jpg']);

  assert.equal(calls[0].url, 'https://primary.supabase.co/rest/v1/love_photos?select=*&order=created_at.desc');
  assert.equal(calls[0].options.headers.apikey, 'primary-key');
  assert.equal(calls[1].url, 'https://storage.supabase.co/storage/v1/object/love-photos/records/test%20photo.jpg');
  assert.equal(calls[1].options.headers.apikey, 'storage-key');
  assert.equal(calls[2].url, 'https://storage.supabase.co/storage/v1/object/love-photos');
  assert.equal(calls[2].options.headers.apikey, 'storage-key');
  assert.equal(client.getPublicUrl('love-photos', 'records/test photo.jpg'),
    'https://storage.supabase.co/storage/v1/object/public/love-photos/records/test%20photo.jpg');
});
```

- [ ] **步骤 2：编写缺省回退测试**

```js
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
  assert.equal(client.getPublicUrl('love-photos', 'gallery/a.jpg'),
    'https://primary.supabase.co/storage/v1/object/public/love-photos/gallery/a.jpg');
});
```

- [ ] **步骤 3：运行测试验证正确失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-persistence.test.js
```

预期：新增双端点测试失败，因为 Storage 请求和公开 URL 仍指向主 Supabase；原有回退测试通过。

### 任务 2：实现客户端 Storage 配置分离

**文件：**
- 修改：`cloud-data-client.js`
- 测试：`tests/data-persistence.test.js`

- [ ] **步骤 1：增加 Storage 配置与独立 header**

在 `createCloudDataClient(options)` 中增加：

```js
var storageBaseUrl = String(options.storageUrl || options.url || '').replace(/\/$/, '');
var storageKey = options.storageKey || key;

function storageHeaders(extra) {
  return Object.assign({ apikey: storageKey, Authorization: 'Bearer ' + storageKey }, extra || {});
}
```

- [ ] **步骤 2：将全部 Storage 方法切换到 Storage 配置**

`upload()`、`removeObjects()` 和 `getPublicUrl()` 使用 `storageBaseUrl`，前两个方法使用 `storageHeaders()`。`select()`、`insert()`、`update()` 和 `remove()` 保持使用 `baseUrl` 与 `headers()`。

- [ ] **步骤 3：运行客户端测试验证通过**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/data-persistence.test.js
```

预期：全部客户端测试通过。

- [ ] **步骤 4：提交客户端改动**

```bash
git add cloud-data-client.js tests/data-persistence.test.js
git commit -m "feat: route storage through secondary Supabase"
```

### 任务 3：接入页面第二 Storage 配置

**文件：**
- 修改：`tests/media-upload-integration.test.js`
- 修改：`script.js`

- [ ] **步骤 1：编写页面配置失败测试**

在媒体集成测试中增加：

```js
test('页面数据库与 Storage 使用各自的 Supabase 配置', () => {
  assert.match(script, /const storageConfig = \{[\s\S]*?msrbqgorhjbzxomexzap\.supabase\.co[\s\S]*?sb_publishable_gGls0-_0bfkwCSmG7MNXJg_2aQLzLnV[\s\S]*?\};/);
  assert.match(script, /createCloudDataClient\(\{[\s\S]*?url:\s*supabaseConfig\.url,[\s\S]*?key:\s*supabaseConfig\.key,[\s\S]*?storageUrl:\s*storageConfig\.url,[\s\S]*?storageKey:\s*storageConfig\.key/);
});
```

- [ ] **步骤 2：运行集成测试验证失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/media-upload-integration.test.js
```

预期：FAIL，因为 `storageConfig` 与两个 Storage 参数尚不存在。

- [ ] **步骤 3：添加第二 Storage 配置并传入客户端**

在主配置后增加：

```js
const storageConfig = {
  url: 'https://msrbqgorhjbzxomexzap.supabase.co',
  key: 'sb_publishable_gGls0-_0bfkwCSmG7MNXJg_2aQLzLnV',
};
```

在 `connectSupabase()` 中传入：

```js
state.client = window.CloudDataClient.createCloudDataClient({
  url: supabaseConfig.url,
  key: supabaseConfig.key,
  storageUrl: storageConfig.url,
  storageKey: storageConfig.key,
});
```

- [ ] **步骤 4：运行集成测试验证通过**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/media-upload-integration.test.js
```

预期：全部媒体集成测试通过。

- [ ] **步骤 5：提交页面接入改动**

```bash
git add script.js tests/media-upload-integration.test.js
git commit -m "feat: configure secondary media storage"
```

### 任务 4：完整验证与交付

**文件：**
- 检查：`cloud-data-client.js`
- 检查：`script.js`
- 检查：`tests/data-persistence.test.js`
- 检查：`tests/media-upload-integration.test.js`

- [ ] **步骤 1：审计数据库与 Storage 路由**

运行：

```bash
rg -n "baseUrl|storageBaseUrl|headers\(|storageHeaders\(|state\.client\.(upload|getPublicUrl)|uploadMediaItem|uploadDataUrlResource|syncPendingRecords" cloud-data-client.js script.js
```

确认数据库四方法只使用主配置，Storage 三方法只使用 Storage 配置，且两个统一上传入口仍覆盖全部业务路径。

- [ ] **步骤 2：运行完整测试**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

预期：164 项以上测试全部通过，0 失败。

- [ ] **步骤 3：检查 diff 与工作区归属**

运行：

```bash
git diff --check
git status --short
git diff master...HEAD -- cloud-data-client.js script.js tests/data-persistence.test.js tests/media-upload-integration.test.js docs/superpowers/specs/2026-08-30-secondary-supabase-storage-design.md docs/superpowers/plans/2026-08-30-secondary-supabase-storage.md
```

确认未纳入用户已有的未跟踪文件，且不存在 UI、schema 或旧 URL 改写。

- [ ] **步骤 4：请求代码审查并处理 Critical/Important 反馈**

使用 `requesting-code-review` 对照设计规格审查 `master..HEAD`；修复必要问题后重新运行完整测试。

- [ ] **步骤 5：推送并创建 Pull Request**

推送 `feature/secondary-supabase-storage`，创建以 `master` 为基础分支的 PR。PR 描述列出修改文件、REST/Storage 路由、向后兼容行为与完整测试结果。

- [ ] **步骤 6：在 Codex 内置浏览器打开页面**

启动本地静态服务器，并在 Codex 内置浏览器打开首页供用户检查；不执行真实媒体上传，避免写入用户 Supabase 数据。
