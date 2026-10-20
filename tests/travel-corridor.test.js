const test = require('node:test');
const assert = require('node:assert/strict');
const corridor = require('../travel-corridor.js');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('长廊只接收相册照片，去重并保留实况静态封面', () => {
  const photos = [{url:'a.jpg', city:'杭州'}, {url:'a.jpg'}, {url:'b.mp4',kind:'video'}, {url:'c.jpg',kind:'live-photo',motion_url:'c.mov'}];
  assert.deepEqual(corridor.entries(photos, []).map(x => x.media.url), ['a.jpg','c.jpg']);
});

test('照片只通过同一媒体地址或路径关联回忆，不凭城市猜测', () => {
  const records = [{title:'同城的另一天',city:'杭州',photos:[{url:'other.jpg'}]}, {title:'湖边',photos:JSON.stringify([{url:'a.jpg'}])}];
  const entries = corridor.entries([{url:'a.jpg',city:'杭州'},{url:'b.jpg',city:'杭州'}], records);
  assert.equal(entries[0].record.title,'湖边');
  assert.equal(entries[0].recordIndex,1);
  assert.equal(entries[1].record,null);
});

test('筛选保留横竖照片与城市差异，过滤加载失败照片且限制数量', () => {
  const entries = Array.from({length:30},(_,i)=>({media:{url:`${i}.jpg`,city:i<15?'杭州':'厦门'},width:i%2?800:1400,height:i%2?1200:900}));
  entries[0].failed=true;
  const result = corridor.select(entries,12);
  assert.equal(result.length,12);
  assert.ok(result.some(x=>x.width<x.height));
  assert.ok(result.some(x=>x.width>x.height));
  assert.ok(result.some(x=>x.media.city==='厦门'));
  assert.ok(!result.includes(entries[0]));
});

test('相机前进时照片变大向两侧经过，投影不会出现无穷值', () => {
  const start = corridor.project(4,0,1200,760,12);
  const near = corridor.project(4,0.35,1200,760,12);
  assert.ok(near.scale>start.scale);
  assert.ok(Math.abs(near.x)>Math.abs(start.x));
  for(let i=0;i<12;i++) for(const progress of [0,0.5,1]) {
    const p=corridor.project(i,progress,375,700,12);
    assert.ok([p.x,p.y,p.scale,p.opacity].every(Number.isFinite));
    assert.ok(p.opacity>=0 && p.opacity<=1);
  }
});

test('人工选片只保存标识与次序，并能关联已核实的记录，照片移除后不会复活', () => {
  const photos = [{id:'a',url:'a.jpg'},{id:'b',url:'b.jpg'},{id:'c',url:'c.jpg'}];
  const selection = [{id:'c',caption:'晚霞'},{id:'a',recordId:'r'}, {id:'deleted'}];
  const result = corridor.entries(photos,[{id:'r',title:'回忆',photos:[]}],selection);
  assert.deepEqual(result.map(x=>x.media.id),['c','a']);
  assert.equal(result[1].record.title,'回忆');
  result[0].failed=true;
  assert.deepEqual(corridor.select(result).map(x=>x.media.id),['a']);
  assert.deepEqual(corridor.entries(photos,[],[{id:'missing'}]).map(x=>x.media.id),['a','b','c']);
});

function browserFixture(deferImages) {
  const images=[], classes=new Set();
  function node() { return {style:{},children:[],isConnected:true,open:false,
    classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},
    addEventListener(){},setAttribute(){},removeAttribute(){},
    append(...children){this.children.push(...children);},replaceChildren(){this.children=[];}}; }
  const parts=new Map();
  const dialog=node(); dialog.querySelector=()=>node();
  const doc={querySelector:()=>dialog,createElement:node};
  const element=node(); element.ownerDocument=doc;
  element.querySelector=(selector)=>{if(!parts.has(selector))parts.set(selector,node());return parts.get(selector);};
  element.querySelectorAll=()=>[];
  const win={matchMedia:()=>({matches:true,addEventListener(){}}),
    setTimeout:()=>1,clearTimeout(){},
    gsap:{matchMedia(){throw new Error('减少动态效果时不能创建动画');}},ScrollTrigger:{},
    Image:class {constructor(){images.push(this);}set src(value){if(value&&!deferImages)this.finish();}finish(){this.naturalWidth=1200;this.naturalHeight=800;this.onload();}}};
  const source=fs.readFileSync(path.join(__dirname,'../travel-corridor.js'),'utf8');
  vm.runInNewContext(source,{window:win});
  return {instance:win.TravelCorridor.create(element,{openMedia(){}}),images,parts,classes};
}

test('系统减少动态效果时所有照片可直接访问且不创建 GSAP 动画',async()=>{
  const fixture=browserFixture(false);
  await fixture.instance.update({authenticated:true,photos:[{url:'a.jpg'},{url:'b.jpg'},{url:'c.jpg'}],records:[],status:'ready'});
  assert.ok(fixture.classes.has('is-flat'));
  assert.equal(fixture.parts.get('.corridor-wall').children.length,3);
  assert.equal(fixture.parts.get('[data-corridor-mode]').disabled,true);
});

test('图片加载期间退出登录，迟到的图片结果不能重新插入私密照片',async()=>{
  const fixture=browserFixture(true);
  const loading=fixture.instance.update({authenticated:true,photos:[{url:'private.jpg'}],records:[],status:'ready'});
  await fixture.instance.update({authenticated:false,photos:[],records:[],status:'ready'});
  fixture.images.forEach(image=>image.finish());
  await loading;
  assert.equal(fixture.parts.get('.corridor-wall').children.length,0);
  assert.match(fixture.parts.get('#corridor-status').textContent,/登录后/);
});

