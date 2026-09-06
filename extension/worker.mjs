import {sourceUrl} from '../lib/hltv.ts';
const origin='https://cs2-radar-lab.moaniq12.chatgpt.site';
chrome.runtime.onConnect.addListener(port=>{
 if(port.name!=='cs2-radar-v1'||port.sender?.frameId!==0||new URL(port.sender?.url||'https://invalid.test').origin!==origin){port.disconnect();return}
 const jobs=new Map();
 const send=m=>{try{port.postMessage(m)}catch{}};
 port.onDisconnect.addListener(()=>{for(const j of jobs.values())j.cancelled=true;jobs.clear()});
 port.onMessage.addListener(async m=>{
  if(m.type==='hello'){send({type:'ready',version:'1.0.3'});return}
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
