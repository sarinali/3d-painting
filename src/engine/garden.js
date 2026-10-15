import {createFields} from './math/fields.js';
import {random} from './math/random.js';

export function createGarden(painting){
const fields=createFields(painting.math);
const {height,field,flow,velocity,traceFlow}=fields;
const {palettes,composition}=painting;
function ribbonMarks(x,z,size,color,depth=1,steps=42,strands=3,dt=.08) {
 const v=velocity(x,z),speed=Math.hypot(v.x,v.z),nx=speed>1e-6?-v.z/speed:0,nz=speed>1e-6?v.x/speed:1,out=[];
 for(let j=0;j<strands;j++) {
  const offset=(j-(strands-1)/2)*size*.10;
  const points=traceFlow(x+nx*offset,z+nz*offset,steps,dt);
  for(let i=1;i<points.length;i++) {
   const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.z-a.z);
   if(length<.0001)continue;
   const mx=(a.x+b.x)*.5,mz=(a.z+b.z)*.5;
   const taper=Math.max(.18,Math.sin(Math.PI*(i-.5)/steps)**.35);
   out.push({x:mx,z:mz,y:height(mx,mz,depth)+.10+j*.002,sx:length*.72,sz:size*.065*taper,color,angle:-Math.atan2(b.z-a.z,b.x-a.x)});
  }
 }
 return out;
}
// Brushwork and solid pad/flower geometry share the same positions and scales.
function createLily(x,z,r,depth,p,rng){
 const y=height(x,z,depth)+.08,angle=rng()*Math.PI*2;
 const marks=[];
 // A few broad dark strokes anchor the pad; smaller dabs define its broken edge.
 for(let j=0;j<4;j++)marks.push({x:x+(rng()-.5)*r*.65,z:z+(rng()-.5)*r*.65,y:y-.025+j*.004,sx:r*(.45+rng()*.25),sz:r*(.18+rng()*.15),color:p.leaf[4%p.leaf.length],angle:rng()*.55-.275,layer:'surface'});
 for(let j=0;j<22;j++){
  const a=rng()*Math.PI*2,rr=Math.sqrt(rng())*r*.88;
  // The pad has no circular backing: its contour is the union of these paint marks.
  const px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr*.88;
  marks.push({x:px,z:pz,y:y+j*.003,sx:r*(.22+rng()*.26),sz:r*(.07+rng()*.10),color:p.leaf[Math.floor(rng()*p.leaf.length)],angle:rng()*.7-.35,layer:'surface'});
 }
 return marks;
}
function createFlower(x,z,size,depth,colors){return {type:'flower',x,z,y:height(x,z,depth)+.15,size,colors};}
// Every chunk is a pure function of world coordinates and seed. Revisiting never reshuffles it.
function generateChunk(cx,cz,seed,palette,depth,density=1,lilyScale=1.8) {
 const rng=random(Math.imul(cx+173,73856093)^Math.imul(cz+391,19349663)^seed); const p=palettes[palette]; const marks=[];
 const add=(x,z,y,sx,sz,color,angle=0)=>marks.push({x,z,y,sx,sz,color,angle,layer:'water'});
 for(let i=0;i<composition.waterMarks;i++){const x=cx*28+rng()*28,z=cz*28+rng()*28,n=field(x,z);const c=Math.min(p.water.length-1,Math.max(0,Math.floor((n*.5+.5)*p.water.length)));add(x,z,height(x,z,depth),.5+rng()*.75,.2+rng()*.35,p.water[c],flow(x,z));}
 for(let i=0;i<composition.flowPaths;i++) {
  const x=cx*28+rng()*28,z=cz*28+rng()*28,n=field(x,z);
  const color=p.water[Math.min(p.water.length-1,Math.max(0,Math.floor((n*.5+.5)*p.water.length)+Math.floor(rng()*3)-1))];
  marks.push(...ribbonMarks(x,z,.9+rng()*1.3,color,depth,i%2===0?18:10,1,.14));
 }
 for(let i=0;i<composition.lilyCandidates*density;i++) {
  const x=cx*28+rng()*28,z=cz*28+rng()*28;if(field(x+12,z-9)<composition.lilyThreshold)continue;
  const r=(.36+rng()*.64)*lilyScale;
  marks.push(...createLily(x,z,r,depth,p,rng));
  if(rng()<composition.flowerProbability)marks.push(createFlower(x+(rng()-.5)*r*.4,z+(rng()-.5)*r*.4,(.40+rng()*.22)*lilyScale,depth,[p.flower[0],p.highlights?.[1]??'#eee4cf',p.flower[2%p.flower.length]]));
 }
 return marks;
}
return {...fields,palettes,random,ribbonMarks,createLily,createFlower,generateChunk};
}
