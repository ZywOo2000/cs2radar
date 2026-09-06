import {sourceUrl,parseMatch,parseEvent,parsePlayer,matchDetailSources,mergeMatchDetails} from '../lib/hltv.ts';
globalThis.__cs2RadarExtract=async()=>{
 try{
  const u=sourceUrl(location.href);
  if(/Just a moment|Attention Required|Verify you are human/i.test(document.title)||document.querySelector('#challenge-form')){
   return {status:'waiting',message:'HLTV 需要验证，请在打开的 HLTV 标签页完成；完成后会自动继续。'};
  }
  // Wait only for HTML parsing, not images/ads. Avoid returning a partially parsed roster.
  if(document.readyState==='loading'||!document.documentElement)return {status:'waiting',message:'正在等待统计正文；无需等待广告和图片加载完成。'};
  const html=document.documentElement.outerHTML;
  if(html.length>5000000)return {status:'error',message:'HLTV 页面过大，暂时无法读取。'};
  const data=/^\/stats\/players\/\d+/.test(u.pathname)?parsePlayer(html,u):/^\/stats\/players\/?$/.test(u.pathname)?parseEvent(html,u):parseMatch(html,u);
  // Browser-session requests reuse the loaded HLTV origin; no extra visible tabs.
  const sources=matchDetailSources(html,u,data).filter(s=>data.players.some(p=>p.stats[s.scope]?.multiKillPct===undefined)).slice(0,6);
  const remainingDetails=[];
  await Promise.all(sources.map(async source=>{
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),8000);
   try{
    const detail=sourceUrl(source.url);detail.hostname=location.hostname||new URL(location.href).hostname;
    const response=await fetch(detail.href,{signal:abort.signal,redirect:'error',credentials:'same-origin'});
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('详细页暂不可读');
    const reader=response.body.getReader(),decoder=new TextDecoder();let body='',bytes=0;
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>5000000){await reader.cancel();throw Error('详细页过大')}body+=decoder.decode(value,{stream:true})}body+=decoder.decode();
    if(!mergeMatchDetails(data,body,sourceUrl(source.url),source.scope))throw Error('详细页缺少匹配的 MKs 或回合数');
   }catch(e){remainingDetails.push({...source,reason:e.message||'请求失败'})}
   finally{clearTimeout(timer)}
  }));
  const parent=document.querySelector('a.match-page-link')?.getAttribute('href');
  return {status:'success',data,remainingDetails,parentMatchUrl:parent?new URL(parent,location.href).href:undefined};
 }catch(e){return {status:'error',message:'等待统计内容：'+(e.message||'HLTV 页面结构无法识别。')}}
};
