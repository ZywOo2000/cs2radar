'use client';
import {useCallback,useId,useState} from 'react';
import {initialRadarMotion,pickRadarMotion,replayRadarMotion,stopRadarMotion} from '@/lib/radar-motion';

export function useRadarMotion(){
 const [state,setState]=useState(initialRadarMotion);
 const rawId=useId();
 const revealId=('radar-reveal-'+rawId).replace(/[^a-zA-Z0-9_-]/g,'');
 const showStatic=useCallback(()=>setState(stopRadarMotion),[]);
 const playDynamic=useCallback(()=>{const kind=pickRadarMotion();setState(current=>replayRadarMotion(current,kind))},[]);
 return {...state,revealId,showStatic,playDynamic};
}

export function RadarModeControls({mode,onStatic,onDynamic}:{mode:'static'|'dynamic';onStatic:()=>void;onDynamic:()=>void}){
 return <fieldset className="radar-mode-switch">
  <legend className="radar-mode-legend">数据图展示模式</legend>
  <button type="button" className="radar-mode-button" data-active={mode==='static'||undefined} aria-pressed={mode==='static'} onClick={onStatic}>静态</button>
  <button type="button" className="radar-mode-button" data-active={mode==='dynamic'||undefined} aria-pressed={mode==='dynamic'} onClick={onDynamic}>动态</button>
 </fieldset>;
}
