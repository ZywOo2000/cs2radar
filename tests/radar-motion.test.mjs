import test from 'node:test';
import assert from 'node:assert/strict';
import {initialRadarMotion,pickRadarMotion,replayRadarMotion,stopRadarMotion} from '../lib/radar-motion.ts';

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
