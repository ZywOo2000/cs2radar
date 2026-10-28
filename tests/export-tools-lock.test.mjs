import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['lib/radar-model-tools.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {createRadarTools}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const {emptyManual}=await import('../lib/manual-data.ts');

test('model tools block mutations while exporting and remain readable',async()=>{
 let editable=false, calls=0, mode='video';
 const state={mode,view:'performance',workspace:{mode:'single',drafts:{A:emptyManual(),B:emptyManual()}},
  store:{getSnapshot:()=>[]},actions:{load:async()=>{calls++},choose:async()=>{calls++}},setMode:v=>{mode=v},canMutate:()=>editable};
 const tools=createRadarTools(()=>state), get=name=>tools.find(t=>t.name===name);
 await assert.rejects(get('select_comparison_player').execute({slot:'A',playerId:'1',mode:'single'}),/正在导出/);
 await assert.rejects(get('import_hltv_source').execute({slot:'A',url:'https://www.hltv.org/matches/1/a'}),/正在导出/);
 assert.equal(calls,0);assert.equal(mode,'video');assert.equal(get('get_radar_comparison').execute({}).mode,'video');
 editable=true;await get('select_comparison_player').execute({slot:'A',playerId:'1',mode:'single'});
 assert.equal(calls,1);assert.equal(mode,'single');
});

test('a delayed model selection cannot switch mode after recording starts',async()=>{
 let editable=true,finish,mode='video';
 const state={mode,view:'performance',workspace:{mode:'single',drafts:{A:emptyManual(),B:emptyManual()}},
  store:{getSnapshot:()=>[]},actions:{load:async()=>{},choose:()=>new Promise(resolve=>{finish=resolve})},setMode:v=>{mode=v},canMutate:()=>editable};
 const tool=createRadarTools(()=>state).find(t=>t.name==='select_comparison_player');
 const operation=tool.execute({slot:'A',playerId:'1',mode:'single'});
 editable=false;finish();await assert.rejects(operation,/正在导出/);assert.equal(mode,'video');
});
