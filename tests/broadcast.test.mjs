import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio/slim';
import {broadcastMetrics,broadcastStats,normalized} from '../lib/stats.ts';
import {parsePlayer,sourceUrl} from '../lib/hltv.ts';

await build({entryPoints:['components/broadcast-radar.tsx'],outfile:'.checks/broadcast-component.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias:{'@':resolve('.')}});
const {BroadcastRadar}=await import('../.checks/broadcast-component.mjs');
test('reference screenshot thresholds all land on the same outer ring and permit overflow',()=>{
 assert.deepEqual(broadcastMetrics.map(m=>m.max),[.85,43,85,78,20,1.3]);
 assert.deepEqual(broadcastMetrics.map(m=>m.min),[.42,15.7,47.5,54.5,7,.55]);
 for(const m of broadcastMetrics){
  assert.equal(normalized(m.min,m),0);assert.equal(normalized(m.min-1,m),0);
  assert.ok(Math.abs(normalized((m.min+m.max)/2,m)-50)<1e-9);
  assert.equal(normalized(m.max,m),100);
  assert.ok(Math.abs(normalized(m.max+(m.max-m.min),m)-200)<1e-9);
 }
 assert.ok(Math.abs(normalized(1,broadcastMetrics.find(m=>m.key==='rating'))-60)<1e-9);
});
test('survival uses exact counts before rounded DPR, preserves zero, and never invents multi-kill',()=>{
 assert.equal(broadcastStats({rounds:100,deaths:57,dpr:.6}).surviving,43);
 assert.ok(Math.abs(broadcastStats({dpr:.57}).surviving-43)<1e-9);
 assert.equal(broadcastStats({rounds:20,deaths:20}).surviving,0);
 assert.equal(broadcastStats({}).surviving,undefined);assert.equal(broadcastStats({multiKill:1.4}).multiKillPct,undefined);
});
test('percentage multi-kills and MK Rating stay separate and unlabelled counts are not percentages',()=>{
 const u=sourceUrl('https://www.hltv.org/stats/players/10/test?event=8038');
 const base='<span class="summaryNickname">TEST</span><div class="stats-row"><span>Rating 3.0</span><span>1.3</span></div><div class="stats-row"><span>ADR</span><span>85</span></div>';
 const p=parsePlayer(base+'<div><span>Multi-kill</span><span>22.4%</span></div><div><span>MK Rating</span><span>1.42</span></div>',u).players[0].stats.event;
 assert.equal(p.multiKillPct,22.4);assert.equal(p.multiKill,1.42);
 assert.equal(parsePlayer(base+'<div><span>Multi-kill</span><span>22</span></div>',u).players[0].stats.event.multiKillPct,undefined);
});
test('missing percentage keeps six labelled axes and does not draw a fake zero polygon',()=>{
 const a={kpr:.85,surviving:43,adr:85,kast:78,rating:1.3,swing:-.32};
 const html=renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a,nameA:'TEST'}));const $=load(html);
 assert.deepEqual($('.radar-mode-button').map((_,el)=>$(el).text()).get(),['静态','动态']);
 assert.equal($('.radar-mode-button').first().attr('aria-pressed'),'true');assert.equal($('svg').attr('data-display-mode'),'static');
 assert.equal($('clipPath').length,0);assert.equal($('animate').length,0);
 assert.equal($('[data-metric-value]').length,6);assert.match($('[data-metric-value="multiKillPct"]').text(),/—/);
 assert.equal($('[data-series="A"] polygon').length,0);assert.equal($('[data-series="A"] line').length,4);assert.equal($('[data-series="A"] circle').length,0);
 assert.match($('[data-firepower]').text(),/Firepower —/);
 assert.equal($('[data-swing="A"] rect').attr('fill'),'#f06469');assert.doesNotMatch(html,/NaN|Infinity/);
 assert.doesNotMatch(html,/外圈为参考标准|缺失数据留空/);
});
test('complete dual comparison retains values and separate positive/negative swing bars in exported SVG',()=>{
 const a={kpr:1,surviving:50,adr:99,kast:80,multiKillPct:25,rating:1.5,swing:3.5,firepower:91},b={...a,rating:1.2,swing:-.32,firepower:84};
 const $=load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a,b,nameA:'A',nameB:'B'})));
 assert.equal($('[data-series="A"] polygon').length,1);assert.equal($('[data-series="B"] polygon').length,1);
 assert.equal($('[data-series="A"] circle, [data-series="B"] circle').length,0);
 assert.match($('[data-metric-value="rating"]').text(),/1.50.*1.20/);
 assert.doesNotMatch($('[data-metric-value="rating"]').text(),/圆心|外圈/);
 assert.match($('[data-firepower]').text(),/A 91.*B 84/);
 assert.equal($('[data-firepower] text').last().text(),'火力值');
 assert.equal($('[data-firepower] text').first().attr('y'),'738');
 assert.equal($('[data-swing="A"] line').first().attr('y1'),'802');
 assert.equal($('[data-swing="B"] line').first().attr('y1'),'862');
 assert.equal($('[data-swing="A"] rect').attr('fill'),'#22d559');assert.equal($('[data-swing="B"] rect').attr('fill'),'#f06469');
});
test('reference grid stays the same size when a player exceeds the outer scale',()=>{
 const standard={kpr:.85,surviving:43,adr:85,kast:78,multiKillPct:20,rating:1.3,swing:0};
 const extreme={kpr:1.5,surviving:60,adr:153.2,kast:88.9,multiKillPct:61.1,rating:2.38,swing:8};
 const standardChart=load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a:standard,nameA:'STANDARD'})));
 const extremeChart=load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a:extreme,nameA:'EXTREME'})));
 assert.equal(standardChart('[data-reference-ring="100"]').attr('points'),extremeChart('[data-reference-ring="100"]').attr('points'));
 assert.notEqual(standardChart('[data-series="A"] polygon').attr('points'),extremeChart('[data-series="A"] polygon').attr('points'));
});

test('round swing uses a fixed scale and overflows equally to the left and right',()=>{
 const base={kpr:.85,surviving:43,adr:85,kast:78,multiKillPct:20,rating:1.3,firepower:80};
 const $=load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a:{...base,swing:7},b:{...base,swing:-7},nameA:'A',nameB:'B'})));
 assert.equal(Number($('[data-swing="A"] rect').attr('width')),440);
 assert.equal(Number($('[data-swing="A"] rect').attr('x')),500);
 assert.equal(Number($('[data-swing="B"] rect').attr('width')),440);
 assert.equal(Number($('[data-swing="B"] rect').attr('x')),60);
 assert.match($('[data-swing="A"]').text(),/\+7\.00%/);
 assert.match($('[data-swing="B"]').text(),/-7\.00%/);
});
test('custom Best markers enlarge the selected values and inherit each radar series color',()=>{
 const base={kpr:.85,surviving:43,adr:85,kast:78,multiKillPct:20,rating:1.3,swing:3.5,firepower:80};
 const $=load(renderToStaticMarkup(createElement(BroadcastRadar,{metrics:broadcastMetrics,a:base,b:base,nameA:'A',nameB:'B',bestA:['kpr','firepower'],bestB:['adr','swing'],colorA:'#6aaeff',colorB:'#54ddc2'})));
 assert.equal($('[data-metric-value="kpr"] [data-best-label="A"]').text(),'Best');
 assert.equal($('[data-metric-value="kpr"] [data-best-value]').attr('font-size'),'42');
 assert.equal($('[data-metric-value="kpr"] [data-best-label="A"]').attr('fill'),'#6aaeff');
 assert.equal($('[data-metric-value="kpr"] [data-best-value]').attr('filter'),'url(#broadcast-best-a-value)');
 assert.equal($('[data-metric-value="kpr"] [data-best-label="A"]').attr('filter'),'url(#broadcast-best-a-glow)');
 assert.equal($('[data-metric-value="kpr"] [data-best-value]').attr('data-best-motion'),'true');
 assert.equal($('[data-metric-value="kpr"] [data-best-label="A"]').attr('data-best-motion'),'true');
 assert.equal($('#broadcast-best-a-glow feFlood').attr('flood-color'),'#6aaeff');
 assert.equal($('#broadcast-best-a-value feFlood').first().attr('flood-color'),'#6aaeff');
 assert.equal($('#broadcast-best-a-value feSpecularLighting').attr('lighting-color'),'#ffffff');
 assert.equal($('[data-metric-value="adr"] [data-best-label="B"]').attr('fill'),'#54ddc2');
 assert.equal($('#broadcast-best-b-glow feFlood').attr('flood-color'),'#54ddc2');
 assert.equal($('#broadcast-best-b-value feFlood').first().attr('flood-color'),'#54ddc2');
 assert.equal($('[data-firepower] [data-best-label="A"]').attr('fill'),'#6aaeff');
 assert.equal($('[data-swing="B"] [data-best-label="B"]').attr('fill'),'#54ddc2');
 assert.equal($('[data-metric-value="rating"] [data-best-label]').length,0);
});
