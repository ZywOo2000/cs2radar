import {sourceUrl,parseMatch,parseEvent,parsePlayer} from '../lib/hltv.ts';
globalThis.__cs2RadarExtract=()=>{
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
  return {status:'success',data};
 }catch(e){return {status:'error',message:'等待统计内容：'+(e.message||'HLTV 页面结构无法识别。')}}
};
