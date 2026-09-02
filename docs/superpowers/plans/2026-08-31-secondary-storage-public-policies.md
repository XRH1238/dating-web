# 第二个 Supabase Storage 临时公开策略实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 让第二个 Supabase 的 `love-photos` 暂时拥有与第一个 Storage 相同的公开读取、上传和删除能力，并保留下一阶段通过登录鉴权收紧权限的明确记录。

**架构：** 新增一份仅在第二个 Supabase 执行的幂等 SQL，针对 `storage.objects` 和 `love-photos` 创建 `SELECT`、`INSERT`、`DELETE` 三项公开策略。应用代码和数据库路由保持不变；用静态测试约束 SQL 范围，再用唯一命名临时对象验证线上上传与删除。

**技术栈：** PostgreSQL RLS、Supabase Storage、Node.js `node:test`、现有原生 JavaScript 客户端、GitHub Pull Request。

---

## 文件结构

- 创建：`supabase/secondary-storage-public-policies.sql` — 第二个 Supabase Storage 的幂等临时公开策略。
- 创建：`tests/secondary-storage-policies.test.js` — 约束 Bucket、操作类型、角色与禁止项。
- 修改：`SUPABASE_SETUP.md` — 标明该 SQL 只能在第二个 Supabase 执行，并记录鉴权后的收紧要求。
- 修改：当前 PR 描述 — 记录文件、测试结果、线上验证结果与临时安全风险。

### 任务 1：用测试锁定第二个 Storage 策略

**文件：**
- 创建：`tests/secondary-storage-policies.test.js`
- 测试：`tests/secondary-storage-policies.test.js`

- [ ] **步骤 1：编写失败的 SQL 约束测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'secondary-storage-public-policies.sql');

test('第二个 Storage 策略仅公开 love-photos 的读取、上传和删除', () => {
  assert.equal(fs.existsSync(sqlPath), true, '缺少第二个 Storage 策略 SQL');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  assert.match(sql, /for\s+select[\s\S]*bucket_id\s*=\s*'love-photos'/i);
  assert.match(sql, /for\s+insert[\s\S]*bucket_id\s*=\s*'love-photos'/i);
  assert.match(sql, /for\s+delete[\s\S]*bucket_id\s*=\s*'love-photos'/i);
  assert.doesNotMatch(sql, /for\s+update/i);
  assert.doesNotMatch(sql, /public\.love_/i);
});

test('第二个 Storage 策略可重复执行且明确限制公开角色', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.equal((sql.match(/drop policy if exists/gi) || []).length, 3);
  assert.equal((sql.match(/to\s+anon\s*,\s*authenticated/gi) || []).length, 3);
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/secondary-storage-policies.test.js
```

预期：FAIL，提示“缺少第二个 Storage 策略 SQL”。

- [ ] **步骤 3：提交测试红灯**

```bash
git add tests/secondary-storage-policies.test.js
git commit -m "test: define secondary storage policies"
```

### 任务 2：新增幂等 Storage policy SQL

**文件：**
- 创建：`supabase/secondary-storage-public-policies.sql`
- 测试：`tests/secondary-storage-policies.test.js`

- [ ] **步骤 1：创建最小 SQL 实现**

```sql
-- 仅在第二个 Supabase 项目 msrbqgorhjbzxomexzap 的 SQL Editor 中执行。
-- 临时与第一个 Storage 保持一致；登录鉴权完成后必须收紧匿名权限。

drop policy if exists "public read love photos bucket" on storage.objects;
drop policy if exists "public upload love photos bucket" on storage.objects;
drop policy if exists "public delete love photos bucket" on storage.objects;

create policy "public read love photos bucket"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'love-photos');

create policy "public upload love photos bucket"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'love-photos');

create policy "public delete love photos bucket"
on storage.objects for delete
to anon, authenticated
using (bucket_id = 'love-photos');
```

- [ ] **步骤 2：运行定向测试确认通过**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/secondary-storage-policies.test.js
```

预期：2 项测试全部 PASS。

- [ ] **步骤 3：提交 SQL 实现**

```bash
git add supabase/secondary-storage-public-policies.sql
git commit -m "feat: add secondary storage public policies"
```

### 任务 3：补充第二个项目的执行说明

**文件：**
- 修改：`SUPABASE_SETUP.md`
- 测试：`tests/secondary-storage-policies.test.js`

- [ ] **步骤 1：增加项目边界说明**

在 `SUPABASE_SETUP.md` 的 Storage 策略段落后增加：

```markdown
## 第二个 Supabase Storage

双 Supabase 分支启用后，只在第二个项目 `msrbqgorhjbzxomexzap` 的 SQL Editor 执行
[`supabase/secondary-storage-public-policies.sql`](supabase/secondary-storage-public-policies.sql)。
它让 `love-photos` 暂时允许匿名读取、上传和删除；不要在主 Supabase 重复执行。

这是登录鉴权上线前的临时策略。鉴权完成后，必须同时收紧两个 Supabase 项目的匿名写入和删除权限。
```

- [ ] **步骤 2：运行策略测试和差异检查**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/secondary-storage-policies.test.js
git diff --check
```

预期：2 项测试全部 PASS；`git diff --check` 无输出。

- [ ] **步骤 3：提交说明**

```bash
git add SUPABASE_SETUP.md
git commit -m "docs: explain secondary storage policies"
```

### 任务 4：完整本地验证

**文件：**
- 验证：`cloud-data-client.js`
- 验证：`script.js`
- 验证：`tests/*.test.js`

- [ ] **步骤 1：运行完整测试套件**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/*.test.js
```

预期：全部测试 PASS，失败数为 0。

- [ ] **步骤 2：检查语法、差异和路由不变量**

运行：

```bash
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check cloud-data-client.js
/Users/xie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --check script.js
git diff --check origin/master...HEAD
git diff --stat origin/master...HEAD
```

预期：语法检查和差异检查通过；业务代码没有因本任务发生额外修改。

### 任务 5：应用并验证第二个 Supabase 策略

**文件：**
- 执行：`supabase/secondary-storage-public-policies.sql`

- [ ] **步骤 1：在第二个项目核对目标**

打开 Supabase Dashboard，确认项目引用为 `msrbqgorhjbzxomexzap`，Bucket 为 Public 的 `love-photos`。不得在主项目 `ueqlgutndwkfuffzkcxo` 执行。

- [ ] **步骤 2：执行已审查 SQL**

在第二个项目的 SQL Editor 粘贴并运行 `supabase/secondary-storage-public-policies.sql` 全文。预期执行成功，Storage Policies 中出现公开读取、上传和删除三项策略。

- [ ] **步骤 3：上传唯一命名的临时对象**

使用第二个项目的 publishable key，向下列路径上传内容为 `secondary-storage-policy-check` 的 `text/plain` 对象：

```text
love-photos/codex-verification/secondary-storage-policy-check-<UTC时间戳>.txt
```

预期：Storage API 返回 2xx；公开 URL可读取相同内容。

- [ ] **步骤 4：只删除本次临时对象**

调用现有 Storage 批量删除接口，`prefixes` 只包含步骤 3 记录的完整路径。预期返回 2xx；随后公开 URL 返回 404 或对象不存在。

- [ ] **步骤 5：确认未触碰现有对象**

在 Dashboard 中确认 `codex-verification` 下不存在本次临时文件。不得列举、移动或删除其他目录中的现有媒体。

### 任务 6：更新分支和 Pull Request

**文件：**
- 修改：Pull Request #1 描述

- [ ] **步骤 1：确认工作树和提交历史**

运行：

```bash
git status --short --branch
git log --oneline origin/master..HEAD
```

预期：工作树干净，新增设计、计划、测试、SQL 和说明提交均位于 `feature/secondary-supabase-storage`。

- [ ] **步骤 2：推送功能分支**

```bash
git push origin feature/secondary-supabase-storage
```

预期：远端分支更新成功，不修改 `master`。

- [ ] **步骤 3：更新 PR #1 描述**

在原文件与测试结果之外补充：

```markdown
- 新增 `supabase/secondary-storage-public-policies.sql`，让第二个 `love-photos` 临时允许匿名 SELECT / INSERT / DELETE。
- 新增 `tests/secondary-storage-policies.test.js`，约束策略只作用于该 Bucket，且不开放 UPDATE。
- 更新 `SUPABASE_SETUP.md`，明确 SQL 只能在第二个项目执行。
- 完整测试：按 Node test runner 的实际输出记录通过项数，并确认 0 项失败。
- 线上验证：唯一临时对象上传、公开读取、删除均成功，临时对象已清理。
- 安全说明：这是登录鉴权上线前的临时公开策略；下一步会同时收紧两个 Supabase 的匿名写入和删除权限。
```

- [ ] **步骤 4：打开页面供用户检查**

在 Codex 内置浏览器打开本地站点和 PR #1，确认页面 UI 未变化，并把 PR 链接交给用户。
