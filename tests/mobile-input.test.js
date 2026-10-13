import test from 'node:test';
import assert from 'node:assert/strict';
import {screenGravity,steeringFromGravity,TiltSteering} from '../src/mobile-input.js';
function fakeWindow(permission='granted'){
 const w=new EventTarget();w.isSecureContext=true;w.time=0;w.performance={now:()=>w.time};
 w.DeviceOrientationEvent=class {static async requestPermission(){w.requests++;return permission;}};
 w.requests=0;w.screen={orientation:new EventTarget()};w.screen.orientation.angle=0;
 w.setTimeout=fn=>{w.timeout=fn;return 1;};w.clearTimeout=()=>{w.timeout=null;};
 w.sample=(beta,gamma)=>{w.time+=20;const e=new Event('deviceorientation');Object.assign(e,{beta,gamma});w.dispatchEvent(e);};
 return w;
}
test('gravity uses the screen axes in portrait and both landscape directions',()=>{
 assert.ok(screenGravity(0,20,0)>.3);assert.ok(screenGravity(20,0,90)>.3);
 assert.ok(screenGravity(20,0,270)<-.3);assert.ok(Math.abs(screenGravity(20,0,0))<1e-9);
});
test('steering dead zone, neutral offset and saturation reject jitter and runaway input',()=>{
 assert.equal(steeringFromGravity(.015),0);assert.equal(steeringFromGravity(.2,.2),0);
 assert.equal(steeringFromGravity(1),-1);assert.equal(steeringFromGravity(-1),1);
});
test('iOS permission is requested, the first reading calibrates and tilt turns smoothly',async()=>{
 const w=fakeWindow(),t=new TiltSteering(w);assert.equal(await t.enable(),true);assert.equal(w.requests,1);
 w.sample(0,12);assert.equal(t.read(.1),0);w.sample(0,30);assert.ok(t.read(.3)<-.5);
 t.calibrate();assert.equal(t.read(.3),0);t.disable();assert.equal(t.enabled,false);
});
test('rejected and unavailable permissions leave touch fallback available',async()=>{
 const denied=new TiltSteering(fakeWindow('denied'));assert.equal(await denied.enable(),false);assert.equal(denied.enabled,false);
 const w=fakeWindow();w.isSecureContext=false;assert.equal(await new TiltSteering(w).enable(),false);assert.equal(w.requests,0);
});
test('invalid readings are ignored and missing sensor data disables tilt safely',async()=>{
 const w=fakeWindow(),t=new TiltSteering(w);await t.enable();w.sample(null,null);assert.equal(t.latest,null);
 w.timeout();assert.equal(t.enabled,false);assert.equal(t.read(.2),0);
});
test('orientation changes recalibrate and stale sensor readings return to zero',async()=>{
 const w=fakeWindow(),t=new TiltSteering(w);await t.enable();w.sample(0,0);w.sample(0,25);assert.ok(t.read(.2)<-.5);
 w.screen.orientation.angle=90;w.screen.orientation.dispatchEvent(new Event('change'));assert.equal(t.read(.2),0);
 w.sample(10,0);assert.equal(t.read(.2),0);w.sample(25,0);assert.ok(t.read(.2)<-.5);
 w.time+=1500;assert.ok(Math.abs(t.read(1))<.001);t.disable();
});

test('a perfectly level zero reading is valid and must not trigger missing-sensor fallback',async()=>{
 const w=fakeWindow(),t=new TiltSteering(w);await t.enable();w.sample(0,0);w.timeout();assert.equal(t.enabled,true);assert.equal(t.read(.2),0);t.disable();
});
