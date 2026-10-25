(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.TravelStars=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function clamp(x){return Math.max(0,Math.min(1,x));}
  function projectStar(seed,camera,width,height){
    var depth=((seed.z-camera*.36)%2400+2400)%2400+120;
    var scale=760/(760+depth);
    return {x:width/2+seed.x*width*1.9*scale,y:height/2+seed.y*height*1.9*scale,
      radius:seed.r*(.45+scale),alpha:clamp((depth-120)/180)*(.30+scale*.55)};
  }
  function stepParticle(p,base,pointer,dt){
    var t=Math.max(.25,Math.min(2,dt/16.667)),ax=-p.dx*.023,ay=-p.dy*.023;
    if(pointer.active){
      var x=base.x+p.dx-pointer.x,y=base.y+p.dy-pointer.y,d=Math.sqrt(x*x+y*y),radius=155;
      if(d<radius){
        var force=Math.pow(1-d/radius,2)*5;
        ax+=(d>.1?x/d:1)*force+(pointer.vx||0)*.045;
        ay+=(d>.1?y/d:0)*force+(pointer.vy||0)*.045;
      }
    }
    var drag=Math.pow(.88,t);
    p.vx=(p.vx+ax*t)*drag;p.vy=(p.vy+ay*t)*drag;
    p.dx+=p.vx*t;p.dy+=p.vy*t;
    return p;
  }
  function create(frame,win){
    if(!frame||!frame.ownerDocument||!win.requestAnimationFrame)return null;
    var doc=frame.ownerDocument,canvas=doc.createElement('canvas');
    canvas.className='d-stars';canvas.setAttribute('aria-hidden','true');
    var ctx=canvas.getContext&&canvas.getContext('2d',{alpha:true});
    if(!ctx)return null;
    frame.prepend(canvas);
    var stars=[],width=1,height=1,camera=0,drift=0,raf=0,last=0,enabled=true,suspended=false,visible=true,userEnabled=true;
    var pointer={x:0,y:0,vx:0,vy:0,active:false},interactions=0;
    var reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
    function random(index,salt){var value=Math.sin(index*127.1+salt*311.7)*43758.5453;return value-Math.floor(value);}
    function resize(){
      width=frame.clientWidth||1;height=frame.clientHeight||1;
      var ratio=Math.min(win.devicePixelRatio||1,width<701?1.25:1.5);
      canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
      var count=width<701?620:1200;
      stars=Array.from({length:count},function(_,i){return{x:random(i,1)*2-1,y:random(i,2)*2-1,z:random(i,3)*2400,
        r:.65+random(i,4)*1.25,dx:0,dy:0,vx:0,vy:0};});
      canvas.dataset.particles=String(count);draw(16.667);
    }
    function draw(dt){
      ctx.clearRect(0,0,width,height);
      // Eight alpha paths replace a fill/style change for every particle.
      var buckets=[[],[],[],[],[],[],[],[]],visibleCount=0;
      stars.forEach(function(star){
        var base=projectStar(star,camera+drift,width,height);
        stepParticle(star,base,pointer,dt);
        var x=base.x+star.dx,y=base.y+star.dy;
        if(x<-10||x>width+10||y<-10||y>height+10)return;
        var bucket=Math.max(0,Math.min(7,Math.floor(base.alpha*8)));
        buckets[bucket].push(x,y,base.radius*.8);visibleCount++;
      });
      for(var j=0;j<8;j++){
        var points=buckets[j];if(!points.length)continue;
        ctx.fillStyle='rgba(245,229,201,'+((j+.5)/8)+')';ctx.beginPath();
        for(var k=0;k<points.length;k+=3){ctx.moveTo(points[k]+points[k+2],points[k+1]);ctx.arc(points[k],points[k+1],points[k+2],0,Math.PI*2);}
        ctx.fill();
      }
      // Diagnostic count is updated sparingly, outside the per-particle path.
      if(!canvas.dataset.visible||Math.abs(Number(canvas.dataset.visible)-visibleCount)>20)canvas.dataset.visible=String(visibleCount);
      pointer.vx*=.8;pointer.vy*=.8;
    }
    function tick(now){
      raf=0;var dt=last?Math.min(32,now-last):16.667;last=now;drift+=dt*.009;
      draw(dt);if(running())raf=win.requestAnimationFrame(tick);
    }
    function running(){return enabled&&userEnabled&&!suspended&&visible&&!doc.hidden&&!reduced.matches;}
    function sync(){
      if(raf)win.cancelAnimationFrame(raf);raf=0;last=0;
      canvas.hidden=!enabled||!userEnabled||reduced.matches;
      canvas.dataset.motion=canvas.hidden?'stopped':running()?'interactive':'paused';
      if(running())raf=win.requestAnimationFrame(tick);
    }
    function move(event){
      if(!running()||event.pointerType==='touch')return;
      var rect=frame.getBoundingClientRect(),x=(event.clientX-rect.left)*width/rect.width,y=(event.clientY-rect.top)*height/rect.height;
      pointer.vx=pointer.active?Math.max(-30,Math.min(30,x-pointer.x)):0;
      pointer.vy=pointer.active?Math.max(-30,Math.min(30,y-pointer.y)):0;
      pointer.x=x;pointer.y=y;pointer.active=true;
      canvas.dataset.interactions=String(++interactions);
    }
    function leave(){pointer.active=false;}
    frame.addEventListener('pointermove',move);frame.addEventListener('pointerleave',leave);
    doc.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    var observer=win.IntersectionObserver?new win.IntersectionObserver(function(entries){visible=entries[0].isIntersecting;sync();}):null;
    if(observer)observer.observe(frame);
    var resizer=win.ResizeObserver?new win.ResizeObserver(resize):null;
    if(resizer)resizer.observe(frame);
    resize();sync();
    return {setCamera:function(value){camera=value;},setActive:function(value){enabled=value;sync();},
      setSuspended:function(value){suspended=value;sync();},toggle:function(){userEnabled=!userEnabled;sync();return userEnabled;},
      destroy:function(){enabled=false;sync();if(observer)observer.disconnect();if(resizer)resizer.disconnect();
        frame.removeEventListener('pointermove',move);frame.removeEventListener('pointerleave',leave);
        doc.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync);canvas.remove();}};
  }
  return {create:create,projectStar:projectStar,stepParticle:stepParticle};
});
