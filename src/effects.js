import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
export function createEffects(renderer,scene,camera){
  const composer=new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.22,.55,1.4);composer.addPass(bloom);
  const finish=new ShaderPass({uniforms:{tDiffuse:{value:null},boost:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float boost;varying vec2 vUv;
  void main(){vec2 d=vUv-.5;float edge=dot(d,d);vec2 offset=d*edge*.005*boost;vec3 c=texture2D(tDiffuse,vUv).rgb;c.r=texture2D(tDiffuse,vUv+offset).r;c.b=texture2D(tDiffuse,vUv-offset).b;c*=1.-edge*.52;gl_FragColor=vec4(c,1.);}`});composer.addPass(finish);
  const fxaa=new ShaderPass(FXAAShader);composer.addPass(fxaa);composer.addPass(new OutputPass());
  return {composer,bloom,update(boost){finish.uniforms.boost.value=boost;},resize(){const ratio=renderer.getPixelRatio();composer.setPixelRatio(ratio);composer.setSize(innerWidth,innerHeight);fxaa.material.uniforms.resolution.value.set(1/(innerWidth*ratio),1/(innerHeight*ratio));},quality(high){bloom.enabled=high;}};
}
export function createTyreEffects(scene){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,2,32,32,30);gradient.addColorStop(0,'rgba(235,239,241,.45)');gradient.addColorStop(1,'rgba(235,239,241,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const positions=new Float32Array(90*3),alpha=new Float32Array(90),sizes=new Float32Array(90),ages=new Float32Array(90).fill(5);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('alpha',new THREE.BufferAttribute(alpha,1));geometry.setAttribute('size',new THREE.BufferAttribute(sizes,1));
  const smoke=new THREE.Points(geometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{map:{value:new THREE.CanvasTexture(canvas)}},vertexShader:'attribute float alpha;attribute float size;varying float a;void main(){a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=min(180.,size*450./max(-p.z,1.));gl_Position=projectionMatrix*p;}',fragmentShader:'varying float a;uniform sampler2D map;void main(){gl_FragColor=texture2D(map,gl_PointCoord);gl_FragColor.a*=a;}'}));smoke.frustumCulled=false;scene.add(smoke);
  const marks=new THREE.InstancedMesh(new THREE.PlaneGeometry(.2,.55),new THREE.MeshStandardMaterial({color:'#182025',transparent:true,opacity:.7,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),1000);marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);marks.frustumCulled=false;const d=new THREE.Object3D();d.scale.set(0,0,0);d.updateMatrix();for(let i=0;i<1000;i++)marks.setMatrixAt(i,d.matrix);scene.add(marks);
  let cursor=0,markCursor=0,timer=0;
  return {update(dt,state){
    timer+=dt;
    const drifting=Math.abs(state.slip)>.05&&Math.abs(state.speed)>10;
    if(drifting&&timer>.04){timer=0;for(const side of [-1,1]){
      const x=state.position.x+Math.cos(state.yaw)*side*.83+Math.sin(state.yaw)*1.4,z=state.position.z-Math.sin(state.yaw)*side*.83+Math.cos(state.yaw)*1.4;
      positions[cursor*3]=x;positions[cursor*3+1]=state.position.y+.4;positions[cursor*3+2]=z;ages[cursor]=0;cursor=(cursor+1)%90;
      d.position.set(x,state.position.y+.07,z);d.rotation.set(-Math.PI/2,0,-state.yaw);d.scale.set(1,Math.min(3,Math.abs(state.speed)*.05),1);d.updateMatrix();marks.setMatrixAt(markCursor,d.matrix);markCursor=(markCursor+1)%1000;
    }marks.instanceMatrix.needsUpdate=true;}
    for(let i=0;i<90;i++){ages[i]+=dt;alpha[i]=Math.max(0,1-ages[i]/1.8);sizes[i]=.5+ages[i]*1.2;positions[i*3+1]+=dt*.5;}
    geometry.attributes.position.needsUpdate=true;geometry.attributes.alpha.needsUpdate=true;geometry.attributes.size.needsUpdate=true;
  }};
}
