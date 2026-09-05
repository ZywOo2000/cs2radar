import {load, type CheerioAPI} from 'cheerio/slim';
import type {Dataset,Player,Stats} from './stats';

export class ImportError extends Error {code:string;status:number;constructor(code:string,message:string,status=422){super(message);this.code=code;this.status=status;}}
export function sourceUrl(input:unknown):URL{
 if(typeof input!=='string'||input.length>1800)throw new ImportError('INVALID_URL','请输入有效的 HLTV 比赛或赛事链接。',400);
 let u:URL;try{u=new URL(input.trim())}catch{throw new ImportError('INVALID_URL','请输入完整链接，例如 https://www.hltv.org/matches/…',400)}
 if(u.protocol!=='https:'||!['hltv.org','www.hltv.org'].includes(u.hostname)||u.port||u.username||u.password)throw new ImportError('INVALID_URL','仅支持 https://www.hltv.org/ 下的公开比赛和赛事页面。',400);
 const p=u.pathname;
 if(!/^\/(?:matches\/\d+\/[^/]+|events\/\d+\/[^/]+|stats\/matches\/(?:mapstatsid\/)?\d+\/[^/]+|stats\/players(?:\/\d+\/[^/]+)?)\/?$/.test(p))throw new ImportError('UNSUPPORTED_URL','请使用比赛详情、赛事详情或带赛事筛选的选手统计链接。',400);
 if(p.startsWith('/stats/players')&&!/^\d+$/.test(u.searchParams.get('event')||''))throw new ImportError('EVENT_REQUIRED','选手统计链接必须带有赛事筛选（event=赛事编号），以明确统计范围。',400);
 const clean=new URL(p,'https://www.hltv.org');
 for(const key of ['event','startDate','endDate','maps','matchType','rankingFilter','minMapCount']){
  const val=u.searchParams.get(key);if(val!==null)clean.searchParams.set(key,val);
 }
 return clean;
}
export async function fetchHtml(url:URL,fetcher:typeof fetch=fetch):Promise<string>{
 let current=url;
 for(let redirects=0;redirects<4;redirects++){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),20000);
  try{
   const r=await fetcher(current,{redirect:'manual',signal:abort.signal,headers:{'User-Agent':'CS2Radar/1.0 (public match statistics)','Accept':'text/html'}});
   if([301,302,303,307,308].includes(r.status)){
    const dest=r.headers.get('location');await r.body?.cancel();if(!dest)throw new ImportError('REDIRECT','HLTV 返回了无效跳转。',502);current=sourceUrl(new URL(dest,current).href);continue;
   }
   if(r.status===403||r.status===401){await r.body?.cancel();throw new ImportError('HLTV_BLOCKED','HLTV 拒绝了服务器读取（'+r.status+'）。本次未导入数据，你可以稍后重试或打开原网页查看。',502)}
   if(r.status===429){await r.body?.cancel();throw new ImportError('HLTV_RATE_LIMIT','HLTV 暂时限制了访问频率，请稍后重试。',429)}
   if(r.status===404){await r.body?.cancel();throw new ImportError('NOT_FOUND','HLTV 未找到此页面，请检查链接是否完整。',404)}
   if(!r.ok){await r.body?.cancel();throw new ImportError('UPSTREAM_ERROR','HLTV 暂时无法读取（'+r.status+'），请稍后重试。',502)}
   if(!r.headers.get('content-type')?.includes('text/html')){await r.body?.cancel();throw new ImportError('NOT_HTML','来源没有返回可识别的 HLTV 网页。',502)}
   const reader=r.body?.getReader();if(!reader)throw new ImportError('EMPTY_PAGE','HLTV 返回了空白页面。',502);
   const decoder=new TextDecoder();let text='',bytes=0;
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>5_000_000){await reader.cancel();throw new ImportError('PAGE_TOO_LARGE','该页面过大，暂时无法导入。',413)}text+=decoder.decode(value,{stream:true})}
   text+=decoder.decode();
   if(/<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(text)||/id=["']challenge-form["']/i.test(text))throw new ImportError('HLTV_BLOCKED','HLTV 要求浏览器验证，服务器无法读取此页面。本次未导入数据。',502);
   return text;
  }catch(e){if(e instanceof ImportError)throw e;if(abort.signal.aborted)throw new ImportError('TIMEOUT','HLTV 读取超时，请稍后重试。',504);throw new ImportError('NETWORK','无法连接 HLTV，请稍后重试。',502)}finally{clearTimeout(timer)}
 }
 throw new ImportError('REDIRECT','HLTV 跳转次数过多，未导入数据。',502);
}
const txt=(s:string)=>s.replace(/[\u200b-\u200f\u2060\ufeff]/g,'').replace(/\s+/g,' ').trim();
export const number=(s:string|undefined)=>{if(!s)return undefined;const m=txt(s).replace(/,/g,'').match(/^[+−-]?\d+(?:\.\d+)?/);if(!m)return undefined;const v=Number(m[0].replace('−','-'));return Number.isFinite(v)?v:undefined};
const label=(s:string)=>txt(s).toLowerCase().replace(/[^\w%/−-]/g,'');
function version(s:string){return s.match(/rating\s*([123]\.\d)/i)?.[1]||'未标注'}
const metricLabels:Record<string,string>={rating:'rating',adr:'adr','damage/round':'adr',damageperround:'adr',kast:'kast',kpr:'kpr','kills/round':'kpr',killsperround:'kpr',dpr:'dpr','deaths/round':'dpr',deathsperround:'dpr',swing:'swing',roundswing:'swing',mkrating:'multiKill','multi-killrating':'multiKill',multikillrating:'multiKill','totalkills':'kills','totaldeaths':'deaths','k/d':'kd','k/dratio':'kd','k-d':'kdDiff','k−d':'kdDiff','headshot%':'hs','hs%':'hs',maps:'maps',mapsplayed:'maps',rounds:'rounds',roundsplayed:'rounds',firepower:'firepower',entrying:'entrying',trading:'trading',opening:'opening',clutching:'clutching',sniping:'sniping',utility:'utility'};
function keyFor(s:string){const l=label(s);return /^rating[123]/.test(l)?'rating':metricLabels[l]}
function derive(s:Stats){if(s.kills!==undefined&&s.deaths!==undefined){s.kdDiff=s.kills-s.deaths;if(s.deaths>0)s.kd=s.kills/s.deaths}if(s.rounds&&s.rounds>0){if(s.kills!==undefined&&s.kpr===undefined)s.kpr=s.kills/s.rounds;if(s.deaths!==undefined&&s.dpr===undefined)s.dpr=s.deaths/s.rounds}return s}
function base($:CheerioAPI,u:URL,kind:Dataset['kind']):Dataset{
 const title=txt($('title').first().text()).replace(/\s*\|\s*HLTV\.org.*$/i,'');
 const event=txt($('.timeAndEvent .event a,.event-hub-title,.eventname,.event-name').first().text())||txt($('a[href*="?event="]').filter((_,el)=>!$(el).closest('table').length).first().text());
 const unix=number($('.timeAndEvent .date,[data-time-format][data-unix]').first().attr('data-unix'));
 return {id:u.pathname+(u.search||''),title:title||'HLTV 统计',event,date:unix?new Date(unix).toISOString().slice(0,10):'',kind,sourceUrl:u.href,importedAt:new Date().toISOString(),scopes:[],players:[],notes:[]};
}
function safeLink(path:string|undefined,baseUrl:URL){if(!path)return undefined;try{return sourceUrl(new URL(path,baseUrl).href).href}catch{return undefined}}
export function parseMatch(html:string,u:URL):Dataset{
 const $=load(html),out=base($,u,'match');
 const maps=$('.mapholder').toArray().map(el=>{const m=$(el),scores=m.find('.results-team-score').toArray().map(x=>number($(x).text()));const url=m.find('.results-stats a,a.results-stats,.results-stats').attr('href');return {name:txt(m.find('.mapname').text()),statsId:url?.match(/mapstatsid\/(\d+)/)?.[1],rounds:scores.length===2&&scores.every(x=>x!==undefined)?scores[0]!+scores[1]!:undefined}});
 const mapOnly=u.pathname.includes('/mapstatsid/');
 let tables=$('table.totalstats');
 if(!tables.length)tables=$('table.stats-table,table.table').filter((_,el)=>/ADR|KAST|Rating/i.test($(el).find('tr').first().text())&&!/\b(?:ctstats|tstats)\b/.test($(el).attr('class')||''));
 const people=new Map<string,Player>();const scopes=new Map<string,string>();
 tables.each((_,el)=>{
  const table=$(el);if(/\b(?:ctstats|tstats)\b/.test(table.attr('class')||''))return;
  const ancestor=table.parents('[id]').toArray().map(x=>$(x).attr('id')!).find(x=>/^(?:stats(?:All|\d+)|all-content|(?:map)?\d+-content)$/i.test(x));
  const scope=ancestor&&!/^(?:statsAll|all-content)$/i.test(ancestor)?ancestor:mapOnly?'map':'all';
  const mapId=scope.match(/\d+/)?.[0];const map=scope.startsWith('map')&&mapId?maps[Number(mapId)-1]:maps.find(m=>m.statsId===mapId);
  const scopeName=scope==='all'?'整场比赛':map?.name|| (mapOnly?'单张地图':'地图 '+(mapId||''));
  const rows=table.find('tr');const headers=rows.first().find('th,td').toArray().map(x=>txt($(x).text()));
  const v=version(headers.join(' '));
  const team=txt(table.find('.teamName,.team-name').first().text())||txt(table.find('tr').first().find('a[href*="/team/"],a[href*="/stats/teams/"]').first().text());
  rows.slice(1).each((_,row)=>{
   const r=$(row);const link=r.find('a[href^="/player/"],a[href^="/stats/players/"]').first();
   const href=link.attr('href')||'';const id=href.match(/\/(?:stats\/)?players?\/(\d+)/)?.[1];if(!id)return;
   const nick=txt(r.find('.player-nick').first().text())||txt(r.find('.playerNickname').first().text())||txt(link.text()).match(/'([^']+)'/)?.[1]||txt(link.text());if(!nick)return;
   const cells=r.children('td'),stats:Stats={};
   cells.each((i,cell)=>{
    const val=txt($(cell).text());const h=headers[i]||'';const k=keyFor(h);
    if((label(h)==='k-d'||label(h)==='k−d')&&/^\d+\s*[-−]\s*\d+$/.test(val)){const pair=val.split(/[-−]/).map(Number);stats.kills=pair[0];stats.deaths=pair[1];return}
    if(k){const value=number(val);if(value!==undefined)stats[k]=value}
   });
   const fallback:Record<string,string>={kills:'.st-kills',deaths:'.st-deaths',kast:'.st-kdratio,.kast',adr:'.st-adr',rating:'.st-rating,.rating',swing:'.st-swing,.swing'};
   for(const [k,sel]of Object.entries(fallback)){if(stats[k]===undefined){const node=r.find(sel).first();if(node.length){const raw=node.clone();raw.find('.ratingDesc,.gtSmartphone-only').remove();const value=number(raw.text());if(value!==undefined)stats[k]=value}}}
   if(stats.rating===undefined&&stats.adr===undefined&&stats.kills===undefined)return;
   const rounds=scope==='all'?maps.filter(m=>m.rounds!==undefined).reduce((s,m)=>s+m.rounds!,0):map?.rounds;
   if(rounds){stats.rounds=rounds;stats.maps=scope==='all'?maps.filter(m=>m.rounds!==undefined).length:1}
   if(mapOnly&&!stats.rounds){const left=number($('.team-left .bold').first().text()),right=number($('.team-right .bold').first().text());if(left!==undefined&&right!==undefined){stats.rounds=left+right;stats.maps=1}}
   derive(stats);
   const old=people.get(id)||{id,name:nick,team:team||'战队未提供',ratingVersion:v,stats:{}};
   // Some pages repeat hidden side/eco tables. Never merge a second row into an existing player/scope.
   if(!old.stats[scope])old.stats[scope]=stats;
   people.set(id,old);scopes.set(scope,scopeName);
  });
 });
 out.players=[...people.values()];out.scopes=[...scopes].map(([id,name])=>({id,name}));
 if(!out.players.length)throw new ImportError('NO_STATS','该页面没有可识别的选手统计。比赛可能尚未结束，或 HLTV 页面结构已变化。');
 out.notes.push('基础指标使用未经济校正的原始数据。仅读取页面明确提供的统计范围，不自行平均 Rating。');
 if(out.players.every(p=>Object.values(p.stats).every(s=>s.firepower===undefined)))out.notes.push('这份比赛数据未提供官方火力及七项属性；缺失项不估算。');
 return out;
}
export function parseEvent(html:string,u:URL,title?:string):Dataset{
 const $=load(html),out=base($,u,'event');if(title)out.title=title;out.event=title||out.event||'赛事 '+u.searchParams.get('event');out.scopes=[{id:'event',name:'整届赛事'}];
 const table=$('.player-ratings-table,.stats-table').filter((_,el)=>$(el).find('.playerCol').length>0).first();
 const headers=table.find('tr').first().find('th,td').toArray().map(x=>txt($(x).text()));
 table.find('tbody tr').each((_,el)=>{
  const r=$(el),a=r.find('.playerCol a').first(),href=a.attr('href'),id=href?.match(/players\/(\d+)/)?.[1];if(!id)return;
  const pu=new URL(href!,u);for(const [k,v]of u.searchParams)pu.searchParams.set(k,v);
  const stats:Stats={};r.children('td').each((i,cell)=>{const k=keyFor(headers[i]||'');const val=number($(cell).text());if(k&&val!==undefined)stats[k]=val});
  for(const [k,sel]of Object.entries({rating:'.ratingCol',kdDiff:'.kdDiffCol'})){const val=number(r.find(sel).text());if(val!==undefined)stats[k]=val}
  out.players.push({id,name:txt(a.text()),team:r.find('.teamCol img').toArray().map(x=>$(x).attr('title')).filter(Boolean).join(' / ')||txt(r.find('.teamCol').text())||'战队未提供',profileUrl:safeLink(pu.href,u),ratingVersion:version(headers.join(' ')),stats:{event:derive(stats)}});
 });
 if(!out.players.length)throw new ImportError('NO_STATS','该赛事没有可识别的选手统计，或 HLTV 页面结构已变化。');
 out.notes=['选择选手后会继续读取其赛事详情；详情读取失败时保留已取得的赛事列表数据。'];return out;
}
export function parsePlayer(html:string,u:URL):Dataset{
 const $=load(html),out=base($,u,'player'),stats:Stats={};
 const id=u.pathname.match(/players\/(\d+)/)?.[1];if(!id)throw new ImportError('INVALID_PLAYER','选手链接无效。');
 const name=txt($('.context-item-name,.summaryNickname,.playerNickname').first().text());
 if(!name)throw new ImportError('NO_STATS','无法识别该选手统计页面，未导入数据。');
 let v='未标注';
 $('.stats-row').each((_,el)=>{const row=$(el),spans=row.children('span'),k=keyFor(spans.first().text());const val=number(spans.last().text());if(k&&val!==undefined)stats[k]=val;if(k==='rating')v=version(spans.first().text())});
 // Summary boxes use explicit labels; do not read T / CT values as the overall rating.
 $('.summaryStatBreakdown,.summaryStatBreakdownContainer,.summary-stat,.summaryStat').each((_,el)=>{
  const node=$(el);const labelNode=node.find('.summaryStatLabel,.summaryStatName,.label').first();const k=keyFor(labelNode.text());const valueNode=node.find('.summaryStatValue,.value').first();const val=number(valueNode.text());
  if(k&&val!==undefined&&stats[k]===undefined){stats[k]=val;if(k==='rating')v=version(labelNode.text())}
 });
 for(const k of ['firepower','entrying','trading','opening','clutching','sniping','utility']){
  const candidates=$('[data-attribute="'+k+'"],[data-type="'+k+'"],.attribute-'+k);
  candidates.each((_,el)=>{const node=$(el);const side=node.attr('data-side')||node.parents('[data-side]').first().attr('data-side');if(side&& !/^(all|both)$/i.test(side))return;const val=number(node.attr('data-value')||node.find('.attribute-value,.attribute-score,.value').first().text());if(val!==undefined&&val>=0&&val<=100&&stats[k]===undefined)stats[k]=val});
 }
 // Accept explicitly paired labels and numeric values across HLTV summary layout variants.
 // Restrict to leaf labels outside tables and skip side-specific / eco-adjusted containers.
 $('span,div').each((_,el)=>{
  const node=$(el);if(node.children().length||node.closest('table,nav,footer,script').length)return;
  const raw=txt(node.text());if(raw.length>32)return;const k=keyFor(raw);if(!k||stats[k]!==undefined)return;
  const ancestry=node.parents('[data-side],.ctstats,.tstats,[data-eco-adjusted="true"]');
  if(ancestry.toArray().some(x=>{const side=$(x).attr('data-side');return side?!/^(all|both)$/i.test(side):true}))return;
  const siblings=[node.next(),node.prev()];let val:number|undefined;
  for(const sibling of siblings){const text=txt(sibling.text());if(/^[+−-]?\d+(?:\.\d+)?%?$/.test(text)){val=number(text);break}}
  if(val===undefined)return;
  if(['firepower','entrying','trading','opening','clutching','sniping','utility'].includes(k)&&(val<0||val>100))return;
  stats[k]=val;if(k==='rating')v=version(raw);
 });
 derive(stats);if(Object.keys(stats).length<2)throw new ImportError('NO_STATS','选手页面缺少可识别的统计字段，未导入数据。');
 out.scopes=[{id:'event',name:'整届赛事'}];out.players=[{id,name,team:txt($('.SummaryTeamname,.summaryTeamname').first().text())||'战队未提供',ratingVersion:v,profileUrl:u.href,detailLoaded:true,stats:{event:stats}}];
 out.notes=['只使用此链接赛事筛选范围内的数据。页面未提供的指标显示为缺失。'];return out;
}
export async function importHltv(input:unknown,fetcher:typeof fetch=fetch):Promise<Dataset>{
 const u=sourceUrl(input);
 if(u.pathname.startsWith('/events/')){
  const html=await fetchHtml(u,fetcher),$=load(html);const title=txt($('.event-hub-title,.eventname,.event-name').first().text())||txt($('title').text()).replace(/\s*(?:overview)?\s*\|\s*HLTV\.org.*$/i,'');
  const id=u.pathname.split('/')[2];const stats=new URL('/stats/players?event='+id,'https://www.hltv.org');
  const data=parseEvent(await fetchHtml(stats,fetcher),stats,title);data.sourceUrl=u.href;return data;
 }
 const html=await fetchHtml(u,fetcher);
 if(/^\/stats\/players\/\d+/.test(u.pathname))return parsePlayer(html,u);
 if(u.pathname==='/stats/players'||u.pathname==='/stats/players/')return parseEvent(html,u);
 return parseMatch(html,u);
}
