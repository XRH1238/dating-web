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
