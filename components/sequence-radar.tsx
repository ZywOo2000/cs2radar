'use client';
import {forwardRef,useEffect,useImperativeHandle,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {Radar} from './radar';
import {pickRadarMotion,type RadarMotionKind} from '@/lib/radar-motion';
import {sequenceDuration,sequenceFrameAt,type SequenceFrame,type SequenceParticipant} from '@/lib/video-sequence';
import {performance as performanceMetrics,type Metric} from '@/lib/stats';

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
 const [frame,setFrame]=useState(initial),raf=useRef(0),run=useRef(0);
 const renderAt=async(elapsed:number,motion:RadarMotionKind)=>{const next=sequenceFrameAt(people,timelineMetrics,elapsed,motion);flushSync(()=>setFrame(next));await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return next};
 const stop=()=>{run.current++;cancelAnimationFrame(raf.current);onPlaying?.(false)};
 const play=()=>{stop();if(people.length<2)return;const id=++run.current,motion=pickRadarMotion(),duration=sequenceDuration(people.length,motion),started=performance.now();onPlaying?.(true);const tick=()=>{if(run.current!==id)return;const elapsed=performance.now()-started;setFrame(sequenceFrameAt(people,timelineMetrics,elapsed,motion));if(elapsed<duration)raf.current=requestAnimationFrame(tick);else onPlaying?.(false)};raf.current=requestAnimationFrame(tick)};
 useEffect(()=>()=>{run.current++;cancelAnimationFrame(raf.current)},[]);
 useImperativeHandle(ref,()=>({play,stop,renderAt,getSvg:()=>document.querySelector('#sequence-radar-host #performance-radar')}));
 const from=people[frame.fromIndex]||people[0],to=people[frame.toIndex]||from;
 return <div id="sequence-radar-host" className="sequence-radar-host">
  <div className="sequence-stage-title"><span>{people.length?`${Math.max(frame.fromIndex,frame.toIndex)+1} / ${people.length}`:'0 / 0'}</span><div className="sequence-name-stack"><div style={{opacity:frame.nameFromOpacity}}><strong>{from?.name||'等待数据'}</strong><small>{from?.context}</small></div>{frame.toIndex!==frame.fromIndex&&<div style={{opacity:frame.nameToOpacity}}><strong>{to?.name}</strong><small>{to?.context}</small></div>}</div></div>
  <Radar metrics={metrics} a={frame.stats} nameA={to?.name||from?.name||'视频序列'} drawKeys={metrics.map(m=>m.key)} bestA={frame.bestKeys} colorA={frame.color} dataKey="sequence-controlled-static" showControls={false} bestOpacity={frame.bestOpacity}/>
 </div>;
});
