'use client';
import {useId,useState} from 'react';
import {BACKGROUND_PRESETS,type RadarBackground,type BackgroundColors} from '@/lib/radar-background';
export function RadarBackgroundControls({value,onChange,disabled=false,warning=''}:{value:RadarBackground;onChange:(value:RadarBackground)=>void;disabled?:boolean;warning?:string}){
 const [customOpen,setCustomOpen]=useState(false);
 const customId=('background-custom-'+useId()).replace(/[^a-zA-Z0-9_-]/g,'');
 return <div className="radar-background-controls"><fieldset disabled={disabled}><legend className="sr-only">图表背景</legend>
 <label className="background-test-switch"><input type="checkbox" checked={value.style==='test'} onChange={e=>onChange({...value,style:e.target.checked?'test':'normal'})}/>测试<span>星光背景</span></label>
 {value.style==='test'&&<><label>背景配色<select aria-label="背景配色" value={value.preset} onChange={e=>{const p=BACKGROUND_PRESETS.find(p=>p.id===e.target.value);if(p)onChange({...value,preset:p.id,colors:[...p.colors]})}}>{BACKGROUND_PRESETS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}{value.preset==='custom'&&<option value="custom">自定义</option>}</select></label>
 <button type="button" className="background-custom-toggle" aria-expanded={customOpen} aria-controls={customId} onClick={()=>setCustomOpen(v=>!v)}>自定义配色 <span aria-hidden="true">{customOpen?'−':'+'}</span></button>
 <button type="button" className="text-button background-reset" onClick={()=>onChange({...value,preset:'multicolor',colors:[...BACKGROUND_PRESETS[0].colors]})}>恢复视频配色</button>
 <div id={customId} className="background-color-inputs" hidden={!customOpen}>{value.colors.map((color,i)=><label key={i}>颜色 {i+1}<input type="color" aria-label={'背景颜色 '+(i+1)} value={color} onInput={e=>{const colors=[...value.colors] as BackgroundColors;colors[i]=e.currentTarget.value;onChange({...value,preset:'custom',colors})}}/></label>)}</div></>}

 </fieldset>{warning&&<output role="status" className="background-warning">{warning}</output>}</div>;
}
