import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['lib/export-sequence-video.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {sequenceRadarSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('sequence snapshots retain the rounded visible frame and expand only explicit ordinary canvas mattes',t=>{
 const old=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:false});t.after(()=>{if(old)globalThis.matchMedia=old;else delete globalThis.matchMedia});
 const node=attrs=>({tagName:'rect',attrs:{...attrs},getAttribute(k){return this.attrs[k]??null},setAttribute(k,v){this.attrs[k]=v}});
 const box={x:-100,y:-60,width:1400,height:1200};
 for(const hasCanvas of [false,true]){
  const frame=node({'data-radar-frame':'true',x:'10',y:'10',width:'980',height:'940',rx:'30'}),canvas=node({'data-radar-canvas-background':'true',width:'600',height:'500'});
  const clone={attrs:{},children:hasCanvas?[frame,canvas]:[frame],querySelectorAll:()=>[],setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]}};
  const live={querySelectorAll:()=>[],cloneNode:()=>clone};
  assert.equal(sequenceRadarSnapshot(live,box,500),clone);
  assert.equal(clone.attrs.viewBox,'-100 -60 1400 1200');
  assert.deepEqual(frame.attrs,{'data-radar-frame':'true',x:'10',y:'10',width:'980',height:'940',rx:'30'});
  if(hasCanvas){assert.equal(canvas.attrs.x,'-100');assert.equal(canvas.attrs.width,'1400');assert.equal(canvas.attrs.rx,'0')}
 }
});
