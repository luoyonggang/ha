import test from 'node:test';
import assert from 'node:assert/strict';
import {DrivingPhysics} from '../src/physics.js';
import {trackSamples, SAMPLE_COUNT} from '../src/track.js';
const idle={throttle:false,brake:false,turn:0,handbrake:false,boost:false};
function drive(car,input,seconds){for(let i=0;i<seconds*120;i++)car.step(1/120,{...idle,...input});}
test('accelerates, brakes and reverses without input drift',()=>{
 const car=new DrivingPhysics();drive(car,{},1);assert.equal(car.speed,0);
 drive(car,{throttle:true},2);assert.ok(car.speed>17);
 drive(car,{brake:true},1);assert.ok(car.speed<2);drive(car,{brake:true},1);assert.ok(car.speed<0);
 car.reset();assert.equal(car.speed,0);assert.equal(car.motion.length(),0);
});
test('nitro accelerates faster, drains and then recharges',()=>{
 const a=new DrivingPhysics(),b=new DrivingPhysics();drive(a,{throttle:true},1);drive(b,{throttle:true},1);
 drive(a,{throttle:true,boost:true},1);drive(b,{throttle:true},1);
 assert.ok(a.speed>b.speed+5);assert.ok(a.nitro<100);const fuel=a.nitro;drive(a,{},1);assert.ok(a.nitro>fuel);
});
test('left input turns left and handbrake creates recoverable tyre slip',()=>{
 const car=new DrivingPhysics();drive(car,{throttle:true},1);const heading=car.yaw;
 drive(car,{throttle:true,turn:1,handbrake:true},.3);assert.ok(car.yaw>heading);assert.ok(Math.abs(car.slip)>.025);
 drive(car,{},1);assert.ok(Math.abs(car.slip)<.025);
});
test('barrier constrains motion and reduces kinetic energy',()=>{
 const car=new DrivingPhysics(),near=car.current;car.position.copy(near.p).addScaledVector(near.n,12);car.motion.copy(near.n).multiplyScalar(20);car.step(1/120,idle);
 assert.ok(Math.abs(car.current.offset)>8.85);assert.ok(car.collision>0);assert.ok(car.motion.length()<20);
 const p=car.position.clone().sub(car.current.p);assert.ok(Math.abs(p.dot(car.current.n))<=8.81);
});
test('continuous full forward travel earns a lap; reverse line crossings do not',()=>{
 const car=new DrivingPhysics();car.position.copy(trackSamples[0].p);car.lastProgress=0;
 const jumpTo=i=>{car.position.copy(trackSamples[i%SAMPLE_COUNT].p);car.motion.set(0,0,0);car.step(1/120,idle);};
 for(let i=5;i<=SAMPLE_COUNT+5;i+=5)jumpTo(i);
 assert.equal(car.completedLaps,1);assert.ok(Number.isFinite(car.bestLap));
 const reverse=new DrivingPhysics();reverse.position.copy(trackSamples[5].p);reverse.lastProgress=5/SAMPLE_COUNT;
 for(let i=0;i<8;i++){reverse.position.copy(trackSamples[i%2?5:SAMPLE_COUNT-5].p);reverse.motion.set(0,0,0);reverse.step(1/120,idle);}
 assert.equal(reverse.completedLaps,0);
});
