import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlayer,sourceUrl} from '../lib/hltv.ts';
import {broadcastMetrics,sharedMetrics,broadcastStats} from '../lib/stats.ts';
import {playerRatingPage} from './helpers/player-rating.mjs';
test('current player summary keeps raw percent cards despite nested tooltips and hidden economy variants',()=>{
 const card=(label,value,eco)=>`<div class="player-summary-stat-box-data-wrapper"><div class="player-summary-stat-box-data traditionalData">${value}</div><div class="player-summary-stat-box-data ecoAdjustedData hidden">${eco}</div><div class="player-summary-stat-box-data-text traditionalData">${label}<div class="player-summary-tooltip hiddenTooltip"><b>${label}</b><br>Long explanatory text</div></div><div class="player-summary-stat-box-data-text ecoAdjustedData hidden">${label}</div></div>`;
 const role=(name,val,side='combined')=>`<div class="role-stats-section-title-wrapper stats-side-${side}"><div class="role-stats-section-title"><div>icon</div>${name}<div class="role-stats-section-description">Long hidden explanation</div><div class="row-stats-section-score">${val}<span>/100</span></div></div></div>`;
 const html='<div class="summaryNickname">donk</div><img class="player-summary-stat-box-left-team-logo" title="Spirit">'+card('KAST','78.4<span>%</span>','76.7%')+card('Multi-kill','27.4<span>%</span>','1.52')+card('Round swing','+4.25<span>%</span>','0')+role('Firepower',100)+role('Sniping',0)+role('Firepower',99,'t');
 const p=parsePlayer(html,sourceUrl('https://www.hltv.org/stats/players/21167/donk?event=8261')).players[0];
 assert.equal(p.stats.event.kast,78.4);assert.equal(p.stats.event.multiKillPct,27.4);assert.equal(p.stats.event.swing,4.25);assert.equal(p.stats.event.firepower,100);assert.equal(p.stats.event.sniping,0);assert.equal(p.team,'Spirit');assert.equal(p.stats.event.multiKill,undefined);
});

test('nested overall rating gauge restores all six screenshot metrics without using T or CT rating',()=>{
 const out=parsePlayer(playerRatingPage(),sourceUrl('https://www.hltv.org/stats/players/11893/zywoo?event=8251'));
 const p=out.players[0];
 assert.equal(p.stats.event.rating,0.91);assert.equal(p.ratingVersion,'3.0');
 assert.equal(p.stats.event.kpr,.61);assert.equal(p.stats.event.adr,62.8);
 assert.equal(p.stats.event.kast,70.9);assert.equal(p.stats.event.multiKillPct,14.6);
 assert.equal(p.stats.event.swing,-.93);assert.equal(p.stats.event.firepower,21);
 assert.equal(out.sourceUrl,'https://www.hltv.org/stats/players/11893/zywoo?event=8251');
 assert.equal(sharedMetrics(broadcastMetrics,broadcastStats(p.stats.event)).length,6);
});

test('rating gauge keeps real zero and the version attached to that score',()=>{
 for(const version of ['3.0','2.1','2.0']){
  const p=parsePlayer(playerRatingPage({rating:'0.00',version}),sourceUrl('https://www.hltv.org/stats/players/11893/zywoo')).players[0];
  assert.equal(p.stats.event.rating,0);assert.equal(p.ratingVersion,version);
 }
});

test('missing or invalid gauge score never falls back to a side score or tooltip average',()=>{
 for(const rating of ['—','','N/A','-0.5','Infinity']){
  const p=parsePlayer(playerRatingPage({rating}),sourceUrl('https://www.hltv.org/stats/players/11893/zywoo?event=8251')).players[0];
  assert.equal(p.stats.event.rating,undefined,rating);assert.equal(p.ratingVersion,'未标注');
 }
});

test('hidden, side-specific and eco-adjusted gauge copies do not supply the overall rating',()=>{
 for(const attrs of ['hidden','aria-hidden="true"','class="ecoAdjustedData"','data-eco-adjusted="true"','data-side="ct"','class="stats-side-t"']){
  const extra=`<div ${attrs}>${playerRatingPage({rating:'9.99'})}</div>`;
  const p=parsePlayer(extra+playerRatingPage(),sourceUrl('https://www.hltv.org/stats/players/11893/zywoo?event=8251')).players[0];
  assert.equal(p.stats.event.rating,.91,attrs);assert.equal(p.ratingVersion,'3.0');
 }
});

test('ambiguous gauge scores are not guessed',()=>{
 const html=playerRatingPage().replace('<b>0.91</b>','<b>0.91</b><b>1.42</b>');
 assert.equal(parsePlayer(html,sourceUrl('https://www.hltv.org/stats/players/11893/zywoo')).players[0].stats.event.rating,undefined);
});
