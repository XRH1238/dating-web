# 已有照片补充动态视频实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 允许已登录用户在照片墙高清查看器中为已有普通照片选择一段视频并绑定为可长按播放的 `LIVE` 媒体。

**架构：** `live-photo.js` 提供可测试的候选判断、视频校验和动态字段构造；`media-viewer.js` 通过配置回调展示入口并管理选择/忙碌/错误状态；`script.js` 完成 Storage 上传、`love_photos` 更新与失败回滚。静态照片记录与文件保持不变，复用已存在的 `motion_*` 字段和原生视频回退。

**技术栈：** 原生 HTML/CSS/JavaScript、Node.js `node:test`、Supabase REST/Storage Gateway、Apple LivePhotosKit JS 与原生 `<video>` 回退。

---

## 文件结构

- 修改：`live-photo.js` — 补充动态候选判断、视频文件校验和云端字段构造。
- 修改：`media-viewer.js` — 配置补充动态回调、显示按钮、触发文件选择并管理交互状态。
- 修改：`index.html` — 增加“补充动态”按钮、隐藏视频输入框和 iPhone 提示。
- 修改：`script.js` — 判断照片墙权限、上传动态视频、更新数据库、回滚失败上传并刷新页面状态。
- 修改：`styles.css` — 桌面和移动端按钮、提示、忙碌与焦点样式。
- 修改：`tests/live-photo.test.js` — 纯函数单元测试。
- 修改：`tests/media-viewer.test.js` — 查看器补充动态状态单元测试。
- 修改：`tests/live-photo-integration.test.js` — DOM 与页面控制层集成契约测试。
- 修改：`tests/story-styles.test.js` — 响应式和可访问样式断言。

### 任务 1：定义补充动态领域规则

**文件：**
- 修改：`tests/live-photo.test.js`
- 修改：`live-photo.js`

- [ ] **步骤 1：编写失败的测试**

在 `tests/live-photo.test.js` 增加：

```js
test('只有持久化普通图片可以补充动态视频', () => {
  assert.equal(LivePhoto.canAttachMotion({ id: 'p1', url: 'a.jpg', kind: 'image' }), true);
  assert.equal(LivePhoto.canAttachMotion({ url: 'a.jpg', kind: 'image' }), false);
  assert.equal(LivePhoto.canAttachMotion({ id: 'p1', url: 'a.jpg', kind: 'live-photo', motion_url: 'a.mov' }), false);
  assert.equal(LivePhoto.canAttachMotion({ id: 'v1', url: 'a.mov', kind: 'video' }), false);
});

test('补充动态只接受视频并构造完整引用', () => {
  assert.equal(LivePhoto.isMotionFile({ name: 'clip.MOV', type: '' }), true);
  assert.equal(LivePhoto.isMotionFile({ name: 'still.jpg', type: 'image/jpeg' }), false);
  assert.deepEqual(
    LivePhoto.motionFields({ name: 'clip.mov', type: 'video/quicktime' }, 'city/clip.mov', 'https://cdn/clip.mov'),
    {
      media_kind: 'live-photo',
      motion_name: 'clip.mov',
      motion_type: 'video/quicktime',
      motion_path: 'city/clip.mov',
      motion_url: 'https://cdn/clip.mov',
    }
  );
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```bash
NODE=/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$NODE" --test tests/live-photo.test.js
```

预期：FAIL，提示 `LivePhoto.canAttachMotion is not a function`。

- [ ] **步骤 3：编写最少实现代码**

在 `live-photo.js` 增加并导出：

```js
function persistedKind(media) {
  return String(media && (media.kind || media.media_kind) || 'image');
}

function canAttachMotion(media) {
  return !!(media && media.id && media.url && persistedKind(media) === 'image' && !media.motion_url);
}

function isMotionFile(file) {
  return isVideo(file);
}

function motionFields(file, path, url) {
  return {
    media_kind: 'live-photo',
    motion_name: fileName(file),
    motion_type: mimeType(file),
    motion_path: String(path || ''),
    motion_url: String(url || ''),
  };
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`"$NODE" --test tests/live-photo.test.js`

预期：所有 `live-photo` 单元测试 PASS。

- [ ] **步骤 5：Commit**

```bash
git add live-photo.js tests/live-photo.test.js
git commit -m "feat: define gallery motion attachment rules"
```

### 任务 2：让高清查看器发出补充动态请求

**文件：**
- 修改：`tests/media-viewer.test.js`
- 修改：`tests/live-photo-integration.test.js`
- 修改：`media-viewer.js`
- 修改：`index.html`

- [ ] **步骤 1：编写失败的测试**

在 `tests/media-viewer.test.js` 增加纯状态测试：

```js
test('补充动态入口只在回调允许时展示且忙碌时锁定', () => {
  const media = { id: 'p1', url: 'a.jpg', kind: 'image' };
  assert.equal(Viewer.motionAttachmentState(media, null, false).visible, false);
  assert.deepEqual(
    Viewer.motionAttachmentState(media, () => true, false),
    { visible: true, disabled: false }
  );
  assert.deepEqual(
    Viewer.motionAttachmentState(media, () => true, true),
    { visible: true, disabled: true }
  );
});
```

在 `tests/live-photo-integration.test.js` 增加：

```js
test('查看器提供单视频补充动态入口和手机提示', () => {
  assert.match(html, /id="media-viewer-attach-motion"/);
  assert.match(html, /id="media-viewer-motion-input"[^>]*accept="video\/\*"/);
  assert.match(html, /请先在照片 App 中将实况照片存储为视频/);
  const viewer = fs.readFileSync(path.join(root, 'media-viewer.js'), 'utf8');
  assert.match(viewer, /configureMotionAttachment/);
  assert.match(viewer, /motionInput\.addEventListener\(['"]change/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：

```bash
"$NODE" --test tests/media-viewer.test.js tests/live-photo-integration.test.js
```

预期：FAIL，缺少 `motionAttachmentState`、`media-viewer-attach-motion` 与 `configureMotionAttachment`。

- [ ] **步骤 3：添加查看器标记**

在 `index.html` 的 `.media-viewer-toolbar` 中加入：

```html
<button id="media-viewer-attach-motion" type="button" aria-label="为当前照片补充动态视频">补充动态</button>
<input id="media-viewer-motion-input" class="sr-only" type="file" accept="video/*" />
```

在状态段落后加入：

```html
<p class="media-viewer-motion-hint" id="media-viewer-motion-hint" hidden>请先在照片 App 中将实况照片存储为视频</p>
```

- [ ] **步骤 4：实现查看器配置与事件**

在 `media-viewer.js` 增加模块状态与纯函数：

```js
var motionAttachment = null;
var motionAttachmentBusy = false;

function motionAttachmentState(media, canAttach, busy) {
  var visible = typeof canAttach === 'function' && !!canAttach(media);
  return { visible: visible, disabled: visible && !!busy };
}

function configureMotionAttachment(options) {
  motionAttachment = options && typeof options.onSelect === 'function' ? options : null;
  if (elements) renderCurrent();
}
```

`renderCurrent()` 根据 `motionAttachmentState` 设置按钮、提示与禁用状态。`bindElements()` 中按钮点击时清空并触发隐藏输入；输入 `change` 时保存当前媒体引用，调用 `motionAttachment.onSelect(media, file)`，上传期间禁用入口，成功结果替换当前项并重新渲染，失败时通过 `setStatus(error.message)` 显示错误，最后清空输入并解除忙碌状态。

`ensureElements()` 收集 `attachMotion`、`motionInput`、`motionHint`，模块导出 `motionAttachmentState` 与 `configureMotionAttachment`。

- [ ] **步骤 5：运行测试验证通过**

运行：`"$NODE" --test tests/media-viewer.test.js tests/live-photo-integration.test.js`

预期：两组测试全部 PASS。

- [ ] **步骤 6：Commit**

```bash
git add index.html media-viewer.js tests/media-viewer.test.js tests/live-photo-integration.test.js
git commit -m "feat: add motion attachment control to media viewer"
```

### 任务 3：上传视频并更新已有照片记录

**文件：**
- 修改：`tests/live-photo-integration.test.js`
- 修改：`script.js`

- [ ] **步骤 1：编写失败的集成契约测试**

在 `tests/live-photo-integration.test.js` 增加：

```js
test('已有照片补充动态会上传视频、更新记录并在失败时回滚', () => {
  assert.match(script, /function canAttachGalleryMotion\(photo\)/);
  assert.match(script, /async function attachMotionToGalleryPhoto\(photo, file\)/);
  assert.match(script, /LivePhotoMedia\.isMotionFile\(file\)/);
  assert.match(script, /state\.client\.upload\(storageBucket, motionPath, file\)/);
  assert.match(script, /state\.client\.update\(tables\.photos, photo\.id, fields\)/);
  assert.match(script, /state\.client\.removeObjects\(storageBucket, \[motionPath\]\)/);
  assert.match(script, /MediaViewer\.configureMotionAttachment/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`"$NODE" --test tests/live-photo-integration.test.js`

预期：FAIL，缺少 `attachMotionToGalleryPhoto`。

- [ ] **步骤 3：实现资格判断与上传事务**

在 `script.js` 的照片墙逻辑附近增加：

```js
function canAttachGalleryMotion(photo) {
  return !!(state.authUser && state.backendReady && state.photos.indexOf(photo) >= 0 &&
    window.LivePhotoMedia.canAttachMotion(photo));
}

function galleryMediaFolder(photo) {
  var path = String(photo && photo.path || '');
  var slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : 'unplaced';
}

async function attachMotionToGalleryPhoto(photo, file) {
  if (!requireAuthenticated()) throw new Error('请先登录后再保存');
  if (!canAttachGalleryMotion(photo)) throw new Error('当前照片暂时无法补充动态');
  if (!window.LivePhotoMedia.isMotionFile(file)) throw new Error('请选择从实况照片存储的视频');
  var motionPath = galleryMediaFolder(photo) + '/' + Date.now() + '-motion-' + safeMediaFileName(file.name);
  await state.client.upload(storageBucket, motionPath, file);
  var motionUrl = state.client.getPublicUrl(storageBucket, motionPath);
  var fields = window.LivePhotoMedia.motionFields(file, motionPath, motionUrl);
  try {
    await state.client.update(tables.photos, photo.id, fields);
  } catch (error) {
    try { await state.client.removeObjects(storageBucket, [motionPath]); } catch (_) {}
    throw error;
  }
  Object.assign(photo, fields, { kind: 'live-photo' });
  renderPhotos();
  showCloudNotice('动态视频已补充，现在可以长按播放。', false);
  return photo;
}
```

在事件初始化完成后配置：

```js
window.MediaViewer.configureMotionAttachment({
  canAttach: canAttachGalleryMotion,
  onSelect: attachMotionToGalleryPhoto,
});
```

- [ ] **步骤 4：运行测试验证通过**

运行：

```bash
"$NODE" --test tests/live-photo-integration.test.js tests/media-viewer.test.js tests/auth-ui.test.js
```

预期：三组测试全部 PASS，且现有认证写权限断言保持不变。

- [ ] **步骤 5：Commit**

```bash
git add script.js tests/live-photo-integration.test.js
git commit -m "feat: attach motion videos to gallery photos"
```

### 任务 4：完成移动端与可访问样式

**文件：**
- 修改：`tests/story-styles.test.js`
- 修改：`styles.css`
- 修改：`index.html`

- [ ] **步骤 1：编写失败的样式测试**

在 `tests/story-styles.test.js` 增加：

```js
test('补充动态入口适配手机安全区和键盘焦点', () => {
  assert.match(css, /#media-viewer-attach-motion[\s\S]*min-height:\s*44px/);
  assert.match(css, /#media-viewer-attach-motion:focus-visible/);
  assert.match(css, /media-viewer-motion-hint/);
  assert.match(css, /#media-viewer-attach-motion\[aria-busy="true"\]/);
});
```

- [ ] **步骤 2：运行测试验证失败**

运行：`"$NODE" --test tests/story-styles.test.js`

预期：FAIL，缺少补充动态按钮样式。

- [ ] **步骤 3：添加最少样式并更新缓存版本**

在 `styles.css` 增加：

```css
#media-viewer-attach-motion {
  min-height: 44px;
  padding-inline: 1rem;
  border-color: rgba(255, 255, 255, 0.45);
}

#media-viewer-attach-motion[aria-busy="true"] {
  cursor: wait;
  opacity: 0.7;
}

#media-viewer-attach-motion:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 3px;
}

.media-viewer-motion-hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.82rem;
  text-align: center;
}
```

在现有移动端媒体查询中让工具条安全换行，提示占满工具区宽度。将 `index.html` 中 `styles.css`、`live-photo.js`、`media-viewer.js` 和 `script.js` 的查询版本统一更新为新的 `20260915-1`，并同步修改缓存版本测试断言。

- [ ] **步骤 4：运行测试验证通过**

运行：`"$NODE" --test tests/story-styles.test.js tests/live-photo-integration.test.js`

预期：两组测试全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add index.html styles.css tests/story-styles.test.js tests/live-photo-integration.test.js
git commit -m "style: polish gallery motion attachment flow"
```

### 任务 5：完整验证与浏览器验收

**文件：**
- 验证：`index.html`
- 验证：`live-photo.js`
- 验证：`media-viewer.js`
- 验证：`script.js`
- 验证：`styles.css`

- [ ] **步骤 1：运行完整自动化测试**

运行：

```bash
"$NODE" --test tests/*.test.js
```

预期：全部测试 PASS，`fail 0`。

- [ ] **步骤 2：运行语法与格式检查**

运行：

```bash
"$NODE" --check live-photo.js
"$NODE" --check media-viewer.js
"$NODE" --check script.js
git diff --check
git status --short --branch
```

预期：三个语法检查和 `git diff --check` 退出码均为 0；状态只包含本计划范围内的预期文件。

- [ ] **步骤 3：启动本地预览并做桌面验收**

运行：

```bash
/usr/bin/python3 -m http.server 8767 --bind 127.0.0.1
```

在 Codex 内置浏览器打开 `http://127.0.0.1:8767/`，登录后验证：

- 普通云端照片显示“补充动态”；
- 取消文件选择不改变照片；
- 非视频文件被输入限制与逻辑校验拒绝；
- 上传期间按钮禁用且显示忙碌状态；
- 成功后同一照片出现 `LIVE`，长按或点击 `LIVE` 可播放；
- 查看器关闭、前后切换、缩放与键盘操作仍正常。

- [ ] **步骤 4：做 iPhone 尺寸验收**

将视口设为 `390 × 844`，验证按钮点击区域不小于 44px、工具栏和提示不横向溢出、底部安全区内可见、错误提示可阅读。

- [ ] **步骤 5：最终提交**

如浏览器验收未产生修复，无需空提交；如产生修复，先添加对应回归测试并完成红—绿循环，然后：

```bash
git add index.html live-photo.js media-viewer.js script.js styles.css tests
git commit -m "fix: complete gallery motion attachment verification"
```

发布 GitHub 与执行任何云端写入均不属于本计划自动步骤，必须在用户明确要求后单独进行。
