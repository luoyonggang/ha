import * as THREE from 'three';
import {closestTrack,trackSamples,SAMPLE_COUNT} from './track.js';
export class DrivingPhysics {
  constructor() {
    this.position=new THREE.Vector3();this.motion=new THREE.Vector3();
    this.bestLap=Infinity;this.completedLaps=0;this.reset(true);
  }
  reset(newSession=false) {
    const start=closestTrack(0,18);
    this.position.set(start.p.x,start.p.y,start.p.z);
    this.yaw=Math.atan2(-start.t.x,-start.t.z);this.motion.set(0,0,0);
    this.speed=0;this.steering=0;this.slip=0;this.roll=0;this.pitch=0;
    this.nitro=100;this.boosting=false;this.gear=0;this.rpm=900;
    this.current=start;this.lastProgress=start.index/SAMPLE_COUNT;this.lapTravel=0;
    this.lapTime=0;this.lap=1;this.elapsed=0;this.distanceDriven=0;this.cleanLap=true;
    if(newSession){this.bestLap=Infinity;this.completedLaps=0;}
  }
  step(dt,input) {
    const {throttle,brake,turn,handbrake,boost}=input;
    this.elapsed+=dt;this.lapTime+=dt;
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    let longitudinal=this.motion.dot(forward),lateral=this.motion.dot(right);
    const oldSpeed=longitudinal;
    this.steering=THREE.MathUtils.damp(this.steering,turn,7,dt);
    this.boosting=boost&&throttle&&this.nitro>0&&longitudinal>3;
    this.nitro=THREE.MathUtils.clamp(this.nitro+(this.boosting?-24:9)*dt,0,100);
    const acceleration=throttle?(11.5/(1+Math.max(0,longitudinal)*.009)+(this.boosting?13:0)):0;
    longitudinal+=acceleration*dt;
    if(brake) longitudinal-=longitudinal>1?28*dt:7*dt;
    if(handbrake) longitudinal*=Math.exp(-.6*dt);
    longitudinal*=Math.exp(-(.025+Math.abs(longitudinal)*.00055+(throttle||brake?0:.10))*dt);
    longitudinal=THREE.MathUtils.clamp(longitudinal,-11,this.boosting?96:86);
    if(!throttle&&!brake&&Math.abs(longitudinal)<.10)longitudinal=0;
    // Bicycle steering with speed-sensitive steering lock, then tyre grip recovery.
    const steerAngle=this.steering*.43/(1+Math.abs(longitudinal)*.038);
    const yawRate=longitudinal/2.65*Math.tan(steerAngle)*(handbrake?1.75:1);
    this.yaw+=yawRate*dt;
    const newForward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const newRight=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    lateral-=yawRate*longitudinal*dt*(handbrake?.65:.12);
    lateral*=Math.exp(-(handbrake?1.5:9)*dt);
    this.motion.copy(newForward).multiplyScalar(longitudinal).addScaledVector(newRight,lateral);
    this.position.addScaledVector(this.motion,dt);
    const near=closestTrack(this.position.x,this.position.z);
    this.current=near;
    if(Math.abs(near.offset)>6.45)this.motion.multiplyScalar(Math.exp(-.7*dt));
    if(Math.abs(near.offset)>8.85) {
      this.position.x=near.p.x+near.n.x*Math.sign(near.offset)*8.8;
      this.position.z=near.p.z+near.n.z*Math.sign(near.offset)*8.8;
      const outward=this.motion.dot(near.n)*Math.sign(near.offset);
      if(outward>0)this.motion.addScaledVector(near.n,-outward*Math.sign(near.offset)*1.3);
      this.motion.multiplyScalar(.83);this.collision=.35;
    }
    this.collision=Math.max(0,(this.collision||0)-dt);
    this.position.y=near.p.y;
    this.speed=this.motion.dot(newForward);
    this.slip=Math.atan2(lateral,Math.abs(longitudinal)+1);
    this.roll=THREE.MathUtils.damp(this.roll,-yawRate*longitudinal*.0025,5,dt);
    this.pitch=THREE.MathUtils.damp(this.pitch,THREE.MathUtils.clamp((longitudinal-oldSpeed)/dt*.002,-.055,.045),5,dt);
    this.gear=this.speed<-.5?-1:this.speed<.3?0:Math.min(7,1+Math.floor(this.speed/13));
    this.rpm=this.gear<=0?900:2400+(Math.abs(this.speed)%13)/13*5900;
    this.distanceDriven+=this.motion.length()*dt;
    const progress=near.index/SAMPLE_COUNT;
    let diff=progress-this.lastProgress;
    if(diff<-.5)diff+=1;if(diff>.5)diff-=1;
    // Count signed continuous travel. Reversing over the finish cannot award a lap.
    if(Math.abs(diff)<.05)this.lapTravel+=diff;
    this.lastProgress=progress;
    this.newLap=false;
    if(this.lapTravel>=1) {
      this.bestLap=Math.min(this.bestLap,this.lapTime);this.completedLaps++;
      this.lap++;this.lapTravel-=1;this.lapTime=0;this.newLap=true;
    }
  }
  recover() {this.reset(false);}
}
