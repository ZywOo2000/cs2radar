import {useId} from 'react';
import {DEFAULT_BACKGROUND_FRAME,type RadarFrame} from '@/lib/radar-frame';
import type {RadarBackground} from '@/lib/radar-background';
import {testParticles,testParticleAt,testGlowAt} from '@/lib/radar-ambient';
export function RadarTestBackground({value,width=1000,height=960,frame=DEFAULT_BACKGROUND_FRAME}:{value?:RadarBackground;width?:number;height?:number;frame?:RadarFrame}){
 const id=('ambient-test-'+useId()).replace(/[^a-zA-Z0-9_-]/g,'');
 if(value?.style!=='test')return null;
 return <svg data-test-background="true" x="0" y="0" width={width} height={height} viewBox="0 0 1000 960" preserveAspectRatio="none" overflow="hidden" aria-hidden="true" pointerEvents="none">
 <defs><clipPath id={id+'-clip'} clipPathUnits="userSpaceOnUse"><rect {...frame}/></clipPath>{value.colors.map((color,i)=><radialGradient key={i} id={id+'-color-'+i}><stop stopColor={color} stopOpacity=".78"/><stop offset="1" stopColor={color} stopOpacity="0"/></radialGradient>)}
 <radialGradient id={id+'-shade'}><stop stopColor="#030817" stopOpacity=".52"/><stop offset="1" stopColor="#030817" stopOpacity="0"/></radialGradient>
 <radialGradient id={id+'-star'}><stop stopColor="#fff6da" stopOpacity=".75"/><stop offset=".3" stopColor="#d0e9ff" stopOpacity=".28"/><stop offset="1" stopColor="#d0e9ff" stopOpacity="0"/></radialGradient></defs>
 <g data-test-background-content="true" clipPath={'url(#'+id+'-clip)'}>
 <rect width="1000" height="960" fill="#080c18"/>
 {[[190,210,690,620],[820,190,650,610],[720,840,760,660]].map(([cx,cy,rx,ry],i)=><ellipse key={i} data-test-glow={i} cx={cx} cy={cy} rx={rx} ry={ry} transform={testGlowAt(i,0)} fill={'url(#'+id+'-color-'+i+')'}/>)}
 <ellipse cx="500" cy="450" rx="350" ry="340" fill={'url(#'+id+'-shade)'}/>
 {testParticles.map((p,i)=>{const s=testParticleAt(i,0);return <g key={i} data-test-particle={i} transform={s.transform} opacity={s.opacity}>{p.star?<><circle r={p.r*3.2} fill={'url(#'+id+'-star)'}/><path d={`M 0 ${-p.r} Q ${p.r*.18} ${-p.r*.18} ${p.r} 0 Q ${p.r*.18} ${p.r*.18} 0 ${p.r} Q ${-p.r*.18} ${p.r*.18} ${-p.r} 0 Q ${-p.r*.18} ${-p.r*.18} 0 ${-p.r}`} fill="#fff4d5"/><circle r=".8" fill="#fff"/></>:<circle r={p.r} fill={i%3===0?'#ffe3ad':'#d9eeff'}/>}</g>})}
 </g></svg>;
}
