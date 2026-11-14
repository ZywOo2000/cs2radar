import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio/slim';
import {loadRadarBackground,saveRadarBackground,BACKGROUND_PRESETS,defaultRadarBackground,parseRadarBackground,copyRadarBackground} from '../lib/radar-background.ts';
import {applyRadarAmbient,testParticles,testParticleAt,testGlowAt} from '../lib/radar-ambient.ts';
import {broadcastMetrics} from '../lib/stats.ts';
await build({entryPoints:['components/broadcast-radar.tsx'],outfile:'.checks/background-render-test.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias:{'@':resolve('.')}});
const {BroadcastRadar}=await import('../.checks/background-render-test.mjs');
const render=background=>load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a:{kpr:.86,rating:1.42},nameA:'A',background})));

test('test style is opt-in, renders three independent colors and 120 dots plus 24 stars',()=>{
 assert.equal(render(defaultRadarBackground())('[data-test-background]').length,0);
 for(const preset of BACKGROUND_PRESETS){
  const $=render({style:'test',preset:preset.id,colors:[...preset.colors]});
  assert.equal($('[data-test-glow]').length,3);
  assert.equal($('[data-test-particle] path').length,24);
  assert.equal($('[data-test-particle]').length,144);
  const stops=$('[data-test-background] radialGradient stop').map((i,n)=>$(n).attr('stop-color')).get();
  for(const color of preset.colors)assert.ok(stops.includes(color));
  assert.match($('[data-metric-value="rating"]').text(),/1.42/);
  assert.equal($('[data-test-background]').attr('pointer-events'),'none');
 }
});

test('stored palettes restore strictly; corrupt, incompatible or unsafe values reject',()=>{
 assert.deepEqual(parseRadarBackground(null),defaultRadarBackground());
 for(const preset of BACKGROUND_PRESETS){
  const value={style:'test',preset:preset.id,colors:[...preset.colors]};
  assert.deepEqual(parseRadarBackground(JSON.stringify({version:1,...value})),value);
 }
 const custom={style:'test',preset:'custom',colors:['#ffffff','#000000','#123456']};
 assert.deepEqual(parseRadarBackground(JSON.stringify({version:1,...custom})),custom);
 for(const raw of ['{',JSON.stringify({version:2,...custom}),JSON.stringify({version:1,...custom,colors:['url(x)','#000000','#123456']}),JSON.stringify({version:1,...custom,style:'unknown'}),JSON.stringify({version:1,...custom,colors:[]})])assert.throws(()=>parseRadarBackground(raw));
 const mismatch=parseRadarBackground(JSON.stringify({version:1,...custom,preset:'gold'}));assert.equal(mismatch.preset,'custom');
});

test('background recording snapshots isolate palette mutations',()=>{
 const value=defaultRadarBackground(),snapshot=copyRadarBackground(value);
 value.colors[0]='#ffffff';value.style='test';
 assert.equal(snapshot.style,'normal');assert.equal(snapshot.colors[0],BACKGROUND_PRESETS[0].colors[0]);
});

test('star and glow motion is deterministic, bounded and continuous with finite fallback',()=>{
 assert.equal(testParticles.filter(p=>p.star).length,24);
 for(let i=0;i<144;i++){
  assert.deepEqual(testParticleAt(i,0),testParticleAt(i,NaN));
  assert.deepEqual(testParticleAt(i,5300),testParticleAt(i,5300));
  assert.notDeepEqual(testParticleAt(i,0),testParticleAt(i,5300));
  for(let t=0;t<30000;t+=100){const s=testParticleAt(i,t);assert.ok(s.opacity>0&&s.opacity<=.75);assert.doesNotMatch(s.transform,/NaN|Infinity/)}
  const a=testParticleAt(i,19999).transform.match(/-?\d+(?:\.\d+)?/g).map(Number),b=testParticleAt(i,20001).transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.ok(Math.abs(a[0]-b[0])<.1&&Math.abs(a[1]-b[1])<.1);
 }
 for(let i=0;i<3;i++){assert.equal(testGlowAt(i,0),testGlowAt(i,NaN));assert.notEqual(testGlowAt(i,0),testGlowAt(i,5000))}
});

test('unavailable storage and corrupt caches keep the page usable without discarding current choices',()=>{
 const unavailable={getItem(){throw Error('blocked')},setItem(){throw Error('quota')}};
 const restored=loadRadarBackground(unavailable);assert.ok(restored.warning);assert.deepEqual(restored.background,defaultRadarBackground());
 const current={style:'test',preset:'custom',colors:['#ffffff','#123456','#000000']};
 assert.ok(saveRadarBackground(unavailable,current));assert.equal(current.colors[0],'#ffffff');assert.equal(current.style,'test');
 assert.ok(loadRadarBackground({getItem:()=>'{'}).warning);
 let raw=null;const available={getItem:()=>raw,setItem:(key,value)=>{raw=value}};
 assert.equal(saveRadarBackground(available,current),'');assert.deepEqual(loadRadarBackground(available).background,current);
});

test('shared live updates are capped at thirty per second and reset when the timeline restarts',()=>{
 let frames=0;const svg={querySelectorAll(selector){if(selector==='[data-test-particle]')frames++;return []}};
 for(let t=0;t<1000;t+=5)applyRadarAmbient(svg,t);
 assert.equal(frames,30);
 applyRadarAmbient(svg,0);assert.equal(frames,31);
});
import {BROADCAST_FRAME} from '../lib/radar-frame.ts';

test('all twelve presets have stable unique identities and remain restorable',()=>{
 assert.equal(BACKGROUND_PRESETS.length,12);
 assert.equal(new Set(BACKGROUND_PRESETS.map(p=>p.id)).size,12);
 for(const p of BACKGROUND_PRESETS){const value={style:'test',preset:p.id,colors:[...p.colors]};assert.deepEqual(parseRadarBackground(JSON.stringify({version:1,...value})),value)}
});

test('normal and test decoration share the visible frame clip, never the overflowing data layer',()=>{
 for(const style of ['normal','test']){
  const $=render({...defaultRadarBackground(),style});
  const frame=$('[data-radar-frame]');
  for(const [key,value] of Object.entries(BROADCAST_FRAME))assert.equal(Number(frame.attr(key)),value);
  const layer=$('[data-background-layer]'),clipId=layer.attr('clip-path').slice(5,-1);
  const clip=$('clipPath').filter((i,n)=>$(n).attr('id')===clipId);
  assert.equal(clip.attr('clippathunits'),'userSpaceOnUse');
  for(const [key,value] of Object.entries(BROADCAST_FRAME))assert.equal(Number(clip.find('rect').attr(key)),value);
  assert.equal(layer.find('[data-ambient-glow]').length,2);
  assert.equal($('#performance-radar').attr('overflow'),'visible');
  assert.equal($('[data-series]').parents('[data-background-layer]').length,0);
  assert.equal($('[data-radar-frame]').parents('[data-background-layer]').length,0);
  if(style==='test'){
   const content=$('[data-test-background-content]');assert.equal(content.length,1);
   assert.equal(content.attr('transform'),undefined);
   assert.equal(content.parents('[data-background-layer]').length,1);
   const testClipId=content.attr('clip-path').slice(5,-1);
   const rect=$('clipPath').filter((i,n)=>$(n).attr('id')===testClipId).find('rect');
   for(const [key,value] of Object.entries(BROADCAST_FRAME))assert.equal(Number(rect.attr(key)),value);
  }
 }
});

test('broadcast corners have no rectangular canvas matte and the frame stroke is uniform',()=>{
 for(const style of ['normal','test']){
  const $=render({...defaultRadarBackground(),style});
  const rects=$('#performance-radar').children('rect');
  assert.equal(rects.length,1);assert.equal(rects.attr('data-radar-frame'),'true');
  assert.equal(rects.attr('stroke'),'#a9bdd4');assert.equal(rects.attr('stroke-opacity'),'.55');
  assert.equal($('[data-radar-canvas-background]').length,0);
  assert.equal($('#broadcast-frame').length,0);
 }
});
