import {palettes} from './palettes.js';

export default {
 id:'monet-water-lilies',
 title:'Monet — Water Lilies',
 math:{noiseSeed:1824},
 palettes,
 brushColors:['#e1b6b5','#c6d1cd','#afd9b8','#0e804f','#0899c0','#598298'],
 composition:{waterMarks:720,flowPaths:340,lilyCandidates:150,lilyThreshold:.17,flowerProbability:.30},
 // Keep the original storage key so existing artwork survives the refactor.
 storageKey:'etang-strokes',
 defaults:{seed:1874,palette:'morning',depth:1,size:1,color:'#e1b6b5',brush:'bloom',density:1,flowLength:1.5,waterEnabled:true,ripples:.28,sunlight:1,waterDepth:.35,sunElevation:48,lilyScale:1.8,swirlPresence:.02,diffusion:.82},
};
