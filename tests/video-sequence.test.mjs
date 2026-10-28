import test from 'node:test';
import assert from 'node:assert/strict';
import {commonSequenceMetrics,renderableSequenceMetrics,interpolateColor,sequenceArrivalTime,sequenceDuration,sequenceFrameAt,sequenceVideoFileName} from '../lib/video-sequence.ts';

const metrics=[
 {key:'rating',name:'评分',label:'Rating',min:0,max:2,decimals:2},
 {key:'adr',name:'伤害',label:'ADR',min:0,max:120,decimals:1},
 {key:'kast',name:'贡献',label:'KAST',min:0,max:100,decimals:1},
];
const person=(name,color,stats,version='3.0')=>({name,context:'比赛',stats,color,bestKeys:['rating'],ratingVersion:version});

test('2–5 person timelines keep all specified holds and morphs',()=>{
 assert.equal(sequenceDuration(2,'rings'),4200);
 assert.equal(sequenceDuration(3,'rings'),6000);
 assert.equal(sequenceDuration(4,'rings'),7800);
 assert.equal(sequenceDuration(5,'rings'),9600);
 assert.equal(sequenceDuration(5,'center'),9850);
 assert.equal(sequenceArrivalTime(0,'rings'),1400);
 assert.equal(sequenceArrivalTime(1,'rings'),3200);
 assert.equal(sequenceArrivalTime(4,'rings'),8600);
});

test('morph interpolates values and colors while names crossfade',()=>{
 const people=[person('A','#000000',{rating:1,adr:60,kast:50}),person('B','#ffffff',{rating:2,adr:120,kast:100})];
 const middle=sequenceFrameAt(people,metrics,1400+700+550,'rings');
 assert.equal(middle.fromIndex,0);assert.equal(middle.toIndex,1);
 assert.equal(middle.stats.rating,1.5);assert.equal(middle.stats.adr,90);
 assert.equal(middle.color,'#808080');assert.equal(middle.nameFromOpacity,.5);assert.equal(middle.nameToOpacity,.5);
});

test('first ring frame stays on the innermost polygon for 0.30 seconds',()=>{
 const people=[person('A','#bddbff',{rating:1.5,adr:100,kast:75}),person('B','#61dac8',{rating:1,adr:70,kast:60})];
 const start=sequenceFrameAt(people,metrics,0,'rings');
 const paused=sequenceFrameAt(people,metrics,300,'rings');
 assert.equal(start.stats.rating,.4);assert.deepEqual(paused.stats,start.stats);
 assert.equal(sequenceFrameAt(people,metrics,1400,'rings').stats.rating,1.5);
});

test('incompatible Rating is excluded while missing values fade from real data',()=>{
 const people=[person('A','#000000',{rating:1.2,adr:90,kast:70},'2.1'),person('B','#ffffff',{rating:1.3,adr:100},'3.0')];
 assert.deepEqual(commonSequenceMetrics(metrics,people).map(m=>m.key),['adr']);
 const allowed=renderableSequenceMetrics(metrics,people);
 assert.deepEqual(allowed.map(m=>m.key),['adr','kast']);
 for(const time of [0,1400,2650,3200,4200]) assert.equal(sequenceFrameAt(people,allowed,time,'rings').stats.rating,undefined);
 const frame=sequenceFrameAt(people,allowed,2650,'rings');
 assert.equal(frame.stats.kast,70);assert.equal(frame.metricOpacity.kast,.5);
 assert.equal(sequenceFrameAt(people,allowed,3200,'rings').stats.kast,undefined);
});

test('missing extras fade without manufacturing zero; real zero remains valid',()=>{
 const extras=[{key:'firepower',min:0,max:100},{key:'swing',min:-10,max:10}];
 const people=[person('A','#000000',{firepower:85,swing:0}),person('B','#ffffff',{swing:-3})];
 const middle=sequenceFrameAt(people,extras,2650,'rings');
 assert.equal(middle.stats.firepower,85);assert.equal(middle.metricOpacity.firepower,.5);
 assert.equal(middle.stats.swing,-1.5);assert.equal(middle.metricOpacity.swing,1);
 assert.equal(sequenceFrameAt(people,extras,3200,'rings').stats.firepower,undefined);
 assert.equal(sequenceFrameAt(people,extras,1400,'rings').stats.swing,0);
});

test('sequence filename contains participant count and timestamp',()=>{
 assert.equal(sequenceVideoFileName(5,new Date(2026,8,11,20,1,2),'mp4'),'5人连续数据图_20260911_200102.mp4');
 assert.equal(interpolateColor('#ff0000','#00ff00',.5),'#808000');
});
