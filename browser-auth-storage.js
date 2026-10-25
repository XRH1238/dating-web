(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BrowserAuthStorage=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function create(options){
    options=options||{};
    var persistent=options.persistent,temporary=options.temporary,key='dating-web:auth:v1',preference=key+':trusted',memory=null;
    function read(store,k){try{return store&&store.getItem(k);}catch(_){return null;}}
    function write(store,k,v){try{if(!store)return false;store.setItem(k,v);return store.getItem(k)===v;}catch(_){return false;}}
    function remove(store,k){try{if(store)store.removeItem(k);}catch(_){}}
    var initialPreference=read(persistent,preference),trusted=initialPreference==='true';
    // Older versions persisted automatically. Move their session to tab storage until explicitly trusted.
    if(!trusted&&read(persistent,key)){
      if(initialPreference===null){memory=read(persistent,key);write(temporary,key,memory);}
      remove(persistent,key);write(persistent,preference,'false');
    }
    return {
      getItem:function(k){return k===key?(trusted?read(persistent,k):(read(temporary,k)||memory)):null;},
      setItem:function(k,v){if(k!==key)return;memory=String(v);if(!write(trusted?persistent:temporary,k,memory)&&trusted){trusted=false;write(persistent,preference,'false');write(temporary,k,memory);}},
      removeItem:function(k){if(k!==key)return;memory=null;remove(persistent,key);remove(temporary,key);write(persistent,preference,'false');trusted=false;},
      isTrusted:function(){return trusted;},
      setTrusted:function(value){var current=read(trusted?persistent:temporary,key)||memory;
        trusted=!!value&&write(persistent,preference,'true');
        if(!trusted)write(persistent,preference,'false');
        if(current){memory=current;if(!write(trusted?persistent:temporary,key,current)&&trusted){trusted=false;write(persistent,preference,'false');write(temporary,key,current);}}
        remove(trusted?temporary:persistent,key);
        return trusted;
      }
    };
  }
  return {create:create};
});
