export function random(seed) { let a=seed|0; return () => { a+=0x6D2B79F5; let t=Math.imul(a^a>>>15,1|a); t^=t+Math.imul(t^t>>>7,61|t); return ((t^t>>>14)>>>0)/4294967296; }; }
