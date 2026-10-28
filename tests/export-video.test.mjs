import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {boundedCanvasSize,MAX_CANVAS_DIMENSION,MAX_CANVAS_PIXELS} from '../lib/canvas-limits.ts';

const utils=await build({entryPoints:['lib/export-video-utils.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {bestRevealOpacity,createVideoRecorder,interpolatePolygonPoints,regularRevealPoints,supportedVideoMime,videoCanvasSize,videoFileName,videoFrameGeometry}=
  await import('data:text/javascript;base64,'+Buffer.from(utils.outputFiles[0].text).toString('base64'));

const bundle=await build({entryPoints:['lib/export-video.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {videoFrame}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('video labels use the selected independent colors',t=>{
 const previous=globalThis.XMLSerializer;
 globalThis.XMLSerializer=class {serializeToString(){return '<svg/>'}};
 t.after(()=>{if(previous)globalThis.XMLSerializer=previous;else delete globalThis.XMLSerializer});
 const {svg}=videoFrame({},1000,960,'QA',{name:'A',context:'test',color:'#ff9b61'},{name:'B',context:'test',color:'#b79cff'});
 assert.match(svg,/fill="#ff9b61"[^>]*>A · A · test/);
 assert.match(svg,/fill="#b79cff"[^>]*>B · B · test/);
});

test('video export prefers MP4 and falls back to WebM',()=>{
 assert.equal(supportedVideoMime(type=>type==='video/mp4'),'video/mp4');
 assert.equal(supportedVideoMime(type=>type==='video/webm;codecs=vp9'),'video/webm;codecs=vp9');
 assert.equal(supportedVideoMime(()=>false),'');
});
test('video export falls back when advertised MP4 encoder cannot initialize',()=>{
 const tried=[];
 class Recorder {static isTypeSupported(type){return type==='video/mp4'||type==='video/webm'}
  constructor(stream,options){tried.push(options.mimeType);if(options.mimeType==='video/mp4')throw Error('broken encoder');this.stream=stream}}
 const stream={};const result=createVideoRecorder(stream,Recorder);
 assert.deepEqual(tried,['video/mp4','video/webm']);assert.equal(result.mime,'video/webm');assert.equal(result.recorder.stream,stream);
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

test('extreme canvas sizes are bounded proportionally while normal outputs are unchanged',()=>{
 assert.deepEqual(boundedCanvasSize(2400,3200),{width:2400,height:3200});
 const large=boundedCanvasSize(50000,30000,true);
 assert.ok(large.width<=MAX_CANVAS_DIMENSION&&large.height<=MAX_CANVAS_DIMENSION);
 assert.ok(large.width*large.height<=MAX_CANVAS_PIXELS);
 assert.ok(Math.abs(large.width/large.height-50000/30000)<.002);
 assert.equal(large.width%2,0);assert.equal(large.height%2,0);
 assert.throws(()=>boundedCanvasSize(Infinity,1000),/范围过大/);
 assert.throws(()=>boundedCanvasSize(1e300,1,true),/范围过大/);
 assert.throws(()=>boundedCanvasSize(Number.MAX_VALUE,1,true),/范围过大/);
});

test('Best values fade from the initial dynamic frame to full visibility',()=>{
 assert.equal(bestRevealOpacity(0),.06);
 assert.equal(bestRevealOpacity(1),1);
 assert.equal(bestRevealOpacity(-1),.06);
 assert.equal(bestRevealOpacity(2),1);
});
