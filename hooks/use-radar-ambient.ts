'use client';
import {useEffect,type RefObject} from 'react';
import type {RadarBackground} from '@/lib/radar-background';
import {applyRadarAmbient} from '@/lib/radar-ambient';

/** Mutate only decorative SVG attributes; never rerender the workbench per frame. */
export function useRadarAmbient(ref:RefObject<SVGSVGElement|null>, dynamic:boolean, runId:number, background?:RadarBackground) {
  useEffect(()=>{
    const svg=ref.current;if(!svg)return;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0, elapsed=0, previous:number|undefined, lastPaint=-Infinity;
    const stop=()=>{cancelAnimationFrame(raf);raf=0;previous=undefined};
    const tick=(now:number)=>{
      if(previous!==undefined)elapsed+=now-previous;
      previous=now;
      if(now-lastPaint>=1000/30){applyRadarAmbient(svg,elapsed);lastPaint=now}
      raf=requestAnimationFrame(tick);
    };
    const sync=()=>{
      stop();
      if(!dynamic||reduced.matches){elapsed=0;applyRadarAmbient(svg,0)}
      else if(!document.hidden)raf=requestAnimationFrame(tick);
    };
    applyRadarAmbient(svg,0);sync();
    document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);
    return()=>{stop();document.removeEventListener('visibilitychange',sync);reduced.removeEventListener('change',sync)};
  },[ref,dynamic,runId,background]);
}
