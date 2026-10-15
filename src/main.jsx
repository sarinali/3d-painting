import React,{useState,useRef,useMemo,useEffect,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Paintbrush,Move,Undo2,Download,Shuffle,SlidersHorizontal,Play,Pause,X,Check,Leaf,Flower2,Waves,Maximize2,Orbit,Plus,Minus,House,Scan,Droplets,Eye,EyeOff} from 'lucide-react';
import {activePainting} from './paintings/index.js';
import {createGarden} from './engine/garden.js';
const {generateChunk,height,field,flow,palettes,random,ribbonMarks,createLily,createFlower}=createGarden(activePainting);
import './style.css';
import CameraRig from './engine/rendering/CameraRig.jsx';
import WaterLayer from './engine/rendering/WaterLayer.jsx';
import Lilies from './engine/rendering/Lilies.jsx';
const colors=activePainting.brushColors;
function brushTexture(){const c=document.createElement('canvas');c.width=128;c.height=64;const ctx=c.getContext('2d'),rng=random(814);for(let i=0;i<95;i++){const y=6+rng()*52,x=7+rng()*15;ctx.strokeStyle=`rgba(255,255,255,${.18+rng()*.38})`;ctx.lineWidth=.3+rng()*2.5;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(35,y-4+rng()*8,85,y-3+rng()*6,108+rng()*15,y-3+rng()*6);ctx.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
function Marks({marks,texture,water=false,layer='water'}) {const ref=useRef();useLayoutEffect(()=>{const obj=new THREE.Object3D(),color=new THREE.Color();marks.forEach((m,i)=>{// Stable thickness separates intersecting paint planes without changing over time.
const relief=(Math.sin(m.x*127.1+m.z*311.7+i*74.7)*43758.5453)%1;
obj.position.set(m.x,m.y+Math.abs(relief)*.025+(water?(layer==='surface'?.24:-.25):0),m.z);obj.rotation.set(-Math.PI/2,0,m.angle);obj.scale.set(m.sx*2,m.sz*2,1);obj.updateMatrix();ref.current.setMatrixAt(i,obj.matrix);ref.current.setColorAt(i,color.set(m.color));});ref.current.instanceMatrix.needsUpdate=true;if(ref.current.instanceColor)ref.current.instanceColor.needsUpdate=true;ref.current.computeBoundingSphere();},[marks,water,layer]);return <instancedMesh ref={ref} args={[null,null,marks.length]} castShadow={layer==='surface'} receiveShadow={layer==='surface'} frustumCulled={true}><planeGeometry/>{layer==='surface'&&<meshDepthMaterial attach="customDepthMaterial" map={texture} alphaTest={.20} depthPacking={THREE.RGBADepthPacking} side={THREE.DoubleSide}/>} {water&&layer==='surface'?<meshStandardMaterial map={texture} transparent alphaTest={.035} depthWrite={true} roughness={.72} metalness={0} side={THREE.DoubleSide}/>:<meshBasicMaterial toneMapped={false} map={texture} transparent={!water} alphaTest={water?.12:.035} alphaToCoverage={water} depthWrite={water} side={THREE.DoubleSide}/>} </instancedMesh>;}
function PaintedMarks({marks,texture,water}){
 const layers=useMemo(()=>({water:marks.filter(m=>!m.type&&m.layer!=='surface'),surface:marks.filter(m=>!m.type&&m.layer==='surface'),objects:marks.filter(m=>m.type)}),[marks]);
 return <>{layers.objects.length>0&&<Lilies objects={layers.objects} water={water} texture={texture}/>} {layers.water.length>0&&<Marks marks={layers.water} texture={texture} water={water}/>} {layers.surface.length>0&&<Marks marks={layers.surface} texture={texture} water={water} layer="surface"/>}</>;
}
function Chunk({x,z,seed,palette,depth,density,lilyScale=1.8,texture,waterEnabled}){const marks=useMemo(()=>generateChunk(x,z,seed,palette,depth,density,lilyScale),[x,z,seed,palette,depth,density,lilyScale]);return <PaintedMarks marks={marks} texture={texture} water={waterEnabled}/>;}
function Garden({settings,mode,drift,strokes,onPaint,viewRef,cameraApi,onNavigating}) {
 const {gl}=useThree(),texture=useMemo(brushTexture,[]),drag=useRef(null),last=useRef(null),waterApi=useRef();
 const [bounds,setBounds]=useState({minX:-2,maxX:2,minZ:-2,maxZ:2,cx:0,cz:0});
 const tile=[bounds.cx,bounds.cz];
 useEffect(()=>{viewRef.current=gl.domElement;return()=>texture.dispose();},[gl,texture,viewRef]);
 const paint=e=>{e.stopPropagation();const p=e.point;if(last.current&&last.current.distanceTo(p)<settings.size*((settings.brush==='bloom'||settings.brush==='lily')?1.35*(settings.lilyScale??1.8):(settings.brush==='swirl'||settings.brush==='disturbance')?.55:.12))return;last.current=p.clone();if(settings.brush==='disturbance'){waterApi.current?.disturb(p.x,p.z);return;}onPaint({x:p.x,z:p.z,color:settings.color,size:settings.size,kind:settings.brush,freehand:true,group:drag.current?.id});};
 const surface=useMemo(()=>{
  const geo=new THREE.PlaneGeometry(420,420,200,200);geo.rotateX(-Math.PI/2);
  const vertices=geo.attributes.position,colors=new Float32Array(vertices.count*3),p=palettes[settings.palette],color=new THREE.Color(),next=new THREE.Color();
  for(let i=0;i<vertices.count;i++){
   const x=vertices.getX(i)+tile[0]*28,z=vertices.getZ(i)+tile[1]*28;
   vertices.setY(i,height(x,z,settings.depth)-.06);
   const n=THREE.MathUtils.clamp((field(x,z)*.5+.5)*(p.water.length-1),0,p.water.length-1),j=Math.floor(n);
   color.set(p.water[j]).lerp(next.set(p.water[Math.min(j+1,p.water.length-1)]),n-j).toArray(colors,i*3);
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
 },[tile[0],tile[1],settings.depth,settings.palette]);
 useEffect(()=>()=>surface.dispose(),[surface]);
 const chunks=[];for(let x=bounds.minX;x<=bounds.maxX;x++)for(let z=bounds.minZ;z<=bounds.maxZ;z++)chunks.push(<Chunk key={`${x},${z}`} x={x} z={z} {...settings} texture={texture}/>);
 const userMarks=useMemo(()=>{
  const out=[],p=palettes[settings.palette],flowers=[];
  strokes.forEach((s,idx)=>{
   const rng=random(idx*319+21);
   if(s.kind==='swirl'){
    // Keep the original current paths, but separate their structure from pink accents.
    const sample=random(idx*7919+1874)(),accent=sample<(settings.swirlPresence??.02);
    if(!s.freehand&&!accent&&sample>.35)return;
    const waterColor=p.water[Math.min(p.water.length-1,Math.max(0,Math.floor((field(s.x,s.z)*.5+.5)*p.water.length)))];
    const color=s.freehand||accent?s.color:'#'+new THREE.Color(waterColor).lerp(new THREE.Color(s.color),.10).getHexString();
    out.push(...ribbonMarks(s.x,s.z,s.size*.55,color,settings.depth,Math.round(32*settings.flowLength),2,.08));
   }else if(s.kind==='lily'){
    out.push(...createLily(s.x,s.z,s.size*.7*(settings.lilyScale??1.8),settings.depth,{...p,leaf:[s.color,...p.leaf.slice(1)]},rng));
   }else if(s.kind==='bloom'){
    const spacing=s.size*(settings.lilyScale??1.8)*1.35;
    if(flowers.some(f=>Math.hypot(f.x-s.x,f.z-s.z)<Math.max(spacing,f.spacing)))return;
    flowers.push({x:s.x,z:s.z,spacing});
    out.push(createFlower(s.x,s.z,s.size*.65*(settings.lilyScale??1.8),settings.depth,[s.color,p.highlights?.[1]??'#f1e7d4',p.flower[0]]));
   }else out.push(...ribbonMarks(s.x,s.z,s.size,s.color,settings.depth,10,2,.09));
  });return out;
 },[strokes,settings.depth,settings.flowLength,settings.swirlPresence,settings.lilyScale,settings.palette]);

 return <>{!settings.waterEnabled&&<><hemisphereLight args={['#d9e7f0','#657560',.8]}/><directionalLight position={[-12,20,-9]} intensity={1.2}/></>}<CameraRig mode={mode} drift={drift} apiRef={cameraApi} onBounds={setBounds} onNavigating={onNavigating}/><color attach="background" args={[palettes[settings.palette].water[0]]}/><group name="painted-world">{settings.waterEnabled&&<mesh geometry={surface} position={[tile[0]*28,-.55,tile[1]*28]} raycast={()=>null} receiveShadow><meshStandardMaterial vertexColors roughness={1} envMapIntensity={.3}/></mesh>}{chunks}{userMarks.length>0&&<PaintedMarks marks={userMarks} texture={texture} water={settings.waterEnabled}/>}<mesh geometry={surface} position={[tile[0]*28,0,tile[1]*28]} onPointerDown={e=>{
  if(mode!=='paint'||e.button!==0||e.nativeEvent?.shiftKey||e.nativeEvent?.ctrlKey||e.nativeEvent?.metaKey||e.nativeEvent?.altKey)return;
  if(e.nativeEvent?.pointerType==='touch'&&e.nativeEvent?.isPrimary===false){drag.current=null;return;}
  // Space temporarily belongs to OrbitControls, even while the paint tool is selected.
  if(cameraApi.current?.isPanning?.())return;
  drag.current={id:Date.now()};e.target.setPointerCapture(e.pointerId);last.current=null;paint(e);
 }} onPointerMove={e=>{if(drag.current&&mode==='paint'&&!cameraApi.current?.isPanning?.())paint(e);}}
 onPointerUp={e=>{if(!drag.current)return;drag.current=null;last.current=null;e.target.releasePointerCapture(e.pointerId);}}
 onLostPointerCapture={()=>{drag.current=null;last.current=null;}}><meshBasicMaterial toneMapped={false} vertexColors colorWrite={!settings.waterEnabled} depthWrite={!settings.waterEnabled}/></mesh></group>{settings.waterEnabled&&<WaterLayer apiRef={waterApi} surface={surface} position={[tile[0]*28,0,tile[1]*28]} settings={settings}/>}</>;
}
function App(){
 const [menusHidden,setMenusHidden]=useState(false);
 const [mode,setMode]=useState('paint'),[drift,setDrift]=useState(false),[settings,setSettings]=useState(()=>({...activePainting.defaults})),[panel,setPanel]=useState(true),[toast,setToast]=useState(''),[strokes,setStrokes]=useState(()=>{try{return JSON.parse(localStorage.getItem(activePainting.storageKey)||'[]');}catch{return [];}});const cameraApi=useRef(),[navigating,setNavigating]=useState(false),viewRef=useRef(),toastTimer=useRef();
 const update=(key,value)=>setSettings(s=>({...s,[key]:value}));const notify=t=>{setToast(t);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),2600);};
 useEffect(()=>{const id=setTimeout(()=>{try{localStorage.setItem(activePainting.storageKey,JSON.stringify(strokes));}catch{notify('Browser storage is full. Export to keep your painting.');}},500);return()=>clearTimeout(id);},[strokes]);
 const undo=()=>setStrokes(s=>{if(!s.length)return s;const group=s[s.length-1].group;return s.filter(m=>m.group!==group);});
 useEffect(()=>{const key=e=>{if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;if(e.code==='KeyH'&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&!e.repeat){e.preventDefault();setMenusHidden(hidden=>!hidden);}if((e.metaKey||e.ctrlKey)&&e.key==='z'){e.preventDefault();undo();}if(e.code==='Escape'){setPanel(false);}if(e.code==='KeyB')setMode('paint');if(e.code==='KeyV')setMode('explore');if(e.code==='KeyO')setMode('orbit');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 const save=()=>{const a=document.createElement('a');a.download=`${activePainting.id}.png`;a.href=viewRef.current.toDataURL('image/png');a.click();notify('A little piece of infinity, saved.');};
 return <main className={`app ${menusHidden?'menus-hidden':''}`}>
 <section className={`canvas-wrap ${mode} ${navigating?'navigating':''}`} aria-label="Interactive three dimensional water lily painting"><Canvas shadows camera={{position:[0,20,17],fov:48,near:.1,far:240}} dpr={[1,1.75]} gl={{antialias:true,preserveDrawingBuffer:true,alpha:false}}><Garden settings={settings} mode={mode} drift={drift} strokes={strokes} onPaint={m=>setStrokes(s=>[...s,m])} viewRef={viewRef} cameraApi={cameraApi} onNavigating={setNavigating}/></Canvas><div className="canvas-grain"/>
 <div inert={menusHidden} className="tool-rail"><button className={mode==='paint'?'active':''} title="Paint (B)" aria-label="Paint" onClick={()=>setMode('paint')}><Paintbrush size={19}/></button><button className={mode==='explore'?'active':''} title="Pan the world (V)" aria-label="Pan the world" onClick={()=>setMode('explore')}><Move size={19}/></button><button className={mode==='orbit'?'active':''} title="Orbit the scene (O)" aria-label="Orbit the scene" onClick={()=>setMode('orbit')}><Orbit size={19}/></button><div className="rail-divider"/><button title="Undo brushstroke (⌘Z)" aria-label="Undo brushstroke" disabled={!strokes.length} onClick={undo}><Undo2 size={18}/></button><button className={panel?'active':''} title="Garden settings" aria-label="Garden settings" aria-expanded={panel} onClick={()=>setPanel(!panel)}><SlidersHorizontal size={18}/></button></div>
 <div inert={menusHidden} className="camera-dock" aria-label="Camera controls"><button title="Zoom in" aria-label="Zoom in" onClick={()=>cameraApi.current?.zoom(.8)}><Plus size={16}/></button><button title="Zoom out" aria-label="Zoom out" onClick={()=>cameraApi.current?.zoom(1.25)}><Minus size={16}/></button><i/><button title="Look straight down" aria-label="Top view" onClick={()=>cameraApi.current?.top()}><Scan size={16}/></button><button title="Return to the starting view" aria-label="Reset camera" onClick={()=>{setDrift(false);cameraApi.current?.home();}}><House size={16}/></button></div>
 <div inert={menusHidden} className="scene-actions"><button title={drift?'Pause drifting':'Let it drift'} aria-label={drift?'Pause drifting':'Let it drift'} aria-pressed={drift} className={drift?'active':''} onClick={()=>setDrift(!drift)}>{drift?<Pause size={18}/>:<Play size={18}/>}</button><button title="Save image" aria-label="Save image" onClick={save}><Download size={18}/></button><button title="Fullscreen" aria-label="Fullscreen" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else document.querySelector('.canvas-wrap').requestFullscreen?.();}}><Maximize2 size={18}/></button></div>
 {panel&&<aside inert={menusHidden} className="settings"><div className="panel-heading"><span>Settings</span><button className="icon-button" aria-label="Close settings" onClick={()=>setPanel(false)}><X size={16}/></button></div><label>Light & palette</label><div className="palette-options">{Object.entries(palettes).map(([key,p])=><button key={key} className={settings.palette===key?'selected':''} onClick={()=>update('palette',key)}><span style={{background:`linear-gradient(120deg,${p.water[0]},${p.flower[0]})`}}/>{p.name}{settings.palette===key&&<Check size={13}/>}</button>)}</div><div className="water-heading"><span>Light on water</span><button role="switch" aria-label="Water lighting" aria-checked={settings.waterEnabled} className={`water-toggle ${settings.waterEnabled?'on':''}`} onClick={()=>update('waterEnabled',!settings.waterEnabled)}><span/></button></div>{settings.waterEnabled&&<><label>Ripples <span>{settings.ripples.toFixed(2)}</span></label><input aria-label="Ripple strength" type="range" min="0" max=".8" step=".02" value={settings.ripples} onChange={e=>update('ripples',+e.target.value)}/><label>Sunlight <span>{settings.sunlight.toFixed(1)}×</span></label><input aria-label="Sunlight intensity" type="range" min=".1" max="2" step=".1" value={settings.sunlight} onChange={e=>update('sunlight',+e.target.value)}/><label>Sun elevation <span>{settings.sunElevation??48}°</span></label><input aria-label="Sun elevation" type="range" min="12" max="78" step="1" value={settings.sunElevation??48} onChange={e=>update('sunElevation',+e.target.value)}/><label>Water diffusion <span>{Math.round((settings.diffusion??.68)*100)}%</span></label><input aria-label="Water diffusion" type="range" min="0" max="1" step=".02" value={settings.diffusion??.68} onChange={e=>update('diffusion',+e.target.value)}/><label>Optical depth <span>{settings.waterDepth.toFixed(1)}</span></label><input aria-label="Water optical depth" type="range" min=".1" max="2" step=".1" value={settings.waterDepth} onChange={e=>update('waterDepth',+e.target.value)}/></>}<label>Surface depth <span>{settings.depth.toFixed(1)}</span></label><input aria-label="Surface depth" type="range" min="0" max="3" step=".1" value={settings.depth} onChange={e=>update('depth',+e.target.value)}/><label>Flow length <span>{settings.flowLength.toFixed(1)}×</span></label><input aria-label="Flow length" type="range" min=".5" max="3" step=".1" value={settings.flowLength} onChange={e=>update('flowLength',+e.target.value)}/><label>Lily size <span>{(settings.lilyScale??1.8).toFixed(1)}×</span></label><input aria-label="Lily size" type="range" min="1" max="3" step=".1" value={settings.lilyScale??1.8} onChange={e=>update('lilyScale',+e.target.value)}/><label>Swirl accents <span>{Math.round((settings.swirlPresence??.02)*100)}%</span></label><input aria-label="Swirl visibility" type="range" min="0" max="1" step=".05" value={settings.swirlPresence??.02} onChange={e=>update('swirlPresence',+e.target.value)}/><label>Lily abundance <span>{settings.density.toFixed(1)}×</span></label><input aria-label="Lily abundance" type="range" min=".3" max="2" step=".1" value={settings.density} onChange={e=>update('density',+e.target.value)}/><button className="new-garden" onClick={()=>{update('seed',Math.floor(Math.random()*9000)+1000);notify('A new garden unfolds. Your marks are kept.');}}><Shuffle size={14}/> New garden</button></aside>}
 <div inert={menusHidden} className="studio" role="toolbar" aria-label="Painting tools"><div className="brush-options">{[{id:'bloom',label:'Blossom',icon:Flower2},{id:'lily',label:'Lily pad',icon:Leaf},{id:'stroke',label:'Reflection',icon:Waves},{id:'swirl',label:'Swirl',icon:Orbit},{id:'disturbance',label:'Disturb',icon:Droplets}].map(({id,label,icon:Icon})=><button key={id} title={label} aria-label={label} aria-pressed={settings.brush===id} className={settings.brush===id?'selected':''} onClick={()=>{update('brush',id);if(id==='disturbance')update('waterEnabled',true);setMode('paint');}}><Icon size={19}/></button>)}</div><div className="studio-divider"/><div className="swatches">{colors.map((color,i)=><button key={color} aria-label={`Paint color ${i+1}`} className={settings.color===color?'selected':''} style={{'--swatch':color}} onClick={()=>update('color',color)}>{settings.color===color&&<Check size={12}/>}</button>)}<label className="custom-color" title="Mix your own color">+<input aria-label="Custom paint color" type="color" value={settings.color} onChange={e=>update('color',e.target.value)}/></label></div><div className="studio-divider"/><div className="size-control"><input aria-label="Brush size" type="range" min=".35" max="2.8" step=".05" value={settings.size} onChange={e=>update('size',+e.target.value)}/><span className="size-preview" style={{width:settings.size*5+4,height:settings.size*5+4}}/></div></div>
 <button className="menu-visibility" title={menusHidden?'Show menus (H)':'Hide menus (H)'} aria-label={menusHidden?'Show menus':'Hide menus'} aria-pressed={menusHidden} onClick={()=>setMenusHidden(hidden=>!hidden)}>{menusHidden?<Eye size={18}/>:<EyeOff size={18}/>}</button>
 </section>
 {toast&&<div className="toast" role="status"><Check size={15}/>{toast}</div>}</main>;

}
createRoot(document.getElementById('root')).render(<App/>);
