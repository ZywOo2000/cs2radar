import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {workerScript,extractorScript} from './helpers/extension-bundle.mjs';
import {parsePlayer,sourceUrl} from '../lib/hltv.ts';
import {normalized,performance} from '../lib/stats.ts';
function harness({result,actual,closed=false,sleep=setTimeout,status='complete',tabs=[],clock=Date}={}){
 let onConnect,listener,disconnect,installed=false;const sent=[],created=[],injections=[];
 const chrome={runtime:{onConnect:{addListener:fn=>onConnect=fn}},tabs:{query:async()=>tabs,create:async args=>{created.push(args);return {id:created.length}},get:async id=>{if(closed)throw Error();return {status,url:actual||tabs.find(t=>t.id===id)?.url||created[id-1].url}}},scripting:{executeScript:async args=>{assert.equal(args.injectImmediately,true);if(args.files){injections.push(args);installed=true;return []}return [{result:installed?((typeof result==="function"?result(args.target.tabId):result)||{status:'success',data:{notes:[],players:[],scopes:[]}}):{status:'not-injected'}}]}}};
 vm.runInNewContext(workerScript,{chrome,URL,setTimeout:sleep,Date:clock,console,atob});
 const port={name:'cs2-radar-v1',sender:{frameId:0,url:'https://cs2-radar-lab.moaniq12.chatgpt.site/'},postMessage:m=>sent.push(m),disconnect:()=>disconnect=true,onDisconnect:{addListener:()=>{}},onMessage:{addListener:fn=>listener=fn}};
 return {connect:(patch={})=>{Object.assign(port,patch);onConnect(port)},send:m=>listener(m),sent,created,injections,get disconnected(){return disconnect}};
}
test('extension rejects other sites and subframes before creating tabs',()=>{
 for(const sender of [{frameId:0,url:'https://evil.test/'},{frameId:1,url:'https://cs2-radar-lab.moaniq12.chatgpt.site/'}]){const h=harness();h.connect({sender});assert.equal(h.disconnected,true);assert.equal(h.created.length,0)}
});
test('extension connects from every published site origin',()=>{
 for(const url of ['https://cs2-radar-lab.moaniq12.chatgpt.site/','https://cs2radar.moaniq12.workers.dev/','https://cs2shuju.top/','https://www.cs2shuju.top/']){
  const h=harness();h.connect({sender:{frameId:0,url}});assert.equal(h.disconnected,undefined);h.send({type:'hello'});assert.equal(h.sent.at(-1).version,'1.0.0');
 }
});
test('extension validates pasted links and never opens arbitrary hosts',async()=>{
 const h=harness();h.connect();await h.send({type:'import',id:'a',url:'https://127.0.0.1/private'});assert.equal(h.created.length,0);assert.equal(h.sent.at(-1).type,'error');
});
test('event overview resolves to roster and retains original source',async()=>{
 const h=harness();h.connect();await h.send({type:'import',id:'a',url:'https://www.hltv.org/events/8038/example'});assert.equal(h.created[0].url,'https://www.hltv.org/stats/players?event=8038');const m=h.sent.at(-1);assert.equal(m.type,'result');assert.equal(m.id,'a');assert.equal(m.data.sourceUrl,'https://www.hltv.org/events/8038/example');
});
test('changed filters cannot be attributed to the requested event',async()=>{
 const h=harness({actual:'https://www.hltv.org/stats/players?event=999'});h.connect();await h.send({type:'import',id:'a',url:'https://www.hltv.org/stats/players?event=8038'});assert.equal(h.sent.at(-1).type,'error');assert.match(h.sent.at(-1).message,/筛选/);
});
test('closing HLTV tab reports actionable failure',async()=>{
 const h=harness({closed:true});h.connect();await h.send({type:'import',id:'a',url:'https://www.hltv.org/events/8038/example'});assert.match(h.sent.at(-1).message,/关闭/);
});
test('player profile recognizes nested attribute score /100 and avoids T rating',()=>{
 const html='<div class="summaryNickname">ZywOo</div><div><span>1.29</span><span>T Rating</span></div><div><span>1.34</span><span>Rating 3.0</span></div><div><span>92.4</span><span>ADR</span></div><div><span>78.0%</span><span>KAST</span></div><div><div><i></i>Firepower</div><div><b>99</b><small>/100</small></div></div><div><span>22.4%</span><span>Multi-kill</span></div><div data-side="ct"><span>Opening</span><span>98</span></div>';
 const p=parsePlayer(html,sourceUrl('https://www.hltv.org/stats/players/11893/zywoo?event=8038')).players[0];
 assert.equal(p.stats.event.rating,1.34);assert.equal(p.ratingVersion,'3.0');assert.equal(p.stats.event.firepower,99);assert.equal(p.stats.event.kast,78);assert.equal(p.stats.event.multiKill,undefined);assert.equal(p.stats.event.opening,undefined);
});
test('over-reference ADR/Rating/Swing remain proportional without upper clipping',()=>{
 assert.ok(Math.abs(normalized(132,performance[1])-110)<1e-9);assert.equal(normalized(1.3,performance[0]),100);assert.equal(normalized(2.6,performance[0]),200);assert.equal(normalized(20,performance[5]),150);
 const peak=Math.max(100,normalized(150,performance[1]));const radius=170/(peak/100);
 assert.equal(radius,136);assert.equal(radius*normalized(150,performance[1])/100,170);assert.equal(radius*normalized(120,performance[1])/100,136);
});

test('challenge progress resumes automatically and keeps the request id',async()=>{
 let passes=0;const h=harness({result:()=>++passes===1?{status:'waiting',message:'请完成验证'}:{status:'success',data:{notes:[]}},sleep:fn=>setTimeout(()=>fn(),0)});
 h.connect();await h.send({type:'import',id:'challenge',url:'https://www.hltv.org/events/8038/example'});
 assert.ok(h.sent.some(m=>m.type==='progress'&&m.message==='请完成验证'));assert.equal(h.sent.at(-1).type,'result');assert.equal(h.sent.at(-1).id,'challenge');
 assert.equal(h.injections.length,1);
});

test('an already open exact event filter is read without opening or reloading a tab',async()=>{
 const url='https://www.hltv.org/stats/players?event=8038';const h=harness({tabs:[{id:9,url}]});h.connect();
 await h.send({type:'import',id:'reuse',url});assert.equal(h.created.length,0);assert.equal(h.sent.at(-1).type,'result');assert.equal(h.injections[0].target.tabId,9);
});

test('a different event filter is never reused',async()=>{
 const h=harness({tabs:[{id:9,url:'https://www.hltv.org/stats/players?event=999'}]});h.connect();
 await h.send({type:'import',id:'distinct',url:'https://www.hltv.org/stats/players?event=8038'});assert.equal(h.created.length,1);assert.equal(h.sent.at(-1).type,'result');
});

test('persistent missing statistics fail early instead of waiting three minutes',async()=>{
 let now=1000;const h=harness({clock:{now:()=>now},result:{status:'error',message:'没有统计'},sleep:fn=>{now+=200;return setTimeout(()=>fn(),0)}});h.connect();
 await h.send({type:'import',id:'no-stats',url:'https://www.hltv.org/stats/players?event=8038'});
 assert.equal(h.sent.at(-1).type,'error');assert.match(h.sent.at(-1).message,/10 秒/);assert.ok(now<15000);assert.equal(h.injections.length,1);
});
test('cancelled verification never emits a later success',async()=>{
 const h=harness({result:{status:'waiting',message:'请完成验证'},sleep:fn=>setTimeout(()=>fn(),0)});h.connect();
 const running=h.send({type:'import',id:'cancel-me',url:'https://www.hltv.org/events/8038/example'});
 await new Promise(r=>setTimeout(r,1));await h.send({type:'cancel',id:'cancel-me'});await running;
 assert.equal(h.sent.some(m=>m.type==='result'||m.type==='error'),false);
});
test('bundled extractor runs with browser globals and returns structured player data',async()=>{
 const html='<span class="summaryNickname">TEST</span><div class="stats-row"><span>Rating 3.0</span><span>1.34</span></div><div class="stats-row"><span>Damage / Round</span><span>92.4</span></div>';
 const context={URL,Date,atob,document:{title:'TEST stats | HLTV.org',querySelector:()=>null,documentElement:{outerHTML:html}},location:{href:'https://www.hltv.org/stats/players/10/test?event=8038'}};
 vm.createContext(context);vm.runInContext(extractorScript,context);
 const result=await context.__cs2RadarExtract();assert.equal(result.status,'success');assert.equal(result.data.players[0].stats.event.adr,92.4);
 context.document.readyState='loading';assert.equal((await context.__cs2RadarExtract()).status,'waiting');
 context.document.readyState='interactive';assert.equal((await context.__cs2RadarExtract()).status,'success');
 context.document.title='Just a moment...';assert.equal((await context.__cs2RadarExtract()).status,'waiting');
});
test('statistics are returned while the tab is still loading advertising resources',async()=>{
 const h=harness({status:'loading',sleep:()=>{throw Error('Must not wait for tab completion')}});h.connect();
 await h.send({type:'import',id:'ads-still-loading',url:'https://www.hltv.org/matches/2396946/fut-vs-vitality-blast-open-porto-2026'});
 assert.equal(h.sent.at(-1).type,'result');assert.equal(h.sent.at(-1).id,'ads-still-loading');
});

test('failed background detail requests fall back to an existing detail tab and fill MKs',async()=>{
 const url='https://www.hltv.org/matches/2396950/mouz-vs-vitality-blast-open-porto-2026',detailUrl='https://www.hltv.org/stats/matches/130123/mouz-vs-vitality';
 const base={sourceUrl:url,notes:[],players:[{id:'18221',stats:{all:{rounds:44,rating:1.61}}}],scopes:[{id:'all',name:'整场'}]};
 const detail={sourceUrl:detailUrl,notes:[],players:[{id:'18221',stats:{all:{rounds:44,multiKillRounds:9}}}],scopes:[{id:'all',name:'整场'}]};
 const h=harness({tabs:[{id:9,url:detailUrl}],result:id=>id===9?{status:'success',data:detail,parentMatchUrl:url}:{status:'success',data:base,remainingDetails:[{scope:'all',url:detailUrl,reason:'403'}]}});
 h.connect();await h.send({type:'import',id:'fallback',url});
 assert.equal(h.created.length,1);assert.equal(h.sent.at(-1).type,'result');assert.equal(h.sent.at(-1).data.players[0].stats.all.multiKillPct,9/44*100);assert.equal(h.sent.at(-1).data.players[0].stats.all.rating,1.61);
});

test('detail fallback never merges another match and keeps the original statistics',async()=>{
 const url='https://www.hltv.org/matches/2396950/mouz-vs-vitality-blast-open-porto-2026',detailUrl='https://www.hltv.org/stats/matches/130123/mouz-vs-vitality';
 const base={sourceUrl:url,notes:[],players:[{id:'18221',stats:{all:{rounds:44,rating:1.61}}}],scopes:[{id:'all'}]};
 const h=harness({tabs:[{id:9,url:detailUrl}],result:id=>id===9?{status:'success',data:{sourceUrl:detailUrl,players:[],notes:[]},parentMatchUrl:url.replace('2396950','2396951')}:{status:'success',data:base,remainingDetails:[{scope:'all',url:detailUrl}]}});
 h.connect();await h.send({type:'import',id:'wrong-detail',url});assert.equal(h.sent.at(-1).type,'result');assert.equal(base.players[0].stats.all.multiKillPct,undefined);assert.match(base.notes.join(' '),/不属于当前比赛/);
});
