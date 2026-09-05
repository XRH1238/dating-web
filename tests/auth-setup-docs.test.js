const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(root, 'SUPABASE_SETUP.md'), 'utf8');
const section = (heading) => {
  const start = doc.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `missing runbook section: ${heading}`);
  const end = doc.indexOf('\n## ', start + 3);
  return doc.slice(start, end < 0 ? undefined : end);
};

test('runbook distinguishes one business database from Storage-only projects', () => {
  const architecture = section('架构与边界');
  for (const word of ['ueqlgutndwkfuffzkcxo', 'msrbqgorhjbzxomexzap', 'Auth', 'Database', 'Edge Function', '不是两个业务数据库', '不迁移', 'Public']) {
    assert.ok(architecture.includes(word), word);
  }
});

test('runbook explains manual accounts, closed signup and recovery redirects', () => {
  const accounts = section('账号与密码恢复');
  for (const word of ['Authentication', 'Users', 'Create user', '多个账号', 'Allow new users to sign up', '关闭', '确认', '密码', 'Site URL', 'Redirect URLs', 'recovery']) {
    assert.ok(accounts.includes(word), word);
  }
  assert.ok(accounts.includes('https://xrh1238.github.io/dating-web/'));
  assert.ok(accounts.includes('http://127.0.0.1:4173/'));
  assert.ok(accounts.includes('http://localhost:4173/'));
});

test('gateway secret example is parseable, placeholder-only and matches adapter keys', () => {
  const gateway = section('网关配置');
  const json = gateway.match(/```json\s*([\s\S]*?)```/);
  assert.ok(json, 'missing JSON example');
  const config = JSON.parse(json[1]);
  assert.deepEqual(Object.keys(config), ['secondary']);
  assert.equal(config.secondary.url, 'https://msrbqgorhjbzxomexzap.supabase.co');
  assert.equal(config.secondary.bucket, 'love-photos');
  assert.equal(config.secondary.secretKey, '<SECONDARY_SB_SECRET_KEY>');
  for (const word of ['STORAGE_BACKENDS_JSON', 'verify_jwt = false', 'getUser', 'publishable', 'anon', 'service_role', 'sb_secret_', '前端', 'Git']) assert.ok(gateway.includes(word), word);
  assert.doesNotMatch(doc, /sb_secret_[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
});

test('deployment orders verification and frontend before tightening both projects', () => {
  const deployment = section('安全部署顺序');
  const steps = ['账号与 Auth URL', '配置并部署网关', '验证网关', '部署前端', '主数据库策略', '第二 Storage 策略', '最终验收'];
  let previous = -1;
  for (const step of steps) {
    const index = deployment.indexOf(step);
    assert.ok(index > previous, `${step} must follow previous step`);
    previous = index;
  }
  assert.match(deployment, /supabase functions deploy storage-gateway --project-ref ueqlgutndwkfuffzkcxo/);
  assert.ok(deployment.includes('sign-upload'));
  assert.ok(deployment.includes('delete'));
});

test('SQL instructions identify exact project targets and existing policy audit', () => {
  const sql = section('SQL 执行位置');
  for (const file of ['authenticated-write-policies.sql', 'secondary-storage-gateway-policies.sql']) {
    assert.ok(sql.includes(file));
    assert.ok(fs.existsSync(path.join(root, 'supabase', file)));
  }
  assert.match(sql, /ueqlgutndwkfuffzkcxo[^\n]*authenticated-write-policies\.sql/);
  assert.match(sql, /msrbqgorhjbzxomexzap[^\n]*secondary-storage-gateway-policies\.sql/);
  assert.ok(sql.includes('不要'));
  assert.ok(sql.includes('pg_policies'));
  assert.doesNotMatch(doc, /secondary-storage-public-policies\.sql/);
  const executableSql = [...doc.matchAll(/```sql\s*([\s\S]*?)```/g)].map(match => match[1]).join('\n');
  assert.doesNotMatch(executableSql, /create\s+policy[\s\S]*?for\s+(insert|update|delete|all)\b/i);
});

test('runbook includes non-destructive rollback and does not claim deployment occurred', () => {
  const rollback = section('回滚与失败处理');
  for (const word of ['回滚', '匿名', '不删除', '旧 URL', '重新选择', '未在线上执行']) assert.ok(rollback.includes(word), word);
});

test('runbook provides reproducible tests and troubleshooting', () => {
  const verification = section('验证与故障排查');
  for (const word of ['node --test tests/*.test.js', 'node --test tests/auth-setup-docs.test.js', '0 failed', '401', '403', 'CORS', '重置链接', 'Gallery', 'Record', 'Capsule', 'Live Photo', 'pending']) assert.ok(verification.includes(word), word);
});
