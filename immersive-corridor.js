(function(root,factory){
  var base=typeof module==='object'&&module.exports?require('./travel-corridor.js'):root.TravelCorridor;
  var api=factory(root,base);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TravelCorridor=api;
})(typeof window!=='undefined'?window:globalThis,function(root,base){
  'use strict';
  function clamp(value){return Math.min(1,Math.max(0,value));}
  var depthStep=1500;
  function smooth(value){var t=clamp(value);return t*t*(3-2*t);}
  function pairProgress(pair,count){
    var last=Math.max(0,Math.ceil(count/2)-1);
    return .18+.82*Math.min(last,Math.max(0,pair))/(last+.65);
  }
  function frameAt(progress,width,height,count){
    var p=clamp(progress),opening=smooth(p/.18),small=width<701;
    var last=Math.max(0,Math.ceil(count/2)-1);
    var travel=clamp((p-.18)/.82)*(last+.65),group=Math.floor(travel),phase=travel-group;
    // Positive speed everywhere: slow near each composition, flowing between them.
    var position=group+phase-.45*Math.sin(2*Math.PI*phase)/(2*Math.PI);
    return {sx:(small?.94:.9)+(small?.06:.1)*opening,sy:.7+.3*opening,
      y:(small?64:72)*(1-opening),radius:22*(1-opening),
      introAlpha:1-clamp(p/.1),introY:-40*clamp(p/.12),
      camera:position*depthStep,pair:Math.min(last,Math.round(position))};
  }
  function planeAt(index,width,height,ratio){
    var small=width<701,side=index%2?1:-1,pair=Math.floor(index/2);
    var unit=small?.73:1,h=height||720,aspect=ratio||4/3;
    var photoWidth=Math.min(small?width*(index%2?.43:.50):Math.min(index%2?390:540,width*(index%2?.33:.42)),h*.62*aspect);
    var stagger=pair%2?-.15:.055;
    return {x:side*width*(small?.25:.27),y:(index%2?-1:1)*h*stagger,
      z:-(pair*depthStep+(index%2?300:360))*unit,width:photoWidth,
      rotationY:side*-10,focal:small?800:1100,unit:unit};
  }
  function visibilityAt(index,camera,width){
    var relative=camera-Math.floor(index/2)*depthStep;
    return smooth((relative+depthStep*4.2)/(depthStep*1.6))*(1-smooth((relative-depthStep*.65)/(depthStep*.20)));
  }
  function cardAt(index,camera,width){
    var relative=camera-Math.floor(index/2)*depthStep,side=index%2?1:-1;
    return {x:side*width*.16*smooth((relative/depthStep-.08)/.65),alpha:visibilityAt(index,camera,width)};
  }
  function inFrustum(plane,travel,camera,width,height,ratio){
    var angle=plane.rotationY*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
    var left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(var ix=-1;ix<=1;ix+=2)for(var iy=-1;iy<=1;iy+=2){
      var x=ix*plane.width/2,y=iy*(plane.width/ratio/2+32);
      var denominator=plane.focal-(plane.z+camera*plane.unit-x*sin);
      if(denominator<=0)return false;
      var scale=plane.focal/denominator;
      var px=width/2+(plane.x+travel.x+x*cos)*scale,py=height/2+(plane.y+y)*scale;
      left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
    }
    // A generous margin covers the small mouse tilt and captions.
    return right>-96&&left<width+96&&bottom>-96&&top<height+96;
  }
  function choosePhotos(photos,records,selection,count){
    // Visually reviewed landscape/architecture frames. Media stay in the existing private gateway.
    var scenes=[
      ['IMG_5503.jpeg','抬头时，刚好是晚霞'],['IMG_3640.jpeg','梧桐树下的光'],
      ['IMG_3651.jpeg','晚风里的城市'],['IMG_3648.jpeg','夜色里的城门'],
      ['IMG_3747.jpeg','车窗外，云慢慢经过'],['IMG_3633.jpeg','绿意里的中山陵'],
      ['IMG_5600.jpeg','夜归的车站'],['IMG_3654.jpeg','阳光下的城市'],
      ['IMG_3656.jpeg','路过的一面花墙'],['IMG_3627.jpeg','古寺的一角'],
      ['IMG_5506.jpeg','晚霞的另一面'],['IMG_3746.jpeg','出发前，抬头看看']
    ];
    var pool=(Array.isArray(photos)?photos:[]).slice();
    (Array.isArray(records)?records:[]).forEach(function(record){
      var media=record.photos;if(typeof media==='string'){try{media=JSON.parse(media);}catch(_){media=[];}}
      if(Array.isArray(media))pool.push.apply(pool,media);
    });
    var all=base.entries(pool,records,[]),used=new Set(),result=[];
    scenes.forEach(function(scene){
      var entry=all.find(function(candidate){return candidate.media.name===scene[0]&&!used.has(candidate.media.url);});
      if(!entry)return;used.add(entry.media.url);entry.caption=scene[1];result.push(entry);
    });
    return result.slice(0,count||20);
  }

  function create(section,options,rootOverride){
    var win=rootOverride||root,doc=section.ownerDocument,g=win.gsap;
    var stage=section.querySelector('.d-stage'),frame=section.querySelector('.d-frame');
    var space=section.querySelector('.d-space'),world=section.querySelector('.d-world');
    var intro=section.querySelector('.d-intro'),status=section.querySelector('#corridor-status');
    var stars=win.TravelStars?win.TravelStars.create(frame,win):null;
    var starToggle=section.querySelector('[data-d-stars]');
    if(starToggle&&stars)starToggle.addEventListener('click',function(){var active=stars.toggle();starToggle.setAttribute('aria-label',active?'暂停星尘动画':'开启星尘动画');starToggle.setAttribute('aria-pressed',String(!active));starToggle.title=active?'暂停星尘':'开启星尘';});
    var label=section.querySelector('.d-count'),fill=section.querySelector('.d-progress-fill');
    var toggle=section.querySelector('[data-d-mode]'),dialog=doc.querySelector('#corridor-memory');
    var reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
    var coarse=win.matchMedia('(max-width:700px)');
    var items=[],cards=[],geometry=[],authenticated=false,signature='',version=0,manualFlat=false;
    var mm=null,pointerCleanup=null,scrollTween=null,timers=[],camera={progress:0};
    var frameCache='',cardSetters=[],cardCache=[],worldZ=null;
    var size={width:1280,height:720},selected=null,opener=null,closing=false,dialogAnimation=null,oldOverflow='';

    function closeMemory(animate){
      if(closing&&animate)return;
      if(dialogAnimation)dialogAnimation.kill();
      var image=dialog.querySelector('img');
      function done(){
        if(dialog.open)dialog.close();
        image.removeAttribute('src');
        if(g){g.set(image,{clearProps:'transform,opacity'});g.set(dialog.querySelector('.corridor-memory-shell'),{clearProps:'opacity'});g.set(dialog.querySelector('.corridor-memory-copy'),{clearProps:'transform,opacity'});}
        doc.body.style.overflow=oldOverflow;
        selected=null;closing=false;dialogAnimation=null;if(stars)stars.setSuspended(false);
        if(authenticated&&opener&&opener.isConnected)opener.focus({preventScroll:true});
      }
      if(!dialog.open){image.removeAttribute('src');selected=null;return;}
      if(!animate||reduced.matches||!g||!opener||!opener.isConnected){done();return;}
      closing=true;
      var from=image.getBoundingClientRect(),to=opener.querySelector('img').getBoundingClientRect();
      dialogAnimation=g.timeline({onComplete:done});
      dialogAnimation.to(image,{x:to.left-from.left,y:to.top-from.top,scaleX:to.width/from.width,scaleY:to.height/from.height,duration:.48,ease:'power3.inOut'},0)
        .to(dialog.querySelector('.corridor-memory-copy'),{opacity:0,duration:.16},0)
        .to(dialog,{'--d-backdrop':0,duration:.4},0)
        .to(dialog.querySelector('.corridor-memory-shell'),{opacity:0,duration:.17},.3);
    }
    dialog.querySelector('[data-memory-close]').addEventListener('click',function(){closeMemory(true);});
    dialog.addEventListener('cancel',function(event){event.preventDefault();closeMemory(true);});
    dialog.addEventListener('click',function(event){if(event.target===dialog)closeMemory(true);});
    dialog.querySelector('[data-memory-record]').addEventListener('click',function(){closeMemory(false);});
    dialog.querySelector('[data-memory-hd]').addEventListener('click',function(){
      if(!selected||!authenticated)return;
      var entry=selected,trigger=opener;closeMemory(false);options.openMedia(entry.media,trigger);
    });
    async function openMemory(entry,button){
      var generation=version;
      if(!authenticated)return;
      if(options.prepareMedia)await options.prepareMedia();
      if(!authenticated||generation!==version||!button.isConnected)return;
      closeMemory(false);selected=entry;opener=button;
      var record=entry.record;
      var title=record?record.title:entry.caption||entry.media.city||'旅途中的一刻';
      dialog.querySelector('#corridor-memory-title').textContent=title;
      dialog.querySelector('#corridor-memory-date').textContent=record?String(record.date||'').replace('/',' — '):entry.media.city||'相册';
      dialog.querySelector('#corridor-memory-body').textContent=record?record.description:'这张照片，留在了我们的相册里。';
      var link=dialog.querySelector('[data-memory-record]');link.hidden=!record;
      if(record)link.href='#memory-record-'+entry.recordIndex;
      var image=dialog.querySelector('img'),source=button.querySelector('img').getBoundingClientRect();
      var url=entry.media.poster_url||entry.media.cover_url||entry.media.url;
      image.src=options.resolveUrl?options.resolveUrl(url):entry.previewUrl;image.alt=title;
      image.width=entry.width||1200;image.height=entry.height||900;
      oldOverflow=doc.body.style.overflow||'';doc.body.style.overflow='hidden';
      dialog.style.setProperty('--d-backdrop','0');dialog.showModal();if(stars)stars.setSuspended(true);
      if(reduced.matches||!g){dialog.style.setProperty('--d-backdrop','.72');return;}
      var target=image.getBoundingClientRect(),shell=dialog.querySelector('.corridor-memory-shell'),copy=dialog.querySelector('.corridor-memory-copy');
      g.set(image,{transformOrigin:'0 0'});
      dialogAnimation=g.timeline({onComplete:function(){dialogAnimation=null;}});
      dialogAnimation.fromTo(image,{x:source.left-target.left,y:source.top-target.top,scaleX:source.width/target.width,scaleY:source.height/target.height},
        {x:0,y:0,scaleX:1,scaleY:1,duration:.65,ease:'power3.inOut'},0)
        .fromTo(shell,{opacity:0},{opacity:1,duration:.22},0)
        .fromTo(copy,{opacity:0,y:18},{opacity:1,y:0,duration:.4,ease:'power2.out'},.2)
        .to(dialog,{'--d-backdrop':.72,duration:.4},0);
    }
    function cleanup(){
      if(mm)mm.revert();mm=null;scrollTween=null;
      frameCache='';cardCache=[];cardSetters=[];worldZ=null;
      if(pointerCleanup)pointerCleanup();pointerCleanup=null;
      section.style.removeProperty('--d-distance');section.classList.remove('d-entered');
      if(g){g.set([frame,space,world,intro],{clearProps:'transform,opacity,borderRadius'});cards.forEach(function(card){g.set(card,{clearProps:'transform,opacity,visibility'});});}
    }
    function paint(){
      var view=frameAt(camera.progress,size.width,size.height,items.length);
      var openingKey=[view.sx,view.sy,view.y,view.introAlpha,view.introY].join(',');
      if(frameCache!==openingKey){
        g.set(frame,{scaleX:view.sx,scaleY:view.sy,y:view.y,borderRadius:view.radius});
        g.set(space,{scaleX:1/view.sx,scaleY:1/view.sy});
        g.set(intro,{autoAlpha:view.introAlpha,y:view.introY});frameCache=openingKey;
      }
      var unit=size.width<701?.73:1;
      if(worldZ)worldZ(view.camera*unit);if(stars)stars.setCamera(view.camera);
      cards.forEach(function(card,index){
        if(!geometry[index]||!items[index]||!cardSetters[index])return;
        var travel=cardAt(index,view.camera,size.width);
        var previous=cardCache[index]||{},entry=items[index],ratio=entry.width&&entry.height?entry.width/entry.height:4/3;
        var shown=travel.alpha>.001&&inFrustum(geometry[index],travel,view.camera,size.width,size.height,ratio),x=geometry[index].x+travel.x;
        // Only live planes keep compositor hints; hidden planes require no transform work.
        if(previous.shown!==shown){card.style.visibility=shown?'visible':'hidden';}
        if(shown&&previous.x!==x)cardSetters[index](x);
        if(previous.alpha!==travel.alpha)card.style.opacity=travel.alpha;
        var inert=travel.alpha<.05;if(previous.inert!==inert)card.inert=inert;
        cardCache[index]={shown:shown,x:shown?x:undefined,alpha:travel.alpha,inert:inert};
      });
      fill.style.transform='scaleX('+camera.progress+')';
      var countText=String(Math.min(items.length,view.pair*2+1)).padStart(2,'0')+'—'+String(Math.min(items.length,view.pair*2+2)).padStart(2,'0')+' / '+String(items.length).padStart(2,'0');
      if(label.textContent!==countText)label.textContent=countText;
      section.classList.toggle('d-entered',view.y+size.height*(1+view.sy)/2>size.height-32);
      section.dataset.progress=camera.progress.toFixed(4);
    }
    function placeCard(card,index){
      var entry=items[index],ratio=entry.width&&entry.height?entry.width/entry.height:4/3;
      var plane=planeAt(index,size.width,size.height,ratio);
      card.style.setProperty('--d-photo-width',plane.width+'px');
      g.set(card,{xPercent:-50,yPercent:-50,x:plane.x,y:plane.y,z:plane.z,rotationY:plane.rotationY});
      return plane;
    }
    function setup(){
      var notebook=doc.querySelector('.travel-notebook');
      var before=notebook?notebook.getBoundingClientRect().top:null;
      var preserve=before!==null&&before<=doc.querySelector('.site-header').getBoundingClientRect().height;
      function restoreNotebook(){if(preserve){var delta=notebook.getBoundingClientRect().top-before;if(Math.abs(delta)>1)win.scrollBy({top:delta,behavior:'instant'});}}
      cleanup();
      var bounds=stage.getBoundingClientRect();size={width:bounds.width||1280,height:bounds.height||720};
      var flat=manualFlat||reduced.matches||!g||!win.ScrollTrigger||items.length<3;
      section.classList.toggle('d-static',flat);if(stars)stars.setActive(!flat);if(starToggle)starToggle.hidden=flat;
      toggle.textContent=reduced.matches?'已减少动态':flat?'空间浏览':'平面浏览';
      toggle.disabled=reduced.matches||!g||items.length<3;
      if(flat){cards.forEach(function(card){card.inert=false;});label.textContent=items.length+' 张回忆';restoreNotebook();return;}
      g.registerPlugin(win.ScrollTrigger);mm=g.matchMedia();
      mm.add('(prefers-reduced-motion:no-preference)',function(){
        var distance=Math.max(2100,Math.ceil(items.length/2)*1100);
        section.style.setProperty('--d-distance',distance+'px');
        geometry=cards.map(function(card,index){return placeCard(card,index);});
        worldZ=g.quickSetter(world,'z','px');cardSetters=cards.map(function(card){return g.quickSetter(card,'x','px');});
        camera.progress=0;
        scrollTween=g.fromTo(camera,{progress:0},{progress:1,ease:'none',onUpdate:paint,
          scrollTrigger:{id:'d-corridor',trigger:section,start:'top top+='+doc.querySelector('.site-header').getBoundingClientRect().height,
            end:'+='+distance,scrub:.22,invalidateOnRefresh:true,onRefresh:paint}});
        if(win.matchMedia('(hover:hover) and (pointer:fine)').matches){
          var rotateX=g.quickTo(world,'rotationX',{duration:.8,ease:'power3.out'}),rotateY=g.quickTo(world,'rotationY',{duration:.8,ease:'power3.out'});
          function move(event){var rect=frame.getBoundingClientRect();rotateY(((event.clientX-rect.left)/rect.width-.5)*-3.2);rotateX(((event.clientY-rect.top)/rect.height-.5)*2.2);}
          function reset(){rotateX(0);rotateY(0);}
          frame.addEventListener('pointermove',move);frame.addEventListener('pointerleave',reset);
          pointerCleanup=function(){frame.removeEventListener('pointermove',move);frame.removeEventListener('pointerleave',reset);rotateX.tween.kill();rotateY.tween.kill();};
        }
        paint();
      });
      win.ScrollTrigger.refresh();restoreNotebook();
    }
    function draw(){
      timers.forEach(function(timer){win.clearTimeout(timer);});timers=[];
      world.replaceChildren();var generation=version;
      cards=items.map(function(entry,index){
        var card=doc.createElement('figure');card.className='d-photo';
        var button=doc.createElement('button');button.type='button';
        var caption=entry.caption||(entry.record&&entry.record.title)||entry.media.city||'旅途中的一刻';
        button.setAttribute('aria-label','查看回忆：'+caption+'，第 '+(index+1)+' 张');
        var image=doc.createElement('img');image.alt=caption;image.decoding='async';image.width=1200;image.height=900;
        var settled=false,timer=win.setTimeout(failed,30000);timers.push(timer);
        function current(){return authenticated&&generation===version&&card.isConnected&&!settled;}
        function failed(){
          if(!current())return;settled=true;win.clearTimeout(timer);entry.failed=true;card.hidden=true;image.removeAttribute('src');
          if(items.every(function(item){return item.failed;})){status.hidden=false;status.textContent='照片暂时未能加载，请到相册重试。';}
        }
        image.addEventListener('error',failed);
        image.addEventListener('load',function(){
          if(!current())return;settled=true;win.clearTimeout(timer);entry.width=image.naturalWidth;entry.height=image.naturalHeight;
          image.width=entry.width;image.height=entry.height;status.hidden=true;status.textContent='';
          if(scrollTween){geometry[index]=placeCard(card,index);cardCache[index]=null;paint();}
        });
        var text=doc.createElement('figcaption');text.textContent=caption;
        button.append(image);card.append(button,text);world.append(card);image.src=entry.previewUrl;
        button.addEventListener('click',function(){openMemory(entry,button);});
        button.addEventListener('focus',function(){
          if(!button.matches(':focus-visible'))return;
          if(!scrollTween||!scrollTween.scrollTrigger)return;
          var pair=Math.floor(index/2),st=scrollTween.scrollTrigger;
          var progress=pairProgress(pair,items.length);
          win.scrollTo({top:st.start+progress*(st.end-st.start),behavior:'instant'});
        });
        return card;
      });
      setup();
    }
    async function update(data){
      authenticated=!!data.authenticated;
      if(!authenticated){version++;signature='';closeMemory(false);items=[];draw();status.hidden=false;
        status.textContent=doc.body.dataset.authenticated==='true'&&data.status==='loading'?'正在连接我们的相册…':'登录后，走进我们的照片长廊。';return;}
      var candidates=choosePhotos(data.photos,data.records,options.selection,20);
      candidates.forEach(function(entry){
        var url=entry.media.poster_url||entry.media.cover_url||entry.media.url;entry.previewUrl=options.resolveUrl?options.resolveUrl(url):url;
        if(!entry.record&&options.recordForPhoto){var match=options.recordForPhoto(entry.media);if(match){entry.record=match.record;entry.recordIndex=match.recordIndex;}}
      });
      var next=JSON.stringify(candidates.map(function(entry){return [entry.media.id,entry.previewUrl,entry.record];}));
      if(next===signature){if(!candidates.length)status.textContent=data.status==='loading'?'正在展开相册…':data.status==='error'?'相册暂未连接，请稍后重试。':'相册还没有照片。';return;}
      version++;signature=next;closeMemory(false);items=candidates.filter(function(entry){return !!entry.previewUrl;});draw();
      status.hidden=false;status.textContent=candidates.length?(items.length||data.status==='loading'?'正在展开相册…':'照片暂时未能加载，请到相册重试。'):data.status==='loading'?'正在展开相册…':data.status==='error'?'相册暂未连接，请稍后重试。':'相册还没有照片。';
    }
    toggle.addEventListener('click',function(){manualFlat=!manualFlat;closeMemory(false);setup();section.scrollIntoView({behavior:'instant',block:'start'});});
    section.querySelectorAll('[data-d-step]').forEach(function(button){button.addEventListener('click',function(){
      if(!scrollTween||!scrollTween.scrollTrigger)return;
      var pair=frameAt(camera.progress,size.width,size.height,items.length).pair+Number(button.dataset.dStep);
      var p=pairProgress(pair,items.length),st=scrollTween.scrollTrigger;
      win.scrollTo({top:st.start+p*(st.end-st.start),behavior:'smooth'});
    });});
    reduced.addEventListener('change',setup);coarse.addEventListener('change',setup);
    if(win.ResizeObserver)new win.ResizeObserver(function(){
      var bounds=stage.getBoundingClientRect();if(Math.abs(bounds.width-size.width)>1||Math.abs(bounds.height-size.height)>1)setup();
    }).observe(stage);
    win.addEventListener('pagehide',function(){cleanup();closeMemory(false);if(stars)stars.destroy();});
    return {update:update};
  }
  return {create:create,entries:base.entries,select:base.select,frameAt:frameAt,planeAt:planeAt,pairProgress:pairProgress,visibilityAt:visibilityAt,cardAt:cardAt,inFrustum:inFrustum,choosePhotos:choosePhotos};
});
