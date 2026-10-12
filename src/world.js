import * as THREE from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {roadGeometry, trackSamples, trackLength, SAMPLE_COUNT, closestTrack, curve} from './track.js';
import grassURL from './assets/grass.jpg?url';

let seed=93621;
export function random(){seed=seed*16807%2147483647;return(seed-1)/2147483646;}
const dummy=new THREE.Object3D();
const v=new THREE.Vector3();
const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
function instanced(scene,geometry,material,transforms,shadow=false) {
  const mesh=new THREE.InstancedMesh(geometry,material,transforms.length);
  transforms.forEach((t,i)=>{
    dummy.position.set(...t.p);dummy.rotation.set(...(t.r||[0,0,0]));dummy.scale.set(...(t.s||[1,1,1]));
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    if(t.color)mesh.setColorAt(i,new THREE.Color(t.color));
  });mesh.castShadow=shadow;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
}
function mesh(scene,geometry,material,position=[0,0,0]){
  const m=new THREE.Mesh(geometry,material);m.position.set(...position);m.receiveShadow=true;scene.add(m);return m;
}
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n);}
function noise(x,z){
  const a=Math.floor(x),b=Math.floor(z),f=x-a,g=z-b,s=f*f*(3-2*f),t=g*g*(3-2*g);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),s),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);
}
function fbm(x,z){return noise(x,z)*.55+noise(x*2,z*2)*.25+noise(x*4,z*4)*.12+noise(x*8,z*8)*.08;}
export function coastX(z){return -130+Math.sin(z*.007)*30+Math.sin(z*.023)*12;}
export function terrainHeight(x,z){
  const distance=x-coastX(z);
  if(distance<0)return -9+Math.max(-4,distance*.025);
  let h=8+fbm(x*.005,z*.005)*38+Math.max(0,x-620)*.10;
  h*=THREE.MathUtils.smoothstep(distance,0,95);
  let best=Infinity,roadY=3;
  for(let i=0;i<SAMPLE_COUNT;i+=6){const p=trackSamples[i].p,d=(x-p.x)**2+(z-p.z)**2;if(d<best){best=d;roadY=p.y;}}
  const d=Math.sqrt(best);
  const blend=THREE.MathUtils.smoothstep(d,18,80);
  return THREE.MathUtils.lerp(roadY-.24,h,blend);
}
function makeAsphalt(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),data=ctx.createImageData(512,512),bump=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
    const k=(y*512+x)*4,r=random(),cloud=fbm(x*.014,y*.014),c=42+cloud*16+r*28;
    data.data[k]=c*.92;data.data[k+1]=c*.98;data.data[k+2]=c*1.04;data.data[k+3]=255;
    const value=80+r*160;bump.data[k]=bump.data[k+1]=bump.data[k+2]=value;bump.data[k+3]=255;
  }
  ctx.putImageData(data,0,0);
  // Longitudinal repaired cracks and subtle tyre wear, baked into the tile.
  ctx.strokeStyle='#363b3e';ctx.lineWidth=.7;
  for(let i=0;i<7;i++){let x=random()*512;ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<=512;y+=12){x+=(random()-.5)*13;ctx.lineTo(x,y);}ctx.stroke();}
  const diffuse=new THREE.CanvasTexture(canvas);diffuse.colorSpace=THREE.SRGBColorSpace;
  const b=document.createElement('canvas');b.width=b.height=512;b.getContext('2d').putImageData(bump,0,0);
  const bumpMap=new THREE.CanvasTexture(b);
  for(const t of [diffuse,bumpMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}
  return{diffuse,bumpMap};
}
function branchTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  for(let i=0;i<12;i++){
    const a=i*Math.PI*2/12,ex=128+Math.cos(a)*115,ey=128+Math.sin(a)*115;
    ctx.strokeStyle='#4b4631';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(128,128);ctx.lineTo(ex,ey);ctx.stroke();
    for(let j=2;j<32;j++){
      const t=j/33,px=128+(ex-128)*t,py=128+(ey-128)*t,l=(1-t)*19+6;
      for(const side of [-1,1]){ctx.strokeStyle=['#243d2e','#35503a','#53674a'][j%3];ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(a+side*.75)*l,py+Math.sin(a+side*.75)*l);ctx.stroke();}
    }
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function pineTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=512;const ctx=c.getContext('2d');
  ctx.strokeStyle='#635849';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(128,18);ctx.lineTo(128,512);ctx.stroke();
  for(let layer=34;layer>=0;layer--){
    const y=20+layer*12.5,span=5+layer*3.0;
    for(const side of [-1,1]){
      const length=span*(.7+random()*.3);
      ctx.strokeStyle='#413f2e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(128,y);ctx.lineTo(128+side*length,y+13);ctx.stroke();
      for(let i=0;i<120;i++){
        const f=random(),x=128+side*length*f+(random()-.5)*9,py=y+f*12+(random()-.5)*20;
        ctx.strokeStyle=['#263e31','#304936','#3a5038','#4b5c41'][Math.floor(random()*4)];ctx.lineWidth=1.4;
        ctx.beginPath();ctx.moveTo(x,py);ctx.lineTo(x+side*(3+random()*4),py-3-random()*6);ctx.stroke();
      }
    }
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function rockTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d'),pixels=ctx.createImageData(256,256);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const k=(y*256+x)*4,n=fbm(x*.05,y*.05),f=120+n*55+random()*20;
    pixels.data[k]=f;pixels.data[k+1]=f*.96;pixels.data[k+2]=f*.89;pixels.data[k+3]=255;
  }ctx.putImageData(pixels,0,0);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeTerrain(scene){
  const geometry=new THREE.PlaneGeometry(3000,2700,240,220);geometry.rotateX(-Math.PI/2);geometry.translate(500,0,-100);
  const position=geometry.attributes.position,colors=[];const brown=new THREE.Color('#8e826a'),green=new THREE.Color('#637257');
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i),h=terrainHeight(x,z);position.setY(i,h);
    const c=brown.clone().lerp(green,THREE.MathUtils.smoothstep(x-coastX(z),20,140)*.85);
    c.multiplyScalar(.83+noise(x*.02,z*.02)*.25);colors.push(c.r,c.g,c.b);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.computeVertexNormals();
  const texture=new THREE.TextureLoader().load(grassURL);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(180,160);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map:texture,color:'#eee3ce',vertexColors:true,roughness:1});
  const terrain=mesh(scene,geometry,material);terrain.castShadow=true;
  // Jagged granite formations, detailed rather than pyramid mountains.
  const geo=mergeVertices(new THREE.IcosahedronGeometry(1,3)),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).multiplyScalar(1+fbm(p.getX(i)*4,p.getZ(i)*4)*.23);p.setXYZ(i,v.x,v.y,v.z);}geo.computeVertexNormals();
  const rock=rockTexture(),rockMat=new THREE.MeshStandardMaterial({color:'#9c9488',map:rock,bumpMap:rock,bumpScale:.16,roughness:.95});
  const rocks=[];
  for(let i=0;i<210;i++){
    const z=random()*2000-1050,x=coastX(z)+random()*70-40,y=terrainHeight(x,z),size=4+random()*19;
    if(closestTrack(x,z).distance<size*1.6+14)continue;
    rocks.push({p:[x,y+size*.1,z],r:[random(),random()*6,random()],s:[size,size*.8,size*1.3]});
  }
  for(let i=0;i<80;i++){
    const s=trackSamples[Math.floor(random()*SAMPLE_COUNT)],x=s.p.x+s.n.x*(35+random()*130),z=s.p.z+s.n.z*(35+random()*130);
    if(x<coastX(z)+80)continue;const size=2+random()*7;rocks.push({p:[x,terrainHeight(x,z)+size*.2,z],r:[random(),random()*6,random()],s:[size,size*.6,size]});
  }
  instanced(scene,geo,rockMat,rocks,true);
}
function makeVegetation(scene){
  const trunks=[],foliage=[],grasses=[];
  for(let i=0;i<350;i++){
    const s=trackSamples[Math.floor(random()*SAMPLE_COUNT)],side=random()<.3?-1:1,offset=side*(19+random()*190);
    const x=s.p.x+s.n.x*offset,z=s.p.z+s.n.z*offset;
    if(x<coastX(z)+55)continue;
    const y=terrainHeight(x,z),h=8+random()*15;
    trunks.push({p:[x,y+h/2,z],s:[.2+random()*.12,h,.2+random()*.12]});
    const angle=random()*Math.PI;
    for(let k=0;k<3;k++)foliage.push({p:[x,y+h*.51,z],r:[0,angle+k*Math.PI/3,0],s:[h*.67,h,1],color:new THREE.Color().setHSL(.28+random()*.04,.12,.86+random()*.08).getHex()});
  }
  instanced(scene,new THREE.CylinderGeometry(.55,1,1,7),mat('#655b49'),trunks,true);
  instanced(scene,new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:pineTexture(),alphaTest:.3,side:THREE.DoubleSide,roughness:1}),foliage,false);
  // Low roadside tufts use the same needle texture; avoid per-blade draw calls.
  for(let i=0;i<1700;i++){
    const s=trackSamples[Math.floor(random()*SAMPLE_COUNT)],o=(random()<.5?-1:1)*(9.9+random()*12);
    const x=s.p.x+s.n.x*o,z=s.p.z+s.n.z*o;
    grasses.push({p:[x,terrainHeight(x,z)+.3,z],r:[0,random()*6,0],s:[.7+random()*.7,.45+random()*.6,1],color:random()<.5?'#b7ad78':'#839574'});
  }
  instanced(scene,new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:branchTexture(),alphaTest:.4,side:THREE.DoubleSide,roughness:1}),grasses);
}
function makeRoad(scene){
  const {diffuse,bumpMap}=makeAsphalt();
  const asphalt=new THREE.MeshStandardMaterial({map:diffuse,bumpMap,bumpScale:.022,roughness:.68,metalness:0,envMapIntensity:.14});
  mesh(scene,roadGeometry(0,14),asphalt);
  for(const side of [-1,1]) {
    mesh(scene,roadGeometry(side*7.7,1.4,.014),mat('#8c8373'));
    mesh(scene,roadGeometry(side*6.5,.13,.055),mat('#e1dbc5'));
  }
  const marks=[],kerbsWhite=[],kerbsRed=[],rails=[],posts=[],reflectors=[];
  const segment=trackLength/SAMPLE_COUNT;
  for(let i=0;i<SAMPLE_COUNT;i+=4){
    const {p,t,n}=trackSamples[i],yaw=Math.atan2(t.x,t.z),pitch=-Math.atan2(t.y,Math.hypot(t.x,t.z));
    marks.push({p:[p.x,p.y+.057,p.z],r:[pitch,yaw,0],s:[.11,.018,3.6]});
    for(const side of [-1,1]){
      const q=p.clone().addScaledVector(n,side*7.25);
      (i%8?kerbsRed:kerbsWhite).push({p:[q.x,p.y+.075,q.z],r:[pitch,yaw,0],s:[.46,.12,segment*4+.03]});
    }
  }
  const box=new THREE.BoxGeometry(1,1,1);
  instanced(scene,box,mat('#dcdac9',.65),marks);
  instanced(scene,box,mat('#c7c0b0'),kerbsWhite);
  instanced(scene,box,mat('#ac4d3e'),kerbsRed);
  for(let i=0;i<SAMPLE_COUNT;i+=5){
    const {p,t,n}=trackSamples[i],yaw=Math.atan2(t.x,t.z),pitch=-Math.atan2(t.y,Math.hypot(t.x,t.z));
    for(const side of [-1,1]){
      const q=p.clone().addScaledVector(n,side*9.15);
      rails.push({p:[q.x,p.y+.78,q.z],r:[pitch,yaw,0],s:[.11,.25,segment*5+.08]});
      rails.push({p:[q.x,p.y+.98,q.z],r:[pitch,yaw,0],s:[.08,.065,segment*5+.08]});
      posts.push({p:[q.x,p.y+.5,q.z],r:[0,yaw,0],s:[.13,1.1,.12]});
      if(i%15===0)reflectors.push({p:[q.x,p.y+1.08,q.z],r:[0,yaw,0],s:[.16,.12,.045]});
    }
  }
  instanced(scene,box,mat('#7e8d94',.32,.8),rails);
  instanced(scene,box,mat('#8a969a',.5,.75),posts);
  instanced(scene,box,new THREE.MeshStandardMaterial({color:'#ffc78b',emissive:'#ff9d45',emissiveIntensity:.7}),reflectors);
  // Start line and suspended gantry.
  const checks=[];
  for(let x=0;x<14;x++)for(let z=0;z<2;z++)checks.push({p:[x-6.5,3.065,z-3],s:[1,.01,1],color:(x+z)%2?'#1b2327':'#e4dfcd'});
  instanced(scene,box,mat('#ffffff'),checks);
  const gantry=mat('#242f32',.5,.5),legs=[{p:[-9.4,7,-9],s:[.4,8,.4]},{p:[9.4,7,-9],s:[.4,8,.4]},{p:[0,11,-9],s:[19.3,.45,.5]}];
  instanced(scene,box,gantry,legs,true);
  const signCanvas=document.createElement('canvas');signCanvas.width=2048;signCanvas.height=256;const ctx=signCanvas.getContext('2d');
  ctx.fillStyle='#172229';ctx.fillRect(0,0,2048,256);ctx.fillStyle='#d0f096';ctx.font='italic bold 100px Arial';ctx.textAlign='center';ctx.fillText('APEX  /  PACIFIC GRAND TOUR',1024,166);
  const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;
  const sign=mesh(scene,new THREE.PlaneGeometry(17.7,2.21),new THREE.MeshStandardMaterial({map:signTexture,emissiveMap:signTexture,emissive:'#ffffff',emissiveIntensity:.18,side:THREE.DoubleSide}),[0,10.75,-8.65]);
  // Road lamps, chevrons and signs at corners.
  const lampPoles=[],lampArms=[],lamps=[];
  for(let i=20;i<SAMPLE_COUNT;i+=35){
    const {p,t,n}=trackSamples[i],q=p.clone().addScaledVector(n,10.5),yaw=Math.atan2(t.x,t.z);
    lampPoles.push({p:[q.x,p.y+4.5,q.z],s:[.15,9,.15]});
    lampArms.push({p:[q.x-n.x*1.8,p.y+8.6,q.z-n.z*1.8],r:[0,yaw,0],s:[3.8,.11,.13]});
    lamps.push({p:[q.x-n.x*3.4,p.y+8.52,q.z-n.z*3.4],r:[0,yaw,0],s:[.7,.08,.4]});
  }
  instanced(scene,box,mat('#535e63',.45,.7),lampPoles);
  instanced(scene,box,mat('#535e63',.45,.7),lampArms);
  instanced(scene,box,new THREE.MeshStandardMaterial({color:'#fff0d2',emissive:'#ffe6b7',emissiveIntensity:3}),lamps);
  const arrowCanvas=document.createElement('canvas');arrowCanvas.width=256;arrowCanvas.height=128;const ac=arrowCanvas.getContext('2d');ac.fillStyle='#e8c979';ac.fillRect(0,0,256,128);ac.strokeStyle='#162126';ac.lineWidth=25;for(let x=30;x<256;x+=70){ac.beginPath();ac.moveTo(x,20);ac.lineTo(x+35,64);ac.lineTo(x,108);ac.stroke();}
  const at=new THREE.CanvasTexture(arrowCanvas);at.colorSpace=THREE.SRGBColorSpace;
  const arrows=[];for(let i=150;i<SAMPLE_COUNT;i+=85){const {p,t,n}=trackSamples[i],q=p.clone().addScaledVector(n,-10.3);arrows.push({p:[q.x,p.y+1.6,q.z],r:[0,Math.atan2(n.x,n.z)+Math.PI,0],s:[2.4,1.2,1]});}
  instanced(scene,new THREE.PlaneGeometry(1,1),new THREE.MeshStandardMaterial({map:at,side:THREE.DoubleSide}),arrows);
}
function makeOcean(scene){
  const g=new THREE.PlaneGeometry(3800,4800,120,100);g.rotateX(-Math.PI/2);
  const material=new THREE.ShaderMaterial({
    uniforms:{time:{value:0},sunDir:{value:new THREE.Vector3(-.8,.16,-.55).normalize()}},
    vertexShader:`varying vec3 wp;uniform float time;
    void main(){vec3 p=position;p.y+=sin(p.x*.032+time*.8)*.18+sin(p.z*.06+p.x*.015-time*.5)*.12;vec4 w=modelMatrix*vec4(p,1.);wp=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`varying vec3 wp;uniform float time;uniform vec3 sunDir;
    void main(){vec3 n=normalize(vec3(cos(wp.x*.09+wp.z*.03+time*.6)*.14+sin(wp.z*.19-time)*.05,1.,cos(wp.z*.12+wp.x*.02-time*.6)*.12));vec3 view=normalize(cameraPosition-wp);float fresnel=pow(1.-max(dot(view,n),0.),4.);vec3 c=mix(vec3(.045,.14,.18),vec3(.38,.49,.54),fresnel);vec3 reflected=reflect(-view,n);float glint=pow(max(dot(reflected,sunDir),0.),140.);c+=vec3(1.,.67,.32)*glint*2.2;float haze=1.-exp(-distance(cameraPosition,wp)*.00055);c=mix(c,vec3(.61,.65,.65),haze);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`,
  });return mesh(scene,g,material,[-2000,-7,-100]);
}
function makeSky(scene){
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{sunDirection:{value:new THREE.Vector3(-.8,.16,-.55).normalize()}},
    vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform vec3 sunDirection;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
    void main(){vec3 d=normalize(direction);float h=max(d.y,0.);vec3 c=mix(vec3(.65,.47,.31),vec3(.055,.16,.32),pow(clamp(h,0.,1.),.45));float glow=pow(max(dot(d,sunDirection),0.),18.);c+=vec3(.4,.23,.10)*glow;float disc=smoothstep(.99965,.99985,dot(d,sunDirection));c+=vec3(2.8,2.0,1.1)*disc;vec2 p=d.xz/(max(d.y,.12))*.7;float cloud=noise(p*5.)*.6+noise(p*11.)*.25+noise(p*25.)*.15;float mask=smoothstep(.58,.77,cloud)*smoothstep(.04,.20,h)*(1.-smoothstep(.45,.9,h));c=mix(c,vec3(.82,.81,.76),mask*.7);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});const sky=mesh(scene,new THREE.SphereGeometry(4000,48,24),material);sky.receiveShadow=false;sky.renderOrder=-10;return sky;
}
function makeBuildings(scene){
  const concrete=mat('#b4aaa0'),metal=mat('#475359',.4,.6);
  // Coastal service station visible at the starting straight.
  mesh(scene,new THREE.BoxGeometry(18,4.5,10),concrete,[26,5.2,44]);
  mesh(scene,new THREE.BoxGeometry(28,.35,17),metal,[24,8,39]);
  for(const x of [11,36])for(const z of [32,46])mesh(scene,new THREE.CylinderGeometry(.16,.16,5,8),metal,[x,5.5,z]);
  for(let i=0;i<3;i++){
    mesh(scene,new THREE.BoxGeometry(1.2,1.8,.7),mat('#eaad72'),[17+i*5,4,36]);
    mesh(scene,new THREE.BoxGeometry(.8,.5,.72),mat('#1c282e'),[17+i*5,4.5,36]);
  }
  const window=new THREE.MeshPhysicalMaterial({color:'#5d747b',roughness:.12,metalness:.4});
  for(let i=0;i<4;i++)mesh(scene,new THREE.BoxGeometry(2.6,1.8,.04),window,[20+i*3.3,5.5,49.03]);
}
export function buildWorld(scene){
  scene.fog=new THREE.FogExp2('#acb9bf',.00062);
  makeSky(scene);const ocean=makeOcean(scene);makeTerrain(scene);makeRoad(scene);makeVegetation(scene);makeBuildings(scene);
  const hemi=new THREE.HemisphereLight('#d3e5f4','#75614e',.8);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#ffe3bd',3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=1;sun.shadow.camera.far=500;sun.shadow.bias=-.0002;sun.shadow.normalBias=.025;sun.shadow.radius=2;scene.add(sun,sun.target);
  return {ocean,sun,update(time,position){ocean.material.uniforms.time.value=time;sun.position.copy(position).add(new THREE.Vector3(-180,110,-130));sun.target.position.copy(position);}};
}
