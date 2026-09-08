export const supportedVideoMime=(supports:(mime:string)=>boolean)=>[
 'video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1.42001E','video/mp4',
 'video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'
].find(supports)||'';

export const videoFileName=(comparison:boolean,date=new Date(),extension='webm')=>{
 const pad=(n:number)=>String(n).padStart(2,'0');
 const stamp=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
 return `${comparison?'双人数据图':'单人数据图'}_${stamp}.${extension}`;
};

export const regularRevealPoints=(axisCount:number,cx:number,cy:number,radius:number)=>Array.from({length:Math.max(3,axisCount)},(_,i)=>{
 const angle=-Math.PI/2+i*Math.PI*2/Math.max(3,axisCount);
 return `${cx+Math.cos(angle)*radius},${cy+Math.sin(angle)*radius}`;
}).join(' ');

export const interpolatePolygonPoints=(from:string,to:string,progress:number)=>{
 const parse=(points:string)=>points.trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
 const start=parse(from),end=parse(to),amount=Math.max(0,Math.min(1,progress));
 if(start.length!==end.length||start.some(point=>point.length!==2||point.some(value=>!Number.isFinite(value)))||end.some(point=>point.length!==2||point.some(value=>!Number.isFinite(value))))return to;
 return end.map((point,index)=>`${start[index][0]+(point[0]-start[index][0])*amount},${start[index][1]+(point[1]-start[index][1])*amount}`).join(' ');
};

export const videoFrameGeometry=(graphWidth:number,graphHeight:number)=>{
 const scale=1.1,header=170,outerWidth=Math.ceil(Math.max(1200,graphWidth*scale+100)-1e-8),height=Math.ceil(header+graphHeight*scale+35-1e-8);
 return {width:outerWidth,height,scale,header,graphX:(outerWidth-graphWidth*scale)/2};
};

export const videoCanvasSize=(frameWidth:number,frameHeight:number)=>{
 const pixelScale=1080/1200;
 const even=(value:number)=>Math.ceil(value/2)*2;
 return {width:even(frameWidth*pixelScale),height:even(frameHeight*pixelScale)};
};
