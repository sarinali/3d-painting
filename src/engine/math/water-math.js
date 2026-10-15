// Small-amplitude deep-water waves: omega^2 = g*k. Coordinates use scene units.
// Distinct directions/wavelengths avoid a short, visibly tiled normal-map pattern.
export const waves=[
 {a:.012,k:1.13,d:[.94,.341],phase:.3},
 {a:.008,k:2.31,d:[.66,-.751],phase:1.7},
 {a:.0045,k:4.73,d:[-.27,.963],phase:3.1},
 {a:.0025,k:8.17,d:[.83,.558],phase:4.8},
 {a:.0014,k:13.39,d:[-.57,-.822],phase:2.2},
];
export function windHeight(x,z,t,strength=1){return waves.reduce((h,w)=>h+w.a*strength*Math.sin(w.k*(w.d[0]*x+w.d[1]*z)-Math.sqrt(9.81*w.k)*t+w.phase),0);}
export function windGradient(x,z,t,strength=1){return waves.reduce((g,w)=>{const f=w.a*strength*w.k*Math.cos(w.k*(w.d[0]*x+w.d[1]*z)-Math.sqrt(9.81*w.k)*t+w.phase);return {x:g.x+f*w.d[0],z:g.z+f*w.d[1]};},{x:0,z:0});}
// An outward Gaussian wave packet, damped in time and with radial spreading.
export function disturbanceHeight(r,t,amplitude=.045){if(t<0||t>9)return 0;const q=r-1.5*t;return amplitude*Math.exp(-t*.55-q*q/.55)*Math.sin(7*q)/Math.sqrt(1+r);}
export const waterWaveGLSL=`
 uniform float uWaterTime;
 uniform float uWind;
 uniform vec4 uDisturbances[8];
 varying vec3 vWaterWorld;
 vec2 waterSlope(vec2 p){
  vec2 slope=vec2(0.0);
  ${waves.map(w=>`slope+=vec2(${w.d.map(v=>v.toFixed(6)).join(',')})*${(w.a*w.k).toFixed(8)}*uWind*cos(${w.k.toFixed(6)}*dot(vec2(${w.d.map(v=>v.toFixed(6)).join(',')}),p)-${Math.sqrt(9.81*w.k).toFixed(6)}*uWaterTime+${w.phase.toFixed(6)});`).join('\n')}
  for(int i=0;i<8;i++){
   vec4 drop=uDisturbances[i];float age=uWaterTime-drop.z;
   if(drop.w>0.0&&age>=0.0&&age<9.0){
    vec2 delta=p-drop.xy;float r=length(delta),q=r-1.5*age;
    float envelope=drop.w*exp(-.55*age-q*q/.55)/sqrt(1.0+r);
    float derivative=envelope*(7.0*cos(7.0*q)-sin(7.0*q)*(2.0*q/.55+.5/(1.0+r)));
    slope+=delta/max(r,.001)*derivative;
   }
  }
  return slope;
 }
`;
