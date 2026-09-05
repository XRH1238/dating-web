const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const oldSqlPath = path.join(__dirname, '..', 'supabase', 'secondary-storage-public-policies.sql');
const sqlPath = path.join(__dirname, '..', 'supabase', 'secondary-storage-gateway-policies.sql');

function statements(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseStorageDrop(statement) {
  const match = statement.match(/^drop policy if exists "([^"]+)" on storage\.objects$/i);
  return match ? match[1] : null;
}

test('旧的第二 Storage 公开策略脚本已删除', () => {
  assert.equal(fs.existsSync(oldSqlPath), false);
});

test('网关策略脚本撤销所有已知的公开读写删策略', () => {
  assert.equal(fs.existsSync(sqlPath), true, '缺少第二 Storage 网关策略 SQL');
  const drops = statements(fs.readFileSync(sqlPath, 'utf8')).map(parseStorageDrop).filter(Boolean);
  assert.deepEqual(drops.sort(), [
    'public delete love photos bucket',
    'public read love photos bucket',
    'public update love photos bucket',
    'public upload love photos bucket',
  ]);
});

test('网关策略脚本不创建任何浏览器角色策略', () => {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const parsed = statements(sql);
  assert.equal(parsed.some(statement => /^create\s+policy\b/i.test(statement)), false);
  assert.equal(parsed.some(statement => /\bto\s+(anon|authenticated)\b/i.test(statement)), false);
  assert.equal(parsed.some(statement => /\bfor\s+(select|insert|update|delete|all)\b/i.test(statement)), false);
});

test('网关策略脚本不改变 Bucket 的 Public 标记或其他 schema', () => {
  const parsed = statements(fs.readFileSync(sqlPath, 'utf8'));
  assert.equal(parsed.some(statement => /\bstorage\.buckets\b/i.test(statement)), false);
  assert.equal(parsed.some(statement => /\b(update|insert|delete)\s+(?:from\s+|into\s+)?storage\./i.test(statement)), false);
  assert.equal(parsed.every(statement => parseStorageDrop(statement) !== null), true);
});
