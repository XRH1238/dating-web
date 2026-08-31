# 高清照片查看器双指缩放实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为高清照片查看器增加手机和平板双指捏合缩放，以及 Mac 触控板和 Safari 手势缩放。

**架构：** 在现有 `media-viewer.js` 内增加独立可测试的手势几何函数，并由一个活动指针集合统一处理单指拖动与双指缩放；Mac 触控板走 `wheel`，Safari 额外走 gesture 兼容事件。所有缩放都复用同一焦点缩放函数和现有边界限制。

**技术栈：** 原生 JavaScript、Pointer Events、Wheel Events、Safari Gesture Events、CSS、Node.js `node:test`。

---

## 文件结构

- 修改 `media-viewer.js`：新增手势几何纯函数、活动指针状态、双指/触控板/Safari 手势事件处理。
- 修改 `tests/media-viewer.test.js`：验证距离、中点、焦点缩放和边界行为。
- 修改 `tests/live-photo-integration.test.js`：验证事件监听、长按取消和资源缓存版本。
- 修改 `styles.css`：手势进行时禁用媒体变换过渡。
- 修改 `tests/story-styles.test.js`：验证手势态样式。
- 修改 `index.html`：更新 `styles.css`、`media-viewer.js` 和 `script.js` 的缓存版本。
- 修改 `tests/home-layout.test.js`：同步新的页面资源版本断言。

### 任务 1：可测试的焦点缩放几何

**文件：**
- 修改：`tests/media-viewer.test.js`
- 修改：`media-viewer.js`

- [x] **步骤 1：编写失败的手势几何测试**

```js
test('双指距离和中点计算使用有效坐标', () => {
  assert.equal(Viewer.pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.deepEqual(Viewer.pointerMidpoint({ x: 10, y: 20 }, { x: 30, y: 50 }), { x: 20, y: 35 });
});

test('围绕非中心焦点缩放时保持焦点下的图片内容稳定', () => {
  const next = Viewer.zoomAroundPoint(
    { scale: 1, x: 0, y: 0 },
    2,
    { x: 225, y: 100 },
    { width: 300, height: 200 }
  );
  assert.deepEqual(next, { scale: 2, x: -75, y: 0 });
});

test('焦点缩放继续限制缩放和平移边界', () => {
  const next = Viewer.zoomAroundPoint(
    { scale: 4, x: 0, y: 0 },
    8,
    { x: 300, y: 200 },
    { width: 300, height: 200 }
  );
  assert.equal(next.scale, 5);
  assert.deepEqual({ x: next.x, y: next.y }, { x: -37.5, y: -25 });
});
```

- [x] **步骤 2：运行测试并确认因新函数缺失而失败**

运行：`node --test tests/media-viewer.test.js`
预期：FAIL，指出 `Viewer.pointerDistance` 或 `Viewer.zoomAroundPoint` 不是函数。

- [x] **步骤 3：实现最少的几何函数并导出**

```js
function pointerDistance(a, b) {
  var dx = (Number(b && b.x) || 0) - (Number(a && a.x) || 0);
  var dy = (Number(b && b.y) || 0) - (Number(a && a.y) || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function pointerMidpoint(a, b) {
  return {
    x: ((Number(a && a.x) || 0) + (Number(b && b.x) || 0)) / 2,
    y: ((Number(a && a.y) || 0) + (Number(b && b.y) || 0)) / 2,
  };
}

function zoomAroundPoint(state, nextScale, focal, bounds) {
  var oldScale = clampScale(state && state.scale);
  var scale = clampScale(nextScale);
  var width = Math.max(0, Number(bounds && bounds.width) || 0);
  var height = Math.max(0, Number(bounds && bounds.height) || 0);
  var focalX = Number(focal && focal.x);
  var focalY = Number(focal && focal.y);
  var px = (Number.isFinite(focalX) ? focalX : width / 2) - width / 2;
  var py = (Number.isFinite(focalY) ? focalY : height / 2) - height / 2;
  var x = Number(state && state.x) || 0;
  var y = Number(state && state.y) || 0;
  var position = clampPan({
    x: px - ((px - x) / oldScale) * scale,
    y: py - ((py - y) / oldScale) * scale,
  }, scale, bounds);
  return { scale: scale, x: position.x, y: position.y };
}
```

将 `pointerDistance`、`pointerMidpoint` 和 `zoomAroundPoint` 加入模块返回对象。

- [x] **步骤 4：运行单元测试确认通过**

运行：`node --test tests/media-viewer.test.js`
预期：全部通过，0 failed。

- [x] **步骤 5：提交任务 1**

```bash
git add media-viewer.js tests/media-viewer.test.js
git commit -m "feat: add viewer focal zoom geometry"
```

### 任务 2：双指、Mac 触控板和 Safari 手势接入

**文件：**
- 修改：`tests/live-photo-integration.test.js`
- 修改：`tests/story-styles.test.js`
- 修改：`media-viewer.js`
- 修改：`styles.css`

- [x] **步骤 1：编写失败的浏览器事件与样式测试**

```js
test('查看器监听双指、Mac 触控板和 Safari 缩放手势', () => {
  const viewer = fs.readFileSync(path.join(root, 'media-viewer.js'), 'utf8');
  assert.match(viewer, /activePointers\s*=\s*new Map/);
  assert.match(viewer, /addEventListener\(['"]wheel['"]/);
  assert.match(viewer, /addEventListener\(['"]gesturestart['"]/);
  assert.match(viewer, /addEventListener\(['"]gesturechange['"]/);
  assert.match(viewer, /pointerDistance/);
  assert.match(viewer, /pointerMidpoint/);
});

test('双指开始会取消实况照片长按并进入无过渡手势状态', () => {
  const viewer = fs.readFileSync(path.join(root, 'media-viewer.js'), 'utf8');
  assert.match(viewer, /activePointers\.size\s*===\s*2[\s\S]*clearHoldTimer/);
  assert.match(viewer, /classList\.add\(['"]is-gesturing['"]\)/);
});
```

在 `tests/story-styles.test.js` 增加：

```js
test('触摸与触控板手势过程中停用照片变换过渡', () => {
  assert.match(css, /\.media-viewer-stage\.is-gesturing[\s\S]*transition:\s*none/);
});
```

- [x] **步骤 2：运行测试并确认事件监听缺失而失败**

运行：`node --test tests/live-photo-integration.test.js tests/story-styles.test.js`
预期：FAIL，指出 `activePointers`、`wheel`、gesture 或 `is-gesturing` 缺失。

- [x] **步骤 3：实现统一活动指针和捏合会话**

在模块状态区加入：

```js
var activePointers = new Map();
var pinchSession = null;
var safariGestureScale = null;
```

增加小型辅助函数：清理长按计时、将事件坐标转换成舞台坐标、创建/更新捏合会话、结束后从剩余触点重建拖动起点。`pointerdown` 将触点加入集合；第二个触点出现时取消长按并进入 `is-gesturing`。`pointermove` 使用距离倍率缩放，并把中点移动量加入平移后重新 `clampPan`。

核心更新形式：

```js
var distance = pointerDistance(points[0], points[1]);
var midpoint = pointerMidpoint(points[0], points[1]);
var next = zoomAroundPoint(viewerState, viewerState.scale * (distance / pinchSession.distance), pinchSession.midpoint, stageBounds());
var moved = clampPan({
  x: next.x + midpoint.x - pinchSession.midpoint.x,
  y: next.y + midpoint.y - pinchSession.midpoint.y,
}, next.scale, stageBounds());
viewerState = Object.assign({}, viewerState, { scale: next.scale, x: moved.x, y: moved.y });
pinchSession = { distance: distance, midpoint: midpoint };
```

- [x] **步骤 4：实现 Mac wheel 与 Safari gesture 兼容路径**

```js
elements.stage.addEventListener('wheel', function (event) {
  if (!elements.stage.querySelector('.media-viewer-media')) return;
  event.preventDefault();
  var focal = stagePoint(event);
  var factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0025));
  var next = zoomAroundPoint(viewerState, viewerState.scale * factor, focal, stageBounds());
  viewerState = Object.assign({}, viewerState, next);
  applyScale();
}, { passive: false });
```

`gesturestart` 保存起始缩放，`gesturechange` 使用 `startScale * event.scale` 调用 `zoomAroundPoint`，`gestureend` 清理状态；活动双触点存在时忽略 Safari 兼容事件，避免重复缩放。

- [x] **步骤 5：增加手势过程无过渡样式**

```css
.media-viewer-stage.is-gesturing .media-viewer-media {
  transition: none;
}
```

- [x] **步骤 6：运行目标测试确认通过**

运行：`node --test tests/media-viewer.test.js tests/live-photo-integration.test.js tests/story-styles.test.js`
预期：全部通过，0 failed。

- [x] **步骤 7：提交任务 2**

```bash
git add media-viewer.js styles.css tests/live-photo-integration.test.js tests/story-styles.test.js
git commit -m "feat: support pinch and trackpad photo zoom"
```

### 任务 3：缓存版本、完整验证和发布准备

**文件：**
- 修改：`index.html`
- 修改：`tests/live-photo-integration.test.js`
- 修改：`tests/home-layout.test.js`
- 修改：`docs/superpowers/plans/2026-08-30-media-viewer-pinch-zoom.md`

- [x] **步骤 1：先更新缓存版本测试**

将断言调整为：`live-photo.js` 保持 `20260830-5`，`media-viewer.js` 使用 `20260830-7`，`styles.css` 与 `script.js` 使用 `20260830-7`，其他未修改模块保持当前版本。

```js
assert.match(html, /media-viewer\.js\?v=20260830-7/);
['styles.css', 'script.js'].forEach(asset => {
  assert.match(html, new RegExp(asset.replace('.', '\\.') + '\\?v=20260830-7'));
});
```

- [x] **步骤 2：运行缓存测试并确认旧 HTML 版本导致失败**

运行：`node --test tests/live-photo-integration.test.js tests/home-layout.test.js`
预期：FAIL，指出 `20260830-7` 未出现在 `index.html`。

- [x] **步骤 3：更新页面资源版本**

在 `index.html` 中将 `styles.css`、`media-viewer.js`、`script.js` 的查询版本更新为 `20260830-7`。

- [x] **步骤 4：运行完整自动化测试与静态检查**

运行：`node --test tests/*.test.js`
预期：全部通过，0 failed。

运行：`git diff --check && node --check media-viewer.js && node --check script.js`
预期：退出码 0，无输出。

- [x] **步骤 5：浏览器只读验收**

打开本地或线上 `#records` 页面，不创建或修改真实数据。检查高清查看器可以打开、按钮缩放和鼠标拖动仍可用，并确认页面加载的是 `20260830-7` 资源。自动化环境无法生成真实 Mac 触控板与多点触摸硬件事件时，以纯函数测试、事件绑定测试和用户设备最终手感检查为准。

执行说明：本地页面已确认加载 `20260830-7` 版本的样式、查看器和主脚本，查看器舞台 `touch-action: none`。现有照片成功打开；按钮缩放从 100% 变为 150%，滚轮/触控板路径继续缩放到约 334%，鼠标拖动使位置从 `0,0` 变为 `80,50`，复位后恢复 100% 与 `0,0`；控制台无错误或警告。真实多点触摸与 Mac 硬件捏合手感仍保留给用户设备最终检查，组合手势计算由完整测试覆盖。

- [x] **步骤 6：提交发布准备**

```bash
git add index.html tests/live-photo-integration.test.js tests/home-layout.test.js docs/superpowers/plans/2026-08-30-media-viewer-pinch-zoom.md
git commit -m "chore: prepare pinch zoom release"
```

- [ ] **步骤 7：获得用户发布许可后推送并核对 GitHub Pages**

运行：`git push origin master`
预期：远端 `master` 更新成功。随后只读检查 `https://xrh1238.github.io/dating-web/#records` 引用 `media-viewer.js?v=20260830-7`。
