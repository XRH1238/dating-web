const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const stars=fs.existsSync(__dirname+'/../travel-stars.js')?require('../travel-stars.js'):{};
test('鼠标推开附近粒子，离开后粒子自然回落',()=>{
  assert.equal(typeof stars.stepParticle,'function');
  const p={dx:0,dy:0,vx:0,vy:0};
  for(let i=0;i<12;i++)stars.stepParticle(p,{x:110,y:100},{x:100,y:100,active:true,vx:1,vy:0},16.667);
  assert.ok(p.dx>8,'附近粒子应明显避让');
  for(let i=0;i<220;i++)stars.stepParticle(p,{x:110,y:100},{active:false},16.667);
  assert.ok(Math.abs(p.dx)<1 && Math.abs(p.dy)<1,'粒子应回到自己的位置');
});
test('极长滚动与不同屏幕下粒子投影始终有限',()=>{
  assert.equal(typeof stars.projectStar,'function');
  for(const width of [320,819,1920])for(const camera of [-100,0,1500,50000])for(let i=0;i<100;i++){
    const p=stars.projectStar({x:i/50-1,y:(i*7%100)/50-1,z:100+i*23,r:1},camera,width,700);
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(p.alpha>=0 && p.alpha<=1);
  }
});

test('暂停、减少动态及销毁时不会遗留动画帧',()=>{
  function fixture(reduce){
    const pending=new Set();let serial=0;
    const ctx={setTransform(){},clearRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){}};
    const canvas={dataset:{},setAttribute(){},getContext:()=>ctx,remove(){this.removed=true;}};
    const doc={hidden:false,createElement:()=>canvas,addEventListener(){},removeEventListener(){}};
    const frame={ownerDocument:doc,clientWidth:819,clientHeight:720,prepend(){},addEventListener(){},removeEventListener(){}};
    const win={matchMedia:()=>({matches:reduce,addEventListener(){},removeEventListener(){}}),requestAnimationFrame(){pending.add(++serial);return serial;},cancelAnimationFrame(id){pending.delete(id);}};
    return {field:stars.create(frame,win),pending,canvas};
  }
  const active=fixture(false);assert.equal(active.pending.size,1);
  active.field.setSuspended(true);assert.equal(active.pending.size,0);
  active.field.setSuspended(false);assert.equal(active.pending.size,1);
  active.field.setActive(false);assert.equal(active.pending.size,0);
  active.field.destroy();assert.equal(active.pending.size,0);assert.equal(active.canvas.removed,true);
  const reduced=fixture(true);assert.equal(reduced.pending.size,0);assert.equal(reduced.canvas.hidden,true);reduced.field.destroy();
});
