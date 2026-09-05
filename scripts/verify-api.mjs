const root='http://localhost:3000';
const page=await fetch(root);console.log('Page HTTP',page.status);if(page.status!==200)process.exitCode=1;
for(const [label,url]of [['invalid','https://example.com/matches/1/test'],['real HLTV match','https://www.hltv.org/matches/2383844/spirit-vs-mouz-iem-cologne-2025']]){
 const r=await fetch(root+'/api/hltv/import',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});const data=await r.json();console.log(label,JSON.stringify({http:r.status,ok:data.ok,code:data.error?.code,message:data.error?.message,players:data.data?.players?.length}));
 if(label==='invalid'&&!(r.status===400&&data.error?.code==='INVALID_URL'))process.exitCode=1;
 if(label==='real HLTV match'&&!data.ok&&!['HLTV_BLOCKED','HLTV_RATE_LIMIT','NETWORK','TIMEOUT','NO_STATS'].includes(data.error?.code))process.exitCode=1;
}
