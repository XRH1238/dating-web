const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const store=fs.existsSync(__dirname+'/../browser-auth-storage.js')?require('../browser-auth-storage.js'):{};
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('不信任浏览器时只在本标签保留会话，信任后才持久化，退出删除两处凭据',()=>{
 assert.equal(typeof store.create,'function');const persistent=memory(),temporary=memory(),s=store.create({persistent,temporary});
 s.setItem('dating-web:auth:v1','session');assert.equal(persistent.getItem('dating-web:auth:v1'),null);assert.equal(temporary.getItem('dating-web:auth:v1'),'session');
 s.setTrusted(true);assert.equal(persistent.getItem('dating-web:auth:v1'),'session');assert.equal(temporary.getItem('dating-web:auth:v1'),null);
 const restored=store.create({persistent,temporary:memory()});assert.equal(restored.getItem('dating-web:auth:v1'),'session');
 restored.removeItem('dating-web:auth:v1');assert.equal(persistent.getItem('dating-web:auth:v1'),null);assert.equal(restored.isTrusted(),false);
});
test('存储不可用时仍可在当前页面登录，不假报信任已保存',()=>{
 assert.equal(typeof store.create,'function');const broken={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 const s=store.create({persistent:broken,temporary:broken});s.setTrusted(true);s.setItem('dating-web:auth:v1','memory-only');assert.equal(s.getItem('dating-web:auth:v1'),'memory-only');assert.equal(s.isTrusted(),false);
});

test('明确不信任后，旧标签重写的遗留会话不能让新标签自动登录',()=>{
 const persistent=memory();persistent.setItem('dating-web:auth:v1:trusted','false');persistent.setItem('dating-web:auth:v1','legacy-rewritten');
 const fresh=store.create({persistent,temporary:memory()});assert.equal(fresh.getItem('dating-web:auth:v1'),null);
});
