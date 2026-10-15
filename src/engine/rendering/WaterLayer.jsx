import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {Sky} from 'three/addons/objects/Sky.js';
import {waterWaveGLSL} from '../math/water-math.js';
import {diffusionGLSL,withGaussianDiffusion} from '../math/water-diffusion.js';

function sunDirection(elevation){return new THREE.Vector3().setFromSphericalCoords(1,THREE.MathUtils.degToRad(90-elevation),THREE.MathUtils.degToRad(225));}

export default function WaterLayer({surface,position,settings,apiRef}){
 const {gl,scene,clock}=useThree(),material=useRef(),nextDrop=useRef(0);
 const [elevation,setElevation]=useState(settings.sunElevation??48);
 // Avoid regenerating the filtered sky for every pointer event while sliding.
 useEffect(()=>{const id=setTimeout(()=>setElevation(settings.sunElevation??48),180);return()=>clearTimeout(id);},[settings.sunElevation]);
 const sun=useMemo(()=>sunDirection(elevation),[elevation]);
 const sunTarget=useMemo(()=>new THREE.Object3D(),[]);
 sunTarget.position.set(position[0],0,position[2]);
 const environment=useMemo(()=>{
  const sky=new Sky();sky.scale.setScalar(450);
  const u=sky.material.uniforms;u.turbidity.value=3;u.rayleigh.value=1.6;u.mieCoefficient.value=.003;u.mieDirectionalG.value=.8;u.sunPosition.value.copy(sun).multiplyScalar(450000);
  // Direct sunlight comes from the directional light below. Excluding the sun
  // disk from IBL avoids two overlapping specular sources and filtering artifacts.
  sky.material.fragmentShader=sky.material.fragmentShader.replace('L0 += ( vSunE * 19000.0 * Fex ) * sundisk;', 'L0 += vec3(0.0);');
  const skyScene=new THREE.Scene();skyScene.add(sky);
  const generator=new THREE.PMREMGenerator(gl),target=generator.fromScene(skyScene,.04,.1,2000);
  generator.dispose();sky.geometry.dispose();sky.material.dispose();return target;
 },[gl,sun]);
 useEffect(()=>{const previous=scene.environment;scene.environment=environment.texture;return()=>{scene.environment=previous;environment.dispose();};},[scene,environment]);
 const uniforms=useMemo(()=>({uWaterTime:{value:0},uWind:{value:.8},uDiffusion:{value:.68},uDiffusionSeed:{value:1874},uDisturbances:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,0,0))}}),[]);
 useEffect(()=>{apiRef.current={disturb(x,z){const drop=uniforms.uDisturbances.value[nextDrop.current++%8];drop.set(x,z,clock.elapsedTime,.045);}};return()=>{apiRef.current=null;};},[apiRef,uniforms,clock]);
 useFrame(()=>{uniforms.uWaterTime.value=clock.elapsedTime;uniforms.uWind.value=(settings.ripples??.28)*3;uniforms.uDiffusion.value=settings.diffusion??.68;uniforms.uDiffusionSeed.value=settings.seed;});
 const compile=useMemo(()=>shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='varying vec3 vWaterWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWaterWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=waterWaveGLSL+diffusionGLSL+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <transmission_pars_fragment>',withGaussianDiffusion(THREE.ShaderChunk.transmission_pars_fragment));
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',`#include <normal_fragment_begin>
   vec2 slope=waterSlope(vWaterWorld.xz);
   vec3 pondUp=normalize(mat3(viewMatrix)*vec3(0.0,1.0,0.0));
   normal=normalize(mix(pondUp,normal,.25)+mat3(viewMatrix)*vec3(-slope.x,0.0,-slope.y));
   nonPerturbedNormal=normal;
  `);
 },[uniforms]);
 useEffect(()=>{if(material.current)material.current.needsUpdate=true;},[compile]);
 const water=useMemo(()=>{const geometry=surface.clone();const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,p.getY(i)+.16);geometry.computeVertexNormals();return geometry;},[surface]);
 useEffect(()=>()=>water.dispose(),[water]);
 const wind=settings.ripples??.28;
 return <><hemisphereLight args={['#d9e7f0','#657560',.55]}/><primitive object={sunTarget}/><directionalLight target={sunTarget} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={65} shadow-camera-bottom={-65} shadow-camera-near={1} shadow-camera-far={220} shadow-bias={-.00015} shadow-normalBias={.02} shadow-radius={3} position={[position[0]+sun.x*100,sun.y*100,position[2]+sun.z*100]} color={elevation<25?'#ffdfb1':'#fff7e7'} intensity={settings.sunlight*1.6}/><mesh name="refractive-water" geometry={water} position={position} raycast={()=>null} renderOrder={1}>
  <meshPhysicalMaterial ref={material} onBeforeCompile={compile} customProgramCacheKey={()=>'pond-waves-diffusion-v6'} color="#ffffff" metalness={0} roughness={.19+wind*.12} ior={1.333} transmission={1} thickness={settings.waterDepth} attenuationColor="#b2c8bb" attenuationDistance={12} envMapIntensity={.45} clearcoat={0} depthWrite={false}/>
 </mesh></>;
}
