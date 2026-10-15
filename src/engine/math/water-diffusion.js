// A normalized, truncated 2D Gaussian. Sampling spacing sets sigma in pixels.
export const gaussianKernel=(()=>{
 const taps=[];let total=0;
 for(let y=-2;y<=2;y++)for(let x=-2;x<=2;x++){const weight=Math.exp(-.5*(x*x+y*y));taps.push({x,y,weight});total+=weight;}
 return taps.map(t=>({...t,weight:t.weight/total}));
})();

export const diffusionGLSL=`
 uniform float uDiffusion;
 uniform float uDiffusionSeed;
 float diffusionHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uDiffusionSeed*.017)*43758.5453);}
 // World-anchored Gaussian islands with varied centers, axes, angles and strength.
 // Warping their domain keeps the patches loose rather than aligned to a grid.
 float diffusionMask(vec2 world){
  vec2 p=world+vec2(sin(world.y*.13+sin(world.x*.07)),cos(world.x*.11+cos(world.y*.09)))*2.4;
  vec2 cell=floor(p/12.0);float clear=1.0;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
   vec2 id=cell+vec2(float(x),float(y));
   float a=diffusionHash(id),b=diffusionHash(id+17.3),c=diffusionHash(id+53.7);
   vec2 center=(id+vec2(.15+.7*a,.15+.7*b))*12.0;
   vec2 delta=p-center;float angle=c*6.2831853;
   delta=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*delta;
   vec2 axes=vec2(3.5+2.5*b,3.0+2.5*c);
   float diffusionAmount=(.4+.6*a)*exp(-.5*dot(delta/axes,delta/axes));
   clear*=1.0-diffusionAmount;
  }
  return clamp(1.0-clear,0.0,1.0);
 }
`;

export function withGaussianDiffusion(transmissionChunk){
 const original='return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );';
 if(!transmissionChunk.includes(original))throw new Error('Three.js transmission sampling changed; review diffusion shader integration.');
 const taps=gaussianKernel.map(t=>`sum+=textureLod(transmissionSamplerMap,clamp(fragCoord.xy+vec2(${t.x.toFixed(1)},${t.y.toFixed(1)})*stepUv,edge,vec2(1.0)-edge),blurLod)*${t.weight.toFixed(10)};`).join('\n');
 return transmissionChunk.replace(original,`
  vec4 sharp=textureBicubic(transmissionSamplerMap,fragCoord.xy,lod);
  if(uDiffusion<.001)return sharp;
  float diffusionAmount=diffusionMask(vWaterWorld.xz);
  // A soft base everywhere, with stronger diffusion inside overlapping islands.
  float blend=1.0-exp(-uDiffusion*(2.0+3.0*diffusionAmount));
  // Convert a small world-space footprint to pixels, with a bounded cost/radius.
  float worldPerPixel=max(length(dFdx(vWaterWorld.xz)),length(dFdy(vWaterWorld.xz)));
  if(blend<.008)return sharp;
  float radius=clamp(1.1/max(worldPerPixel,.0001),2.0,64.0);
  float sigma=1.0+radius*uDiffusion*(.45+.75*diffusionAmount);
  // Mip prefiltering fills the gaps between taps at large radii.
  float blurLod=max(lod,log2(max(sigma*.65,1.0)));
  vec2 stepUv=vec2(sigma)/transmissionSamplerSize;
  vec2 edge=vec2(.5)/transmissionSamplerSize;
  vec4 sum=vec4(0.0);
  ${taps}
  return mix(sharp,sum,blend);
 `);
}
