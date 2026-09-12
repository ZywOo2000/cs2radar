import {hltvImageUrl} from '@/lib/hltv-avatar';

const TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);

export async function GET(request:Request){
 const raw=new URL(request.url).searchParams.get('url');
 const initial=hltvImageUrl(raw);
 if(!initial)return new Response('Invalid avatar URL',{status:400,headers:{'Cache-Control':'no-store'}});
 let current=initial;
 for(let redirects=0;redirects<4;redirects++){
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
  try{
   const response=await fetch(current,{redirect:'manual',signal:abort.signal,headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'}});
   if([301,302,303,307,308].includes(response.status)){
    const next=hltvImageUrl(response.headers.get('location'),current);
    await response.body?.cancel();
    if(!next)return new Response('Invalid avatar redirect',{status:502});
    current=next;continue;
   }
   if(!response.ok)return new Response('Avatar unavailable',{status:response.status===404?404:502,headers:{'Cache-Control':'public, max-age=300'}});
   const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
   if(!TYPES.has(type)){await response.body?.cancel();return new Response('Unsupported avatar format',{status:415})}
   if(Number(response.headers.get('content-length'))>2_000_000){await response.body?.cancel();return new Response('Avatar too large',{status:413})}
   const bytes=await response.arrayBuffer();
   if(!bytes.byteLength||bytes.byteLength>2_000_000)return new Response('Avatar too large',{status:413});
   return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400, stale-while-revalidate=604800','X-Content-Type-Options':'nosniff'}});
  }catch{return new Response('Avatar unavailable',{status:502,headers:{'Cache-Control':'public, max-age=300'}})}finally{clearTimeout(timer)}
 }
 return new Response('Too many redirects',{status:502});
}
