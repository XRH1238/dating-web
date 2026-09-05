# 用户名与头像实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让已登录用户在网站内设置用户名和可拖动、可缩放裁剪的圆形头像，并用它们替换页头邮箱展示。

**架构：** 主 Supabase Auth 的 `user_metadata` 只保存白名单字段 `display_name`、`avatar_url` 和 `avatar_path`。独立的 `avatar-cropper.js` 负责裁剪数学、指针/触摸交互和 Canvas 输出；`script.js` 负责弹窗状态、通过现有 Storage 网关上传新头像、更新 Auth 资料，再清理旧头像。

**技术栈：** 原生 HTML/CSS/JavaScript、Canvas 2D、Pointer/Touch Events、Supabase Auth REST API、现有 `CloudDataClient` Storage 网关、Node.js `node:test`。

---

## 文件结构

- 创建 `avatar-cropper.js`：头像裁剪的纯计算函数和浏览器交互控制器。
- 创建 `tests/avatar-cropper.test.js`：覆盖初始填充、偏移边界、缩放焦点和裁剪源区域。
- 修改 `auth-client.js`：白名单投影用户资料，并提供 `updateProfile(metadata)`。
- 修改 `tests/auth-client.test.js`：验证资料读取、更新、会话持久化和敏感字段过滤。
- 修改 `index.html`：增加页头资料按钮、个人资料弹窗和裁剪控件，并加载裁剪模块。
- 修改 `styles.css`：增加页头头像、弹窗、圆形遮罩和移动端样式。
- 修改 `script.js`：连接 UI、Auth metadata 和第二 Storage，实现可回滚的保存流程。
- 修改 `tests/auth-ui.test.js`：覆盖页头显示、弹窗结构、上传顺序、失败回收和旧头像清理。
- 修改 `tests/home-layout.test.js`：更新新资源的缓存版本断言。

### 任务 1：扩展 Auth 用户资料白名单

**文件：**
- 修改：`auth-client.js`
- 测试：`tests/auth-client.test.js`

- [ ] **步骤 1：编写失败的 metadata 投影和更新测试**

在 `tests/auth-client.test.js` 增加两个精确用例：

```js
test('会话只保留允许展示的用户资料', async () => {
  const storage = createStorage();
  const { client } = createHarness(async () => jsonResponse(wireSession({
    id: 'u1', email: 'a@example.com', role: 'authenticated',
    user_metadata: {
      display_name: '小恋', avatar_url: 'https://cdn.example/avatar.jpg',
      avatar_path: 'avatars/u1/avatar.jpg', private_note: '不保存',
    },
  })), { storage });

  const session = await client.signInWithPassword('a@example.com', 'password');
  assert.deepEqual(session.user.user_metadata, {
    display_name: '小恋', avatar_url: 'https://cdn.example/avatar.jpg',
    avatar_path: 'avatars/u1/avatar.jpg',
  });
  assert.equal(JSON.stringify(storage.value('dating-web:auth:v1')).includes('private_note'), false);
});

test('updateProfile 只发送白名单资料并刷新会话用户', async () => {
  const calls = [];
  const { client } = createHarness(async (url, options) => {
    calls.push({ url, options });
    if (url.includes('grant_type=password')) return jsonResponse(wireSession({ id: 'u1', email: 'a@example.com' }));
    return jsonResponse({ id: 'u1', email: 'a@example.com', role: 'authenticated', user_metadata: {
      display_name: '新名字', avatar_url: 'https://cdn.example/new.jpg', avatar_path: 'avatars/u1/new.jpg',
    }});
  });
  await client.signInWithPassword('a@example.com', 'password');
  await client.updateProfile({
    display_name: '新名字', avatar_url: 'https://cdn.example/new.jpg',
    avatar_path: 'avatars/u1/new.jpg', ignored: 'drop-me',
  });

  assert.equal(calls[1].url, 'https://example.supabase.co/auth/v1/user');
  assert.deepEqual(JSON.parse(calls[1].options.body), { data: {
    display_name: '新名字', avatar_url: 'https://cdn.example/new.jpg', avatar_path: 'avatars/u1/new.jpg',
  }});
  assert.equal((await client.getSession()).user.user_metadata.display_name, '新名字');
});
```

- [ ] **步骤 2：运行定向测试并确认失败**

运行：`node --test tests/auth-client.test.js`

预期：FAIL，因为 `projectUser` 尚未保留 `user_metadata`，并且 `updateProfile` 尚不存在。

- [ ] **步骤 3：实现最小白名单和更新方法**

在 `auth-client.js` 中加入：

```js
function projectProfileMetadata(value) {
  var source = value && typeof value === "object" ? value : {};
  var result = {};
  ["display_name", "avatar_url", "avatar_path"].forEach(function(key) {
    if (typeof source[key] === "string") result[key] = source[key];
  });
  return result;
}

function projectUser(value) {
  if (!value || typeof value !== "object" || value.id == null || value.id === "") return null;
  var result = { id: value.id };
  if (typeof value.email === "string") result.email = value.email;
  if (typeof value.role === "string") result.role = value.role;
  result.user_metadata = projectProfileMetadata(value.user_metadata);
  return result;
}
```

在客户端返回对象中加入 `updateProfile`，复用 `updatePassword` 已有的令牌、并发保护和 `USER_UPDATED` 通知：

```js
updateProfile: async function(metadata) {
  var operationGeneration = mutationGeneration;
  var current = await getCurrentSession();
  if (!current || !current.access_token) throw new Error("请先登录");
  if (mutationGeneration !== operationGeneration) return null;
  var targetSession = session;
  var cleanMetadata = projectProfileMetadata(metadata);
  var response = await authRequest("/auth/v1/user", {
    method: "PUT",
    headers: { Authorization: "Bearer " + current.access_token },
    body: JSON.stringify({ data: cleanMetadata }),
  });
  if (session !== targetSession || mutationGeneration !== operationGeneration) return copyWithoutPassword(response);
  var updatedUser = projectUser(response && response.user ? response.user : response);
  if (updatedUser) {
    session.user = updatedUser;
    saveSession(session);
    notify("USER_UPDATED", session);
  }
  return copyWithoutPassword(response);
},
```

- [ ] **步骤 4：运行 Auth 测试并确认通过**

运行：`node --test tests/auth-client.test.js`

预期：所有 `auth-client` 测试 PASS，包括原有的密码过滤与会话竞态测试。

- [ ] **步骤 5：Commit**

```bash
git add auth-client.js tests/auth-client.test.js
git commit -m "feat: support safe auth profile metadata"
```

### 任务 2：建立可测试的头像裁剪模块

**文件：**
- 创建：`avatar-cropper.js`
- 创建：`tests/avatar-cropper.test.js`

- [ ] **步骤 1：为裁剪数学编写失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { fitScale, clampOffset, cropSourceRect } = require('../avatar-cropper.js');

test('初始缩放完全覆盖固定裁剪框', () => {
  assert.equal(fitScale(1200, 800, 280), 0.35);
  assert.equal(fitScale(600, 1200, 280), 280 / 600);
});

test('偏移不会让裁剪框露出空白', () => {
  assert.deepEqual(clampOffset({ x: 500, y: -500, imageWidth: 1200, imageHeight: 800, scale: 0.5, frameSize: 280 }), {
    x: 160, y: -60,
  });
});

test('输出裁剪区域映射回原图像素', () => {
  assert.deepEqual(cropSourceRect({ x: 20, y: -10, imageWidth: 1200, imageHeight: 800, scale: 0.5, frameSize: 280 }), {
    sx: 280, sy: 140, size: 560,
  });
});
```

- [ ] **步骤 2：运行裁剪测试并确认失败**

运行：`node --test tests/avatar-cropper.test.js`

预期：FAIL，报错 `Cannot find module '../avatar-cropper.js'`。

- [ ] **步骤 3：实现纯函数和浏览器控制器**

`avatar-cropper.js` 使用项目现有 UMD 形式导出：

```js
(function(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AvatarCropper = api;
})(typeof window !== "undefined" ? window : null, function() {
  function fitScale(imageWidth, imageHeight, frameSize) {
    return Math.max(frameSize / imageWidth, frameSize / imageHeight);
  }

  function clampOffset(state) {
    var halfOverflowX = Math.max(0, (state.imageWidth * state.scale - state.frameSize) / 2);
    var halfOverflowY = Math.max(0, (state.imageHeight * state.scale - state.frameSize) / 2);
    return {
      x: Math.max(-halfOverflowX, Math.min(halfOverflowX, state.x)),
      y: Math.max(-halfOverflowY, Math.min(halfOverflowY, state.y)),
    };
  }

  function cropSourceRect(state) {
    return {
      sx: (state.imageWidth * state.scale - state.frameSize) / (2 * state.scale) - state.x / state.scale,
      sy: (state.imageHeight * state.scale - state.frameSize) / (2 * state.scale) - state.y / state.scale,
      size: state.frameSize / state.scale,
    };
  }

  function createAvatarCropper(options) {
    var canvas = options.canvas;
    var zoomInput = options.zoomInput;
    var context = canvas.getContext("2d");
    var image = null;
    var objectUrl = "";
    var pointers = new Map();
    var pinch = null;
    var state = { x: 0, y: 0, imageWidth: 0, imageHeight: 0, scale: 1, baseScale: 1, frameSize: 280 };

    function applyOffset(x, y) {
      var next = clampOffset(Object.assign({}, state, { x: x, y: y }));
      state.x = next.x;
      state.y = next.y;
    }

    function render() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!image) return;
      context.save();
      context.translate(state.frameSize / 2 + state.x, state.frameSize / 2 + state.y);
      context.scale(state.scale, state.scale);
      context.drawImage(image, -state.imageWidth / 2, -state.imageHeight / 2);
      context.restore();
    }

    function setZoom(multiplier) {
      var bounded = Math.max(1, Math.min(3, Number(multiplier) || 1));
      state.scale = state.baseScale * bounded;
      applyOffset(state.x, state.y);
      zoomInput.value = String(bounded);
      render();
    }

    function decodeWithImage(file) {
      return new Promise(function(resolve, reject) {
        objectUrl = URL.createObjectURL(file);
        var next = new Image();
        next.onload = function() { resolve(next); };
        next.onerror = function() { reject(new Error("无法读取这张图片")); };
        next.src = objectUrl;
      });
    }

    async function loadFile(file) {
      if (!file || !/^image\//.test(file.type || "")) throw new Error("请选择图片文件");
      if (file.size > 12 * 1024 * 1024) throw new Error("头像图片不能超过 12 MB");
      reset();
      image = typeof createImageBitmap === "function" ? await createImageBitmap(file) : await decodeWithImage(file);
      state.imageWidth = image.width;
      state.imageHeight = image.height;
      state.baseScale = fitScale(image.width, image.height, state.frameSize);
      state.scale = state.baseScale;
      zoomInput.value = "1";
      render();
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(event) {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size === 2) {
        var pair = Array.from(pointers.values());
        pinch = { distance: distance(pair[0], pair[1]), zoom: Number(zoomInput.value) || 1 };
      }
    }

    function onPointerMove(event) {
      var previous = pointers.get(event.pointerId);
      if (!previous) return;
      var next = { x: event.clientX, y: event.clientY };
      pointers.set(event.pointerId, next);
      if (pointers.size === 1) {
        applyOffset(state.x + next.x - previous.x, state.y + next.y - previous.y);
        render();
      } else if (pointers.size === 2 && pinch) {
        var pair = Array.from(pointers.values());
        setZoom(pinch.zoom * distance(pair[0], pair[1]) / Math.max(1, pinch.distance));
      }
    }

    function onPointerUp(event) {
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      pinch = null;
    }

    function onZoomInput() {
      setZoom(zoomInput.value);
    }

    function toBlob() {
      if (!image) return Promise.reject(new Error("请先选择头像"));
      var source = cropSourceRect(state);
      var output = document.createElement("canvas");
      output.width = output.height = 512;
      output.getContext("2d").drawImage(image, source.sx, source.sy, source.size, source.size, 0, 0, 512, 512);
      return new Promise(function(resolve, reject) {
        output.toBlob(function(blob) { blob ? resolve(blob) : reject(new Error("头像生成失败")); }, "image/jpeg", 0.88);
      });
    }

    function reset() {
      pointers.clear();
      pinch = null;
      if (image && typeof image.close === "function") image.close();
      image = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = "";
      state.x = state.y = 0;
      render();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    zoomInput.addEventListener("input", onZoomInput);

    return {
      loadFile: loadFile,
      setZoom: setZoom,
      reset: reset,
      toBlob: toBlob,
      destroy: function() {
        reset();
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerUp);
        zoomInput.removeEventListener("input", onZoomInput);
      },
    };
  }

  return { fitScale, clampOffset, cropSourceRect, createAvatarCropper };
});
```

`createAvatarCropper` 的具体交互约束：

- `loadFile(file)` 先检查 `file.type.startsWith("image/")` 与 `file.size <= 12 * 1024 * 1024`，再使用 `createImageBitmap`，不支持时回退到 `Image + URL.createObjectURL`。
- 初始缩放为 `fitScale`，滑杆范围是初始缩放的 `1–3` 倍。
- Pointer 拖动和双指缩放每次更新后都调用 `clampOffset`，不允许圆框出现空白。
- `toBlob()` 用 `cropSourceRect` 绘制到 `512×512` 的离屏 Canvas，并以 `image/jpeg` 、0.88 质量输出。
- `destroy()` 释放 object URL、ImageBitmap 和所有事件监听器。

- [ ] **步骤 4：扩展边界测试并运行**

增加竖图、横图、正方形、最小/最大缩放和焦点保持测试。

运行：`node --test tests/avatar-cropper.test.js`

预期：所有裁剪数学测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add avatar-cropper.js tests/avatar-cropper.test.js
git commit -m "feat: add interactive avatar cropper"
```

### 任务 3：添加页头资料入口和编辑弹窗

**文件：**
- 修改：`index.html`
- 修改：`styles.css`
- 测试：`tests/auth-ui.test.js`
- 测试：`tests/home-layout.test.js`

- [ ] **步骤 1：编写失败的结构和样式测试**

在 `tests/auth-ui.test.js` 中断言：

```js
test('登录后页头提供头像资料入口和裁剪弹窗', () => {
  assert.match(html, /id="auth-profile-button"/);
  assert.match(html, /id="auth-avatar"/);
  assert.match(html, /<dialog[^>]*id="profile-dialog"[^>]*aria-labelledby="profile-dialog-title"/);
  assert.match(html, /name="display_name"[^>]*maxlength="32"/);
  assert.match(html, /id="profile-avatar-input"[^>]*type="file"[^>]*accept="image\/.+"/);
  assert.match(html, /id="avatar-crop-canvas"/);
  assert.match(html, /id="avatar-zoom"[^>]*type="range"/);
  assert.ok(html.indexOf('avatar-cropper.js') < html.indexOf('script.js'));
  assert.match(styles, /\.auth-avatar\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(styles, /\.avatar-crop-stage\s*\{[^}]*touch-action:\s*none/s);
});
```

- [ ] **步骤 2：运行 UI 测试并确认失败**

运行：`node --test tests/auth-ui.test.js tests/home-layout.test.js`

预期：FAIL，因为资料按钮、弹窗、裁剪模块引用和样式尚不存在。

- [ ] **步骤 3：替换页头账号文本并增加资料弹窗**

将原 `#auth-account` 文本节点替换为：

```html
<button class="auth-profile-button" id="auth-profile-button" type="button" hidden>
  <span class="auth-avatar auth-avatar-placeholder" id="auth-avatar" aria-hidden="true">♥</span>
  <span class="auth-account" id="auth-account">已登录</span>
</button>
```

在登录弹窗附近增加：

```html
<dialog class="auth-dialog profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
  <form id="profile-form">
    <div class="auth-dialog-heading">
      <div><span class="card-kicker">PROFILE</span><h2 id="profile-dialog-title">个人资料</h2></div>
      <button class="auth-dialog-close" type="button" data-close-profile aria-label="关闭">×</button>
    </div>
    <label>用户名<input name="display_name" maxlength="32" autocomplete="nickname" required /></label>
    <label class="profile-file-label">选择头像<input id="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" /></label>
    <div class="avatar-crop-stage" id="avatar-crop-stage" hidden>
      <canvas id="avatar-crop-canvas" width="280" height="280" aria-label="拖动和缩放图片以选择头像区域"></canvas>
      <span class="avatar-crop-mask" aria-hidden="true"></span>
    </div>
    <label class="avatar-zoom-label" for="avatar-zoom" hidden>缩放
      <input id="avatar-zoom" type="range" min="1" max="3" step="0.01" value="1" />
    </label>
    <p class="form-status" id="profile-status" role="status" aria-live="polite"></p>
    <div class="auth-dialog-actions">
      <button class="button secondary" type="button" data-close-profile>取消</button>
      <button class="button primary" type="submit">保存</button>
    </div>
  </form>
</dialog>
```

在 `script.js` 前加载 `avatar-cropper.js?v=20260905-1`，并同步增加 `styles.css`、`auth-client.js` 和 `script.js` 的缓存版本。

- [ ] **步骤 4：实现页头和裁剪弹窗样式**

样式必须包括：

```css
.auth-profile-button { display: inline-flex; align-items: center; gap: 8px; border: 0; background: transparent; cursor: pointer; }
.auth-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; display: grid; place-items: center; overflow: hidden; }
.avatar-crop-stage { position: relative; width: min(280px, 100%); aspect-ratio: 1; margin: 0 auto; overflow: hidden; touch-action: none; background: #262126; }
.avatar-crop-stage canvas { display: block; width: 100%; height: 100%; }
.avatar-crop-mask { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 999px rgba(20, 16, 20, .55); pointer-events: none; }
```

在 `max-width: 720px` 的现有响应式区域内缩小用户名最大宽度，保证导航和退出按钮不被挤出。

- [ ] **步骤 5：运行 UI 结构测试并确认通过**

运行：`node --test tests/auth-ui.test.js tests/home-layout.test.js`

预期：新增结构、样式和资源顺序断言 PASS，原有登录弹窗断言仍 PASS。

- [ ] **步骤 6：Commit**

```bash
git add index.html styles.css tests/auth-ui.test.js tests/home-layout.test.js
git commit -m "feat: add profile avatar editor interface"
```

### 任务 4：连接用户资料、裁剪与安全 Storage

**文件：**
- 修改：`script.js`
- 测试：`tests/auth-ui.test.js`

- [ ] **步骤 1：编写失败的页头和保存顺序测试**

扩展 `createScriptHarness` 的 DOM 元素和钩子，然后增加：

```js
test('页头显示用户名和头像而不显示邮箱', () => {
  const account = { hidden: true, textContent: '' };
  const avatar = { hidden: false, textContent: '', style: {}, removeAttribute() {}, setAttribute() {} };
  const profileButton = { hidden: true };
  const harness = createScriptHarness({ elements: {
    '#auth-account': account, '#auth-avatar': avatar, '#auth-profile-button': profileButton,
  }});
  harness.hooks.setState({ authUser: { id: 'u1', email: 'secret@example.com', user_metadata: {
    display_name: '小恋', avatar_url: 'https://cdn.example/avatar.jpg', avatar_path: 'avatars/u1/avatar.jpg',
  }}});
  harness.hooks.updateAuthUi();
  assert.equal(account.textContent, '小恋');
  assert.equal(profileButton.hidden, false);
  assert.equal(account.textContent.includes('@'), false);
});

test('更换头像按上传、更新资料、删除旧文件的顺序执行', async () => {
  const events = [];
  const harness = createScriptHarness();
  harness.hooks.setState({
    authUser: { id: 'u1', user_metadata: { avatar_path: 'avatars/u1/old.jpg' } },
    authClient: { async updateProfile(data) { events.push(['profile', data.avatar_path]); return { id: 'u1', user_metadata: data }; } },
    client: {
      async upload(_bucket, path) { events.push(['upload', path]); },
      getPublicUrl(_bucket, path) { return 'https://storage.example/' + path; },
      async removeObjects(_bucket, paths) { events.push(['delete', paths[0]]); },
    },
  });
  await harness.hooks.saveProfile({ displayName: '新名字', avatarBlob: new Blob(['avatar'], { type: 'image/jpeg' }) });
  assert.deepEqual(events.map(item => item[0]), ['upload', 'profile', 'delete']);
});

test('Auth 更新失败时回收新头像且不删除旧头像', async () => {
  const removed = [];
  let uploadedPath = '';
  const harness = createScriptHarness();
  harness.hooks.setState({
    authUser: { id: 'u1', user_metadata: { avatar_path: 'avatars/u1/old.jpg' } },
    authClient: { async updateProfile() { throw new Error('资料更新失败'); } },
    client: {
      async upload(_bucket, path) { uploadedPath = path; },
      getPublicUrl(_bucket, path) { return 'https://storage.example/' + path; },
      async removeObjects(_bucket, paths) { removed.push(...paths); },
    },
  });
  await assert.rejects(
    harness.hooks.saveProfile({ displayName: '新名字', avatarBlob: new Blob(['avatar'], { type: 'image/jpeg' }) }),
    /资料更新失败/
  );
  assert.deepEqual(removed, [uploadedPath]);
  assert.notEqual(uploadedPath, 'avatars/u1/old.jpg');
});
```

- [ ] **步骤 2：运行集成测试并确认失败**

运行：`node --test tests/auth-ui.test.js`

预期：FAIL，因为 `updateAuthUi` 尚未渲染资料，`saveProfile` 尚不存在。

- [ ] **步骤 3：实现资料渲染和弹窗状态**

在 `script.js` 中增加白名单读取：

```js
function authProfile(user) {
  var metadata = user && user.user_metadata && typeof user.user_metadata === "object" ? user.user_metadata : {};
  return {
    displayName: String(metadata.display_name || "").trim(),
    avatarUrl: String(metadata.avatar_url || ""),
    avatarPath: String(metadata.avatar_path || ""),
  };
}
```

`updateAuthUi()` 使用 `displayName || "已登录"`，有 `avatarUrl` 时安全设置 `<img>` 的 `src`，否则恢复爱心占位图。给 `#auth-profile-button`、`[data-close-profile]`、文件 input、缩放滑杆和 `#profile-form` 绑定事件。打开时用当前 metadata 填充表单，关闭时调用 cropper `reset()`。

- [ ] **步骤 4：实现保存、回收与清理顺序**

```js
async function saveProfile(input) {
  if (!requireAuthenticated()) throw new Error("请先登录");
  var displayName = String(input.displayName || "").trim();
  if (!displayName || displayName.length > 32) throw new Error("用户名需为 1–32 个字符");

  var previous = authProfile(state.authUser);
  var next = { display_name: displayName, avatar_url: previous.avatarUrl, avatar_path: previous.avatarPath };
  var uploadedPath = "";
  if (input.avatarBlob) {
    uploadedPath = "avatars/" + state.authUser.id + "/" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".jpg";
    await state.client.upload(storageBucket, uploadedPath, input.avatarBlob);
    next.avatar_path = uploadedPath;
    next.avatar_url = state.client.getPublicUrl(storageBucket, uploadedPath);
  }

  try {
    await state.authClient.updateProfile(next);
  } catch (error) {
    if (uploadedPath) try { await state.client.removeObjects(storageBucket, [uploadedPath]); } catch (_) {}
    throw error;
  }

  if (uploadedPath && previous.avatarPath && previous.avatarPath !== uploadedPath) {
    try { await state.client.removeObjects(storageBucket, [previous.avatarPath]); }
    catch (_) { showCloudNotice("资料已保存，但旧头像暂未清理。", true); }
  }
}
```

表单提交时禁用保存按钮，如选了图片先等待 `cropper.toBlob()`，再调用 `saveProfile`。成功后关闭弹窗；失败时在 `#profile-status` 显示中文错误并保留当前编辑内容。

- [ ] **步骤 5：补齐失败和无头像测试**

增加并通过以下断言：

- 只修改用户名时不调用 Storage。
- 新头像上传失败时不调用 `updateProfile` 或删除旧头像。
- Auth 更新失败时尝试删除新头像，但不删除旧头像。
- 旧头像删除失败不导致整个保存失败。
- `USER_UPDATED` 事件后页头立即使用新用户名和头像。
- 退出登录后关闭资料弹窗并释放裁剪资源。

运行：`node --test tests/auth-ui.test.js tests/auth-client.test.js tests/avatar-cropper.test.js`

预期：所有资料、Auth 和裁剪测试 PASS。

- [ ] **步骤 6：Commit**

```bash
git add script.js tests/auth-ui.test.js
git commit -m "feat: save editable profile avatars"
```

### 任务 5：全量回归与浏览器验收

**文件：**
- 验证：`index.html`
- 验证：`styles.css`
- 验证：`auth-client.js`
- 验证：`avatar-cropper.js`
- 验证：`script.js`
- 验证：`tests/*.test.js`

- [ ] **步骤 1：运行语法和全量测试**

```bash
node --check auth-client.js
node --check avatar-cropper.js
node --check script.js
node --test tests/*.test.js
```

预期：三个语法检查退出码均为 0，全部测试 PASS，无 skipped/cancelled 用例。

- [ ] **步骤 2：检查差异质量与范围**

```bash
git diff --check
git status --short
git diff --stat origin/master...HEAD
```

预期：无空白错误；只有计划列出的文件变更；未跟踪的 `supabase/.temp/` 保持未纳入提交。

- [ ] **步骤 3：本地浏览器验收**

启动项目现有静态服务器，在 Codex 内置浏览器验证：

- 桌面端与 390px 移动端页头不溢出。
- 用户名代替邮箱，头像保持圆形。
- 选择图片后可鼠标/触摸拖动，滑杆可缩放，边缘不露白。
- 取消不上传；重新打开时表单使用已保存资料。
- 不在自动化验收中输入或保存用户密码；需要真实账号时由用户在浏览器中接管登录。

- [ ] **步骤 4：提交验证调整**

```bash
git add index.html styles.css auth-client.js avatar-cropper.js script.js tests/auth-client.test.js tests/avatar-cropper.test.js tests/auth-ui.test.js tests/home-layout.test.js docs/superpowers/plans/2026-09-05-profile-avatar.md
git commit -m "test: verify profile avatar workflow"
```

如本步没有新差异，则不创建空提交。

- [ ] **步骤 5：准备交付但不自动上线**

汇报分支名、提交、全量测试数量和本地预览结果。只有在用户明确同意外部写入后，才推送 GitHub 并创建 PR；只有 PR 审核后再合并上线。
