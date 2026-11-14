import test from 'node:test';
import assert from 'node:assert/strict';
import {ambientParticles,ambientParticleAt,ambientGlowAt,applyRadarAmbient} from '../lib/radar-ambient.ts';

test('environment motion is deterministic, bounded, nonzero and continuous across cycles',()=>{
 for(let i=0;i<44;i++){
  const base=ambientParticles[i], initial=ambientParticleAt(i,0);
  assert.deepEqual(initial,{cx:base.x,cy:base.y,opacity:base.opacity});
  assert.deepEqual(ambientParticleAt(i,3500),ambientParticleAt(i,3500));
  assert.notDeepEqual(initial,ambientParticleAt(i,3500));
  for(let t=0;t<60000;t+=137){
   const state=ambientParticleAt(i,t);
   assert.ok(Math.abs(state.cx-base.x)<=24.00001);
   assert.ok(Math.abs(state.cy-base.y)<=32.00001);
   assert.ok(state.opacity>=base.opacity*.63999&&state.opacity<=base.opacity);
  }
  const cycle=(12+i%13)*1000;
  assert.ok(Math.abs(ambientParticleAt(i,cycle-.1).cx-ambientParticleAt(i,cycle+.1).cx)<.01);
 }
 assert.notEqual(ambientGlowAt(0,0),ambientGlowAt(0,3500));
 assert.equal(ambientGlowAt(1,3500),ambientGlowAt(1,3500));
});

test('only marked decorative nodes change, repeated final frames freeze and PNG resets them',()=>{
 const node=attrs=>({attrs:{...attrs},getAttribute(k){return this.attrs[k]??null},setAttribute(k,v){this.attrs[k]=v}});
 const particle=node({'data-ambient-particle':'0'}),glow=node({'data-ambient-glow':'1'});
 const polygon=node({points:'1,2 3,4'});
 const svg={querySelectorAll:s=>s==='[data-ambient-particle]'?[particle]:s==='[data-ambient-glow]'?[glow]:[]};
 applyRadarAmbient(svg,4000);const final=structuredClone([particle.attrs,glow.attrs]);
 for(let i=0;i<30;i++)applyRadarAmbient(svg,4000);
 assert.deepEqual([particle.attrs,glow.attrs],final);
 assert.deepEqual(polygon.attrs,{points:'1,2 3,4'});
 applyRadarAmbient(svg,0);
 assert.equal(Number(particle.attrs.cx),ambientParticles[0].x);
 assert.equal(Number(particle.attrs.cy),ambientParticles[0].y);
 assert.equal(Number(particle.attrs.opacity),ambientParticles[0].opacity);
 assert.deepEqual(ambientParticleAt(0,NaN),ambientParticleAt(0,0));
});
