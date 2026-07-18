# 出游日期、路线与行政区标签实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 统一计划和记录的起止日期，修复计划路线不刷新，并让地图只显示可定位的正式行政区全称。

**架构：** 在 `map-label-layout.js` 中增加不依赖 DOM 的日期与行政区规范化函数，主脚本使用这些函数构建地图索引、解析路线和格式化日期。行政区索引从 GeoJSON 按六位编码筛选，地图标签与路线共享同一正式名称和坐标来源。

**技术栈：** 原生 HTML/CSS/JavaScript、SVG、Node.js 内置测试运行器、Supabase 现有表。

---

## 文件职责

- `map-label-layout.js`：日期范围解析/格式化、行政区编码筛选、正式名称补全、城市索引与名称解析。
- `script.js`：表单提交、路线规范化、地图重绘与图例渲染。
- `index.html`：开始日期与结束日期原生输入。
- `styles.css`：日期字段布局和校验提示样式。
- `tests/map-label-layout.test.js`：纯函数单元测试。
- `tests/map-label-integration.test.js`：表单和地图刷新回归测试。

### 任务 1：日期范围纯函数

**文件：**
- 修改：`map-label-layout.js`
- 测试：`tests/map-label-layout.test.js`

- [ ] **步骤 1：编写失败测试**

```js
test('日期范围统一存储和显示', () => {
  assert.equal(serializeDateRange('2026-08-06', '2026-08-08'), '2026-08-06/2026-08-08');
  assert.equal(formatDateRange('2026-08-06/2026-08-08'), '2026.08.06 — 2026.08.08');
  assert.equal(formatDateRange('2026.08.06'), '2026.08.06');
  assert.throws(() => serializeDateRange('2026-08-08', '2026-08-06'));
});
```

- [ ] **步骤 2：运行测试并确认因函数不存在而失败**

运行：`node --test tests/map-label-layout.test.js`

- [ ] **步骤 3：实现日期纯函数并导出**

实现 `serializeDateRange(start, end)`、`parseDateRange(value)` 和 `formatDateRange(value)`；新格式使用 `YYYY-MM-DD/YYYY-MM-DD`，旧单日期按单日处理，无法解析的旧文字原样返回。

- [ ] **步骤 4：运行单元测试并确认通过**

运行：`node --test tests/map-label-layout.test.js`

### 任务 2：正式行政区索引

**文件：**
- 修改：`map-label-layout.js`
- 测试：`tests/map-label-layout.test.js`

- [ ] **步骤 1：编写失败测试**

```js
test('正式行政区索引排除保护区并接受简称', () => {
  const index = buildAdministrativeCityIndex(fixtures);
  assert.equal(index.entries.length, 337);
  assert.equal(resolveAdministrativeCity(index, '厦门').name, '厦门市');
  assert.equal(resolveAdministrativeCity(index, '马鞍山市').name, '马鞍山市');
  assert.equal(resolveAdministrativeCity(index, '太子山天然林保护'), null);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`node --test tests/map-label-layout.test.js`

- [ ] **步骤 3：实现编码筛选、正式名称补全、别名和索引构建**

只接收行政区划编码末四位不是 `0000` 且末两位是 `00` 的地级记录；排除 `629700`、`629800`、`629900`；补全 `市`、`自治州`、`地区`、`盟` 后缀，并额外加入北京、天津、上海、重庆四个直辖市。索引项保存 `{ code, name, aliases, coordinates, feature }`。

- [ ] **步骤 4：运行单元测试并确认 333 个地级单位、337 个市级视图名称全部唯一**

运行：`node --test tests/map-label-layout.test.js`

### 任务 3：统一日期表单和列表显示

**文件：**
- 修改：`index.html`
- 修改：`styles.css`
- 修改：`script.js`
- 测试：`tests/map-label-integration.test.js`

- [ ] **步骤 1：添加失败的集成断言**

```js
assert.match(html, /name="start_date"[^>]*type="date"/);
assert.match(html, /name="end_date"[^>]*type="date"/);
assert.match(script, /serializeDateRange/);
assert.match(script, /formatDateRange/);
```

- [ ] **步骤 2：运行集成测试并确认失败**

运行：`node --test tests/map-label-integration.test.js`

- [ ] **步骤 3：替换表单日期输入并接入共享函数**

将单个自由文本输入改为两个必填 `date` 输入；开始日期变化时更新结束日期的 `min`；提交时序列化为现有 `date` 字段；计划卡片和记录时间轴统一调用 `formatDateRange`。

- [ ] **步骤 4：补充日期字段的响应式双列样式**

桌面端并排，窄屏堆叠；沿用现有输入样式和焦点状态。

- [ ] **步骤 5：运行日期单元与集成测试**

运行：`node --test tests/map-label-layout.test.js tests/map-label-integration.test.js`

### 任务 4：修复路线刷新并使用完整城市索引

**文件：**
- 修改：`script.js`
- 测试：`tests/map-label-integration.test.js`

- [ ] **步骤 1：添加地图回归断言**

```js
assert.doesNotMatch(script, /if \(!mapEl \|\| !overlay \|\| !legend\) return/);
assert.match(script, /buildAdministrativeCityIndex/);
assert.match(script, /resolveAdministrativeCity/);
```

- [ ] **步骤 2：运行集成测试并确认旧实现失败**

运行：`node --test tests/map-label-integration.test.js`

- [ ] **步骤 3：移除 overlay 前置依赖并建立地图城市索引**

`renderFootprintMap` 仅要求地图容器和图例存在。首次取得 GeoJSON 后建立索引；路线、照片和重点标签都通过同一个解析函数获得正式名称与坐标。

- [ ] **步骤 4：让地图几何只为有效行政区生成市级标签**

保护区、马场、县级单位不生成文字；省名和市名使用正式全称；路线图例和城市标记也使用解析后的正式全称。

- [ ] **步骤 5：运行全部自动化测试**

运行：`node --test tests/*.test.js`

### 任务 5：浏览器验收

**文件：**
- 不修改文件。

- [ ] **步骤 1：刷新 `http://127.0.0.1:8000/` 并检查控制台无错误**

- [ ] **步骤 2：确认计划和记录表单都有开始/结束日期，且结束日期不能早于开始日期**

- [ ] **步骤 3：新增包含“厦门”或其他非硬编码城市的路线，确认保存后地图立即出现路线并显示正式全称**

- [ ] **步骤 4：放大地图，确认“太子山天然林保护”等名称不出现，“马鞍山市”等正式全称存在且标签不重叠**

- [ ] **步骤 5：保持内置浏览器停留在最终页面，供用户继续标注反馈**
