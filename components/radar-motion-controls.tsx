'use client';
import {useCallback,useEffect,useId,useRef,useState} from 'react';
import {beginRadarRingAnimations,initialRadarMotion,pickRadarMotion,refreshDynamicRadar,replayRadarMotion,stopRadarMotion,type RadarMotionKind} from '@/lib/radar-motion';

export function useRadarRingPlayback(mode:'static'|'dynamic',kind:RadarMotionKind,runId:number){
 const svgRef=useRef<SVGSVGElement>(null);
 useEffect(()=>{
  if(mode!=='dynamic'||kind!=='rings')return;
  const frame=requestAnimationFrame(()=>beginRadarRingAnimations(svgRef.current?.querySelectorAll<SVGAnimationElement>('animate[data-radar-ring-motion]')||[]));
  return()=>cancelAnimationFrame(frame);
 },[mode,kind,runId]);
 return svgRef;
}

export function useRadarMotion(dataKey=''){
 const [state,setState]=useState(initialRadarMotion);
 const previousDataKey=useRef(dataKey);
 const rawId=useId();
 const revealId=('radar-reveal-'+rawId).replace(/[^a-zA-Z0-9_-]/g,'');
 const showStatic=useCallback(()=>setState(stopRadarMotion),[]);
 const playDynamic=useCallback(()=>{const kind=pickRadarMotion();setState(current=>replayRadarMotion(current,kind))},[]);
 useEffect(()=>{if(previousDataKey.current===dataKey)return;previousDataKey.current=dataKey;const kind=pickRadarMotion();setState(current=>refreshDynamicRadar(current,kind))},[dataKey]);
 return {...state,revealId,showStatic,playDynamic};
}

export function RadarModeControls({mode,onStatic,onDynamic}:{mode:'static'|'dynamic';onStatic:()=>void;onDynamic:()=>void}){
 return <fieldset className="radar-mode-switch">
  <legend className="radar-mode-legend">数据图展示模式</legend>
  <button type="button" className="radar-mode-button" data-active={mode==='static'||undefined} aria-pressed={mode==='static'} onClick={onStatic}>静态</button>
  <button type="button" className="radar-mode-button" data-active={mode==='dynamic'||undefined} aria-pressed={mode==='dynamic'} onClick={onDynamic}>动态</button>
 </fieldset>;
}
