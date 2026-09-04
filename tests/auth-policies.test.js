const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sqlPath = path.join(__dirname, '..', 'supabase', 'authenticated-write-policies.sql');
const tables = ['love_plans', 'love_records', 'love_todos', 'love_photos', 'love_capsules'];
const operations = ['select', 'insert', 'update', 'delete'];

function statements(sql) {
  return sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map(statement => statement.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseCreatePolicy(statement) {
  const match = statement.match(
    /^create policy "([^"]+)" on public\.(love_[a-z_]+) for (select|insert|update|delete) to ([a-z, ]+) (using|with check)\b/i,
  );
  if (!match) return null;
  return {
    name: match[1],
    table: match[2].toLowerCase(),
    operation: match[3].toLowerCase(),
    roles: match[4].split(',').map(role => role.trim().toLowerCase()),
    statement,
  };
}

function parseDropPolicy(statement) {
  const match = statement.match(/^drop policy if exists "([^"]+)" on public\.(love_[a-z_]+)$/i);
  return match ? { name: match[1], table: match[2].toLowerCase() } : null;
}

function readSql() {
  assert.equal(fs.existsSync(sqlPath), true, 'missing authenticated write policy SQL');
  return fs.readFileSync(sqlPath, 'utf8');
}

function validateApplicationPolicies(sql) {
  const createStatements = statements(sql).filter(statement => /^create\s+policy\b/i.test(statement));
  const policies = createStatements.map(statement => {
    const policy = parseCreatePolicy(statement);
    assert.ok(policy, `unexpected or unsafe CREATE POLICY statement: ${statement}`);
    return policy;
  });
  assert.equal(policies.length, tables.length * operations.length);

  for (const table of tables) {
    for (const operation of operations) {
      const matches = policies.filter(policy => policy.table === table && policy.operation === operation);
      assert.equal(matches.length, 1, `${table} must have exactly one ${operation} policy`);

      const policy = matches[0];
      if (operation === 'select') {
        assert.deepEqual(policy.roles, ['anon', 'authenticated']);
        assert.match(policy.statement, / using \(true\)$/i);
      } else {
        assert.deepEqual(policy.roles, ['authenticated']);
        assert.doesNotMatch(policy.statement, /\bto\s+[^;]*\banon\b/i);
      }

      if (operation === 'insert') {
        assert.match(policy.statement, / with check \(true\)$/i);
        assert.doesNotMatch(policy.statement, /\busing\b/i);
      }
      if (operation === 'update') {
        assert.match(policy.statement, / using \(true\) with check \(true\)$/i);
      }
      if (operation === 'delete') {
        assert.match(policy.statement, / using \(true\)$/i);
        assert.doesNotMatch(policy.statement, /\bwith check\b/i);
      }
    }
  }
}

test('all application tables enable row level security', () => {
  const parsed = statements(readSql());
  for (const table of tables) {
    assert.ok(
      parsed.includes(`alter table public.${table} enable row level security`),
      `${table} must enable RLS`,
    );
  }
});

test('each table is public read and authenticated write only', () => {
  validateApplicationPolicies(readSql());
});

test('an extra anonymous all-operations policy is rejected', () => {
  const malicious = `${readSql()}\ncreate policy "evil public writes" on public.love_plans for all to anon using (true) with check (true);`;
  assert.throws(() => validateApplicationPolicies(malicious));
});

test('all repository legacy anonymous policies are explicitly removed', () => {
  const drops = statements(readSql()).map(parseDropPolicy).filter(Boolean);
  const actual = new Set(drops.map(drop => `${drop.table}:${drop.name}`));
  const legacySuffixes = {
    love_plans: 'plans',
    love_records: 'records',
    love_todos: 'todos',
    love_photos: 'photos',
  };

  for (const [table, suffix] of Object.entries(legacySuffixes)) {
    for (const policyVerb of ['read', 'insert', 'update', 'delete']) {
      assert.ok(actual.has(`${table}:public ${policyVerb} ${suffix}`));
    }
  }
  for (const policyVerb of ['read', 'insert', 'update', 'delete']) {
    assert.ok(actual.has(`love_capsules:Public ${policyVerb} love_capsules`));
  }
});

test('new policies are dropped before creation so the script is repeatable', () => {
  const parsed = statements(readSql());
  const creates = parsed.map(parseCreatePolicy).filter(Boolean);
  const drops = parsed.map(parseDropPolicy).filter(Boolean);
  const dropKeys = new Set(drops.map(drop => `${drop.table}:${drop.name}`));

  for (const policy of creates) {
    assert.ok(
      dropKeys.has(`${policy.table}:${policy.name}`),
      `${policy.name} must be dropped before recreation`,
    );
    assert.ok(
      parsed.findIndex(statement => statement === `drop policy if exists "${policy.name}" on public.${policy.table}`)
        < parsed.findIndex(statement => statement === policy.statement),
      `${policy.name} must be dropped before it is created`,
    );
  }
});

test('main policy script does not alter schema or Storage policies', () => {
  const parsed = statements(readSql());
  assert.equal(parsed.some(statement => /^create table\b/i.test(statement)), false);
  assert.equal(parsed.some(statement => /^alter table\b(?!.*enable row level security$)/i.test(statement)), false);
  assert.equal(parsed.some(statement => /\bstorage\.(objects|buckets)\b/i.test(statement)), false);
});
