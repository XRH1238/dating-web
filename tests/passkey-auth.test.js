const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=fs.existsSync(__dirname+'/../passkey-auth.js')?require('../passkey-auth.js'):{};
function fixture(overrides){const calls=[];const credential={id:'credential',rawId:new Uint8Array([1,2]).buffer,type:'public-key',response:{clientDataJSON:new Uint8Array([3]).buffer,authenticatorData:new Uint8Array([4]).buffer,signature:new Uint8Array([5]).buffer,userHandle:null},getClientExtensionResults:()=>({})};let count=0;
const opts={secure:true,PublicKeyCredential:function(){},credentials:{get:async({publicKey})=>{assert.ok(publicKey.challenge instanceof ArrayBuffer);return credential;},create:async()=>credential},token:async()=> 'user-jwt',isCurrent:()=>true,request:async(path,options)=>{calls.push({path,options});if(path.endsWith('/settings'))return{passkeys_enabled:true};if(path.endsWith('/options'))return{challenge_id:'challenge-'+(++count),options:{challenge:'AQI',user:{id:'AQI'},rp:{id:'example.com'}}};if(path.endsWith('/verify'))return{access_token:'new',refresh_token:'new-r',expires_in:3600,user:{id:'u1'}};return[];}};
return {options:Object.assign(opts,overrides||{}),calls};}
test('通行密钥验证使用新挑战和服务端会话，序列化二进制签名',async()=>{
 assert.equal(typeof api.create,'function');const f=fixture(),client=api.create(f.options);const result=await client.signIn();await client.signIn();assert.equal(result.access_token,'new');
 const verify=f.calls.filter(c=>c.path.endsWith('/verify'));assert.deepEqual(verify.map(v=>JSON.parse(v.options.body).challenge_id),['challenge-1','challenge-2']);assert.equal(JSON.parse(verify[0].options.body).credential.response.signature,'BQ');
});
test('取消或账号切换中止验证，不建立会话也不提交验证结果',async()=>{
 assert.equal(typeof api.create,'function');const f=fixture({credentials:{get:async()=>{const e=Error('cancel');e.name='NotAllowedError';throw e;}}});await assert.rejects(()=>api.create(f.options).signIn(),e=>e.name==='NotAllowedError');assert.equal(f.calls.length,1);
 const stale=fixture({isCurrent:()=>false});await assert.rejects(()=>api.create(stale.options).signIn(),/过期/);assert.equal(stale.calls.filter(c=>c.path.endsWith('/verify')).length,0);
});
test('不支持的浏览器不发认证请求，settings 只读取真实开关',async()=>{
 assert.equal(typeof api.create,'function');const f=fixture({secure:false});const client=api.create(f.options);assert.equal(client.supported(),false);await assert.rejects(()=>client.signIn(),/不支持/);assert.equal(f.calls.length,0);
 const enabled=fixture();assert.equal(await api.create(enabled.options).enabled(),true);
});
test('只有登录会话能管理通行密钥，凭据ID不能逃逸请求路径',async()=>{
 assert.equal(typeof api.create,'function');const f=fixture(),client=api.create(f.options);await client.list();assert.equal(f.calls[0].options.headers.Authorization,'Bearer user-jwt');await assert.rejects(()=>client.remove('../bad'),/无效/);
 const noUser=fixture({token:async()=>null});await assert.rejects(()=>api.create(noUser.options).register(),/登录/);
});

test('注册与删除使用用户认证，缺失挑战不唤起设备，空的删除响应可正常结束',async()=>{
 const f=fixture({credentials:{create:async({publicKey})=>({id:'new',rawId:new Uint8Array([1]).buffer,type:'public-key',response:{clientDataJSON:new Uint8Array([2]).buffer,attestationObject:new Uint8Array([3]).buffer,getTransports:()=>['internal']},getClientExtensionResults:()=>({})})}});
 const client=api.create(f.options);await client.register();const verification=f.calls.find(c=>c.path.endsWith('registration/verify'));assert.equal(verification.options.headers.Authorization,'Bearer user-jwt');assert.deepEqual(JSON.parse(verification.options.body).credential.response.transports,['internal']);
 await client.remove('valid-id');assert.equal(f.calls.at(-1).options.method,'DELETE');
 const invalid=fixture({request:async()=>({})});await assert.rejects(()=>api.create(invalid.options).signIn(),/挑战无效/);
});
