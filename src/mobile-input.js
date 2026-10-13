const radians=Math.PI/180;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
export function screenGravity(beta,gamma,angle=0){
  const x=Math.sin(gamma*radians)*Math.cos(beta*radians);
  const y=Math.sin(beta*radians),a=angle*radians;
  return x*Math.cos(a)+y*Math.sin(a);
}
export function steeringFromGravity(value,neutral=0,sensitivity=.28,deadZone=.025){
  const delta=value-neutral;
  if(Math.abs(delta)<=deadZone)return 0;
  return -Math.sign(delta)*clamp((Math.abs(delta)-deadZone)/Math.max(.05,sensitivity-deadZone),0,1);
}
export class TiltSteering {
  constructor(target=globalThis.window,onStatus=()=>{}){
    this.target=target;this.onStatus=onStatus;this.enabled=false;this.raw=0;this.smoothed=0;
    this.neutral=0;this.lastSample=0;this.latest=null;this.pendingCalibration=false;this.sensitivity=.28;
    this.onSample=this.onSample.bind(this);this.onRotate=this.onRotate.bind(this);
  }
  angle(){return this.target.screen?.orientation?.angle??this.target.orientation??0;}
  status(message){this.onStatus(message,this.enabled);}
  async enable(){
    if(this.enabled){this.disable();return false;}
    const EventType=this.target.DeviceOrientationEvent;
    if(!this.target.isSecureContext){this.status('重力需要 HTTPS 在线打开；可先用方向按钮。');return false;}
    if(!EventType){this.status('浏览器不支持重力传感器，请用方向按钮。');return false;}
    try{
      // iOS permission must be requested directly from the user's tap.
      if(typeof EventType.requestPermission==='function'){
        const permission=await EventType.requestPermission();
        if(permission!=='granted'){this.status('重力权限未允许；可使用方向按钮或重新授权。');return false;}
      }
    }catch{this.status('无法取得重力权限，请检查浏览器设置或用方向按钮。');return false;}
    this.enabled=true;this.pendingCalibration=true;this.latest=null;this.raw=this.smoothed=0;
    this.target.addEventListener('deviceorientation',this.onSample);
    this.target.addEventListener('orientationchange',this.onRotate);
    this.target.screen?.orientation?.addEventListener('change',this.onRotate);
    this.status('请保持手机中立，正在读取重力传感器…');
    this.timeout=this.target.setTimeout(()=>{
      if(this.latest===null){this.disable(false);this.status('未收到重力数据，请使用方向按钮并检查传感器权限。');}
    },4000);
    return true;
  }
  onSample(event){
    if(!this.enabled||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
    const value=screenGravity(event.beta,event.gamma,this.angle());
    this.latest=value;this.lastSample=this.target.performance.now();
    if(this.pendingCalibration){this.neutral=value;this.pendingCalibration=false;this.status('重力已开启：向左右倾斜手机转向。');}
    this.raw=steeringFromGravity(value,this.neutral,this.sensitivity);
  }
  onRotate(){this.pendingCalibration=true;this.raw=this.smoothed=0;this.latest=null;this.status('屏幕方向已改变，请保持中立重新校准。');}
  calibrate(){
    this.raw=this.smoothed=0;
    if(this.latest!==null&&this.target.performance.now()-this.lastSample<1000){this.neutral=this.latest;this.pendingCalibration=false;this.status('已校准，当前姿势为中立位置。');}
    else{this.pendingCalibration=true;this.status(this.enabled?'请保持手机中立，等待下一次重力读数。':'请先开启重力操作。');}
  }
  read(dt){
    const goal=this.enabled&&this.target.performance.now()-this.lastSample<1000?this.raw:0;
    this.smoothed+=(goal-this.smoothed)*(1-Math.exp(-Math.max(0,dt)*12));
    return this.smoothed;
  }
  disable(report=true){
    this.target.removeEventListener('deviceorientation',this.onSample);
    this.target.removeEventListener('orientationchange',this.onRotate);
    this.target.screen?.orientation?.removeEventListener('change',this.onRotate);
    this.target.clearTimeout(this.timeout);this.enabled=false;this.raw=this.smoothed=0;this.latest=null;
    if(report)this.status('触屏驾驶：使用左右方向按钮转向。');
  }
}
export class TouchControls {
  constructor(buttons,target=globalThis.window){
    this.pointers=new Map();this.buttons=[...buttons];this.actions=new Set();
    const release=event=>this.release(event.pointerId);
    for(const button of this.buttons){
      button.addEventListener('pointerdown',event=>{
        event.preventDefault();this.release(event.pointerId);
        this.pointers.set(event.pointerId,{action:button.dataset.drive,button});
        try{button.setPointerCapture(event.pointerId);}catch{}
        this.refresh();
      });
      for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,release);
      button.addEventListener('contextmenu',event=>event.preventDefault());
    }
    target.addEventListener('pointerup',release);target.addEventListener('pointercancel',release);
  }
  release(id){if(this.pointers.delete(id))this.refresh();}
  refresh(){
    this.actions=new Set([...this.pointers.values()].map(p=>p.action));
    for(const button of this.buttons){const held=this.actions.has(button.dataset.drive);button.classList.toggle('pressed',held);button.setAttribute('aria-pressed',String(held));}
  }
  clear(){this.pointers.clear();this.refresh();}
  has(action){return this.actions.has(action);}
}
