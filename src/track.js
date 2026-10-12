import * as THREE from 'three';
export const ROAD_WIDTH = 14;
const points = [
  [0, 3, 0], [0, 3, -210], [80, 9, -440], [330, 24, -590],
  [650, 32, -480], [820, 16, -190], [760, 9, 160],
  [500, 18, 360], [180, 5, 340], [-70, 3, 160],
].map(p => new THREE.Vector3(...p));
export const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', .35);
export const trackLength = curve.getLength();
export const SAMPLE_COUNT = 1200;
export const trackSamples = Array.from({length:SAMPLE_COUNT}, (_,i) => {
  const p = curve.getPointAt(i / SAMPLE_COUNT);
  const t = curve.getTangentAt(i / SAMPLE_COUNT);
  const n = new THREE.Vector3(-t.z, 0, t.x).normalize();
  return {p,t,n};
});
export function closestTrack(x,z) {
  let best = Infinity, index = 0;
  for (let i=0;i<SAMPLE_COUNT;i++) {
    const p=trackSamples[i].p, d=(p.x-x)**2+(p.z-z)**2;
    if(d<best) {best=d;index=i;}
  }
  const s=trackSamples[index];
  return {index,distance:Math.sqrt(best),offset:(x-s.p.x)*s.n.x+(z-s.p.z)*s.n.z,...s};
}
export function roadGeometry(offset,width,height=.025) {
  const vertices=[],uv=[],indices=[];
  for(let i=0;i<=SAMPLE_COUNT;i++) {
    const {p,n}=trackSamples[i%SAMPLE_COUNT];
    for(const side of [-1,1]) {
      const q=p.clone().addScaledVector(n,offset+side*width/2);
      vertices.push(q.x,p.y+height,q.z);
      uv.push(side===-1?0:width/4,i*trackLength/SAMPLE_COUNT/4);
    }
    if(i<SAMPLE_COUNT) {const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
