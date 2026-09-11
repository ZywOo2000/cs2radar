import {sourceUrl,mergeMatchDataset} from '../lib/hltv.ts';
const allowedOrigins=new Set([
 'https://cs2-radar-lab.moaniq12.chatgpt.site',
 'https://cs2radar.moaniq12.workers.dev',
 'https://cs2shuju.top',
 'https://www.cs2shuju.top'
]);
function validSender(port){
 try{return port.sender?.frameId===0&&allowedOrigins.has(new URL(port.sender?.url).origin)}catch{return false}
}
async function readDetail(source,job,progress){
 const target=sourceUrl(source.url);
 if(!/^\/stats\/matches\/(?:mapstatsid\/)?\d+\//.test(target.pathname))throw Error('无效详细页链接');
 const tabs=await chrome.tabs.query({url:['https://www.hltv.org/*','https://hltv.org/*']});
 const existing=tabs.find(t=>{try{return !t.discarded&&sourceUrl(t.url).href===target.href}catch{return false}});
 const tab=existing||await chrome.tabs.create({url:target.href,active:true});
 let lastError='',errorStart=0;
 while(!job.cancelled&&Date.now()<job.detailDeadline){
  const current=await chrome.tabs.get(tab.id);
  if(current.url&&current.url!=='about:blank'){
   if(sourceUrl(current.url).href!==target.href)throw Error('详细页链接已改变');
   let r;
   try{
    const read=()=>chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>typeof globalThis.__cs2RadarExtract==='function'?globalThis.__cs2RadarExtract():{status:'not-injected'},injectImmediately:true});
    let response=await read();
    if(response[0]?.result?.status==='not-injected'){await chrome.scripting.executeScript({target:{tabId:tab.id},files:['extractor.js'],injectImmediately:true});response=await read()}
    r=response[0]?.result;
   }catch{r={status:'waiting',message:'正在加载详细统计页…'}}
   if(job.cancelled)throw Error('已取消');
   if(r?.status==='success')return r;
   if(r?.status==='error'){if(r.message!==lastError){lastError=r.message;errorStart=Date.now()}if(Date.now()-errorStart>=10000)throw Error(lastError)}
   else{lastError='';errorStart=0}
   progress('正在补读多杀：'+(r?.message||'等待详细页；如有验证，请在该页完成。'));
  }
  await new Promise(r=>setTimeout(r,200));
 }
 throw Error('详细页读取超时，请完成验证后重新导入');
}
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=='cs2-radar-v1'||!validSender(port)){port.disconnect();return}
 const jobs=new Map();
 const send=m=>{try{port.postMessage(m)}catch{}};
 port.onDisconnect.addListener(()=>{for(const j of jobs.values())j.cancelled=true;jobs.clear()});
 port.onMessage.addListener(async m=>{
  if(m.type==='hello'){send({type:'ready',version:'1.0.0'});return}
  if(m.type==='ping')return;
  if(m.type==='cancel'){const j=jobs.get(m.id);if(j)j.cancelled=true;return}
  if(m.type!=='import'||typeof m.id!=='string'||m.id.length>80)return;
  if(jobs.has(m.id))return;
  const job={cancelled:false};jobs.set(m.id,job);
  try{
   if(jobs.size>2)throw Error('最多同时读取两份数据，请等待当前读取完成。');
   const requested=sourceUrl(m.url);
   const target=requested.pathname.startsWith('/events/')?sourceUrl('https://www.hltv.org/stats/players?event='+requested.pathname.split('/')[2]):requested;
   // Reuse only an exact source/filter match. Never navigate another existing tab.
   const candidates=await chrome.tabs.query({url:['https://www.hltv.org/*','https://hltv.org/*']});
   const existing=candidates.find(t=>{try{return !t.discarded&&sourceUrl(t.url).href===target.href}catch{return false}});
   send({type:'progress',id:m.id,message:existing?'正在直接读取已打开的 HLTV 页面…':'正在浏览器打开 HLTV…'});
   const tab=existing||await chrome.tabs.create({url:target.href,active:true});
   const deadline=Date.now()+180000;
   let last='',parseError='',errorSince=0;
   while(!job.cancelled&&Date.now()<deadline){
    let current;try{current=await chrome.tabs.get(tab.id)}catch{throw Error('HLTV 标签页已关闭，请重新导入。')}
    // A tab can stay "loading" while advertisements load after the stats DOM is ready.
    if(current.url&&current.url!=='about:blank'){
     let actual;try{actual=sourceUrl(current.url)}catch{throw Error('HLTV 页面已跳转到不支持的地址，请重新导入。')}
     if(actual.href!==target.href)throw Error('HLTV 页面或赛事筛选已改变，请使用当前链接重新导入。');
     let result;
     try{
      const read=()=>chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>typeof globalThis.__cs2RadarExtract==='function'?globalThis.__cs2RadarExtract():{status:'not-injected'},injectImmediately:true});
      let response=await read();
      // Navigation destroys the isolated world: probe again rather than retaining a stale flag.
      if(response[0]?.result?.status==='not-injected'){
       await chrome.scripting.executeScript({target:{tabId:tab.id},files:['extractor.js'],injectImmediately:true});
       response=await read();
      }
      result=response[0]?.result;
     }catch{result={status:'waiting',message:'等待 HLTV 页面加载；如出现验证，请在该页完成。'}}
     if(job.cancelled)return;
     if(result?.status==='success'){
      result.data.sourceUrl=requested.href;
      const pending=result.remainingDetails||[];job.detailDeadline=Math.min(deadline,Date.now()+120000);
      for(const source of pending.slice(0,6)){
       if(job.cancelled)return;
       const progress=message=>send({type:'progress',id:m.id,message});
       progress('后台补读未成功，正在直接读取详细统计页…');
       try{const detail=await readDetail(source,job,progress);if(!mergeMatchDataset(result.data,detail.data,source.scope,detail.parentMatchUrl))throw Error('MKs 或总回合数未匹配')}
       catch(e){if(job.cancelled)return;result.data.notes.push('多杀补读失败（'+source.scope+'）：'+e.message)}
      }
      if(job.cancelled)return;
      result.data.notes.push('通过浏览器扩展读取 HLTV 页面；不包含浏览器 Cookie 或登录信息。');
      send({type:'result',id:m.id,data:result.data});return;
     }
     if(result?.status==='error'){
      if(parseError!==result.message||!errorSince)errorSince=Date.now();
      parseError=result.message;
      if(Date.now()-errorSince>=10000)throw Error(parseError+'。页面连续 10 秒未出现可读统计，请确认比赛已结束及链接正确后重试。');
     }else{parseError='';errorSince=0}
     const message=result?.message||'等待 HLTV 页面加载…';
     if(last!==message){last=message;send({type:'progress',id:m.id,message})}
    }
    await new Promise(r=>setTimeout(r,200));
   }
   if(!job.cancelled)throw Error(parseError||'等待 HLTV 超时（3 分钟）。请完成页面验证后重新导入。');
  }catch(e){if(!job.cancelled)send({type:'error',id:m.id,message:e.message||'扩展读取失败，请重试。'})}
  finally{jobs.delete(m.id)}
 });
});
