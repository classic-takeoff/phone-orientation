import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const math=await readFile(new URL('../src/orientation.mjs',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.mjs',import.meta.url),'utf8');
const code=math.replace(/^export /gm,'')+'\n'+app.replace(/^import .*;\n/,'');
function target(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},async emit(type,event={}){for(const fn of [...(listeners.get(type)||[])])await fn(event);},count(type){return listeners.get(type)?.size||0;}};}
function harness({secure=true,permission='granted',supported=true}={}){
  const elements=new Map();let time=1000,frameId=0;const frames=new Map(),intervals=[];
  const el=id=>{if(!elements.has(id))elements.set(id,Object.assign(target(),{textContent:'',style:{},dataset:{},value:.65,disabled:false}));return elements.get(id);};
  const document=Object.assign(target(),{hidden:false,getElementById:el,body:{classList:{toggle(){}}}});
  const orientation=Object.assign(target(),{angle:0});
  const DeviceOrientationEvent={requestPermission:async()=>permission};
  const window=Object.assign(target(),{isSecureContext:secure,DeviceOrientationEvent:supported?DeviceOrientationEvent:undefined,screen:{orientation}});
  vm.runInNewContext(code,{document,window,DeviceOrientationEvent,performance:{now:()=>time},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id),setInterval:fn=>intervals.push(fn),Math,Number,Error});
  return {el,window,document,orientation,frames,click:id=>el(id).emit('click'),sensor:data=>window.emit('deviceorientation',{alpha:0,beta:0,gamma:0,...data}),tick(ms=17){time+=ms;const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn(time));},stats(ms=1000){time+=ms;intervals.forEach(fn=>fn());}};
}
test('insecure origin is refused before subscribing',async()=>{const h=harness({secure:false});await h.click('connect');assert.equal(h.el('status').textContent,'需要 HTTPS');assert.equal(h.window.count('deviceorientation'),0);});
test('permission rejection has a recoverable error state',async()=>{const h=harness({permission:'denied'});await h.click('connect');assert.equal(h.el('status').textContent,'无法连接');assert.equal(h.window.count('deviceorientation'),0);assert.equal(h.el('connect').disabled,false);});
test('null sensor values never appear as live readings',async()=>{const h=harness();await h.click('connect');await h.sensor({alpha:null});assert.notEqual(h.el('status').dataset.state,'live');h.stats(5000);assert.equal(h.el('status').textContent,'未收到数据');await h.sensor({alpha:20});assert.equal(h.el('status').textContent,'实时连接');});
test('stationary pose drains rendering queue and moving data restarts it',async()=>{const h=harness();await h.click('connect');await h.sensor({beta:70});h.tick();assert.equal(h.frames.size,0);await h.sensor({beta:90});assert.equal(h.frames.size,1);for(let i=0;i<120;i++)h.tick();assert.equal(h.frames.size,0);});
test('pause and background remove sensor listener; resume never duplicates it',async()=>{const h=harness();await h.click('connect');await h.sensor();await h.click('pause');assert.equal(h.window.count('deviceorientation'),0);assert.equal(h.frames.size,0);await h.click('pause');assert.equal(h.window.count('deviceorientation'),1);h.document.hidden=true;await h.document.emit('visibilitychange');assert.equal(h.window.count('deviceorientation'),0);assert.equal(h.frames.size,0);h.document.hidden=false;await h.document.emit('visibilitychange');assert.equal(h.window.count('deviceorientation'),1);await h.click('connect');assert.equal(h.window.count('deviceorientation'),0);});
test('screen orientation change calibrates next valid sample',async()=>{const h=harness();await h.click('connect');await h.sensor({beta:60});h.orientation.angle=90;await h.orientation.emit('change');await h.sensor({alpha:90,beta:60});assert.equal(h.el('pitch').textContent,'0.0°');assert.equal(h.el('yaw').textContent,'0.0°');assert.equal(h.el('roll').textContent,'0.0°');});
test('demo labels simulated data and does not subscribe to sensor',async()=>{const h=harness();await h.click('demo');assert.equal(h.el('status').textContent,'演示模式');assert.equal(h.window.count('deviceorientation'),0);h.tick();h.stats();assert.equal(h.el('sensor-hz').textContent,'—');await h.click('demo');assert.equal(h.frames.size,0);});
test('visible page script is syntactically valid',()=>assert.doesNotThrow(()=>new vm.Script(code)));
