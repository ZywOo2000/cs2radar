import test from 'node:test';
import assert from 'node:assert/strict';
import {beginRadarRingAnimations,initialRadarMotion,pickRadarMotion,RADAR_RING_EXPAND_MS,RADAR_RING_PAUSE_MS,radarRingProgress,refreshDynamicRadar,replayRadarMotion,stopRadarMotion} from '../lib/radar-motion.ts';

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

test('ring motion holds on the inner polygon for 300ms before its 900ms expansion',()=>{
 assert.equal(RADAR_RING_PAUSE_MS,300);
 assert.equal(RADAR_RING_EXPAND_MS,900);
 assert.equal(radarRingProgress(0),0);
 assert.equal(radarRingProgress(299),0);
 assert.equal(radarRingProgress(300),0);
 assert.equal(radarRingProgress(750),.5);
 assert.equal(radarRingProgress(1200),1);
});
