const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=name=>fs.readFileSync(__dirname+'/../'+name,'utf8');
test('信任需要主动勾选，密码回退与通行密钥入口共存',()=>{
 const html=read('index.html');assert.match(html,/name="trust_browser"/);assert.doesNotMatch(html,/<input[^>]*name="trust_browser"[^>]*checked/);
 assert.match(html,/id="auth-passkey-login"/);assert.match(html,/id="profile-passkey-add"/);assert.match(html,/autocomplete="current-password"/);
 const script=read('script.js');assert.match(script,/setTrusted\(fd\.get\("trust_browser"\)/);
});
test('本地与正式域名的凭据严格分开，页面加载不自动注册凭据',()=>{
 const file=__dirname+'/../auth-security.js';assert.ok(fs.existsSync(file));const js=read('auth-security.js');
 assert.match(js,/location\.origin/);assert.match(js,/registerPasskey/);assert.match(js,/addEventListener\('click'/);
 assert.doesNotMatch(js,/localStorage\.setItem|password.*store\(/);
});
