const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const file = __dirname + '/../immersive-corridor.js';
const motion = fs.existsSync(file) ? require(file) : {};

test('窗口先展开，镜头随后推进，向后滚动能精确返回开场', () => {
  assert.equal(typeof motion.frameAt, 'function');
  const start = motion.frameAt(0, 1280, 720, 8);
  const expanded = motion.frameAt(.18, 1280, 720, 8);
  const end = motion.frameAt(1, 1280, 720, 8);
  assert.equal(start.camera, 0);
  assert.equal(start.sx, .9);
  assert.equal(expanded.sx, 1);
  assert.equal(expanded.camera, 0);
  assert.ok(end.camera > expanded.camera);
  assert.deepEqual(motion.frameAt(0,1280,720,8), start);
});

test('手机和桌面的投影始终有限，并且前后两侧照片都有深度', () => {
  assert.equal(typeof motion.planeAt, 'function');
  for (const width of [320,375,768,1280,1920]) {
    const near=motion.planeAt(0,width), far=motion.planeAt(2,width);
    assert.ok(near.x<0);
    assert.ok(motion.planeAt(1,width).x>0);
    assert.ok(far.z<near.z);
    for(let i=0;i<8;i++) for(const p of [0,.15,.5,1]) {
      const frame=motion.frameAt(p,width,700,8);
      const plane=motion.planeAt(i,width);
      assert.ok(Object.values(frame).every(Number.isFinite));
      assert.ok(Object.values(plane).every(Number.isFinite));
      assert.ok(frame.sx>0 && frame.sy>0);
    }
  }
});

test('重复加载与退出登录清除私密场景，迟到事件不能恢复照片', async () => {
  assert.equal(typeof motion.create, 'function');
  const listeners = new Map();
  function node() {
    return {style:{setProperty(){},removeProperty(){}},dataset:{},children:[],isConnected:true,
      classList:{toggle(){},add(){},remove(){}},open:false,
      addEventListener(type,fn){this[type]=fn;},removeEventListener(){},setAttribute(){},removeAttribute(){},
      append(...nodes){this.children.push(...nodes);},replaceChildren(){
        const drop=n=>{n.isConnected=false;n.children.forEach(drop);};
        this.children.forEach(drop);this.children=[];
      },getBoundingClientRect(){return {width:1280,height:720,top:80,left:0};},
      close(){this.open=false;},focus(){}};
  }
  const elements=new Map();
  const doc={body:node(),querySelector(selector){if(!elements.has(selector))elements.set(selector,node());return elements.get(selector);},createElement:node};
  doc.querySelector('#corridor-memory').querySelector=selector=>doc.querySelector('dialog '+selector);
  const section=node(); section.ownerDocument=doc;
  section.querySelector=selector=>doc.querySelector(selector);
  section.querySelectorAll=()=>[];
  const root={gsap:{set(){},matchMedia(){throw new Error('减少动态时不应创建动画');}},ScrollTrigger:{},matchMedia:()=>({matches:true,addEventListener(){}}),setTimeout:()=>1,clearTimeout(){},
    addEventListener(type,fn){listeners.set(type,fn);}};
  const instance=motion.create(section,{resolveUrl:u=>u,selection:[]},root);
  const data={authenticated:true,photos:[{name:'IMG_5503.jpeg',url:'private.jpg'},{name:'IMG_3640.jpeg',url:'private-2.jpg'},{name:'IMG_3651.jpeg',url:'private-3.jpg'}],records:[],status:'ready'};
  await instance.update(data);
  await instance.update(data);
  assert.match(doc.querySelector('#corridor-status').textContent,/正在/);
  const wall=doc.querySelector('.d-world');
  assert.equal(wall.children.length,3);
  assert.equal(doc.querySelector('[data-d-mode]').disabled,true);
  assert.equal(doc.querySelector('[data-d-mode]').textContent,'已减少动态');
  const lateImage=wall.children[0].children[0].children[0];
  await instance.update({authenticated:false,photos:[],records:[],status:'ready'});
  lateImage.load();
  assert.equal(wall.children.length,0);
  assert.match(doc.querySelector('#corridor-status').textContent,/登录后/);
});


test('相机持续穿行，在完整观看位置减速但不停住，远处还有后续照片', () => {
  let lastCamera=0;
  for(let i=181;i<=1000;i++) {
    const current=motion.frameAt(i/1000,1280,720,8).camera;
    assert.ok(current>lastCamera,'滚动时镜头不能停成幻灯片');lastCamera=current;
  }
  for(let pair=0;pair<4;pair++) {
    const p=motion.pairProgress(pair,8),at=motion.frameAt(p,1280,720,8);
    const before=motion.frameAt(Math.max(.18,p-.012),1280,720,8);
    const after=motion.frameAt(p+.012,1280,720,8);
    assert.ok(after.camera>before.camera,'完整观看阶段仍缓慢推进');
    assert.ok(after.camera-before.camera<160,'观看时不能快速冲过照片');
    assert.equal(at.pair,pair);
    assert.equal(motion.visibilityAt(pair*2,at.camera,1280),1);
    if(pair)assert.equal(motion.visibilityAt((pair-1)*2,at.camera,1280),0,'前组已从侧面离场');
    if(pair<3)assert.ok(motion.visibilityAt((pair+1)*2,at.camera,1280)>.2,'远处应能看到后续照片');
  }
});

test('照片看清后仍继续靠近，沿两侧掠出画面',()=>{
  assert.equal(typeof motion.cardAt,'function');
  const left=motion.cardAt(0,0,1280),right=motion.cardAt(1,0,1280);
  const passedLeft=motion.cardAt(0,700,1280),passedRight=motion.cardAt(1,700,1280);
  assert.ok(passedLeft.x<left.x && passedRight.x>right.x,'左右照片应向各自侧面离开');
  assert.ok(passedLeft.alpha>.8 && passedRight.alpha>.8,'应通过走近并掠过离场，而不是提早淡出');
});

test('横竖照片在完整观看位置均保留屏幕边距', () => {
  const ratios=[4/3,3/4,4/3,4/3,4/3,3/4,3/4,3/4];
  for(const [width,height] of [[320,540],[375,700],[768,640],[1280,720],[1920,720]]) {
    ratios.forEach((ratio,index)=>{
      const plane=motion.planeAt(index,width,height,ratio);
      const camera=motion.frameAt(motion.pairProgress(Math.floor(index/2),8),width,height,8).camera*plane.unit;
      const angle=plane.rotationY*Math.PI/180;
      // Project actual image corners, including the plane's Y rotation.
      const points=[];
      for(const x of [-plane.width/2,plane.width/2])for(const y of [-plane.width/ratio/2,plane.width/ratio/2]){
        const z=plane.z+camera-x*Math.sin(angle),factor=plane.focal/(plane.focal-z);
        points.push({x:width/2+(plane.x+x*Math.cos(angle))*factor,y:height/2+(plane.y+y)*factor});
      }
      assert.ok(points.every(p=>p.x>width*.03 && p.x<width*.97 && p.y>height*.05 && p.y<height*.92),`完整构图应留边：${width}px，第${index+1}张`);
      assert.ok(plane.width<=width*.52,'构图在观看位置有横向余量');
    });
  }
});

test('照片恢复有存在感的尺寸，同时按竖图高度适配',()=>{
  assert.ok(motion.planeAt(0,1280,720,4/3).width>=500);
  assert.ok(motion.planeAt(1,1280,720,3/4).width>=320);
  assert.ok(motion.planeAt(0,375,700,4/3).width>=180);
});


test('只选已核对的风景，并合并记录照片、去重和保留原记录关系',()=>{
  const photos=[{id:'sunset',name:'IMG_5503.jpeg',url:'sunset.jpg'},
    {id:'gate',name:'IMG_3648.jpeg',url:'gate.jpg'},
    {id:'drink',name:'IMG_3657.jpeg',url:'drink.jpg'},
    {id:'couple',name:'IMG_5508.jpeg',url:'couple.jpg'},
    {id:'unknown',name:'unknown.jpg',url:'unknown.jpg'}];
  const records=[{title:'南京',photos:[{name:'IMG_3640.jpeg',url:'trees.jpg'},photos[1],
    {name:'IMG_3651.jpeg',url:'movie.mp4',kind:'video'}]}];
  const chosen=motion.choosePhotos(photos,records,[],20);
  assert.deepEqual(chosen.map(x=>x.media.name),['IMG_5503.jpeg','IMG_3640.jpeg','IMG_3648.jpeg']);
  assert.equal(new Set(chosen.map(x=>x.media.url)).size,3);
  assert.equal(chosen[1].record,records[0]);
  assert.equal(chosen[1].recordIndex,0);
  assert.equal(motion.choosePhotos(photos,records,[],2).length,2);
});

test('完整观看位置不被视锥裁掉，掠过两侧后才移出渲染',()=>{
  for(const [w,h] of [[375,700],[1280,720]])for(let index=0;index<12;index++){
    const ratio=index%2?3/4:4/3,plane=motion.planeAt(index,w,h,ratio);
    const camera=motion.frameAt(motion.pairProgress(Math.floor(index/2),12),w,h,12).camera;
    assert.equal(motion.inFrustum(plane,motion.cardAt(index,camera,w),camera,w,h,ratio),true);
  }
  const plane=motion.planeAt(0,1280,720,4/3);
  assert.equal(motion.inFrustum(plane,motion.cardAt(0,1300,1280),1300,1280,720,4/3),false);
});
