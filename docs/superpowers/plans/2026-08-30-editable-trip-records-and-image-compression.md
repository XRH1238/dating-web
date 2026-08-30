# 可编辑出游记录与高质量图片压缩实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让云端出游记录可安全编辑和增删照片，并在所有上传入口对普通大图进行高质量浏览器端压缩。

**架构：** 新建独立 `image-compression.js` 负责纯尺寸决策和浏览器 Canvas 压缩；`script.js` 维护单一记录编辑状态并复用现有记录表单；`cloud-data-client.js` 增加 Storage 删除接口，以“先更新记录、后删除旧文件”的顺序保证旧记录不被中途破坏。

**技术栈：** 原生 JavaScript、Supabase REST/Storage API、Node.js `node:test`、静态 HTML/CSS、GitHub Pages。

---

## 文件结构

- 创建 `image-compression.js`：图片压缩策略、尺寸计算、文件重命名、Canvas 压缩与失败回退。
- 创建 `tests/image-compression.test.js`：图片压缩模块的单元测试。
- 修改 `cloud-data-client.js`：增加按对象路径删除 Storage 文件的方法。
- 修改 `tests/data-persistence.test.js`：覆盖 Storage 删除请求。
- 修改 `index.html`：加载压缩模块、增加记录提交按钮标识并更新静态资源版本。
- 修改 `script.js`：上传压缩、记录编辑状态、照片预览移除、保存和回滚流程。
- 修改 `styles.css`：记录卡片操作区和可移除媒体预览样式。
- 修改 `tests/story-records-integration.test.js`：覆盖记录编辑入口、按 ID 更新和照片一致性顺序。
- 修改 `tests/media-upload-integration.test.js`：覆盖三个上传入口使用压缩模块。

### 任务 1：普通图片高质量压缩模块

**文件：**
- 创建：`image-compression.js`
- 创建：`tests/image-compression.test.js`

- [x] **步骤 1：编写失败的尺寸与结果选择测试**

```js
test('最长边限制为 3200 且不放大小图', () => {
  assert.deepEqual(ImageCompression.targetDimensions(6000, 4000, 3200), { width: 3200, height: 2133 });
  assert.deepEqual(ImageCompression.targetDimensions(1200, 800, 3200), { width: 1200, height: 800 });
});

test('压缩文件不更小时保留原文件', () => {
  const original = { size: 1000 };
  assert.equal(ImageCompression.preferSmaller(original, { size: 1200 }), original);
});
```

- [x] **步骤 2：运行测试并确认因模块不存在而失败**

运行：`node --test tests/image-compression.test.js`
预期：FAIL，`Cannot find module '../image-compression.js'`。

- [x] **步骤 3：实现纯函数和浏览器压缩入口**

```js
function targetDimensions(width, height, maxEdge) {
  var scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function preferSmaller(original, compressed) {
  return compressed && compressed.size < original.size ? compressed : original;
}

async function compressFile(file, options) {
  options = options || {};
  try {
    var bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    var size = targetDimensions(bitmap.width, bitmap.height, options.maxEdge || 3200);
    var canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, size.width, size.height);
    var blob = await new Promise(function(resolve) { canvas.toBlob(resolve, 'image/webp', options.quality || 0.88); });
    var candidate = new File([blob], webpName(file.name), { type: 'image/webp' });
    return { file: preferSmaller(file, candidate), warning: '' };
  } catch (_) {
    return { file: file, warning: '这张照片无法压缩，已保留原文件。' };
  }
}
```

- [x] **步骤 4：运行单元测试确认通过**

运行：`node --test tests/image-compression.test.js`
预期：全部通过，0 failed。

- [x] **步骤 5：提交任务 1**

```bash
git add image-compression.js tests/image-compression.test.js
git commit -m "feat: add high-quality image compression (task 1/4)"
```

### 任务 2：Storage 删除能力和上传压缩接入

**文件：**
- 修改：`cloud-data-client.js`
- 修改：`script.js`
- 修改：`index.html`
- 修改：`tests/data-persistence.test.js`
- 修改：`tests/media-upload-integration.test.js`

- [x] **步骤 1：编写失败的 Storage 删除与上传压缩测试**

```js
test('Storage 文件可以按路径删除', async () => {
  await client.removeObjects('love-photos', ['records/a.webp']);
  assert.equal(calls[0].url, 'https://example.test/storage/v1/object/love-photos');
  assert.equal(calls[0].options.method, 'DELETE');
});

test('普通图片上传前经过压缩而实况照片保持原文件', () => {
  assert.match(script, /ImageCompression\.compressFile/);
  assert.match(script, /item\.kind\s*!==\s*["']live-photo["']/);
});
```

- [x] **步骤 2：运行测试确认新能力缺失而失败**

运行：`node --test tests/data-persistence.test.js tests/media-upload-integration.test.js`
预期：至少一个断言失败，指出 `removeObjects` 或 `ImageCompression.compressFile` 缺失。

- [x] **步骤 3：实现删除请求和压缩上传**

```js
removeObjects: async function(bucket, paths) {
  var response = await timedRequest(baseUrl + '/storage/v1/object/' + safeSegment(bucket), {
    method: 'DELETE',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ prefixes: paths }),
  });
  return parse(response);
}
```

在 `uploadMediaItem` 中只压缩 `kind === 'image'` 的文件，将实际上传大小写入状态提示；相册、记录和胶囊继续共用这个上传函数。

- [x] **步骤 4：运行目标测试确认通过**

运行：`node --test tests/data-persistence.test.js tests/media-upload-integration.test.js tests/image-compression.test.js`
预期：全部通过，0 failed。

- [x] **步骤 5：提交任务 2**

```bash
git add cloud-data-client.js script.js index.html tests/data-persistence.test.js tests/media-upload-integration.test.js
git commit -m "feat: compress new photo uploads (task 2/4)"
```

### 任务 3：出游记录完整编辑与照片增删

**文件：**
- 修改：`index.html`
- 修改：`script.js`
- 修改：`styles.css`
- 修改：`tests/story-records-integration.test.js`

- [x] **步骤 1：编写失败的编辑流程测试**

```js
test('记录卡片提供编辑入口并按记录 ID 更新', () => {
  assert.match(script, /data-edit-record-id/);
  assert.match(script, /function openRecordEditor/);
  assert.match(script, /state\.client\.update\(tables\.records,\s*editingRecordId/);
});

test('记录更新成功后才删除被移除的旧照片', () => {
  const submit = script.match(/async function submitRecordForm[\s\S]*?\n\}/)[0];
  assert.ok(submit.indexOf('state.client.update') < submit.indexOf('removeRecordMedia'));
});
```

- [x] **步骤 2：运行记录测试并确认编辑能力缺失而失败**

运行：`node --test tests/story-records-integration.test.js`
预期：FAIL，编辑入口或更新调用断言失败。

- [x] **步骤 3：实现编辑状态、回填、预览移除和保存顺序**

```js
let editingRecordId = null;
let recordExistingPhotos = [];
let recordRemovedPhotos = [];

function openRecordEditor(recordId) {
  var record = state.records.find(function(item) { return String(item.id) === String(recordId); });
  if (!record) return;
  editingRecordId = record.id;
  recordExistingPhotos = (record.photos || []).slice();
  recordRemovedPhotos = [];
  recordForm.elements.city.value = record.city || '';
  recordForm.elements.title.value = record.title || '';
  recordForm.elements.description.value = record.description || '';
  restoreMoodOptions(record.moods || []);
  restoreRecordDateRange(record.date);
  setRecordFormMode('edit');
  renderRecordMediaPreview();
  openPanelById(recordPanel);
}
```

新增照片与保留照片合计不得超过 20 项；保存失败时清理本次新上传对象并保留表单；更新成功后再删除旧对象并重新拉取记录。

- [x] **步骤 4：运行记录与相关回归测试确认通过**

运行：`node --test tests/story-records-integration.test.js tests/record-recovery.test.js tests/story-data.test.js tests/live-photo-integration.test.js`
预期：全部通过，0 failed。

- [x] **步骤 5：提交任务 3**

```bash
git add index.html script.js styles.css tests/story-records-integration.test.js
git commit -m "feat: edit trip records and photos (task 3/4)"
```

### 任务 4：完整回归、浏览器验收和发布

**文件：**
- 修改：`index.html`（将本次变更涉及的脚本和样式查询版本统一更新为 `20260830-6`）
- 修改：`docs/superpowers/plans/2026-08-30-editable-trip-records-and-image-compression.md`（勾选步骤）

- [x] **步骤 1：运行完整自动化测试**

运行：`node --test tests/*.test.js`
预期：全部测试通过，0 failed。

- [x] **步骤 2：执行静态检查**

运行：`git diff --check && node --check script.js && node --check image-compression.js && node --check cloud-data-client.js`
预期：退出码 0，无输出。

- [ ] **步骤 3：在本地浏览器验收**

打开 `http://127.0.0.1:4174/#records`，使用页面注入的测试态记录验证：编辑入口可见、字段回填、删除旧预览、添加新预览、取消不改变卡片、保存按钮防重复提交；再打开一张照片验证缩放、缩小和拖动。不得向真实 Supabase 写入测试数据。

执行说明：内置浏览器的 URL 安全策略阻止自动控制本机地址，因此不绕过限制；推送后在 HTTPS 线上页面执行等价的只读交互验收，不点击“保存修改”，不改变真实记录。

- [x] **步骤 4：提交最终计划状态并推送**

```bash
git add docs/superpowers/plans/2026-08-30-editable-trip-records-and-image-compression.md index.html
git commit -m "chore: verify editable trip records (task 4/4)"
git push origin master
```

- [x] **步骤 5：检查 GitHub Pages 部署状态**

打开 `https://xrh1238.github.io/dating-web/#records`，确认新资源版本已部署。线上 HTML 已确认引用 `20260830-6` 版本资源；内置浏览器自动交互连续两次超时，因此没有把“编辑按钮可见、高清查看器可缩放和拖动”记为自动浏览器验收通过。对应行为由完整自动化测试覆盖，页面已交给用户进行最终可视检查，且未创建或修改真实记录。
