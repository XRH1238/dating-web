(function(win){
  'use strict';
  var binding=null;
  function bind(options){
    var client=options.client,store=options.storage,doc=win.document;
    var login=doc.querySelector('#auth-passkey-login'),add=doc.querySelector('#profile-passkey-add'),list=doc.querySelector('#profile-passkey-list');
    var loginStatus=doc.querySelector('#auth-passkey-status'),profileStatus=doc.querySelector('#profile-security-status');
    var loginTrust=doc.querySelector('[name="trust_browser"]'),profileTrust=doc.querySelector('#profile-trust-browser');
    var settings=null,checking=null,busy=false;
    var production=win.location.origin===doc.body.dataset.passkeyOrigin;
    function message(error){
      if(error&&(/NotAllowedError|AbortError/.test(error.name)))return '未完成设备验证，你仍可使用密码登录。';
      if(error&&error.name==='SecurityError')return '请在正式网站使用通行密钥，或改用密码登录。';
      if(error&&error.status===401)return '登录已失效，请先重新登录。';
      return '通行密钥暂时不可用，请使用密码登录后重试。';
    }
    function availability(){
      if(!production)return '请在正式网站设置和使用通行密钥；本地预览可使用密码登录。';
      if(!settings)return '暂时无法检查通行密钥，请使用密码登录。';
      if(!settings.supported)return '此浏览器暂不支持通行密钥，请使用密码登录。';
      if(!settings.enabled)return '通行密钥尚未启用，当前仍可使用密码登录。';
      return '可使用面容、指纹或设备解锁；验证方式由设备决定。';
    }
    function updateButtons(){var available=production&&settings&&settings.supported&&settings.enabled;login.disabled=busy||!available;add.disabled=busy||!available;}
    async function check(){
      if(settings)return settings;if(checking)return checking;
      checking=client.getPasskeyStatus().then(function(result){settings=result;return result;}).catch(function(){return null;}).finally(function(){checking=null;});
      return checking;
    }
    async function loadList(){
      list.replaceChildren();
      if(!production||!settings||!settings.enabled||doc.body.dataset.authenticated!=='true')return;
      try{
        var rows=await client.listPasskeys();
        if(doc.body.dataset.authenticated!=='true')return;
        (Array.isArray(rows)?rows:[]).forEach(function(row){
          var item=doc.createElement('li'),name=doc.createElement('span'),remove=doc.createElement('button');
          name.textContent=row.friendly_name||'通行密钥';remove.type='button';remove.textContent='移除';remove.className='auth-link-button';remove.setAttribute('aria-label','移除'+name.textContent);
          remove.addEventListener('click',async function(){
            if(!win.confirm('移除此通行密钥？之后可使用密码或其他通行密钥登录。'))return;
            remove.disabled=true;try{await client.deletePasskey(row.id);await loadList();profileStatus.textContent='已移除通行密钥。';}catch(error){profileStatus.textContent=message(error);remove.disabled=false;}
          });item.append(name,remove);list.append(item);
        });
        if(!list.children.length){var empty=doc.createElement('li');empty.textContent='还没有设置通行密钥。';list.append(empty);}
      }catch(error){profileStatus.textContent=message(error);}
    }
    async function refresh(){
      loginTrust.checked=!!(store&&store.isTrusted());profileTrust.checked=loginTrust.checked;
      await check();updateButtons();loginStatus.textContent=availability();profileStatus.textContent=availability();
      if(doc.querySelector('#profile-dialog').open)await loadList();
    }
    profileTrust.addEventListener('change',function(){
      var trusted=store&&store.setTrusted(profileTrust.checked);profileTrust.checked=!!trusted;loginTrust.checked=!!trusted;
      profileStatus.textContent=profileTrust.checked?'已信任此浏览器，会保持登录。':'仅在当前标签页保持登录。';
    });
    login.addEventListener('click',async function(){
      if(busy||login.disabled)return;busy=true;updateButtons();loginStatus.textContent='请在设备提示中完成验证…';
      if(store)store.setTrusted(loginTrust.checked);
      try{await client.signInWithPasskey();doc.querySelector('#auth-dialog').close();doc.querySelector('#auth-login-form').reset();}
      catch(error){loginStatus.textContent=message(error);}finally{busy=false;updateButtons();}
    });
    add.addEventListener('click',async function(){
      if(busy||add.disabled)return;busy=true;updateButtons();profileStatus.textContent='请在设备提示中创建通行密钥…';
      try{await client.registerPasskey();await loadList();profileStatus.textContent='通行密钥已添加。下次可使用设备解锁登录。';}
      catch(error){profileStatus.textContent=message(error);}finally{busy=false;updateButtons();}
    });
    client.onAuthStateChange(function(event){if(event==='SIGNED_OUT'){list.replaceChildren();profileStatus.textContent='请先登录。';}});
    win.addEventListener('storage',function(event){if(store&&store.isTrusted()&&event.key==='dating-web:auth:v1')client.syncFromStorage();});
    function renew(){if(!doc.hidden)client.getSession().catch(function(){/* Existing status handling supplies a recoverable notice. */});}
    var timer=win.setInterval(renew,30000);doc.addEventListener('visibilitychange',renew);win.addEventListener('online',renew);win.addEventListener('focus',renew);
    win.addEventListener('pagehide',function(){win.clearInterval(timer);doc.removeEventListener('visibilitychange',renew);win.removeEventListener('online',renew);win.removeEventListener('focus',renew);});
    binding={refresh:refresh};refresh();return binding;
  }
  win.AuthSecurity={bind:bind,refresh:function(){return binding&&binding.refresh();}};
})(window);
