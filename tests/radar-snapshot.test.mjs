import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result=await build({entryPoints:['lib/radar-snapshot.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {assertFiniteRadarGeometry,finalRadarSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));

test('non-finite chart geometry is rejected instead of silently exporting a clipped chart',()=>{
 const node={getAttribute:key=>key==='data-final-cx'?'Infinity':null};
 assert.throws(()=>assertFiniteRadarGeometry({querySelectorAll:()=>[node]}),/范围过大/);
 assert.doesNotThrow(()=>assertFiniteRadarGeometry({querySelectorAll:()=>[]}));
});

test('snapshot commits final polygon, lines and dots without altering the live chart',()=>{
 const element=initial=>({attributes:{...initial},getAttribute(k){return this.attributes[k]??null},setAttribute(k,v){this.attributes[k]=v}});
 const live=element({points:'0,0'});
 const polygon=element({'data-final-points':'1,2 3,4',points:'0,0'});
 const line=element({'data-final-x1':'10','data-final-y1':'11','data-final-x2':'12','data-final-y2':'13',x1:'1'});
 const circle=element({'data-final-cx':'20','data-final-cy':'21',cx:'0'});
 const anim=element({attributeName:'points',to:'1,2 3,4'});
 anim.parentElement=polygon;anim.remove=()=>{anim.removed=true};
 const removed=[];const moving={classList:{remove(...classes){removed.push(...classes)}}};
 const clone={removed:[],querySelectorAll(selector){
  if(selector==='animate')return [anim];
  if(selector==='.radar-motion-center,.radar-motion-rings,.radar-motion-bar,.radar-best-motion')return [moving];
  const match=selector.match(/^\[data-final-(.+)\]$/);return match?[polygon,line,circle].filter(n=>n.getAttribute('data-final-'+match[1])!==null):[];
 },removeAttribute(k){this.removed.push(k)}};
 live.querySelectorAll=()=>[];live.cloneNode=()=>clone;
 assert.equal(finalRadarSnapshot(live),clone);
 assert.equal(polygon.getAttribute('points'),'1,2 3,4');assert.equal(line.getAttribute('x1'),'10');
 assert.equal(line.getAttribute('y2'),'13');assert.equal(circle.getAttribute('cx'),'20');assert.equal(circle.getAttribute('cy'),'21');
 assert.equal(live.getAttribute('points'),'0,0');assert.equal(anim.removed,true);
 assert.ok(removed.includes('radar-motion-center'));assert.ok(clone.removed.includes('data-motion-kind'));
});
