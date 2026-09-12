export const isAllowedHltvImageHost=(hostname:string)=>hostname==='hltv.org'||hostname.endsWith('.hltv.org');

export function hltvImageUrl(input:unknown,base='https://www.hltv.org'){
 if(typeof input!=='string'||!input.trim())return undefined;
 const candidate=input.trim().split(/\s+/)[0];
 try{
  const url=new URL(candidate,base);
  if(url.protocol!=='https:'||url.port||url.username||url.password||!isAllowedHltvImageHost(url.hostname))return undefined;
  url.hash='';
  return url.href;
 }catch{return undefined}
}

export const playerInitials=(name:string)=>Array.from(name.trim()).slice(0,2).join('').toUpperCase()||'--';

export const shortenPlayerText=(value:string,max:number)=>{
 const text=value.replace(/\s+/g,' ').trim();
 return text.length<=max?text:text.slice(0,Math.max(1,max-1)).trimEnd()+'…';
};
