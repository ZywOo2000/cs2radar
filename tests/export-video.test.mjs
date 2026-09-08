import test from 'node:test';
import assert from 'node:assert/strict';
import {interpolatePolygonPoints,regularRevealPoints,supportedVideoMime,videoCanvasSize,videoFileName,videoFrameGeometry} from '../lib/export-video-utils.ts';

test('video export prefers MP4 and falls back to WebM',()=>{
 assert.equal(supportedVideoMime(type=>type==='video/mp4'),'video/mp4');
 assert.equal(supportedVideoMime(type=>type==='video/webm;codecs=vp9'),'video/webm;codecs=vp9');
 assert.equal(supportedVideoMime(()=>false),'');
});

test('video export filename includes chart mode and local timestamp',()=>{
 const date=new Date(2026,8,6,15,30,0);
 assert.equal(videoFileName(false,date,'mp4'),'单人数据图_20260906_153000.mp4');
 assert.equal(videoFileName(true,date,'webm'),'双人数据图_20260906_153000.webm');
});

test('the reveal mask stays polygonal instead of becoming a circle',()=>{
 const hexagon=regularRevealPoints(6,500,365,100).split(' ');
 const heptagon=regularRevealPoints(7,300,244,100).split(' ');
 assert.equal(hexagon.length,6);assert.equal(heptagon.length,7);
 assert.equal(hexagon[0],'500,265');
});

test('ring motion starts on the innermost polygon and reaches exact final points',()=>{
 const inner='0,20 17.32,10 17.32,-10 0,-20 -17.32,-10 -17.32,10';
 const final='0,100 86.6,50 43.3,-25 0,-70 -69.28,-40 -34.64,20';
 assert.equal(interpolatePolygonPoints(inner,final,0),inner);
 assert.equal(interpolatePolygonPoints(inner,final,1),final);
 assert.equal(interpolatePolygonPoints(inner,final,.5),'0,60 51.96,30 30.31,-17.5 0,-45 -43.3,-25 -25.98,15');
});

test('video frame and canvas expand without shrinking the chart scale',()=>{
 const ordinary=videoFrameGeometry(1000,960);
 const overflow=videoFrameGeometry(1400,1200);
 assert.equal(ordinary.width,1200);assert.equal(ordinary.scale,1.1);
 assert.equal(overflow.width,1640);assert.equal(overflow.scale,1.1);
 assert.ok(Math.abs(overflow.graphX-50)<1e-9);
 assert.deepEqual(videoCanvasSize(1200,1280),{width:1080,height:1152});
 assert.deepEqual(videoCanvasSize(1640,1525),{width:1476,height:1374});
});
