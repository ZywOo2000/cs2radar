'use client';
import {forwardRef,useEffect,useImperativeHandle,useLayoutEffect,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Radar} from './radar';
import {pickRadarMotion,type RadarMotionKind} from '@/lib/radar-motion';
import {sequenceArrivalTime,sequenceDuration,sequenceFrameAt,type SequenceFrame,type SequenceParticipant} from '@/lib/video-sequence';
import {performance as performanceMetrics,type Metric} from '@/lib/stats';
import {radarViewBox,type RadarViewBox} from '@/lib/radar-bounds';
import {unionRadarBoxes} from '@/lib/sequence-video-layout';
import {playerInitials} from '@/lib/hltv-avatar';

export type SequenceRadarHandle={
 play:()=>void;
 stop:()=>void;
 renderAt:(elapsed:number,motion:RadarMotionKind)=>Promise<SequenceFrame>;
 getSvg:()=>SVGSVGElement|null;
};

export const SequenceRadar=forwardRef<SequenceRadarHandle,{people:SequenceParticipant[];metrics:Metric[];onPlaying?:(value:boolean)=>void}>(function SequenceRadar({people,metrics,onPlaying},ref){
 const extras=metrics.some(m=>m.key==='multiKillPct')?performanceMetrics.filter(m=>['firepower','swing'].includes(m.key)&&people.every(p=>Number.isFinite(p.stats[m.key]))):[];
 const timelineMetrics=[...metrics,...extras];
 const initial=sequenceFrameAt(people,timelineMetrics,sequenceDuration(people.length,'rings'),'rings');
 const [frame,setFrame]=useState(initial),[previewBox,setPreviewBox]=useState<RadarViewBox>({x:0,y:0,width:600,height:500}),[prepared,setPrepared]=useState(false),raf=useRef(0),run=useRef(0),host=useRef<HTMLDivElement>(null);
 const renderAt=async(elapsed:number,motion:RadarMotionKind)=>{const next=sequenceFrameAt(people,timelineMetrics,elapsed,motion);flushSync(()=>setFrame(next));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return next};
 const stop=()=>{run.current++;cancelAnimationFrame(raf.current);onPlaying?.(false)};
 const play=()=>{stop();if(people.length<2)return;const id=++run.current,motion=pickRadarMotion(),duration=sequenceDuration(people.length,motion),started=performance.now();onPlaying?.(true);const tick=()=>{if(run.current!==id)return;const elapsed=performance.now()-started;setFrame(sequenceFrameAt(people,timelineMetrics,elapsed,motion));if(elapsed<duration)raf.current=requestAnimationFrame(tick);else onPlaying?.(false)};raf.current=requestAnimationFrame(tick)};
 useEffect(()=>{let active=true;(async()=>{const boxes:RadarViewBox[]=[];for(let i=0;i<people.length;i++){flushSync(()=>setFrame(sequenceFrameAt(people,timelineMetrics,sequenceArrivalTime(i,'rings'),'rings')));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));const svg=host.current?.querySelector<SVGSVGElement>('#performance-radar');if(svg)boxes.push(radarViewBox(svg))}if(!active)return;setPreviewBox(unionRadarBoxes(boxes));flushSync(()=>setFrame(initial));setPrepared(true)})();return()=>{active=false;run.current++;cancelAnimationFrame(raf.current)}},[]);
 useLayoutEffect(()=>{if(!prepared)return;const svg=host.current?.querySelector<SVGSVGElement>('#performance-radar');if(!svg)return;svg.setAttribute('viewBox',`${previewBox.x} ${previewBox.y} ${previewBox.width} ${previewBox.height}`)},[frame,previewBox,prepared]);
 useImperativeHandle(ref,()=>({play,stop,renderAt,getSvg:()=>host.current?.querySelector<SVGSVGElement>('#performance-radar')||null}));
 const from=people[frame.fromIndex]||people[0],to=people[frame.toIndex]||from;
 const card=(person:SequenceParticipant|undefined,opacity:number,key:string)=>person?<div className="sequence-player-card" style={{opacity}} key={key}><span className="sequence-player-index">选手 {Math.max(frame.fromIndex,frame.toIndex)+1} / {people.length}</span><div className="sequence-player-avatar"><span>{playerInitials(person.name)}</span>{person.avatarUrl&&<img src={'/api/hltv/avatar?url='+encodeURIComponent(person.avatarUrl)} alt="" onError={event=>event.currentTarget.remove()}/>}</div><div className="sequence-player-rule" style={{background:person.color}}/><strong style={{color:person.color}} title={person.name}>{person.name}</strong><b title={person.team}>{person.team}</b><small title={person.source}>{person.source}</small></div>:null;
 return <div ref={host} id="sequence-radar-host" className="sequence-radar-host">
  <div className="sequence-video-frame" data-prepared={prepared||undefined}>
   <section className="sequence-video-left"><div className="sequence-video-heading"><span>RADAR / CS2 · 连续数据图</span><strong>{metrics.some(m=>m.key==='multiKillPct')?'选手比赛表现':'HLTV 选手属性'}</strong></div><div className="sequence-radar-viewport"><Radar metrics={metrics} a={frame.stats} nameA={to?.name||from?.name||'视频序列'} drawKeys={metrics.map(m=>m.key)} bestA={frame.bestKeys} colorA={frame.color} dataKey="sequence-controlled-static" showControls={false} bestOpacity={frame.bestOpacity}/></div></section>
   <aside className="sequence-player-rail">{card(from,frame.nameFromOpacity,'from')}{frame.toIndex!==frame.fromIndex&&card(to,frame.nameToOpacity,'to')}</aside>
  </div>
 </div>;
});
