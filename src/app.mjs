import { identity, multiply, inverse, fromSensor, distance, cssMatrix, angles, PoseFilter } from './orientation.mjs';
const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['phone','status','message','connect','pause','calibrate','demo','stage','pitch','yaw','roll','sensor-hz','render-hz','sample-age','motion-label','source-label','view-label','deadband','deadband-value'].map(id=>[id,$(id)]));
const filter=new PoseFilter();
let mode='idle', paused=false, base=null, latest=null, lastEvent=0, started=0, raf=0, frameTime=0, statsTime=0, samples=0, draws=0, lastReadout=0, demoStart=0, generation=0;
let currentScreen=screenAngle();
function screenAngle(){return Number(window.screen?.orientation?.angle ?? window.orientation ?? 0);}
function status(label,state){ui.status.textContent=label;ui.status.dataset.state=state;}
function message(text){ui.message.textContent=text;}
function render(){ui.phone.style.transform=cssMatrix(filter.value);draws++;}
function readouts(){const values=angles(filter.value); ['pitch','yaw','roll'].forEach((key,i)=>{const n=Math.round(values[i]*10)/10; const s=(Math.abs(n)<.05?'0.0':n.toFixed(1))+'°'; if(ui[key].textContent!==s)ui[key].textContent=s;});}
function screenLayout(){currentScreen=screenAngle();document.body.classList.toggle('landscape',Math.abs(currentScreen)%180===90);ui['view-label'].textContent=`握持视角 · ${Math.abs(currentScreen)%180===90?'横屏':'竖屏'}`;}
function resetPose(q,time=performance.now()){base=inverse(q);filter.reset(identity(),time);render();readouts();}
function onSensor(event){
  if(mode!=='sensor'||paused||document.hidden)return;
  const {alpha,beta,gamma}=event;
  // Null is not zero; do not pretend unsupported sensors are connected.
  if(![alpha,beta,gamma].every(v=>typeof v==='number'&&Number.isFinite(v)))return;
  const now=performance.now(), returning=lastEvent && now-lastEvent>1200;
  latest=fromSensor(alpha,beta,gamma,currentScreen);lastEvent=now;samples++;
  if(!base){resetPose(latest,now);message('已连接。模型以当前握姿为正面，转动手机即可查看；更换握姿时可重新设为正面。');}
  const relative=multiply(base,latest);
  if(returning)filter.reset(relative,now);else filter.sample(relative,now);
  if(ui.status.dataset.state!=='live')status('实时连接','live');
  schedule();
}
function schedule(){if(!raf&&!paused&&!document.hidden&&(mode==='sensor'||mode==='demo'))raf=requestAnimationFrame(frame);}
function frame(now){
  raf=0;if(paused||document.hidden)return;
  const dt=frameTime?Math.min((now-frameTime)/1000,.05):1/60;frameTime=now;
  if(mode==='demo'){
    const t=(now-demoStart)/1000;
    latest=fromSensor(24*Math.sin(t*.6),30*Math.sin(t*.8),42*Math.sin(t*.45),0);
    if(!base)base=identity();filter.sample(multiply(base,latest),now);
  }
  if(filter.step(dt))render();
  if(now-lastReadout>=100){readouts();lastReadout=now;ui['motion-label'].textContent=distance(filter.value,filter.target)>.12?'跟随中':'姿态稳定';}
  if(mode==='demo'||distance(filter.value,filter.target)>.015)schedule();
}
function cancelFrame(){cancelAnimationFrame(raf);raf=0;frameTime=0;}
function stop(){generation++;window.removeEventListener('deviceorientation',onSensor);cancelFrame();mode='idle';base=null;latest=null;lastEvent=0;paused=false;samples=0;draws=0;statsTime=performance.now();}
function controls(){const active=mode==='sensor'||mode==='demo';ui.pause.disabled=!active;ui.calibrate.disabled=!active;ui.pause.textContent=paused?'▶ 继续':'Ⅱ 暂停';ui.connect.textContent=mode==='sensor'?'断开传感器':'连接手机传感器 ↗';ui.demo.textContent=mode==='demo'?'退出演示 →':'没有传感器？体验演示 →';ui['source-label'].textContent=mode==='sensor'?'手机方向传感器':mode==='demo'?'演示数据 · 非真实传感器':'等待手机传感器';}
ui.connect.addEventListener('click',async()=>{
  if(mode==='sensor'){stop();controls();status('已断开','idle');message('已停止读取传感器。点击连接可重新开始。');return;}
  stop();controls();
  if(!window.isSecureContext){status('需要 HTTPS','error');message('请通过 GitHub Pages 的 HTTPS 地址打开，浏览器在不安全的 HTTP 页面上会限制传感器。');return;}
  if(!window.DeviceOrientationEvent){status('不支持传感器','error');message('当前浏览器没有提供方向传感器接口。请在手机系统浏览器中打开，或体验演示。');return;}
  const attempt=generation;ui.connect.disabled=true;status('等待授权','idle');
  try{
    // Invoke synchronously inside the user click; Safari requires transient activation.
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const permission=await DeviceOrientationEvent.requestPermission();
      if(attempt!==generation)return;
      if(permission!=='granted')throw new Error('permission-denied');
    }
    if(attempt!==generation)return;
    mode='sensor';started=performance.now();statsTime=started;screenLayout();
    window.addEventListener('deviceorientation',onSensor,{passive:true});controls();
    status('等待传感器','idle');message('权限已就绪，等待有效方向数据。请轻轻转动手机。');
  }catch(error){if(attempt!==generation)return;status('无法连接','error');message(error.message==='permission-denied'?'运动与方向权限未获允许。请在浏览器网站设置中允许，或重新打开页面后连接。':'浏览器未能提供运动权限。请在 Safari / Chrome 中通过 HTTPS 打开，并检查网站传感器权限。');}
  finally{ui.connect.disabled=false;}
});
ui.demo.addEventListener('click',()=>{const wasDemo=mode==='demo';stop();ui.connect.disabled=false;if(wasDemo){status('尚未连接','idle');message('演示已结束。用手机连接传感器即可查看真实姿态。');}else{mode='demo';demoStart=performance.now();filter.reset();render();status('演示模式','demo');message('正在播放模拟旋转，不代表手机传感器读数。点击连接可切换到真实数据。');schedule();}controls();});
ui.calibrate.addEventListener('click',()=>{
  if(!latest || (mode==='sensor'&&performance.now()-lastEvent>1200)){message('还没有新鲜的方向数据。请继续连接并轻轻转动手机后再校准。');return;}
  resetPose(latest);message('已将当前握姿设为正面。继续转动手机查看相对姿态。');schedule();
});
ui.pause.addEventListener('click',()=>{
  paused=!paused;
  if(paused){cancelFrame();window.removeEventListener('deviceorientation',onSensor);status('已暂停','idle');message('已暂停读取和更新。点击继续恢复。');}
  else{if(mode==='sensor'){lastEvent=0;started=performance.now();window.addEventListener('deviceorientation',onSensor,{passive:true});status('等待传感器','idle');}else{status('演示模式','demo');schedule();}message('已继续跟随，保留原来的正面参照。');}
  controls();
});
ui.deadband.addEventListener('input',()=>{filter.deadband=Number(ui.deadband.value);ui['deadband-value'].textContent=filter.deadband.toFixed(2)+'°';});
function onScreenChange(){screenLayout();if(mode==='sensor'){base=null;latest=null;lastEvent=0;started=performance.now();message('屏幕方向已改变，下一次有效采样会重新校准正面。');}schedule();}
if(window.screen?.orientation?.addEventListener)window.screen.orientation.addEventListener('change',onScreenChange);else window.addEventListener('orientationchange',onScreenChange);
document.addEventListener('visibilitychange',()=>{
  cancelFrame();
  if(document.hidden){window.removeEventListener('deviceorientation',onSensor);return;}
  statsTime=performance.now();samples=0;draws=0;
  if(mode==='sensor'&&!paused){started=performance.now();lastEvent=0;window.addEventListener('deviceorientation',onSensor,{passive:true});status('等待传感器','idle');}
  schedule();
});
// Low-rate instrumentation stays separate from the model's animation loop.
setInterval(()=>{
  if(document.hidden)return;const now=performance.now(),seconds=(now-statsTime)/1000;
  const active=(mode==='sensor'||mode==='demo')&&!paused;
  ui['sensor-hz'].textContent=mode==='sensor'&&!paused?String(Math.round(samples/Math.max(seconds,.1))):'—';
  ui['render-hz'].textContent=active?String(Math.round(draws/Math.max(seconds,.1))):'—';
  ui['sample-age'].textContent=mode==='sensor'&&!paused&&lastEvent?String(Math.round(now-lastEvent)):'—';
  if(mode==='sensor'&&!paused){
    if(!lastEvent&&now-started>4500){status('未收到数据','error');message('未收到有效方向数据。请轻轻转动手机；如仍无响应，请检查运动权限，并用手机系统浏览器重新打开。');}
    else if(lastEvent&&now-lastEvent>1200){status('等待新采样','idle');ui['motion-label'].textContent='数据暂未更新';}
  }
  samples=0;draws=0;statsTime=now;
},1000);
screenLayout();filter.reset();render();statsTime=performance.now();controls();
