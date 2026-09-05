import {ImportError,importHltv,sourceUrl} from '@/lib/hltv';
import type {Dataset} from '@/lib/stats';
const cache=new Map<string,{at:number;data:Dataset}>();
const inflight=new Map<string,Promise<Dataset>>();
const limits=new Map<string,{at:number;count:number}>();
export async function POST(request:Request){
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 try{
  if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)throw new ImportError('ORIGIN','请从当前网页发起导入。',403);
  if(!request.headers.get('content-type')?.includes('application/json'))throw new ImportError('CONTENT_TYPE','请求格式无效。',400);
  if(Number(request.headers.get('content-length'))>4096)throw new ImportError('INPUT_SIZE','链接过长。',413);
  const body=await request.text();if(body.length>4096)throw new ImportError('INPUT_SIZE','链接过长。',413);
  let input;try{input=JSON.parse(body)}catch{throw new ImportError('JSON','请求格式无效。',400)}
  const url=sourceUrl(input?.url).href,now=Date.now();
  const hit=cache.get(url);if(hit&&now-hit.at<300000)return json({ok:true,data:hit.data,cached:true});
  const ip=request.headers.get('cf-connecting-ip')||'local',limit=limits.get(ip);
  if(limit&&now-limit.at<60000&&limit.count>=15)throw new ImportError('RATE_LIMIT','导入次数较多，请一分钟后重试。',429);
  if(!limit||now-limit.at>=60000)limits.set(ip,{at:now,count:1});else limit.count++;
  if(limits.size>1000)for(const [key,l]of limits)if(now-l.at>60000)limits.delete(key);
  let job=inflight.get(url);
  if(!job){job=importHltv(url);inflight.set(url,job)}
  let data:Dataset;try{data=await job}finally{inflight.delete(url)}
  if(cache.size>=24)cache.delete(cache.keys().next().value!);
  cache.set(url,{at:now,data});
  return json({ok:true,data});
 }catch(e){if(e instanceof ImportError)return json({ok:false,error:{code:e.code,message:e.message}},e.status);return json({ok:false,error:{code:'INTERNAL',message:'导入暂时失败，请稍后重试。'}},500)}
}
