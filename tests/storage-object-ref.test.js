const test = require('node:test');
const assert = require('node:assert/strict');

let StorageObjectRef = {};
try {
  StorageObjectRef = require('../storage-object-ref.js');
} catch (_) {
  // The first TDD run intentionally reaches this branch before implementation.
}

const options = {
  primaryUrl: 'https://primary.supabase.co',
  secondaryUrl: 'https://secondary.supabase.co',
  bucket: 'love-photos',
};

test('标准 Supabase Public URL 映射到对应后端和安全路径', () => {
  assert.deepEqual(StorageObjectRef.parsePublicObjectUrl(
    'https://primary.supabase.co/storage/v1/object/public/love-photos/%E5%8E%A6%E9%97%A8/%E6%97%A5%E8%90%BD.jpg',
    options,
  ), { backend: 'primary', path: '厦门/日落.jpg' });
  assert.deepEqual(StorageObjectRef.parsePublicObjectUrl(
    'https://secondary.supabase.co/storage/v1/object/public/love-photos/unplaced/new.jpg',
    options,
  ), { backend: 'secondary', path: 'unplaced/new.jpg' });
});

test('Live Photo 同时收集静态图和 MOV 并按后端去重', () => {
  assert.deepEqual(StorageObjectRef.collectMediaTargets({
    url: 'https://primary.supabase.co/storage/v1/object/public/love-photos/records/a.jpg',
    motion_url: 'https://secondary.supabase.co/storage/v1/object/public/love-photos/records/a.mov',
  }, options), {
    primary: ['records/a.jpg'],
    secondary: ['records/a.mov'],
    unresolved: false,
  });
});

test('外部地址、错误 Bucket 和编码逃逸路径不会被解析为可删除文件', () => {
  for (const url of [
    'https://example.com/storage/v1/object/public/love-photos/records/a.jpg',
    'https://primary.supabase.co/storage/v1/object/public/other/records/a.jpg',
    'https://primary.supabase.co/storage/v1/object/public/love-photos/records/%2Fsecret.jpg',
    'https://primary.supabase.co/storage/v1/object/public/love-photos/records/%2e%2e/secret.jpg',
    'data:image/jpeg;base64,AA',
  ]) {
    assert.equal(StorageObjectRef.parsePublicObjectUrl(url, options), null, url);
  }
  assert.equal(StorageObjectRef.collectMediaTargets({ url: 'https://example.com/a.jpg' }, options).unresolved, true);
});
