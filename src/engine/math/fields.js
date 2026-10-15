import {createNoise2D} from 'simplex-noise';
import {random} from './random.js';

// Pure, deterministic fields; no React, renderer, palette, or object dependencies.
export function createFields({noiseSeed=1824}={}) {
const noise=createNoise2D(random(noiseSeed));
function fbm(x,z) { return noise(x,z)*.57+noise(x*2.03+17,z*2.03)*.28+noise(x*4.01,z*4.01+31)*.15; }
function field(x,z) { const wx=x*.075+noise(x*.032,z*.032)*1.8, wz=z*.075+noise(x*.032+40,z*.032)*1.8; return fbm(wx,wz); }
function height(x,z,depth=1) { return depth*(fbm(x*.085,z*.085)*.44+noise(x*.27,z*.27)*.065); }
// Stream function on the pond's (x,z) plane. The linear term supplies a gentle current.
function potential(x,z) {
 return 3.2*noise(x*.15,z*.15)+.65*noise(x*.34+17,z*.34-9)+.12*z;
}
// Rotating the gradient 90 degrees gives v=(∂ψ/∂z, -∂ψ/∂x).
// Keep its magnitude: normalizing this field would generally lose incompressibility.
function velocity(x,z) {
 const e=.01;
 return {x:(potential(x,z+e)-potential(x,z-e))/(2*e),
         z:-(potential(x+e,z)-potential(x-e,z))/(2*e)};
}
function flow(x,z) { const v=velocity(x,z); return -Math.atan2(v.z,v.x); }
// Midpoint/RK2 advection. Nearby seeds share the same current and stretch into ribbons.
function advect(x,z,dt=.08) {
 const a=velocity(x,z),b=velocity(x+a.x*dt*.5,z+a.z*dt*.5);
 return {x:x+b.x*dt,z:z+b.z*dt};
}
function traceFlow(x,z,steps=40,dt=.08) {
 const points=[{x,z}];
 for(let i=0;i<steps;i++){const p=advect(x,z,dt);x=p.x;z=p.z;points.push(p);}
 return points;
}
return {noise,fbm,field,height,potential,velocity,flow,advect,traceFlow};
}
