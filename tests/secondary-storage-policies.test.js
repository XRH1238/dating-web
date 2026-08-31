const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'secondary-storage-public-policies.sql');

function createPolicyStatements(sql) {
  return sql.split(';').map(statement => statement.trim()).filter(statement => /^create\s+policy/i.test(statement));
}

function assertOnlyExpectedPolicies(sql) {
  const policies = createPolicyStatements(sql);

  assert.equal(policies.length, 3);
  assert.deepEqual(policies.map(policy => policy.match(/for\s+(select|insert|delete)/i)[1].toLowerCase()).sort(), [
    'delete',
    'insert',
    'select',
  ]);
  policies.forEach(policy => {
    assert.match(policy, /on\s+storage\.objects\s+for\s+(select|insert|delete)/i);
    assert.match(policy, /to\s+anon\s*,\s*authenticated/i);
    assert.match(policy, /bucket_id\s*=\s*'love-photos'/i);
    assert.doesNotMatch(policy, /for\s+(all|update)/i);
    assert.doesNotMatch(policy, /bucket_id\s*(?:!=|<>|=)\s*'(?!love-photos')/i);
  });
  assert.match(policies.find(policy => /for\s+insert/i.test(policy)), /with\s+check\s*\(\s*bucket_id\s*=\s*'love-photos'\s*\)/i);
  policies.filter(policy => /for\s+(select|delete)/i.test(policy)).forEach(policy => {
    assert.match(policy, /using\s*\(\s*bucket_id\s*=\s*'love-photos'\s*\)/i);
  });
  assert.doesNotMatch(sql, /for\s+update/i);
  assert.doesNotMatch(sql, /public\.love_/i);
}

test('第二个 Storage 策略仅公开 love-photos 的读取、上传和删除', () => {
  assert.equal(fs.existsSync(sqlPath), true, '缺少第二个 Storage 策略 SQL');
  assertOnlyExpectedPolicies(fs.readFileSync(sqlPath, 'utf8'));
});

test('额外的全表公开策略会被拒绝', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8') + "\ncreate policy evil on storage.objects for all using (true) with check (true);";
  assert.throws(() => assertOnlyExpectedPolicies(sql));
});

test('第二个 Storage 策略可重复执行且明确限制公开角色', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  assert.equal((sql.match(/drop policy if exists/gi) || []).length, 3);
  assert.equal((sql.match(/to\s+anon\s*,\s*authenticated/gi) || []).length, 3);
});
