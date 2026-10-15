import React,{useMemo,useRef,useLayoutEffect} from 'react';
import * as THREE from 'three';
function petalGeometry(){
 const vertices=[],indices=[],uvs=[],rows=10,cols=6;
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const u=i/rows,v=j/cols*2-1,s=Math.sin(Math.PI*u);
  uvs.push(i/rows,j/cols);
  vertices.push(v*Math.pow(Math.max(.001,s),.7)*.19,.11*s+.12*u*u+.045*(1-v*v)*s,u*.73);
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;indices.push(a,b,a+1,b,b+1,a+1);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function Batch({items,geometry,roughness=.85,texture}){
 const ref=useRef();useLayoutEffect(()=>{if(!items.length)return;const obj=new THREE.Object3D(),color=new THREE.Color();items.forEach((p,i)=>{obj.position.set(p.x,p.y,p.z);obj.rotation.set(p.tilt??0,p.angle??0,0,'YXZ');obj.scale.set(...p.scale);obj.updateMatrix();ref.current.setMatrixAt(i,obj.matrix);ref.current.setColorAt(i,color.set(p.color));});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();},[items]);
 if(!items.length)return null;
 return <instancedMesh ref={ref} args={[geometry,null,items.length]} castShadow receiveShadow raycast={()=>null}><meshStandardMaterial map={texture??null} transparent={!!texture} alphaTest={texture?.05:0} roughness={roughness} metalness={0} side={THREE.DoubleSide}/></instancedMesh>;
}
export default function Lilies({objects,water,texture}){
 const geometry=useMemo(()=>({petal:petalGeometry(),center:new THREE.SphereGeometry(1,10,7),stem:new THREE.CylinderGeometry(.025,.035,1,6)}),[]);
 React.useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
 const batches=useMemo(()=>{
  const petals=[],centers=[],stems=[];
  for(const m of objects){const y=m.y+(water?.24:0);
   
   if(m.type!=='flower')continue;
   const size=m.size,base=y+.15*size;
   stems.push({x:m.x,y:y+.08*size,z:m.z,color:'#65855e',scale:[size,.20*size,size]});
   for(let layer=0;layer<3;layer++)for(let j=0;j<9;j++){
    const angle=j*Math.PI*2/9+layer*.37,scale=size*(1-layer*.20);
    petals.push({x:m.x,y:base+layer*.09*size,z:m.z,angle,tilt:-(.13+layer*.35),scale:[scale,scale,scale],color:m.colors[(j+layer)%m.colors.length]});
   }
   centers.push({x:m.x,y:base+.31*size,z:m.z,color:'#e7c578',scale:[.12*size,.13*size,.12*size]});
  }
  return {petals,centers,stems};
 },[objects,water]);
 return <group name="raised-water-lilies"><Batch items={batches.petals} geometry={geometry.petal} texture={texture}/><Batch items={batches.centers} geometry={geometry.center}/><Batch items={batches.stems} geometry={geometry.stem}/></group>;
}
