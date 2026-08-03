const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'story-timeline-capsule.sql'), 'utf8');

test('迁移为记录增加城市、心情和照片字段', () => {
  assert.match(sql, /love_records[\s\S]*city\s+text/i);
  assert.match(sql, /love_records[\s\S]*moods\s+jsonb/i);
  assert.match(sql, /love_records[\s\S]*photos\s+jsonb/i);
});

test('迁移创建时间胶囊表和访问策略', () => {
  assert.match(sql, /create table if not exists public\.love_capsules/i);
  assert.match(sql, /unlock_date\s+date/i);
  assert.match(sql, /body\s+text/i);
  assert.match(sql, /photos\s+jsonb/i);
  assert.match(sql, /create policy[\s\S]*love_capsules/i);
});
