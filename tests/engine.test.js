import test from 'node:test';
import assert from 'node:assert/strict';
import {createFields} from '../src/engine/math/fields.js';
import {createGarden} from '../src/engine/garden.js';
import monet from '../src/paintings/monet-water-lilies/index.js';

test('fields are reproducible and independent between painting seeds',()=>{
 const a=createFields(monet.math),b=createFields(monet.math),other=createFields({noiseSeed:42});
 const before=a.traceFlow(3,7);
 assert.deepEqual(before,b.traceFlow(3,7));
 assert.notDeepEqual(before,other.traceFlow(3,7));
 assert.deepEqual(before,a.traceFlow(3,7));
});
test('curl field has negligible numerical divergence',()=>{
 const {velocity}=createFields();const e=.01;
 for(const [x,z] of [[1,2],[-13,8],[25,-4]]){
  const divergence=(velocity(x+e,z).x-velocity(x-e,z).x+velocity(x,z+e).z-velocity(x,z-e).z)/(2*e);
  assert.ok(Math.abs(divergence)<1e-8);
 }
});
test('revisiting a chunk reproduces all paint marks',()=>{
 const garden=createGarden(monet);
 const args=[0,0,1874,'morning',1,1,1.8];
 const first=garden.generateChunk(...args);
 garden.generateChunk(-1,2,1874,'morning',1);
 assert.deepEqual(first,garden.generateChunk(...args));
 assert.ok(first.length>0);
 assert.ok(first.every(m=>Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z)));
});
test('a new painting can replace composition and palette without editing math',()=>{
 const painting={...monet,palettes:{custom:monet.palettes.morning},composition:{...monet.composition,waterMarks:1,flowPaths:0,lilyCandidates:0}};
 const marks=createGarden(painting).generateChunk(0,0,1874,'custom',1);
 assert.equal(marks.length,1);
 assert.ok(painting.palettes.custom.water.includes(marks[0].color));
});
