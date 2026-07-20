# 高铁图标三条平行基线实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将高铁交通图标替换为已确认的 OpenMoji 改造版，并确保车顶、红色腰线和灰色底边三条横向基线完全平行。

**架构：** 保留现有 `transportVisuals`、`transportIcon()` 和 `routeTransportGlyph()` 接口，仅替换 `transportVisuals.高铁.icon` 的内嵌 SVG 内容。为三条水平路径添加稳定的 `data-baseline` 标识，集成测试通过 SVG 的水平 `H` 路径命令验证三条线均为 0°。

**技术栈：** 原生 JavaScript、内嵌 SVG、Node.js `node:test`

---

## 文件结构

- 修改：`tests/map-label-integration.test.js` — 增加高铁图标三条水平基线的回归测试。
- 修改：`script.js` — 替换高铁 SVG 路径，其他交通视觉配置不变。

### 任务 1：高铁图标三条平行基线

**文件：**
- 修改：`tests/map-label-integration.test.js`
- 修改：`script.js:13-18`

- [x] **步骤 1：编写失败的测试**

在 `tests/map-label-integration.test.js` 中加入：

```js
test('高铁图标的车顶腰线和底线保持水平平行', () => {
  const iconBlock = script.match(/高铁:\s*\{[\s\S]*?icon:\s*'([^']+)'/);
  assert.ok(iconBlock, '必须能读取高铁图标配置');
  ['roof', 'waist', 'base'].forEach((baseline) => {
    assert.match(
      iconBlock[1],
      new RegExp('data-baseline="' + baseline + '"[^>]*d="[^"]*H'),
      baseline + ' 必须使用水平路径命令'
    );
  });
});
```

- [x] **步骤 2：运行测试验证失败**

运行：`node --test tests/map-label-integration.test.js`

预期：FAIL，提示无法匹配 `data-baseline="roof"`，证明旧高铁图标没有三条可验证的水平基线。

- [x] **步骤 3：编写最少实现代码**

将 `transportVisuals.高铁.icon` 替换为 24 × 24 坐标空间内的 OpenMoji 改造路径：

```js
icon: '<g transform="scale(.333333)"><path data-baseline="roof" style="fill:#fff;stroke:#1f1f1f;stroke-width:2;stroke-linejoin:round" d="M68 48 6.22 47.5 5.09 43.54 36.85 24.2H68Z"/><path data-baseline="base" style="fill:#9b9b9a;stroke:#1f1f1f;stroke-width:2;stroke-linejoin:round" d="M68 48v5.5H12.65a1 1 0 0 1-.5-1.87L18.41 48Z"/><path style="fill:#3f3f3f" d="M68 36.5H41.84a1.286 1.286 0 0 1-.69-2.37l7.26-4.62a12.86 12.86 0 0 1 6.9-2.01H68ZM15.61 36.5h9.5a12.86 12.86 0 0 0 6.9-2.01l7.26-4.62a1.286 1.286 0 0 0-.69-2.37h-9.47Z"/><path data-baseline="waist" style="fill:#d22f27;stroke:#1f1f1f;stroke-width:1.7;stroke-linejoin:round" d="M18.64 44H67.93V40h-43.3a5.7 5.7 0 0 0-3.07.89l-3.23 2.06a.57.57 0 0 0 .31 1.05Z"/></g>'
```

三条标记路径分别包含水平 `H` 命令；车顶和底盘端点使用相同 y 坐标。不要修改其他五种交通图标。

- [x] **步骤 4：运行目标测试验证通过**

运行：`node --test tests/map-label-integration.test.js`

预期：该文件所有测试 PASS，0 failures。

- [x] **步骤 5：运行完整测试套件**

运行：`node --test tests/*.test.js`

预期：全部测试 PASS，0 failures。

- [x] **步骤 6：浏览器验收**

打开本地网站 `http://127.0.0.1:8000/?transport_icons=parallel#plans`，检查交通图标说明中的高铁图标以及已有路线上的高铁徽章。确认三条横线平行、图标可辨认、其他交通工具图标未变化。

- [x] **步骤 7：Commit**

```bash
git add script.js tests/map-label-integration.test.js docs/superpowers/plans/2026-07-21-high-speed-train-parallel-baselines.md
git commit -m "feat: refine high-speed train icon"
```
