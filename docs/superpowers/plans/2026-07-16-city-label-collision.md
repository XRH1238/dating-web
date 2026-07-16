# 市级行政区标签防重叠实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让市级行政区标签按地图缩放等级逐步显示，自动隐藏相互重叠的普通标签，并优先保留旅行相关城市。

**架构：** 新增一个无 DOM 依赖的标签布局模块，输入标签地图坐标、当前地图变换和重点城市集合，输出稳定的可见城市集合。现有 SVG 地图渲染继续负责几何与交互，在每次 `applyMapView` 后调用布局模块，并通过 `hidden` 属性控制标签可见性。

**技术栈：** 原生 JavaScript、SVG、CSS、Node.js 内置 `node:test`

---

## 文件结构

- 创建 `map-label-layout.js`：纯函数标签布局算法，同时暴露浏览器全局和 CommonJS 导出。
- 创建 `tests/map-label-layout.test.js`：覆盖优先级、碰撞、缩放渐进显示和视口裁剪。
- 修改 `index.html`：在主脚本前加载标签布局模块。
- 修改 `script.js`：为市级标签添加元数据，收集重点城市，并在地图变换后应用布局结果。
- 修改 `styles.css`：让文字和描边随地图缩放反向缩放，保持屏幕阅读尺寸稳定。

### 任务 1：建立可测试的标签布局算法

**文件：**
- 创建：`tests/map-label-layout.test.js`
- 创建：`map-label-layout.js`

- [ ] **步骤 1：编写失败的布局测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { layoutCityLabels } = require('../map-label-layout.js');

const baseView = { scale: 3, x: 0, y: 0, width: 1000, height: 720 };

test('重叠时重点城市优先于普通城市', () => {
  const visible = layoutCityLabels([
    { name: '普通市', x: 500, y: 360, priority: false, index: 0 },
    { name: '重点市', x: 501, y: 360, priority: true, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['重点市']);
});

test('互不重叠的市级标签全部显示', () => {
  const visible = layoutCityLabels([
    { name: '甲市', x: 450, y: 360, priority: false, index: 0 },
    { name: '乙市', x: 550, y: 360, priority: false, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['甲市', '乙市']);
});

test('继续放大后逐步显示距离较近的城市', () => {
  const labels = [
    { name: '甲城市', x: 500, y: 360, priority: false, index: 0 },
    { name: '乙城市', x: 508, y: 360, priority: false, index: 1 }
  ];
  assert.equal(layoutCityLabels(labels, baseView).size, 1);
  assert.equal(layoutCityLabels(labels, { ...baseView, scale: 8 }).size, 2);
});

test('视口外标签不参与布局', () => {
  const visible = layoutCityLabels([
    { name: '视口外', x: 900, y: 360, priority: true, index: 0 }
  ], { ...baseView, x: 1000 });
  assert.equal(visible.size, 0);
});

test('低于市级详情缩放阈值时不显示市级标签', () => {
  const visible = layoutCityLabels([
    { name: '甲市', x: 500, y: 360, priority: true, index: 0 }
  ], { ...baseView, scale: 2.9 });
  assert.equal(visible.size, 0);
});
```

- [ ] **步骤 2：运行测试并确认正确失败**

运行：`node --test tests/map-label-layout.test.js`

预期：FAIL，错误包含 `Cannot find module '../map-label-layout.js'`。

- [ ] **步骤 3：实现最小布局模块**

```js
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MapLabelLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  function intersects(a, b) {
    return a.left < b.right && a.right > b.left &&
      a.top < b.bottom && a.bottom > b.top;
  }

  function layoutCityLabels(labels, view) {
    var visible = new Set();
    if (!view || view.scale < 3) return visible;

    var fontSize = 12;
    var gap = view.scale < 6 ? 8 : view.scale < 9 ? 5 : 3;
    var occupied = [];
    var ordered = labels.slice().sort(function(a, b) {
      return Number(b.priority) - Number(a.priority) || a.index - b.index;
    });

    ordered.forEach(function(label) {
      var screenX = view.x + 500 + (label.x - 500) * view.scale;
      var screenY = view.y + 360 + (label.y - 360) * view.scale;
      var width = Math.max(fontSize * 2, String(label.name).length * fontSize);
      var height = fontSize * 1.35;
      var rect = {
        left: screenX - width / 2 - gap,
        right: screenX + width / 2 + gap,
        top: screenY - height / 2 - gap,
        bottom: screenY + height / 2 + gap
      };
      if (rect.right < 0 || rect.left > view.width || rect.bottom < 0 || rect.top > view.height) return;
      if (occupied.some(function(item) { return intersects(rect, item); })) return;
      occupied.push(rect);
      visible.add(label.name);
    });

    return visible;
  }

  return { layoutCityLabels: layoutCityLabels };
});
```

- [ ] **步骤 4：运行测试并确认通过**

运行：`node --test tests/map-label-layout.test.js`

预期：5 个测试全部 PASS，0 个失败。

- [ ] **步骤 5：提交纯布局算法**

```bash
git add map-label-layout.js tests/map-label-layout.test.js
git commit -m "feat: add collision-aware city label layout"
```

### 任务 2：把布局算法接入 SVG 地图

**文件：**
- 修改：`index.html:238-244`
- 修改：`script.js:60-66,507-617`
- 修改：`styles.css:490-516`
- 测试：`tests/map-label-layout.test.js`

- [ ] **步骤 1：补充重点城市稳定排序测试**

在 `tests/map-label-layout.test.js` 追加：

```js
test('多个重点标签重叠时按原始顺序稳定保留', () => {
  const visible = layoutCityLabels([
    { name: '先出现', x: 500, y: 360, priority: true, index: 0 },
    { name: '后出现', x: 501, y: 360, priority: true, index: 1 }
  ], baseView);
  assert.deepEqual([...visible], ['先出现']);
});
```

- [ ] **步骤 2：运行新增测试，记录当前布局模块行为**

运行：`node --test tests/map-label-layout.test.js`

预期：6 个测试全部 PASS；该测试锁定重点标签之间的稳定取舍规则，随后进行 DOM 集成。

- [ ] **步骤 3：在主脚本前加载布局模块**

在 `index.html` 的 `script.js` 之前加入：

```html
<script src="map-label-layout.js"></script>
<script src="script.js"></script>
```

- [ ] **步骤 4：为地图状态增加重点城市集合**

在 `script.js` 地图状态变量附近加入：

```js
let mapPriorityCities = new Set();
```

在 `renderChinaMap` 构建 SVG 之前更新：

```js
mapPriorityCities = new Set();
plans.forEach(function(plan) {
  plan.segments.forEach(function(segment) {
    if (segment.from) mapPriorityCities.add(segment.from);
    if (segment.to) mapPriorityCities.add(segment.to);
  });
});
visitedCities.forEach(function(city) { if (city.name) mapPriorityCities.add(city.name); });
(mapPhotos || []).forEach(function(photo) { if (photo.city) mapPriorityCities.add(photo.city); });
```

- [ ] **步骤 5：给市级 SVG 标签加入稳定元数据**

把 `cityLabel` 改为：

```js
function cityLabel(feature, index) {
  var p = centerFor(feature);
  var name = feature.properties.name || '';
  return '<text data-city="' + escapeHtml(name) + '" data-label-index="' + index +
    '" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '">' +
    escapeHtml(name) + '</text>';
}
```

- [ ] **步骤 6：在地图变换后执行碰撞布局**

在 `script.js` 增加并从 `applyMapView` 末尾调用：

```js
function updateCityLabelLayout() {
  if (!chinaMap || !window.MapLabelLayout) return;
  var labels = Array.from(chinaMap.querySelectorAll('.city-labels text'));
  var candidates = labels.map(function(label, index) {
    return {
      name: label.dataset.city || '',
      x: Number(label.getAttribute('x')),
      y: Number(label.getAttribute('y')),
      priority: mapPriorityCities.has(label.dataset.city || ''),
      index: Number(label.dataset.labelIndex || index)
    };
  });
  var visible = window.MapLabelLayout.layoutCityLabels(candidates, {
    scale: mapView.scale,
    x: mapView.x,
    y: mapView.y,
    width: 1000,
    height: 720
  });
  labels.forEach(function(label) {
    label.hidden = !visible.has(label.dataset.city || '');
  });
  var group = chinaMap.querySelector('.city-labels');
  if (group) {
    group.style.setProperty('--city-label-font-size', (12 / mapView.scale).toFixed(3) + 'px');
    group.style.setProperty('--city-label-stroke-width', (3 / mapView.scale).toFixed(3) + 'px');
  }
}
```

在 `applyMapView` 最后加入：

```js
updateCityLabelLayout();
```

- [ ] **步骤 7：让标签尺寸在屏幕上保持稳定**

更新 `styles.css`：

```css
.city-labels text {
  fill: #805064;
  font-size: var(--city-label-font-size, 4px);
  font-weight: 700;
  paint-order: stroke;
  stroke: rgba(255, 249, 247, 0.96);
  stroke-width: var(--city-label-stroke-width, 1px);
  stroke-linejoin: round;
  text-anchor: middle;
  pointer-events: none;
}

.city-labels text[hidden] {
  display: none;
}
```

- [ ] **步骤 8：运行自动化测试与静态检查**

运行：

```bash
node --test tests/map-label-layout.test.js
node --check map-label-layout.js
node --check script.js
git diff --check
```

预期：6 个测试全部 PASS；两个脚本语法检查退出码为 0；`git diff --check` 无输出。

- [ ] **步骤 9：提交地图集成**

```bash
git add index.html script.js styles.css tests/map-label-layout.test.js
git commit -m "fix: prevent city map label overlap"
```

### 任务 3：浏览器回归验证

**文件：**
- 验证：`index.html`
- 验证：`script.js`
- 验证：`styles.css`

- [ ] **步骤 1：启动或复用本地静态服务器**

运行：`python3 -m http.server 8000`

预期：网站可通过 `http://127.0.0.1:8000/` 访问。

- [ ] **步骤 2：刷新内置浏览器并进入市级详情**

刷新页面，滚动到“中国旅行足迹”，点击“放大地图”按钮至少 5 次，使地图缩放超过 3 倍。

预期：省级标签隐藏，市级标签出现；旅行路线与地图控制按钮仍正常。

- [ ] **步骤 3：在 3 倍、6 倍、10 倍检查标签矩形**

在每个缩放等级读取当前可见 `.city-labels text:not([hidden])` 的 `getBoundingClientRect()`，对所有矩形进行两两相交检查。

预期：明显重叠数量为 0；随着缩放增加，可见标签数量单调增加。

- [ ] **步骤 4：检查拖动后的重新布局**

拖动地图到东部密集区域，再次读取可见标签矩形。

预期：进入视口的城市重新显示，离开视口的城市隐藏，标签无明显重叠且没有随机闪烁。

- [ ] **步骤 5：检查桌面与窄屏布局**

分别使用默认视口和 390px 宽视口验证地图。

预期：两种视口下标签均可读、无明显重叠，地图侧栏与控制按钮没有回归。

- [ ] **步骤 6：完成前重新运行全部验证**

运行：

```bash
node --test tests/map-label-layout.test.js
node --check map-label-layout.js
node --check script.js
git diff --check
git status --short
```

预期：所有测试通过、语法检查退出码为 0、无空白错误；`git status --short` 只显示计划执行过程中明确产生且尚未提交的文件，正常情况下为空。
