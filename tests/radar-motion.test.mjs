import test from 'node:test';
import assert from 'node:assert/strict';
import {beginRadarRingAnimations,initialRadarMotion,pickRadarMotion,RADAR_RING_EXPAND_MS,RADAR_RING_PAUSE_MS,radarMotionDataKey,radarRingProgress,refreshDynamicRadar,replayRadarMotion,stopRadarMotion} from '../lib/radar-motion.ts';

test('manual values restart geometry even when source identity is unchanged',()=>{
 const metrics=[{key:'kpr'},{key:'adr'},{key:'kast'}],a={kpr:1,adr:90,kast:78},b={kpr:.8};
 const key=radarMotionDataKey('same-manual-source',metrics,a,b,['kpr']);
 const complete=radarMotionDataKey('same-manual-source',metrics,a,{...b,adr:80,kast:75},['kpr','adr','kast']);
 assert.notEqual(key,complete);
 assert.notEqual(complete,radarMotionDataKey('same-manual-source',metrics,{...a,kpr:1.1},{...b,adr:80,kast:75},['kpr','adr','kast']));
 assert.equal(complete,radarMotionDataKey('same-manual-source',metrics,{...a},{...b,adr:80,kast:75},['kpr','adr','kast']));
});

test('Rating axis compatibility and auxiliary values are included in animation identity',()=>{
 const metrics=[{key:'kpr'},{key:'rating'}],a={kpr:.8,rating:1.3,swing:0,firepower:0},b={...a};
 const key=radarMotionDataKey('manual',metrics,a,b,['kpr']);
 assert.notEqual(key,radarMotionDataKey('manual',metrics,a,b,['kpr','rating']));
 assert.notEqual(key,radarMotionDataKey('manual',metrics,{...a,swing:-2},b,['kpr']));
 assert.notEqual(key,radarMotionDataKey('manual',metrics,a,{...b,firepower:70},['kpr']));
 assert.notEqual(key,radarMotionDataKey('manual',metrics,a,undefined,['kpr']));
 assert.notEqual(radarMotionDataKey('manual',metrics,{},undefined),radarMotionDataKey('manual',metrics,{kpr:0},undefined));
});

test('each animation choice uses an independent exact 50 percent boundary',()=>{
 assert.equal(pickRadarMotion(()=>0),'rings');
 assert.equal(pickRadarMotion(()=>.499999),'rings');
 assert.equal(pickRadarMotion(()=>.5),'center');
 assert.equal(pickRadarMotion(()=>.999999),'center');
});

test('replaying dynamic mode always creates a fresh run and static stops it immediately',()=>{
 const first=replayRadarMotion(initialRadarMotion,'rings');
 const second=replayRadarMotion(first,'rings');
 const third=replayRadarMotion(second,'center');
 assert.deepEqual(first,{mode:'dynamic',kind:'rings',runId:1});
 assert.equal(second.runId,2);assert.equal(second.kind,'rings');
 assert.equal(third.runId,3);assert.equal(third.kind,'center');
 assert.deepEqual(stopRadarMotion(third),{mode:'static',kind:'center',runId:3});
});

test('changed player data replays only while dynamic mode is selected',()=>{
 const dynamic=replayRadarMotion(initialRadarMotion,'center');
 assert.deepEqual(refreshDynamicRadar(dynamic,'rings'),{mode:'dynamic',kind:'rings',runId:2});
 assert.equal(refreshDynamicRadar(initialRadarMotion,'rings'),initialRadarMotion);
});

test('a newly selected player explicitly starts every ring animation',()=>{
 const started=[];
 const count=beginRadarRingAnimations([
  {beginElement:()=>started.push('polygon')},
  {beginElement:()=>started.push('axis')},
 ]);
 assert.equal(count,2);
 assert.deepEqual(started,['polygon','axis']);
});

test('ring motion holds on the inner polygon for 300ms before its 1100ms expansion',()=>{
 assert.equal(RADAR_RING_PAUSE_MS,300);
 assert.equal(RADAR_RING_EXPAND_MS,1100);
 assert.equal(radarRingProgress(0),0);
 assert.equal(radarRingProgress(299),0);
 assert.equal(radarRingProgress(300),0);
 assert.equal(radarRingProgress(850),.5);
 assert.equal(radarRingProgress(1400),1);
});
