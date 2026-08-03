const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('时间胶囊接入云端加载、保存、更新和删除', () => {
  assert.match(script, /love_capsules/);
  assert.match(script, /fetchCapsules/);
  assert.match(script, /saveCapsule/);
  assert.match(script, /update\(tables\.capsules/);
  assert.match(script, /remove\(tables\.capsules/);
});

test('胶囊渲染使用公开视图隐藏未解锁正文', () => {
  assert.match(script, /StoryData\.toPublicCapsule/);
  assert.match(script, /remainingDays/);
  assert.match(script, /data-edit-capsule/);
});

test('胶囊表尚未迁移时不让其他云端数据进入离线模式', () => {
  assert.match(script, /var capsuleResult = await Promise\.allSettled/);
  assert.match(script, /var coreResults = await Promise\.allSettled/);
  assert.match(script, /failed = coreResults\.some/);
});
