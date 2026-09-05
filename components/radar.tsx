'use client';
import {useState} from 'react';
import {type Metric,type Stats,normalized,format} from '@/lib/stats';
export function Radar({metrics,a,b,nameA,nameB}:{metrics:Metric[];a:Stats;b?:Stats;nameA:string;nameB?:string}){
 const [hover,setHover]=useState<number|null>(null);const n=metrics.length;
 const point=(v:number,i:number,r=170)=>{const angle=-Math.PI/2+i*Math.PI*2/n;return [300+Math.cos(angle)*r*v/100,244+Math.sin(angle)*r*v/100]};
 const polygon=(values:number[])=>values.map((v,i)=>point(v,i).join(',')).join(' ');
 return <><svg id="performance-radar" xmlns="http://www.w3.org/2000/svg" className="radar-svg" viewBox="0 0 600 500" role="img" aria-label={nameA+(b?' 与 '+nameB:'')+'，选手雷达图；原始数据见下方表格'}><title>RADAR / CS2 · {nameA}{b?' vs '+nameB:''}</title><rect width="600" height="500" fill="#151e28"/>
 {[20,40,60,80,100].map(v=><polygon key={v} points={polygon(Array(n).fill(v))} fill="none" stroke={v===100?'#425365':'#30404e'} strokeDasharray={v===100?undefined:'3 5'}/>)}
 {metrics.map((m,i)=>{const [x,y]=point(100,i),[tx,ty]=point(100,i,217);return <g key={m.key}><line x1={300} y1={244} x2={x} y2={y} stroke="#2b3845"/><text x={tx} y={ty} textAnchor="middle" fill="#c5d0db" fontFamily="Arial, sans-serif" fontSize={14}>{m.label}</text><text x={tx} y={ty+19} textAnchor="middle" fill="#8094a7" fontFamily="Arial, Microsoft YaHei, sans-serif" fontSize={12}>{m.name}</text></g>})}
 {n>=3&&[b,a].map((s,j)=>{if(!s||!metrics.every(m=>s[m.key]!==undefined))return null;const color=j===1?'#ff904b':'#61dac8';return <g key={j}><polygon points={polygon(metrics.map(m=>normalized(s[m.key]!,m)))} fill={color} fillOpacity={.13} stroke={color} strokeWidth={2.5} strokeLinejoin="round"/>{metrics.map((m,i)=>{const [cx,cy]=point(normalized(s[m.key]!,m),i);return <circle key={m.key} cx={cx} cy={cy} r={4} fill={color} stroke="#151e28" strokeWidth={1.5} onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}><title>{m.label}: {format(s[m.key],m)}</title></circle>})}</g>})}
 {!metrics.some(m=>a[m.key]!==undefined)&&<><circle cx={300} cy={244} r={39} fill="#192530" stroke="#425365"/><text x={300} y={250} fill="#c4d3df" textAnchor="middle" fontFamily="Arial" fontSize={16}>VS</text></>}
 </svg><div className="radar-tooltip" aria-live="polite">{hover!==null&&metrics[hover]?<><b>{metrics[hover].label}</b><span className="text-a">A {format(a[metrics[hover].key],metrics[hover])}</span>{b&&<span className="text-b">B {format(b[metrics[hover].key],metrics[hover])}</span>}</>:<span>固定刻度 · 鼠标移至数据点查看原始数值</span>}</div></>;
}
