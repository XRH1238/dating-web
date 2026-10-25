(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PasskeyAuth=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function decode(value){var text=String(value).replace(/-/g,'+').replace(/_/g,'/');text+='='.repeat((4-text.length%4)%4);var bytes=atob(text),out=new Uint8Array(bytes.length);for(var i=0;i<bytes.length;i++)out[i]=bytes.charCodeAt(i);return out.buffer;}
  function encode(buffer){var bytes=new Uint8Array(buffer),s='';for(var i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function parseOptions(options,registration,Type){
    var nativeParser=Type&&(registration?Type.parseCreationOptionsFromJSON:Type.parseRequestOptionsFromJSON);
    if(nativeParser)return nativeParser.call(Type,options);
    var result=Object.assign({},options,{challenge:decode(options.challenge)});
    if(registration)result.user=Object.assign({},options.user,{id:decode(options.user.id)});
    ['allowCredentials','excludeCredentials'].forEach(function(key){if(options[key])result[key]=options[key].map(function(item){return Object.assign({},item,{id:decode(item.id)});});});
    return result;
  }
  function serialize(credential){
    if(typeof credential.toJSON==='function')return credential.toJSON();
    var response={},source=credential.response;
    ['clientDataJSON','attestationObject','authenticatorData','signature','userHandle'].forEach(function(key){if(source[key]!=null)response[key]=encode(source[key]);});
    if(typeof source.getTransports==='function')response.transports=source.getTransports();
    var result={id:credential.id,rawId:encode(credential.rawId),type:credential.type,response:response,clientExtensionResults:credential.getClientExtensionResults?credential.getClientExtensionResults():{}};
    if(credential.authenticatorAttachment)result.authenticatorAttachment=credential.authenticatorAttachment;
    return result;
  }
  function create(options){
    var pending=null;
    function supported(){return !!(options.secure&&options.PublicKeyCredential&&options.credentials);}
    function current(){if(options.isCurrent&&!options.isCurrent())throw new Error('认证操作已过期');}
    async function headers(){var token=await options.token();if(!token)throw new Error('请先登录');current();return{Authorization:'Bearer '+token};}
    async function ceremony(registration){
      if(!supported())throw new Error('此浏览器不支持通行密钥，请使用密码登录。');
      if(pending)pending.abort();pending=typeof AbortController!=='undefined'?new AbortController():null;
      var controller=pending,h=registration?await headers():{};
      var route='/auth/v1/passkeys/'+(registration?'registration':'authentication');
      var challenge=await options.request(route+'/options',{method:'POST',headers:h,body:JSON.stringify(registration?{}:{gotrue_meta_security:{}})});
      if(!challenge||!challenge.challenge_id||!challenge.options)throw new Error('通行密钥挑战无效');current();
      var credential=await options.credentials[registration?'create':'get']({publicKey:parseOptions(challenge.options,registration,options.PublicKeyCredential),signal:controller?controller.signal:undefined});
      current();if(!credential)throw new Error('未完成通行密钥验证');
      return options.request(route+'/verify',{method:'POST',headers:registration?await headers():{},body:JSON.stringify({challenge_id:challenge.challenge_id,credential:serialize(credential)})});
    }
    return {supported:supported,enabled:async function(){var status=await options.request('/auth/v1/settings',{method:'GET'});return !!(status&&status.passkeys_enabled===true);},
      signIn:function(){return ceremony(false);},register:function(){return ceremony(true);},
      list:async function(){return options.request('/auth/v1/passkeys',{method:'GET',headers:await headers()});},
      remove:async function(id){if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))throw new Error('通行密钥标识无效');return options.request('/auth/v1/passkeys/'+id,{method:'DELETE',headers:await headers()});},
      cancel:function(){if(pending)pending.abort();pending=null;}};
  }
  return {create:create};
});
