const SUPPORTED_AVATAR_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif']);

export function bytesToBase64(bytes:Uint8Array){
 let binary='';
 for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary);
}

export async function resolveAvatarDataUrl(avatarUrl?:string,fetcher:typeof fetch=fetch){
 if(!avatarUrl)return undefined;
 try{
  const response=await fetcher('/api/hltv/avatar?url='+encodeURIComponent(avatarUrl),{signal:AbortSignal.timeout(15000)});
  if(!response.ok)return undefined;
  const type=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!SUPPORTED_AVATAR_TYPES.has(type))return undefined;
  const buffer=await response.arrayBuffer();
  if(!buffer.byteLength||buffer.byteLength>2_000_000)return undefined;
  return `data:${type};base64,${bytesToBase64(new Uint8Array(buffer))}`;
 }catch{return undefined}
}
