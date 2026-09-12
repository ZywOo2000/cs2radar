import test from 'node:test';
import assert from 'node:assert/strict';
import {SEQUENCE_VIDEO_LAYOUT,sequenceRadarFit,unionRadarBoxes} from '../lib/sequence-video-layout.ts';
import {hltvImageUrl,playerInitials,shortenPlayerText} from '../lib/hltv-avatar.ts';
import {resolveAvatarDataUrl} from '../lib/avatar-client.ts';

test('sequence video uses a fixed 1920 by 1080 left-radar right-player frame',()=>{
 assert.equal(SEQUENCE_VIDEO_LAYOUT.width,1920);assert.equal(SEQUENCE_VIDEO_LAYOUT.height,1080);
 assert.ok(SEQUENCE_VIDEO_LAYOUT.left.width/SEQUENCE_VIDEO_LAYOUT.width>.65);
 assert.ok(SEQUENCE_VIDEO_LAYOUT.right.x>SEQUENCE_VIDEO_LAYOUT.left.x+SEQUENCE_VIDEO_LAYOUT.left.width);
});

test('union radar bounds fit wholly inside the fixed left stage',()=>{
 const box=unionRadarBoxes([{x:-220,y:-100,width:930,height:760},{x:0,y:0,width:600,height:500}]);
 const fit=sequenceRadarFit(box),area=SEQUENCE_VIDEO_LAYOUT.radar;
 assert.ok(fit.x>=area.x-.001);assert.ok(fit.y>=area.y-.001);
 assert.ok(fit.x+box.width*fit.scale<=area.x+area.width+.001);
 assert.ok(fit.y+box.height*fit.scale<=area.y+area.height+.001);
});

test('HLTV avatar URLs reject external and insecure hosts',()=>{
 assert.equal(hltvImageUrl('https://img-cdn.hltv.org/playerbodyshot/a.png'),'https://img-cdn.hltv.org/playerbodyshot/a.png');
 assert.equal(hltvImageUrl('http://img-cdn.hltv.org/a.png'),undefined);
 assert.equal(hltvImageUrl('https://hltv.org.example.com/a.png'),undefined);
 assert.equal(hltvImageUrl('https://example.com/a.png'),undefined);
});

test('avatar data becomes export-safe while unavailable avatars fall back cleanly',async()=>{
 const ok=await resolveAvatarDataUrl('https://img-cdn.hltv.org/a.png',async()=>new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}}));
 assert.equal(ok,'data:image/png;base64,AQID');
 assert.equal(await resolveAvatarDataUrl('https://img-cdn.hltv.org/a.svg',async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}})),undefined);
 assert.equal(playerInitials('ZywOo'),'ZY');assert.equal(playerInitials('李四'),'李四');
 assert.equal(shortenPlayerText('abcdefghijkl',8),'abcdefg…');
});
