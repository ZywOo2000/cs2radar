import type {Metric,Stats} from './stats';
import type {RadarMotionKind} from './radar-motion';

const RADAR_RING_PAUSE_MS=300;
const RADAR_RING_EXPAND_MS=1100;

export const SEQUENCE_MORPH_MS=1100;
export const SEQUENCE_HOLD_MS=700;
export const SEQUENCE_FINAL_HOLD_MS=1000;
export const SEQUENCE_CENTER_ENTRY_MS=1650;

export type SequenceParticipant={name:string;context:string;stats:Stats;color:string;bestKeys:string[];ratingVersion:string};
export type SequenceFrame={stats:Stats;color:string;bestKeys:string[];bestOpacity:number;fromIndex:number;toIndex:number;mix:number;nameFromOpacity:number;nameToOpacity:number;done:boolean};

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const sequenceEase=(v:number)=>{v=clamp(v);return v<.5?4*v*v*v:1-Math.pow(-2*v+2,3)/2};
const rgb=(hex:string)=>{const value=hex.replace('#','');return [0,2,4].map(i=>parseInt(value.slice(i,i+2),16))};
export const interpolateColor=(a:string,b:string,t:number)=>'#'+rgb(a).map((v,i)=>Math.round(v+(rgb(b)[i]-v)*clamp(t)).toString(16).padStart(2,'0')).join('');
const rawAtNormalized=(m:Metric,n:number)=>m.inverse?m.max-(m.max-m.min)*n/100:m.min+(m.max-m.min)*n/100;
const interpolateStats=(metrics:Metric[],a:Stats,b:Stats,t:number):Stats=>Object.fromEntries(metrics.flatMap(m=>{
 const av=a[m.key],bv=b[m.key];
 if(!Number.isFinite(av)||!Number.isFinite(bv))return [];
 return [[m.key,av!+(bv!-av!)*t]];
}));

export function sequenceEntryMs(motion:RadarMotionKind){return motion==='rings'?RADAR_RING_PAUSE_MS+RADAR_RING_EXPAND_MS:SEQUENCE_CENTER_ENTRY_MS}
export function sequenceDuration(count:number,motion:RadarMotionKind){if(count<1)return 0;return sequenceEntryMs(motion)+SEQUENCE_HOLD_MS+Math.max(0,count-1)*(SEQUENCE_MORPH_MS+SEQUENCE_HOLD_MS)+SEQUENCE_FINAL_HOLD_MS-SEQUENCE_HOLD_MS}
export function sequenceArrivalTime(index:number,motion:RadarMotionKind){return index<=0?sequenceEntryMs(motion):sequenceEntryMs(motion)+SEQUENCE_HOLD_MS+index*SEQUENCE_MORPH_MS+(index-1)*SEQUENCE_HOLD_MS}

export function sequenceFrameAt(people:SequenceParticipant[],metrics:Metric[],elapsed:number,motion:RadarMotionKind):SequenceFrame{
 if(!people.length)return {stats:{},color:'#bddbff',bestKeys:[],bestOpacity:0,fromIndex:0,toIndex:0,mix:0,nameFromOpacity:0,nameToOpacity:0,done:true};
 const entry=sequenceEntryMs(motion),total=sequenceDuration(people.length,motion),time=Math.max(0,elapsed);
 if(time<entry){
  const pause=motion==='rings'?RADAR_RING_PAUSE_MS:0;
  const p=sequenceEase((time-pause)/(entry-pause));
  const start:Stats=Object.fromEntries(metrics.flatMap(m=>Number.isFinite(people[0].stats[m.key])?[[m.key,rawAtNormalized(m,motion==='rings'?20:0)]]:[]));
  return {stats:interpolateStats(metrics,start,people[0].stats,p),color:people[0].color,bestKeys:people[0].bestKeys,bestOpacity:p,fromIndex:0,toIndex:0,mix:p,nameFromOpacity:1,nameToOpacity:0,done:false};
 }
 let cursor=entry;
 for(let i=0;i<people.length-1;i++){
  if(time<cursor+SEQUENCE_HOLD_MS)return {stats:people[i].stats,color:people[i].color,bestKeys:people[i].bestKeys,bestOpacity:1,fromIndex:i,toIndex:i,mix:0,nameFromOpacity:1,nameToOpacity:0,done:false};
  cursor+=SEQUENCE_HOLD_MS;
  if(time<cursor+SEQUENCE_MORPH_MS){
   const raw=clamp((time-cursor)/SEQUENCE_MORPH_MS),p=sequenceEase(raw),fade=raw<.5?1-raw*2:(raw-.5)*2;
   return {stats:interpolateStats(metrics,people[i].stats,people[i+1].stats,p),color:interpolateColor(people[i].color,people[i+1].color,p),bestKeys:raw<.5?people[i].bestKeys:people[i+1].bestKeys,bestOpacity:fade,fromIndex:i,toIndex:i+1,mix:raw,nameFromOpacity:1-raw,nameToOpacity:raw,done:false};
  }
  cursor+=SEQUENCE_MORPH_MS;
 }
 const last=people.length-1;
 return {stats:people[last].stats,color:people[last].color,bestKeys:people[last].bestKeys,bestOpacity:1,fromIndex:last,toIndex:last,mix:1,nameFromOpacity:1,nameToOpacity:0,done:time>=total};
}

export function commonSequenceMetrics(metrics:Metric[],people:SequenceParticipant[]){
 const versions=new Set(people.map(p=>p.ratingVersion));
 return metrics.filter(m=>(m.key!=='rating'||(versions.size===1&&!versions.has('未标注')))&&people.every(p=>Number.isFinite(p.stats[m.key])));
}

export function sequenceVideoFileName(count:number,date=new Date(),extension='webm'){
 const pad=(n:number)=>String(n).padStart(2,'0');
 const stamp=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
 return `${count}人连续数据图_${stamp}.${extension}`;
}
