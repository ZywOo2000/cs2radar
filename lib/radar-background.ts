export type BackgroundColors = [string,string,string];
export type RadarBackground = {style:'normal'|'test';preset:string;colors:BackgroundColors};
export const BACKGROUND_STORAGE_KEY='cs2-radar-background-v1';
export const BACKGROUND_PRESETS = [
 {id:'multicolor',name:'视频同款多彩',colors:['#b18446','#8455b4','#139eac']},
 {id:'blue-purple',name:'蓝紫',colors:['#246fbd','#8053bb','#347bad']},
 {id:'teal',name:'青绿',colors:['#297d68','#246376','#2da39a']},
 {id:'gold',name:'暖金',colors:['#b57b30','#864a38','#b59a50']},
 {id:'red',name:'暗红',colors:['#9f3c53','#66385c','#a45a32']},
 {id:'ice',name:'冰蓝',colors:['#416c99','#38658b','#4d96ad']},
 {id:'rose-purple',name:'玫紫',colors:['#7f477f','#644898','#a04776']},
 {id:'sakura',name:'樱粉',colors:['#a0687c','#79597f','#a87a8e']},
 {id:'orange',name:'赤橙',colors:['#b15f2d','#8d3c30','#b1803d']},
 {id:'forest',name:'森林',colors:['#365d41','#345956','#62804e']},
 {id:'silver',name:'银灰',colors:['#59646f','#505b70','#78818b']},
 {id:'dark',name:'纯暗',colors:['#141b27','#1c1727','#15252a']},
] as const;
export const defaultRadarBackground=():RadarBackground=>({style:'normal',preset:'multicolor',colors:[...BACKGROUND_PRESETS[0].colors]});
export function parseRadarBackground(raw:string|null):RadarBackground {
 if(raw===null)return defaultRadarBackground();
 const x=JSON.parse(raw);
 if(x?.version!==1||!['normal','test'].includes(x.style)||!Array.isArray(x.colors)||x.colors.length!==3||!x.colors.every((c:unknown)=>typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)))throw new Error('背景设置已损坏，已恢复默认配色。');
 const preset=BACKGROUND_PRESETS.find(p=>p.id===x.preset&&p.colors.every((c,i)=>c.toLowerCase()===x.colors[i].toLowerCase()));
 return {style:x.style,preset:preset?.id||'custom',colors:[...x.colors] as BackgroundColors};
}
export function copyRadarBackground(value:RadarBackground):RadarBackground{return {...value,colors:[...value.colors]}}

export function loadRadarBackground(storage:Pick<Storage,'getItem'>){
 try{return {background:parseRadarBackground(storage.getItem(BACKGROUND_STORAGE_KEY)),warning:''}}
 catch{return {background:defaultRadarBackground(),warning:'无法恢复背景设置，已使用默认配色。'}}
}
export function saveRadarBackground(storage:Pick<Storage,'setItem'>,background:RadarBackground){
 try{storage.setItem(BACKGROUND_STORAGE_KEY,JSON.stringify({version:1,...background}));return ''}
 catch{return '背景设置无法保存，当前页面仍可使用。'}
}
