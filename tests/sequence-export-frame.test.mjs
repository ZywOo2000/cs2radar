import test from 'node:test';
import assert from 'node:assert/strict';
import {SEQUENCE_VIDEO_FRAME,sequenceExportFrameMarkup,sequenceRadarFit,unionRadarBoxes} from '../lib/sequence-export-frame.ts';

test('sequence export is a fixed 1920 by 1080 bordered frame',()=>{
 assert.equal(SEQUENCE_VIDEO_FRAME.width,1920);
 assert.equal(SEQUENCE_VIDEO_FRAME.height,1080);
 const svg=sequenceExportFrameMarkup('<svg><polygon points="0,0 1,1"/></svg>',{x:0,y:0,width:600,height:500});
 assert.match(svg,/width="1920" height="1080"/);
 assert.match(svg,/data-sequence-export-border="true"/);
 assert.doesNotMatch(svg,/RADAR \/ CS2 · 连续数据图|选手 1|数据来源/);
});

test('the union of every player stays inside the fixed content area',()=>{
 const box=unionRadarBoxes([
  {x:-180,y:-90,width:900,height:700},
  {x:-40,y:-160,width:820,height:920},
 ]);
 assert.deepEqual(box,{x:-180,y:-160,width:960,height:920});
 const fit=sequenceRadarFit(box),frame=SEQUENCE_VIDEO_FRAME;
 const left=fit.x+box.x*fit.scale,top=fit.y+box.y*fit.scale;
 const right=fit.x+(box.x+box.width)*fit.scale,bottom=fit.y+(box.y+box.height)*fit.scale;
 assert.ok(left>=frame.borderInset+frame.contentPaddingX-1e-8);
 assert.ok(top>=frame.borderInset+frame.contentPaddingY-1e-8);
 assert.ok(right<=frame.width-frame.borderInset-frame.contentPaddingX+1e-8);
 assert.ok(bottom<=frame.height-frame.borderInset-frame.contentPaddingY+1e-8);
});
