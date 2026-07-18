# 交通工具特色图标实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 6 种交通方式提供轮廓、主题色和可访问名称均不同的 SVG 图标，并统一应用到地图徽章、路线图例和备用地图。

**架构：** 在 `script.js` 中用单一 `transportVisual` 配置返回规范化名称、颜色和 SVG；所有渲染入口只消费该配置。路线线条继续使用计划颜色，徽章与图例图标使用交通方式主题色。

**技术栈：** 原生 JavaScript、SVG、CSS、Node.js 内置测试运行器。

---

## 文件职责

- `script.js`：交通方式视觉配置、SVG 输出及所有使用位置的样式变量。
- `styles.css`：地图徽章、图例图标和路线摘要的共享视觉样式。
- `tests/map-label-integration.test.js`：6 种图标唯一性、颜色映射和各渲染入口共享配置的回归测试。

### 任务 1：共享交通方式视觉配置

**文件：**
- 修改：`script.js`
- 测试：`tests/map-label-integration.test.js`

- [ ] **步骤 1：编写失败测试**

```js
test('六种交通方式拥有不同图标标识和主题色', () => {
  ['高铁', '飞机', '自驾', '火车', '轮船', '其他'].forEach((name) => {
    assert.match(script, new RegExp(name + ":\\s*\\{\\s*color:"));
    assert.match(script, new RegExp('data-transport-icon="' + name + '"'));
  });
});

test('未知交通方式回退到其他配置', () => {
  assert.match(script, /transportVisual\(transport\)/);
  assert.match(script, /transportVisuals\[normalizeTransport\(transport\)\]/);
});
```

- [ ] **步骤 2：运行测试并确认因共享配置不存在而失败**

运行：`/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/map-label-integration.test.js`

- [ ] **步骤 3：实现 `transportVisuals` 和 `transportVisual`**

配置高铁 `#4E7FB3`、飞机 `#6D62B5`、自驾 `#C06F4C`、火车 `#7D5A49`、轮船 `#3F8C8C`、其他 `#8B6C91`。每个 SVG 使用 `viewBox="0 0 24 24"`、`aria-hidden="true"`、`data-transport-icon` 和独立路径；高铁使用侧面尖车头，火车使用正面车灯与短铁轨。

- [ ] **步骤 4：运行集成测试并确认通过**

运行：`/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/map-label-integration.test.js`

### 任务 2：统一地图徽章与图例样式

**文件：**
- 修改：`script.js`
- 修改：`styles.css`
- 测试：`tests/map-label-integration.test.js`

- [ ] **步骤 1：编写失败测试**

```js
test('地图徽章图例和备用地图共享交通方式颜色', () => {
  assert.match(script, /--transport-color:/);
  assert.match(script, /transportVisual\(s\.transport\)/);
  assert.match(script, /transportVisual\(seg\.transport\)/);
  assert.match(styles, /var\(--transport-color\)/);
});
```

- [ ] **步骤 2：运行测试并确认旧实现仍使用路线色或固定玫红色而失败**

运行：`/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/map-label-integration.test.js`

- [ ] **步骤 3：接入三个渲染入口**

SVG 地图路线组写入 `--transport-color`，徽章圆使用该变量；图例图标容器写入同一变量并保留文字；备用高德地图徽章背景使用 `transportVisual(seg.transport).color`。路线线条的 `--route-color` 保持不变。

- [ ] **步骤 4：补充共享 CSS**

地图徽章使用白色图标和交通色背景；图例使用 `color-mix` 生成浅色底板、交通色图标和圆角边框；窄屏保持 22 像素图标尺寸，不改变路线文字换行。

- [ ] **步骤 5：运行全部自动化测试**

运行：`/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js`

### 任务 3：内置浏览器验收

**文件：**
- 不修改文件。

- [ ] **步骤 1：刷新 `http://127.0.0.1:8000/#plans` 并确认新版脚本已加载**

- [ ] **步骤 2：在测试数据中渲染 6 种交通方式，确认每个徽章颜色与轮廓不同**

- [ ] **步骤 3：确认高铁侧面车头与火车正面车头不会混淆**

- [ ] **步骤 4：确认现有路线图例文字、地图缩放、行政区标签和路线动画未回归**

- [ ] **步骤 5：复位地图并将实际网站标签页作为 handoff 保留**
