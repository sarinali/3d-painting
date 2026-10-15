import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

// Camera controls are independent of painting geometry, so future scene layers
// (including splat renderers) can share this camera and the same world coordinates.
export default function CameraRig({mode,drift,apiRef,onBounds,onNavigating}) {
 const {camera,gl}=useThree();
 const controls=useRef(),keys=useRef({}),active=useRef(false),lastBounds=useRef('');
 const scratch=useRef({forward:new THREE.Vector3(),right:new THREE.Vector3(),delta:new THREE.Vector3(),ray:new THREE.Raycaster(),plane:new THREE.Plane(new THREE.Vector3(0,1,0),0),hit:new THREE.Vector3()});
 useEffect(()=>{
  const c=new OrbitControls(camera,gl.domElement);controls.current=c;
  c.target.set(0,0,-3);camera.position.set(0,20.1,17);
  c.enableDamping=true;c.dampingFactor=.12;c.screenSpacePanning=false;
  c.minDistance=6;c.maxDistance=36;
  c.minPolarAngle=.08;c.maxPolarAngle=Math.PI*.27;
  c.panSpeed=.85;c.rotateSpeed=.55;c.zoomSpeed=.7;
  c.mouseButtons.MIDDLE=THREE.MOUSE.PAN;c.mouseButtons.RIGHT=THREE.MOUSE.ROTATE;
  c.touches.TWO=THREE.TOUCH.DOLLY_PAN;
  c.update();c.saveState();
  const start=()=>{active.current=true;onNavigating(true);};
  const end=()=>{active.current=false;onNavigating(false);};
  c.addEventListener('start',start);c.addEventListener('end',end);
  const down=e=>{
   if(e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
   if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
   keys.current[e.code]=true;
   if(e.code==='Space'){c.mouseButtons.LEFT=THREE.MOUSE.PAN;onNavigating(true);}
  };
  const up=e=>{keys.current[e.code]=false;if(e.code==='Space')onNavigating(false);};
  const blur=()=>{keys.current={};active.current=false;onNavigating(false);};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
  apiRef.current={
   isPanning(){return !!keys.current.Space||active.current;},
   zoom(factor){const offset=camera.position.clone().sub(c.target);const d=THREE.MathUtils.clamp(offset.length()*factor,c.minDistance,c.maxDistance);camera.position.copy(c.target).add(offset.setLength(d));c.update();},
   home(){c.enableDamping=false;c.reset();c.enableDamping=true;},
   top(){const target=c.target.clone(),distance=c.getDistance();c.enableDamping=false;c.update();camera.position.copy(target).add(new THREE.Vector3(0,distance,.01));c.update();c.enableDamping=true;},
  };
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);c.dispose();controls.current=null;apiRef.current=null;};
 },[camera,gl,apiRef,onNavigating]);
 useFrame((_,dt)=>{
  const c=controls.current;if(!c)return;
  const k=keys.current,s=scratch.current;
  c.mouseButtons.LEFT=k.Space||mode==='explore'?THREE.MOUSE.PAN:mode==='orbit'?THREE.MOUSE.ROTATE:null;
  c.touches.ONE=mode==='explore'?THREE.TOUCH.PAN:mode==='orbit'?THREE.TOUCH.ROTATE:null;
  camera.getWorldDirection(s.forward);s.forward.y=0;s.forward.normalize();
  s.right.crossVectors(s.forward,camera.up).normalize();
  const forward=(k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0);
  const right=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0);
  s.delta.copy(s.forward).multiplyScalar(forward).addScaledVector(s.right,right);
  if(s.delta.lengthSq()>0)s.delta.normalize().multiplyScalar(Math.min(dt,.05)*c.getDistance()*.35);
  if(drift&&!active.current)s.delta.addScaledVector(s.forward,Math.min(dt,.05)*1.1);
  c.target.add(s.delta);camera.position.add(s.delta);c.update(dt);camera.updateMatrixWorld();
  // Stream the part of the ground actually visible to this camera, at any heading.
  let minX=c.target.x,maxX=minX,minZ=c.target.z,maxZ=minZ;
  for(const [x,y] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
   s.ray.setFromCamera({x,y},camera);
   if(s.ray.ray.intersectPlane(s.plane,s.hit)){
    minX=Math.min(minX,s.hit.x);maxX=Math.max(maxX,s.hit.x);minZ=Math.min(minZ,s.hit.z);maxZ=Math.max(maxZ,s.hit.z);
   }
  }
  const bounds={minX:Math.floor((minX-4)/28),maxX:Math.floor((maxX+4)/28),minZ:Math.floor((minZ-4)/28),maxZ:Math.floor((maxZ+4)/28),cx:Math.floor(c.target.x/28),cz:Math.floor(c.target.z/28)};
  const signature=Object.values(bounds).join(',');
  if(signature!==lastBounds.current){lastBounds.current=signature;onBounds(bounds);}
 });
 return null;
}
