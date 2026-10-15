import monet from './monet-water-lilies/index.js';

export const paintings={[monet.id]:monet};
const requested=new URLSearchParams(window.location.search).get('painting');
export const activePainting=paintings[requested]??monet;
