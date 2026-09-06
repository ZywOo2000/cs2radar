import {pickRadarMotion,type RadarMotionKind} from './radar-motion';
import {supportedVideoMime,videoFileName} from './export-video-utils';

export type ExportSide={name:string;context:string};
export type VideoExportResult={format:'MP4'|'WebM';fileName:string;motion:RadarMotionKind};

const NS='http://www.w3.org/2000/svg';
const escape=(value:string)=>value.replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[char]!));
const ease=(value:number)=>value<.5?4*value*value*value:1-Math.pow(-2*value+2,3)/2;
const waitFrame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));

async function drawSvg(ctx:CanvasRenderingContext2D,svg:string,width:number,height:number){
 const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob);
 try{const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('视频画面生成失败，请重试。'));image.src=url});ctx.clearRect(0,0,width,height);ctx.drawImage(image,0,0,width,height)}finally{URL.revokeObjectURL(url)}
}

function videoFrame(clone:SVGSVGElement,graphWidth:number,graphHeight:number,title:string,a:ExportSide,b?:ExportSide){
 const outerWidth=1200,header=170,scale=Math.min(1.1,1100/graphWidth),graphX=(outerWidth-graphWidth*scale)/2,totalHeight=Math.ceil(header+graphHeight*scale+35);
 const xml=new XMLSerializer().serializeToString(clone);
 const text=(x:number,y:number,value:string,size:number,color:string,weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}">${escape(value)}</text>`;
 const legendB=b?text(600,133,`B · ${b.name} · ${b.context}`.slice(0,82),17,'#61dac8',600):'';
 return {width:outerWidth,height:totalHeight,svg:`<svg xmlns="${NS}" width="${outerWidth}" height="${totalHeight}" viewBox="0 0 ${outerWidth} ${totalHeight}"><rect width="${outerWidth}" height="${totalHeight}" fill="#151e28"/>${text(50,48,'RADAR / CS2',20,'#bddbff',600)}${text(50,91,title,31,'#eef4fb',600)}${text(50,133,`A · ${a.name} · ${a.context}`.slice(0,82),17,'#bddbff',600)}${legendB}<g transform="translate(${graphX} ${header}) scale(${scale})">${xml}</g></svg>`};
}

export async function exportDynamicVideo(title:string,a:ExportSide,b:ExportSide|undefined,onProgress:(value:number)=>void=()=>{}):Promise<VideoExportResult>{
 const live=document.getElementById('performance-radar');
 if(!(live instanceof SVGSVGElement))throw new Error('雷达图尚未就绪。');
 if(typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge。');
 const mime=supportedVideoMime(type=>MediaRecorder.isTypeSupported(type));
 if(!mime)throw new Error('当前浏览器没有可用的视频编码器，请使用最新版 Chrome 或 Edge。');

 const clone=live.cloneNode(true) as SVGSVGElement;
 clone.querySelectorAll('.radar-motion-center,.radar-motion-rings,.radar-motion-bar').forEach(node=>node.classList.remove('radar-motion-center','radar-motion-rings','radar-motion-bar'));
 clone.removeAttribute('class');clone.removeAttribute('data-display-mode');clone.removeAttribute('data-motion-kind');clone.removeAttribute('data-motion-run');
 const box=(clone.getAttribute('viewBox')||'0 0 600 500').split(/\s+/).map(Number);
 const graphWidth=box[2]||600,graphHeight=box[3]||500;
 clone.setAttribute('width',String(graphWidth));clone.setAttribute('height',String(graphHeight));
 const center=graphWidth>800?{x:500,y:365}:{x:300,y:244};
 const series=[...clone.querySelectorAll<SVGGElement>('[data-series="A"],[data-series="B"]')];
 if(!series.length)throw new Error('当前数据图没有可导出的数据区域。');
 const original=series.map(node=>({node,transform:node.getAttribute('transform'),clip:node.getAttribute('clip-path')}));
 const defs=clone.querySelector('defs')||clone.insertBefore(document.createElementNS(NS,'defs'),clone.firstChild);
 const clip=document.createElementNS(NS,'clipPath');clip.id='video-export-reveal';
 const reveal=document.createElementNS(NS,'circle');reveal.setAttribute('cx',String(center.x));reveal.setAttribute('cy',String(center.y));clip.appendChild(reveal);defs.appendChild(clip);
 const bars=[...clone.querySelectorAll<SVGRectElement>('[data-swing] rect')].map(node=>({node,x:Number(node.getAttribute('x')||500),width:Number(node.getAttribute('width')||0)}));
 const motion=pickRadarMotion();
 const setProgress=(raw:number)=>{
  const progress=ease(Math.max(0,Math.min(1,raw)));
  original.forEach(({node,transform,clip:oldClip})=>{
   if(raw>=1){if(transform===null)node.removeAttribute('transform');else node.setAttribute('transform',transform);if(oldClip===null)node.removeAttribute('clip-path');else node.setAttribute('clip-path',oldClip);return}
   if(motion==='center'){node.setAttribute('transform',`translate(${center.x} ${center.y}) scale(${Math.max(.002,progress)}) translate(${-center.x} ${-center.y})`);node.removeAttribute('clip-path')}
   else{if(transform===null)node.removeAttribute('transform');else node.setAttribute('transform',transform);node.setAttribute('clip-path','url(#video-export-reveal)')}
  });
  reveal.setAttribute('r',String(motion==='rings'?Math.hypot(graphWidth,graphHeight)*1.15*progress:0));
  bars.forEach(({node,x,width})=>{const current=width*progress;node.setAttribute('width',String(current));node.setAttribute('x',String(x<500?500-current:500))});
 };

 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animationMs=reduced?900:1650,holdMs=1000;
 setProgress(0);
 let frame=videoFrame(clone,graphWidth,graphHeight,title,a,b);
 const canvas=document.createElement('canvas');const targetWidth=1080;
 canvas.width=targetWidth;canvas.height=Math.round(targetWidth*frame.height/frame.width);
 const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw new Error('浏览器无法创建视频画布。');
 await drawSvg(ctx,frame.svg,canvas.width,canvas.height);
 const stream=canvas.captureStream(30);const chunks:Blob[]=[];
 let recorder:MediaRecorder;
 try{recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8_000_000})}catch{stream.getTracks().forEach(track=>track.stop());throw new Error('视频编码器启动失败，请更新浏览器后重试。')}
 const recording=new Promise<Blob>((resolve,reject)=>{recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};recorder.onerror=()=>reject(new Error('录制视频时发生错误，请重试。'));recorder.onstop=()=>chunks.length?resolve(new Blob(chunks,{type:recorder.mimeType||mime})):reject(new Error('浏览器没有生成视频数据，请重试。'))});
 try{
  onProgress(1);recorder.start(100);const start=performance.now();let elapsed=0;
  while(elapsed<animationMs){elapsed=performance.now()-start;setProgress(elapsed/animationMs);frame=videoFrame(clone,graphWidth,graphHeight,title,a,b);await drawSvg(ctx,frame.svg,canvas.width,canvas.height);onProgress(Math.min(70,Math.round(elapsed/animationMs*70)));await waitFrame()}
  setProgress(1);frame=videoFrame(clone,graphWidth,graphHeight,title,a,b);await drawSvg(ctx,frame.svg,canvas.width,canvas.height);
  const holdStart=performance.now();while(performance.now()-holdStart<holdMs){onProgress(70+Math.round((performance.now()-holdStart)/holdMs*25));await waitFrame()}
  recorder.stop();const blob=await recording;onProgress(97);
  const actual=(recorder.mimeType||mime).toLowerCase();const mp4=actual.startsWith('video/mp4');const extension=mp4?'mp4':'webm';const fileName=videoFileName(!!b,new Date(),extension);
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);onProgress(100);
  return {format:mp4?'MP4':'WebM',fileName,motion};
 }finally{
  if(recorder.state!=='inactive')recorder.stop();stream.getTracks().forEach(track=>track.stop());canvas.width=1;canvas.height=1;
 }
}
