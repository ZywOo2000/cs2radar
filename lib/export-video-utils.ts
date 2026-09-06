export const supportedVideoMime=(supports:(mime:string)=>boolean)=>[
 'video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1.42001E','video/mp4',
 'video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'
].find(supports)||'';

export const videoFileName=(comparison:boolean,date=new Date(),extension='webm')=>{
 const pad=(n:number)=>String(n).padStart(2,'0');
 const stamp=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
 return `${comparison?'双人数据图':'单人数据图'}_${stamp}.${extension}`;
};
