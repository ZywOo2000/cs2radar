import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {parseMatch,sourceUrl,matchDetailSources,mergeMatchDetails} from '../lib/hltv.ts';
const url='https://www.hltv.org/matches/2396950/mouz-vs-vitality-blast-open-porto-2026';
const detailUrl='https://www.hltv.org/stats/matches/130123/mouz-vs-vitality';
const maps='<a class="stats-match-map" href="/stats/matches/mapstatsid/237142/mouz-vs-vitality">13 - 11 Dust2</a><a class="stats-match-map" href="/stats/matches/mapstatsid/237153/vitality-vs-mouz">13 - 7 Mirage</a>';
const table=(mks=9,cls='totalstats')=>`<table class="stats-table ${cls}"><tr><th>MOUZ</th><th>MKs</th><th>K (hs)</th><th>D (t)</th><th>KAST</th><th>eKAST</th><th>ADR</th><th>Swing</th><th>Rating 3.0</th></tr><tr><td><a href="/stats/players/18221/spinx">Spinx</a></td><td class="st-mks">${mks}</td><td class="st-kills traditional-data">40 (25)</td><td class="st-deaths traditional-data">28 (5)</td><td>77.3%</td><td class="eco-adjusted-data">72.5%</td><td>97.0</td><td>+7.67%</td><td>1.61</td></tr></table>`;
const detail=`<a class="match-page-link" href="${url}">More info</a>${maps}${table()}${table(99,'ctstats')}`;
const baseHtml='<a href="'+detailUrl+'">Detailed stats</a><div class="mapholder"><span class="mapname">Dust2</span><span class="results-team-score">13</span><span class="results-team-score">11</span></div><div class="mapholder"><span class="mapname">Mirage</span><span class="results-team-score">13</span><span class="results-team-score">7</span></div>'+table().replace('<th>MKs</th>','<th>Other</th>').replace('class="st-mks"','class="other"');
test('HLTV detailed MKs counts become percentages using both maps, without CT or economy mixing',()=>{
 const s=parseMatch(detail,sourceUrl(detailUrl)).players[0].stats.all;
 assert.equal(s.rounds,44);assert.equal(s.multiKillRounds,9);assert.equal(s.multiKillPct,9/44*100);assert.equal(s.kast,77.3);assert.equal(s.kills,40);assert.equal(s.multiKill,undefined);
});
test('only matching match and round scope can enrich base data',()=>{
 const base=parseMatch(baseHtml,sourceUrl(url));assert.deepEqual(matchDetailSources(baseHtml,sourceUrl(url),base),[{scope:'all',url:detailUrl}]);
 assert.equal(mergeMatchDetails(base,detail,sourceUrl(detailUrl),'all'),1);assert.equal(base.players[0].stats.all.multiKillPct,9/44*100);
 assert.throws(()=>mergeMatchDetails(base,detail.replace(url,url.replace('2396950','2396951')),sourceUrl(detailUrl),'all'),/不属于/);
 const mismatch=parseMatch(baseHtml,sourceUrl(url));mismatch.players[0].stats.all.rounds=20;
 assert.equal(mergeMatchDetails(mismatch,detail,sourceUrl(detailUrl),'all'),0);assert.equal(mismatch.players[0].stats.all.multiKillPct,undefined);
});
test('zero multi-kill rounds stay zero and invalid counts do not become percentages',()=>{
 assert.equal(parseMatch(maps+table(0),sourceUrl(detailUrl)).players[0].stats.all.multiKillPct,0);
 assert.equal(parseMatch(maps+table(45),sourceUrl(detailUrl)).players[0].stats.all.multiKillPct,undefined);
 assert.equal(parseMatch(table(),sourceUrl(detailUrl)).players[0].stats.all.multiKillPct,undefined);
});
test('browser extractor follows detail source and preserves base stats if detail fetch fails',async()=>{
 let blocked=false;const context={URL,Date,atob,AbortController,TextDecoder,setTimeout,clearTimeout,document:{readyState:'interactive',title:'HLTV',querySelector:()=>null,documentElement:{outerHTML:baseHtml}},location:{href:url,hostname:'www.hltv.org'},fetch:async target=>{assert.equal(target,detailUrl);if(blocked)throw Error('403');return new Response(detail,{headers:{'content-type':'text/html'}})}};
 vm.createContext(context);vm.runInContext(readFileSync('.checks/extension-package/extractor.js','utf8'),context);
 const result=await context.__cs2RadarExtract();assert.equal(result.status,'success');assert.equal(result.data.players[0].stats.all.multiKillPct,9/44*100);
 blocked=true;const fallback=await context.__cs2RadarExtract();assert.equal(fallback.status,'success');assert.equal(fallback.data.players[0].stats.all.rating,1.61);assert.equal(fallback.data.players[0].stats.all.multiKillPct,undefined);assert.ok(fallback.data.notes.some(n=>n.includes('未能补读')));
});
