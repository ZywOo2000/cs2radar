import test from 'node:test';
import assert from 'node:assert/strict';
import {supportedVideoMime,videoFileName} from '../lib/export-video-utils.ts';

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
