import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePlayer,sourceUrl} from '../lib/hltv.ts';
test('current player summary keeps raw percent cards despite nested tooltips and hidden economy variants',()=>{
 const card=(label,value,eco)=>`<div class="player-summary-stat-box-data-wrapper"><div class="player-summary-stat-box-data traditionalData">${value}</div><div class="player-summary-stat-box-data ecoAdjustedData hidden">${eco}</div><div class="player-summary-stat-box-data-text traditionalData">${label}<div class="player-summary-tooltip hiddenTooltip"><b>${label}</b><br>Long explanatory text</div></div><div class="player-summary-stat-box-data-text ecoAdjustedData hidden">${label}</div></div>`;
 const role=(name,val,side='combined')=>`<div class="role-stats-section-title-wrapper stats-side-${side}"><div class="role-stats-section-title"><div>icon</div>${name}<div class="role-stats-section-description">Long hidden explanation</div><div class="row-stats-section-score">${val}<span>/100</span></div></div></div>`;
 const html='<div class="summaryNickname">donk</div><img class="bodyshot-img" src="https://img-cdn.hltv.org/playerbodyshot/donk.png"><img class="player-summary-stat-box-left-team-logo" title="Spirit">'+card('KAST','78.4<span>%</span>','76.7%')+card('Multi-kill','27.4<span>%</span>','1.52')+card('Round swing','+4.25<span>%</span>','0')+role('Firepower',100)+role('Sniping',0)+role('Firepower',99,'t');
 const p=parsePlayer(html,sourceUrl('https://www.hltv.org/stats/players/21167/donk?event=8261')).players[0];
 assert.equal(p.stats.event.kast,78.4);assert.equal(p.stats.event.multiKillPct,27.4);assert.equal(p.stats.event.swing,4.25);assert.equal(p.stats.event.firepower,100);assert.equal(p.stats.event.sniping,0);assert.equal(p.team,'Spirit');assert.equal(p.avatarUrl,'https://img-cdn.hltv.org/playerbodyshot/donk.png');assert.equal(p.stats.event.multiKill,undefined);
});
