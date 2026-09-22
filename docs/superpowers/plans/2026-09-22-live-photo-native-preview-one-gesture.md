# Apple 实况照片兼容预览与单手势播放实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 保留 Apple LivePhotosKit JS 为首选播放器，同时让 HEIC 实况照片在相册中可预览，并使第一次点击或第一次长按即可播放。

**架构：** `live-photo.js` 提供无 DOM 依赖的预览策略；`script.js` 依据策略渲染静态图或 MOV 帧预览；`media-viewer.js` 在查看器打开时创建并预加载 Apple Player，播放手势只负责调用已准备的实例。浏览器 `<video>` 仅在 Apple 明确失败或媒体被标记为补充视频时兜底。

**技术栈：** 原生 JavaScript、Apple LivePhotosKit JS、HTML `<video>`/`<img>`、Node.js `node:test`、现有静态 HTML/CSS。

---

## 文件结构

- 修改：`live-photo.js`，提供 HEIC/HEIF 实况预览策略纯函数。
- 修改：`script.js`，为相册和表单预览渲染 MOV 首帧兼容预览。
- 修改：`media-viewer.js`，管理 Apple Player 预创建、预加载、首次手势播放和错误回退。
- 修改：`styles.css`，统一图片与视频预览尺寸并提供失败占位。
- 修改：`index.html`，更新本次变更资源的缓存版本。
- 修改：`tests/live-photo.test.js`，覆盖预览策略。
- 修改：`tests/live-photo-integration.test.js`，覆盖页面渲染、播放器生命周期和缓存版本契约。
- 修改：`tests/media-viewer.test.js`，覆盖 Apple 配置和播放状态纯逻辑。
- 修改：`tests/home-layout.test.js`，同步核心资源缓存版本断言。

### 任务 1：定义 HEIC 实况照片的兼容预览策略

**文件：**
- 修改：`tests/live-photo.test.js`
- 修改：`live-photo.js`

- [ ] **步骤 1：编写失败的预览策略测试**

在 `tests/live-photo.test.js` 增加：

```js
test('HEIC 与 HEIF 实况照片使用动态资源作为兼容预览', () => {
  assert.equal(LivePhoto.previewMode({ kind: 'live-photo', name: 'IMG_1.HEIC', motion_url: 'IMG_1.MOV' }), 'motion');
  assert.equal(LivePhoto.previewMode({ media_kind: 'live-photo', type: 'image/heif', motion_url: 'IMG_2.MOV' }), 'motion');
});

test('可显示静态图和普通媒体保持图片预览', () => {
  assert.equal(LivePhoto.previewMode({ kind: 'live-photo', name: 'IMG_1.JPG', motion_url: 'IMG_1.MOV' }), 'image');
  assert.equal(LivePhoto.previewMode({ kind: 'image', name: 'IMG_1.HEIC' }), 'image');
});
```

- [ ] **步骤 2：运行测试并确认正确失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/live-photo.test.js
```

预期：FAIL，提示 `LivePhoto.previewMode is not a function`。

- [ ] **步骤 3：实现最少预览策略**

在 `live-photo.js` 增加并导出：

```js
function previewMode(media) {
  var kind = persistedKind(media);
  var name = String(media && media.name || '');
  var type = String(media && media.type || '').toLowerCase();
  var isHeic = /\.(heic|heif)$/i.test(name) || /image\/hei[cf]/.test(type);
  return kind === 'live-photo' && media.motion_url && isHeic ? 'motion' : 'image';
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行同一步骤 2，预期该文件全部 PASS。

- [ ] **步骤 5：提交任务 1**

```bash
git add live-photo.js tests/live-photo.test.js
git commit -m "fix: choose compatible previews for HEIC live photos"
```

### 任务 2：让相册卡片显示 MOV 可见帧而不是黑色 HEIC

**文件：**
- 修改：`tests/live-photo-integration.test.js`
- 修改：`script.js`
- 修改：`styles.css`

- [ ] **步骤 1：编写失败的页面契约测试**

在 `tests/live-photo-integration.test.js` 增加：

```js
test('HEIC 实况照片使用无控制条的 MOV 帧作为相册预览', () => {
  assert.match(script, /LivePhotoMedia\.previewMode\(media\)/);
  assert.match(script, /class="live-photo-motion-preview"/);
  assert.match(script, /muted playsinline preload="metadata"/);
  assert.match(script, /data-live-preview/);
});

test('动态预览加载失败时显示明确占位而不是黑色卡片', () => {
  assert.match(script, /实况预览暂不可用/);
  assert.match(script, /addEventListener\("error"/);
});
```

同时读取 `styles.css` 并断言 `.live-photo-motion-preview` 与图片共享 `object-fit: cover`、卡片高度和 `pointer-events: none`。

- [ ] **步骤 2：运行测试并确认正确失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/live-photo-integration.test.js
```

预期：FAIL，缺少动态预览标记和错误占位逻辑。

- [ ] **步骤 3：实现最少相册预览渲染**

在 `script.js` 的 `mediaElementMarkup` 中，根据 `LivePhotoMedia.previewMode(media)` 选择内部标记：

```js
var previewMedia = window.LivePhotoMedia.previewMode(media) === 'motion'
  ? '<video class="live-photo-motion-preview" src="' + escapeHtml(media.motion_url) +
      '" muted playsinline preload="metadata" data-live-preview aria-label="' + label + '"></video>'
  : '<img src="' + url + '" alt="' + label + '" loading="lazy" decoding="async" />';
```

增加 `prepareLivePhotoPreviews(container)`：

```js
function prepareLivePhotoPreviews(container) {
  container.querySelectorAll('[data-live-preview]').forEach(function(video) {
    video.addEventListener('loadeddata', function() {
      try { video.currentTime = Math.min(0.05, Math.max(0, video.duration || 0)); } catch (_) {}
    }, { once: true });
    video.addEventListener('error', function() {
      var placeholder = document.createElement('span');
      placeholder.className = 'live-photo-preview-error';
      placeholder.textContent = '实况预览暂不可用';
      video.replaceWith(placeholder);
    }, { once: true });
  });
}
```

在相册和表单预览写入 HTML 后调用该函数。视频保持静音、无 `controls`、不调用 `play()`，只显示首个可解码帧。

- [ ] **步骤 4：补齐统一样式**

在 `styles.css` 中让 `.live-photo-motion-preview` 与相册图片共享宽度、高度和 `object-fit: cover`，并设置：

```css
.live-photo-motion-preview {
  display: block;
  pointer-events: none;
}

.live-photo-preview-error {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  color: rgba(255, 255, 255, .82);
  background: #2f2730;
}
```

- [ ] **步骤 5：运行测试并确认通过**

运行步骤 2 的测试命令，预期全部 PASS。

- [ ] **步骤 6：提交任务 2**

```bash
git add script.js styles.css tests/live-photo-integration.test.js
git commit -m "fix: show motion previews for HEIC live photos"
```

### 任务 3：预创建 Apple Player 并支持首次手势播放

**文件：**
- 修改：`tests/media-viewer.test.js`
- 修改：`tests/live-photo-integration.test.js`
- 修改：`media-viewer.js`

- [ ] **步骤 1：编写失败的 Apple Player 配置测试**

在 `tests/media-viewer.test.js` 增加：

```js
test('Apple 播放器主动预加载且隐藏 Apple 自带控制层', () => {
  const player = {};
  Viewer.configureApplePlayer(player, { url: 'a.jpg', motion_url: 'a.mov' }, { PlaybackStyle: { FULL: 'full' } });
  assert.equal(player.photoSrc, 'a.jpg');
  assert.equal(player.videoSrc, 'a.mov');
  assert.equal(player.proactivelyLoadsVideo, true);
  assert.equal(player.showsNativeControls, false);
  assert.equal(player.playbackStyle, 'full');
});
```

在 `tests/live-photo-integration.test.js` 增加契约断言：`open()` 或 `renderCurrent()` 调用 `prepareApplePlayer`，点击与长按调用已准备的播放器，源码不再包含“请再次点击 LIVE”。

- [ ] **步骤 2：运行相关测试并确认正确失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/media-viewer.test.js tests/live-photo-integration.test.js
```

预期：FAIL，缺少 `configureApplePlayer`、`prepareApplePlayer`，且仍存在二次点击文案。

- [ ] **步骤 3：实现 Apple Player 配置与预创建**

在 `media-viewer.js` 增加：

```js
function configureApplePlayer(player, media, kit) {
  player.photoSrc = media.url;
  player.videoSrc = media.motion_url;
  player.proactivelyLoadsVideo = true;
  player.showsNativeControls = false;
  if (kit.PlaybackStyle && kit.PlaybackStyle.FULL) player.playbackStyle = kit.PlaybackStyle.FULL;
  return player;
}
```

增加当前媒体令牌 `playerGeneration`。`prepareApplePlayer(media)` 在 `renderCurrent()` 后异步加载 Kit、创建容器与 Player、注册 `photoload`、`canplay`、`error`、`ended`；只有 generation 与当前媒体仍匹配时才能修改 DOM 或状态。兼容预览在 Player 可显示前保持可见。

- [ ] **步骤 4：让第一次点击直接播放已准备的 Apple Player**

将 `playLive()` 调整为：

```js
function playLive() {
  var media = currentMedia();
  if (!canPlayLive(media) || !elements) return Promise.resolve(false);
  if (viewerState.appleFailed || prefersNativeVideo(media)) return playFallbackVideo(media, true);
  if (applePlayer && typeof applePlayer.play === 'function') {
    setStatus('正在使用 Apple 实况播放器');
    return Promise.resolve(applePlayer.play());
  }
  return prepareApplePlayer(media).then(function() {
    return applePlayer && applePlayer.play ? applePlayer.play() : false;
  });
}
```

`LIVE` 点击直接调用该函数。长按计时到 350ms 时调用同一函数，不再先初始化、再等待第二个手势。

- [ ] **步骤 5：清理二次确认文案与错误回退**

删除 `playFallbackVideo(media, false)` 分支和两处“请再次点击 LIVE”提示。Apple 同步失败时在当前点击链中调用 `playFallbackVideo(media, true)`；异步错误只标记 `appleFailed`、准备回退画面并显示“Apple 实况暂不可用，可点击或长按播放动态”，下一次操作直接播放，不再声称是声音确认。

- [ ] **步骤 6：保证停止播放不销毁已准备的 Player**

拆分 `stopPlayback()` 与 `disposePlayer()`：松开长按或一次播放结束只调用 `stop()`；切换媒体、关闭查看器或发生 Apple 错误时才销毁旧实例与 DOM。这样同一张照片的第二次播放不需要重新初始化。

- [ ] **步骤 7：运行相关测试并确认通过**

运行步骤 2 的命令，预期全部 PASS。

- [ ] **步骤 8：提交任务 3**

```bash
git add media-viewer.js tests/media-viewer.test.js tests/live-photo-integration.test.js
git commit -m "fix: prepare Apple live photos before first gesture"
```

### 任务 4：更新缓存版本并完成全量验证

**文件：**
- 修改：`index.html`
- 修改：`tests/home-layout.test.js`
- 修改：`tests/live-photo-integration.test.js`

- [ ] **步骤 1：编写失败的缓存版本测试**

将本次修改资源的预期版本更新为 `20260922-1`：

```js
['styles.css', 'live-photo.js', 'media-viewer.js', 'script.js'].forEach(asset => {
  assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260922-1'));
});
```

- [ ] **步骤 2：运行缓存测试并确认正确失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/home-layout.test.js tests/live-photo-integration.test.js
```

预期：FAIL，页面仍引用旧缓存版本。

- [ ] **步骤 3：更新页面资源版本**

在 `index.html` 中仅把 `styles.css`、`live-photo.js`、`media-viewer.js`、`script.js` 更新为 `?v=20260922-1`；保留其他资源版本不变。

- [ ] **步骤 4：运行完整自动化验证**

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check live-photo.js
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check media-viewer.js
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check script.js
git diff --check
```

预期：全部测试 PASS、语法检查退出码 0、`git diff --check` 无输出。

- [ ] **步骤 5：在 Codex 内置浏览器验收**

使用当前本地预览服务，验证：

1. 桌面端相册中的 `IMG_5640.HEIC` 卡片显示 MOV 可见帧而不是黑色；
2. 打开后 Apple 状态在用户点击前已准备或正在预加载；
3. 第一次点击 `LIVE` 即开始播放；
4. 重新打开后第一次长按即播放，松开停止；
5. 390 × 844 视口无横向溢出，控制台没有新增错误；
6. 浏览器视频回退无进度条，页面不存在声音确认文案。

- [ ] **步骤 6：提交任务 4**

```bash
git add index.html tests/home-layout.test.js tests/live-photo-integration.test.js
git commit -m "chore: refresh live photo browser assets"
```

- [ ] **步骤 7：记录最终开发位置**

最终回复注明功能名称、分支 `codex/live-photo-attach-motion`、未合并/未推送/未发布，以及完整工作区 `/Users/xie/Documents/恋爱网站/.worktrees/live-photo-attach-motion`。
