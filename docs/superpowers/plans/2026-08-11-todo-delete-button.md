# 想做的事删除按钮实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为每条“想做的事”增加带确认提示的圆形垃圾桶按钮，并安全同步本地与 Supabase 数据。

**架构：** 在现有 `script.js` 的 todos 模块中增加 `deleteTodo(index)`，沿用 `confirmAction` 与云端客户端的 `remove` 方法。列表渲染继续使用完整数组索引，在每行新增独立操作区，样式由 `styles.css` 中专用类控制。

**技术栈：** 原生 HTML/CSS/JavaScript、Supabase REST 云端客户端、Node.js 内置测试运行器。

---

## 文件结构

- 修改：`script.js` — 删除行为、按钮渲染、事件绑定和分页收敛。
- 修改：`styles.css` — 两按钮操作区、圆形垃圾桶及响应式状态。
- 创建：`tests/todo-delete.test.js` — 删除渲染、确认顺序、云端失败保护和事件索引测试。
- 修改：`tests/home-layout.test.js` — 更新每行网格结构的样式约束。

### 任务 1：定义安全删除行为

**文件：**
- 创建：`tests/todo-delete.test.js`
- 修改：`script.js:697-726`

- [ ] **步骤 1：编写失败的删除行为测试**

```js
test('想做的事删除前确认且云端失败时保留事项', () => {
  const deletion = script.match(/async function deleteTodo\(index\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(deletion, /await confirmAction\("确定删除这件想做的事吗？删除后无法恢复。"\)/);
  assert.ok(deletion.indexOf('confirmAction') < deletion.indexOf('state.client.remove'));
  assert.match(deletion, /catch\s*\(_\)\s*\{[\s\S]*?setCloudStatus\("offline"\);[\s\S]*?return;/);
  assert.ok(deletion.indexOf('state.client.remove') < deletion.indexOf('state.todos.splice'));
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`node --test tests/todo-delete.test.js`

预期：FAIL，无法找到 `deleteTodo` 函数。

- [ ] **步骤 3：实现最小删除函数**

```js
async function deleteTodo(index) {
  var todo = state.todos[index];
  if (!todo || !(await confirmAction("确定删除这件想做的事吗？删除后无法恢复。"))) return;
  if (state.backendReady && todo.id) {
    try {
      await state.client.remove(tables.todos, todo.id);
    } catch (_) {
      setCloudStatus("offline");
      return;
    }
  }
  state.todos.splice(index, 1);
  renderAll();
}
```

- [ ] **步骤 4：运行删除行为测试并确认通过**

运行：`node --test tests/todo-delete.test.js`

预期：PASS。

- [ ] **步骤 5：提交行为实现**

```bash
git add script.js tests/todo-delete.test.js
git commit -m "feat: safely delete todo items"
```

### 任务 2：渲染垃圾桶并绑定正确索引

**文件：**
- 修改：`script.js:868-914`
- 修改：`tests/todo-delete.test.js`

- [ ] **步骤 1：编写失败的渲染与索引测试**

```js
test('每条事项渲染完成按钮和带名称的垃圾桶按钮', () => {
  const render = script.match(/function renderTodos\(\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(render, /class="todo-actions"/);
  assert.match(render, /data-delete-todo="/);
  assert.match(render, /aria-label="删除想做的事：/);
  assert.match(render, /assets\/icons\/trash\.svg/);
  assert.match(render, /deleteTodo\(parseInt\(btn\.dataset\.deleteTodo\)\)/);
  assert.match(render, /entry\.index/);
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：`node --test tests/todo-delete.test.js`

预期：FAIL，缺少 `todo-actions` 和 `data-delete-todo`。

- [ ] **步骤 3：更新列表行标记与事件绑定**

```js
return '<div class="todo-row' + (t.done ? ' done' : '') + '"><span>' + escapeHtml(t.text) +
  '</span><span class="todo-actions"><button class="todo-toggle" type="button" aria-label="' + action + '：' +
  escapeHtml(t.text) + '" data-toggle-todo="' + entry.index + '">' + (t.done ? '✓' : '') +
  '</button><button class="todo-delete" type="button" aria-label="删除想做的事：' + escapeHtml(t.text) +
  '" data-delete-todo="' + entry.index + '"><img src="assets/icons/trash.svg" alt="" /></button></span></div>';
```

并增加：

```js
list.querySelectorAll("[data-delete-todo]").forEach(function(btn) {
  btn.addEventListener("click", function() { deleteTodo(parseInt(btn.dataset.deleteTodo)); });
});
```

- [ ] **步骤 4：运行测试并确认通过**

运行：`node --test tests/todo-delete.test.js`

预期：PASS。

- [ ] **步骤 5：提交渲染实现**

```bash
git add script.js tests/todo-delete.test.js
git commit -m "feat: render todo delete controls"
```

### 任务 3：完成样式、回归与发布验收

**文件：**
- 修改：`styles.css:1214-1267`
- 修改：`tests/home-layout.test.js`
- 修改：`tests/todo-delete.test.js`

- [ ] **步骤 1：编写失败的样式测试**

```js
test('愿望操作区与圆形垃圾桶拥有独立状态', () => {
  assert.match(css, /\.todo-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+76px/s);
  assert.match(css, /\.todo-actions\s*\{[^}]*display:\s*flex[^}]*gap:\s*10px/s);
  assert.match(css, /\.todo-delete\s*\{[^}]*border-radius:\s*50%/s);
  assert.match(css, /\.todo-delete img/);
  assert.match(css, /\.todo-delete:hover,[\s\S]*?\.todo-delete:focus-visible/);
});
```

- [ ] **步骤 2：运行样式测试并确认失败**

运行：`node --test tests/home-layout.test.js tests/todo-delete.test.js`

预期：FAIL，缺少操作区与垃圾桶样式。

- [ ] **步骤 3：实现专用样式**

```css
.todo-row {
  grid-template-columns: minmax(0, 1fr) 76px;
}

.todo-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

.todo-toggle,
.todo-delete {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border-radius: 50%;
}

.todo-delete {
  border: 1px solid rgba(217, 95, 120, 0.3);
  color: var(--rose);
  background: rgba(255, 247, 248, 0.9);
}

.todo-delete img {
  width: 15px;
  height: 15px;
}

.todo-toggle {
  border: 1px solid rgba(117, 104, 114, 0.7);
  color: var(--muted);
  background: transparent;
  font: inherit;
  font-weight: 800;
}

.todo-row.done .todo-toggle {
  color: #fff;
  background: var(--rose);
  border-color: var(--rose);
}

.todo-toggle:hover,
.todo-toggle:focus-visible,
.todo-delete:hover,
.todo-delete:focus-visible {
  border-color: var(--rose);
  color: var(--rose-dark);
  outline: 2px solid rgba(217, 95, 120, 0.2);
  outline-offset: 2px;
}
```

- [ ] **步骤 4：运行目标测试和完整测试**

运行：`node --test tests/home-layout.test.js tests/todo-delete.test.js`

预期：目标测试全部 PASS。

运行：`node --test tests/*.test.js`

预期：全部测试 PASS，0 个失败。

- [ ] **步骤 5：执行语法和差异检查**

运行：`node --check script.js`

预期：退出码 0。

运行：`git diff --check`

预期：退出码 0。

- [ ] **步骤 6：提交样式与测试**

```bash
git add styles.css tests/home-layout.test.js tests/todo-delete.test.js
git commit -m "style: add todo delete button"
```

- [ ] **步骤 7：本地和线上安全验收**

本地内置浏览器检查：每条事项显示两个按钮；点击垃圾桶出现确认提示；点击取消后事项仍存在；控制台无错误。

发布 GitHub Pages 后再次执行相同检查。线上验收只取消确认提示，不实际删除用户数据。
