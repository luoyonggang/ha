import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {buildWorld} from './world.js';
import {loadCars,makeCar} from './car.js';
import {DrivingPhysics} from './physics.js';
import {EngineAudio} from './audio.js';
import {createEffects,createTyreEffects} from './effects.js';
import {curve,trackSamples,trackLength,SAMPLE_COUNT} from './track.js';
import hdrURL from './assets/venice_sunset_1k.hdr?url';
import './style.css';

const $=id=>document.getElementById(id);
const formatTime=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+(t%60).toFixed(3).padStart(6,'0');
const keys=new Set(),audio=new EngineAudio();
let renderer,scene,camera,world,effects,player,rivals,tyres;
let mode='free',sessionMode='free',active=false,paused=false,finished=false,high=true,view=0;
let countdown=0,started=false,helpWasPaused=false,accumulator=0,gameTime=0;
const physics=new DrivingPhysics();
let bestSaved=Infinity;
try{bestSaved=Number(localStorage.getItem('apex-ii-best-lap'))||Infinity;}catch{}
let ready=false;

async function setup(){
  renderer=new THREE.WebGLRenderer({canvas:$('world'),antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(53,innerWidth/innerHeight,.055,6000);
  $('load-status').textContent='正在载入 458 Italia 精细赛车与 HDR 环境…';
  const [assets,hdr]=await Promise.all([loadCars(),new RGBELoader().loadAsync(hdrURL)]);
  hdr.mapping=THREE.EquirectangularReflectionMapping;
  const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromEquirectangular(hdr).texture;scene.environmentIntensity=1.15;pmrem.dispose();hdr.dispose();
  $('load-status').textContent='正在构建海岸公路与植被…';
  await new Promise(resolve=>requestAnimationFrame(resolve));
  world=buildWorld(scene);player=makeCar(scene,assets,'#ed5e32');
  rivals=['#99afc5','#c0b286','#638570'].map((color,i)=>({car:makeCar(scene,assets,color,false),progress:0,travel:0,speed:28+i*2.3,finished:false}));
  tyres=createTyreEffects(scene);effects=createEffects(renderer,scene,camera);effects.resize();
  player.update(physics,0,0);rivals.forEach(r=>r.car.group.visible=false);
  camera.position.copy(physics.position).add(new THREE.Vector3(5.3,1.65,-6.4));
  ready=true;$('start').disabled=false;$('start').innerHTML='开始驾驶 <span>↗</span>';$('loading').classList.add('hidden');
  $('distance').innerHTML=(trackLength/1000).toFixed(1)+' <span>KM</span>';
  updateHUD();let previous=performance.now();
  function frame(now){
    requestAnimationFrame(frame);
    const fullDT=Math.max(0,(now-previous)/1000);
    const realDT=Math.min(fullDT,.2);previous=now;
    const visualDT=Math.min(realDT,.08);
    if(active&&!paused&&!finished){
      if(countdown>0){countdown=Math.max(0,countdown-fullDT);showCountdown();}
      accumulator+=realDT;
      const input=readInput();
      while(accumulator>=1/120){
        const dt=1/120;
        if(countdown<=0) {
          started=true;physics.step(dt,input);physics.braking=input.brake||input.handbrake;
          advanceRivals(dt);
          if(physics.newLap){saveBest();if(sessionMode==='race'&&physics.completedLaps>=3)finishRace();}
        }
        gameTime+=dt;accumulator-=dt;
      }
      player.update(physics,visualDT,gameTime);tyres.update(visualDT,physics);
    }else {accumulator=0;if(!active)gameTime+=visualDT;}
    world.update(gameTime,physics.position);
    updateCamera(visualDT,now/1000);
    effects.update(THREE.MathUtils.clamp(Math.abs(physics.speed)/86*.15+(physics.boosting?.8:0),0,1));
    audio.update(physics,active&&!paused&&!finished);
    document.body.classList.toggle('boosting',active&&!paused&&physics.boosting);
    $('collision-overlay').style.opacity=active&&!paused&&physics.collision>0?'1':'0';
    if(Math.floor(now/100)!==Math.floor((now-realDT*1000)/100))updateHUD();
    high?effects.composer.render():renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}

function readInput(){return{
  throttle:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown'),
  turn:(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0),
  handbrake:keys.has('Space'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight'),
};}
function resetRivals(){
  const base=physics.current.index/SAMPLE_COUNT;
  rivals.forEach((r,i)=>{r.progress=(base+(i+1)*8/trackLength)%1;r.travel=(i+1)*8;r.finished=false;r.speed=28+i*2.3;placeRival(r,i,0);r.car.group.visible=true;});
}
function placeRival(r,i,dt){
  const p=curve.getPointAt((r.progress+1)%1),t=curve.getTangentAt((r.progress+1)%1),n=new THREE.Vector3(-t.z,0,t.x).normalize();
  const lane=i%2?2.5:-2.5;
  const state={position:p.clone().addScaledVector(n,lane),yaw:Math.atan2(-t.x,-t.z),speed:r.speed,current:{t},steering:0,roll:0,pitch:0};
  r.car.update(state,dt,gameTime);
}
function advanceRivals(dt){
  for(const [i,r] of rivals.entries()){
    if(r.finished)continue;
    const t1=curve.getTangentAt(r.progress),t2=curve.getTangentAt((r.progress+.013)%1);
    const bend=t1.angleTo(t2);
    const desired=THREE.MathUtils.clamp((sessionMode==='race'?43:30)+i*2.8-bend*60,17,52);
    r.speed=THREE.MathUtils.damp(r.speed,desired,2,dt);
    const delta=r.speed*dt;r.travel+=delta;r.progress=(r.progress+delta/trackLength)%1;
    if(sessionMode==='race'&&r.travel>trackLength*3)r.finished=true;
    placeRival(r,i,dt);
    const d=r.car.group.position.clone().sub(physics.position);d.y=0;
    if(d.length()<3.4&&Math.abs(physics.speed)>2){
      physics.motion.multiplyScalar(Math.exp(-2*dt));
      if(d.length()>0)physics.position.addScaledVector(d.normalize(),-dt*2);
      physics.collision=.15;
    }
  }
}
function showCountdown(){
  if(countdown>0){$('countdown').classList.remove('hidden');$('countdown').textContent=countdown>.7?Math.ceil(countdown-.7):'GO';}
  else $('countdown').classList.add('hidden');
}
function begin(){
  if(!ready)return;
  if(active&&paused){pause(false);return;}
  sessionMode=mode;active=true;paused=false;finished=false;started=false;gameTime=0;
  physics.reset(true);keys.clear();resetRivals();view=0;
  countdown=sessionMode==='race'?3.7:0;
  $('result').classList.add('hidden');$('menu').classList.add('hidden');$('car-card').classList.add('hidden');$('hud').classList.remove('hidden');
  document.body.classList.add('driving');$('start').innerHTML='继续驾驶 <span>↗</span>';showCountdown();
  $('mode-label').textContent=sessionMode==='race'?'PACIFIC / 三圈竞速':'PACIFIC / 自由驾驶';
  updateHUD();
}
function pause(value){
  paused=value;keys.clear();document.body.classList.toggle('driving',!value);
  $('menu').classList.toggle('hidden',!value);$('car-card').classList.toggle('hidden',!value);$('hud').classList.toggle('hidden',value);
  document.querySelector('.mode-picker').classList.toggle('hidden',value);
  if(value){$('start').innerHTML='继续驾驶 <span>↗</span>';$('countdown').classList.add('hidden');}
}
function returnMenu(){active=false;paused=false;finished=false;started=false;countdown=0;physics.reset(true);player.update(physics,0,gameTime);keys.clear();rivals.forEach(r=>r.car.group.visible=false);$('result').classList.add('hidden');$('hud').classList.add('hidden');$('menu').classList.remove('hidden');$('car-card').classList.remove('hidden');document.querySelector('.mode-picker').classList.remove('hidden');$('start').innerHTML='开始驾驶 <span>↗</span>';document.body.classList.remove('driving','boosting');}
function saveBest(){bestSaved=Math.min(bestSaved,physics.bestLap);try{localStorage.setItem('apex-ii-best-lap',String(bestSaved));}catch{}}
function ranking(){return 1+rivals.filter(r=>r.travel>physics.lapTravel*trackLength+physics.completedLaps*trackLength).length;}
function finishRace(){
  finished=true;keys.clear();physics.boosting=false;saveBest();
  $('result-detail').textContent=`第 ${ranking()} 名 / 4 位车手 · 完成太平洋海岸三圈竞速`;
  $('result-time').textContent=formatTime(physics.elapsed);$('result-best').textContent=formatTime(physics.bestLap);
  $('result').classList.remove('hidden');$('countdown').classList.add('hidden');
}
function updateHUD(){
  $('speed').textContent=Math.round(Math.abs(physics.speed)*3.6);
  $('gear').textContent=physics.gear<0?'R':physics.gear===0?'N':physics.gear;
  $('rpm').style.width=`${THREE.MathUtils.clamp(physics.rpm/9000*100,10,100)}%`;
  $('nitro').style.width=`${physics.nitro}%`;
  $('timer').textContent=formatTime(physics.lapTime);
  $('lap').textContent='LAP '+String(Math.min(physics.lap,sessionMode==='race'?3:999)).padStart(2,'0')+(sessionMode==='race'?' / 03':'');
  $('position').textContent=sessionMode==='race'?`${ranking()} / 4`:'FREE RUN';
  $('best-lap').textContent=Number.isFinite(bestSaved)?formatTime(bestSaved):'—';
  $('notice').textContent=physics.collision>0?'护栏碰撞 · 减速调整方向':physics.boosting?'NITRO ACTIVE · 全速前进':Math.abs(physics.slip)>.06?'轮胎侧滑 · 松开手刹恢复抓地':Math.abs(physics.current.offset)>6.5?'驶离路面 · 注意路肩':'太平洋海岸 · '+(sessionMode==='race'?'三圈竞速':'自由驾驶');
  $('camera-label').textContent=['CHASE CAM','COCKPIT','HOOD CAM','WIDE CAM'][view];drawMap();
}
const cameraPosition=new THREE.Vector3(),lookTarget=new THREE.Vector3(),smoothLook=new THREE.Vector3();let lookInitialized=false;
function updateCamera(dt,time){
  const p=physics.position,forward=new THREE.Vector3(-Math.sin(physics.yaw),0,-Math.cos(physics.yaw));
  if(!active||paused){
    const angle=.1*Math.sin(time*.17);
    cameraPosition.copy(p).add(new THREE.Vector3(5.3+angle,1.65,-6.4));
    lookTarget.copy(p).add(new THREE.Vector3(2.7,-.65,2.1));
  }else if(keys.has('KeyQ')){
    cameraPosition.copy(p).addScaledVector(forward,6.7).add(new THREE.Vector3(0,1.8,0));lookTarget.copy(p).addScaledVector(forward,-12).add(new THREE.Vector3(0,.65,0));
  }else if(view===0){
    cameraPosition.copy(p).addScaledVector(forward,-5.6-Math.abs(physics.speed)*.01).add(new THREE.Vector3(0,1.65,0));
    lookTarget.copy(p).addScaledVector(forward,13).add(new THREE.Vector3(0,.85,0));
  }else if(view===1){
    const right=new THREE.Vector3(Math.cos(physics.yaw),0,-Math.sin(physics.yaw));
    cameraPosition.copy(p).addScaledVector(right,-.34).addScaledVector(forward,.10).add(new THREE.Vector3(0,1.04,0));
    lookTarget.copy(cameraPosition).addScaledVector(forward,30).add(new THREE.Vector3(0,-.4,0));
  }else if(view===2){
    cameraPosition.copy(p).addScaledVector(forward,1.45).add(new THREE.Vector3(0,.9,0));
    lookTarget.copy(cameraPosition).addScaledVector(forward,30).add(new THREE.Vector3(0,-.1,0));
  }else{
    cameraPosition.copy(p).addScaledVector(forward,-11).add(new THREE.Vector3(0,4.5,0));lookTarget.copy(p).addScaledVector(forward,12).add(new THREE.Vector3(0,1,0));
  }
  const instant=active&&!paused&&(view===1||view===2||keys.has('KeyQ'));
  camera.position.lerp(cameraPosition,instant?1:1-Math.exp(-dt*7));
  if(!lookInitialized){smoothLook.copy(lookTarget);lookInitialized=true;}smoothLook.lerp(lookTarget,instant?1:1-Math.exp(-dt*9));
  camera.lookAt(smoothLook);
  const targetFov=active&&!paused?57+Math.min(13,Math.abs(physics.speed)*.12)+(physics.boosting?7:0):48;
  camera.fov=THREE.MathUtils.damp(camera.fov,targetFov,4,dt);camera.updateProjectionMatrix();
}
const mapContext=$('map').getContext('2d');
const bounds=new THREE.Box3().setFromPoints(trackSamples.map(s=>s.p)),mapScale=Math.min(200/(bounds.max.x-bounds.min.x),132/(bounds.max.z-bounds.min.z));
const mapPoint=p=>[20+(p.x-bounds.min.x)*mapScale,20+(p.z-bounds.min.z)*mapScale];
function drawMap(){
  const ctx=mapContext;ctx.clearRect(0,0,240,180);ctx.lineWidth=6;ctx.strokeStyle='#081a24aa';ctx.beginPath();
  for(let i=0;i<SAMPLE_COUNT;i+=5){const [x,y]=mapPoint(trackSamples[i].p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#c7d9e4aa';ctx.stroke();
  const start=mapPoint(trackSamples[0].p);ctx.fillStyle='#fff';ctx.fillRect(start[0]-3,start[1]-3,6,6);
  if(active)for(const r of rivals){const [x,y]=mapPoint(r.car.group.position);ctx.fillStyle='#efa377';ctx.beginPath();ctx.arc(x,y,2.4,0,Math.PI*2);ctx.fill();}
  const [x,y]=mapPoint(physics.position);ctx.save();ctx.translate(x,y);ctx.rotate(-physics.yaw);ctx.fillStyle='#d0f096';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,4);ctx.lineTo(0,2);ctx.lineTo(-4,4);ctx.closePath();ctx.fill();ctx.restore();
}
$('start').onclick=begin;$('restart').onclick=()=>{active=false;document.querySelector('.mode-picker').classList.remove('hidden');begin();};$('return-menu').onclick=returnMenu;
$('sound').onclick=()=>{try{const enabled=audio.toggle();$('sound').textContent='引擎声音 '+(enabled?'ON':'OFF');$('sound').setAttribute('aria-pressed',String(enabled));}catch{$('sound').textContent='浏览器未支持音频';}};
$('fullscreen').onclick=async()=>{try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen();}catch{$('fullscreen').textContent='使用 F11 全屏';}};
$('quality').onclick=()=>{
  high=!high;if(!renderer)return;renderer.setPixelRatio(high?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,.85));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=high;effects.resize();effects.quality(high);$('quality').textContent='画质：'+(high?'高':'流畅')+' ↗';
};
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(active&&paused)return;mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===b));});
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{if(!ready)return;player.setColor(b.dataset.color);$('color-name').textContent=b.dataset.name;document.querySelectorAll('[data-color]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});});
$('help-button').onclick=()=>{helpWasPaused=paused;if(active&&!finished)pause(true);$('help').classList.remove('hidden');};
$('close-help').onclick=()=>{$('help').classList.add('hidden');if(active&&!helpWasPaused&&!finished)pause(false);};
addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.target instanceof HTMLButtonElement&&e.code==='Space')e.target.blur();
  keys.add(e.code);if(e.repeat||!ready)return;
  if(e.code==='KeyC'&&active){view=(view+1)%4;updateHUD();}
  if(e.code==='KeyR'&&active&&!finished){physics.reset(true);resetRivals();countdown=sessionMode==='race'?3.7:0;player.update(physics,0,gameTime);showCountdown();updateHUD();}
  if(e.code==='Escape'){
    if(!$('help').classList.contains('hidden')){$('close-help').click();return;}
    if(active&&!finished)pause(!paused);
  }
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{keys.clear();if(active&&!paused&&!finished)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&active&&!paused&&!finished)pause(true);});
addEventListener('resize',()=>{if(!ready)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);effects.resize();});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();keys.clear();if(active)pause(true);$('loading').classList.remove('hidden');$('load-status').textContent='显卡连接中断，请刷新游戏并切换流畅画质。';});
setup().catch(error=>{console.error(error);$('load-status').textContent='加载失败：'+error.message;$('loading').querySelector('small').textContent='请使用最新版 Chrome / Edge，并确认浏览器开启硬件加速。';});

// Inspection hooks exist only in development; the downloadable build removes them.
export const developerTools = import.meta.env.DEV ? {
  driver: physics,
  curve,
  get vehicle(){return player;},
  get renderer(){return renderer;},
  get rivals(){return rivals;},
} : undefined;

if(import.meta.env.DEV) globalThis.__APEX_DEV__ = developerTools;
