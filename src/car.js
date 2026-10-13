import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import carURL from './assets/ferrari.glb?url';
import mobileURL from './assets/ferrari-mobile.glb?url';
import lodURL from './assets/ferrari-lod.glb?url';
import aoURL from './assets/ferrari_ao.png?url';

export async function loadCars({mobile=false}={}){
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [high,low]=await Promise.all([loader.loadAsync(import.meta.env.VITE_MOBILE_BUILD==='1'?mobileURL:mobile?mobileURL:carURL),loader.loadAsync(lodURL)]);
  const ao=await new THREE.TextureLoader().loadAsync(aoURL);
  return {high:high.scene,low:low.scene,ao};
}
export function makeCar(scene,assets,color='#ed5e32',highDetail=true){
  const vehicle=new THREE.Group();
  const model=(highDetail?assets.high:assets.low).clone(true);
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.material=o.material.clone();o.castShadow=highDetail;o.receiveShadow=true;
    if(!o.geometry.attributes.normal){
      // Thin model panels include opposite faces sharing positions after simplification.
      // Keep their normals separate; averaging them produces zero normals and black sparkles.
      if(o.geometry.index)o.geometry=o.geometry.toNonIndexed();
      o.geometry.computeVertexNormals();
    }
    if(/tire/i.test(o.name)){o.material.color.set('#161a1c');o.material.roughness=.95;o.material.metalness=0;}
    if(/carbon/i.test(o.name)){o.material.color.set('#1d252a');o.material.roughness=.42;}
  });
  const paint=new THREE.MeshPhysicalMaterial({color,metalness:.65,roughness:.28,clearcoat:1,clearcoatRoughness:.075,envMapIntensity:1.45});
  model.getObjectByName('body').material=paint;
  const trim=new THREE.MeshStandardMaterial({color:'#c7cbd0',metalness:.95,roughness:.2,envMapIntensity:1.1});
  ['rim_fl','rim_fr','rim_rl','rim_rr','trim'].forEach(n=>{const o=model.getObjectByName(n);if(o)o.material=trim;});
  model.getObjectByName('glass').material=new THREE.MeshPhysicalMaterial({color:'#9aaeb8',metalness:.28,roughness:.08,transparent:true,opacity:.32,depthWrite:false,envMapIntensity:.9});
  const rearMaterial=new THREE.MeshStandardMaterial({color:'#8d140c',emissive:'#ff2410',emissiveIntensity:.7,roughness:.18});
  model.getObjectByName('lights_red').material=rearMaterial;
  model.getObjectByName('leds').material=new THREE.MeshStandardMaterial({color:'#e8f3ff',emissive:'#d7edff',emissiveIntensity:3,roughness:.2});
  vehicle.add(model);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.65,5.3),new THREE.MeshBasicMaterial({map:assets.ao,transparent:true,opacity:.75,depthWrite:false,blending:THREE.MultiplyBlending,premultipliedAlpha:true,toneMapped:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=.045;shadow.renderOrder=1;vehicle.add(shadow);
  // Independent front steering pivots keep steering separate from wheel rotation.
  const wheels=[];
  ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'].forEach((name,i)=>{
    const wheel=model.getObjectByName(name);const pivot=new THREE.Group();
    pivot.position.copy(wheel.position);wheel.parent.add(pivot);pivot.add(wheel);wheel.position.set(0,0,0);
    wheels.push({wheel,pivot,front:i<2});
  });
  const headlights=[];
  if(highDetail)for(const x of [-.68,.68]){
    const light=new THREE.SpotLight('#dcecff',75,60,.34,.5,1.5);light.position.set(x,.62,-1.8);light.target.position.set(x*.6,-.2,-35);vehicle.add(light,light.target);headlights.push(light);
  }
  const boostFlames=[];
  for(const x of [-.25,0,.25]){
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.065,.7,10),new THREE.MeshBasicMaterial({color:'#91e7ff',transparent:true,opacity:.85,depthWrite:false}));flame.rotation.x=Math.PI/2;flame.position.set(x,.35,2.38);flame.visible=false;vehicle.add(flame);boostFlames.push(flame);
  }
  scene.add(vehicle);
  return {group:vehicle,model,paint,wheels,rearMaterial,boostFlames,headlights,
    setColor(value){paint.color.set(value);},
    update(state,dt,time){
      vehicle.position.copy(state.position);
      const grade=Math.atan2(state.current?.t.y||0,Math.hypot(state.current?.t.x||0,state.current?.t.z||1));
      vehicle.rotation.set((state.pitch||0)+grade,state.yaw,THREE.MathUtils.clamp(state.roll||0,-.07,.07),'YXZ');
      model.position.y=Math.sin(time*38)*Math.min(Math.abs(state.speed)*.00012,.006);
      for(const {wheel,pivot,front} of wheels){wheel.rotation.x-=state.speed*dt/.355;if(front)pivot.rotation.y=(state.steering||0)*.35/(1+Math.abs(state.speed)*.025);}
      rearMaterial.emissiveIntensity=state.braking?3.4:.75;
      for(const f of boostFlames){f.visible=!!state.boosting;f.scale.y=.7+Math.random()*.55;}
    },
  };
}
