export type Stats = Partial<Record<string, number>>;
export type Player = {id:string;name:string;team:string;profileUrl?:string;stats:Record<string,Stats>;ratingVersion:string;detailLoaded?:boolean};
export type Dataset = {id:string;title:string;event:string;date:string;kind:'match'|'event'|'player';sourceUrl:string;importedAt:string;scopes:{id:string;name:string}[];players:Player[];notes:string[];demo?:boolean};
export type Metric = {key:string;label:string;name:string;min:number;max:number;decimals:number;unit?:string;inverse?:boolean;description:string};
export const performance:Metric[] = [
 {key:'rating',label:'Rating',name:'综合评分',min:0,max:1.3,decimals:2,description:'HLTV 原始综合评分；版本见选手信息。雷达参考满刻度为 1.30，超过时按比例越出参考圈。'},
 {key:'adr',label:'ADR',name:'回合均伤',min:0,max:120,decimals:1,description:'平均每回合造成的伤害。雷达刻度 0–120。'},
 {key:'kast',label:'KAST',name:'回合贡献率',min:0,max:100,decimals:1,unit:'%',description:'有击杀、助攻、存活或死亡被补枪的回合占比。刻度 0–100%。'},
 {key:'kpr',label:'KPR',name:'回合均击杀',min:0,max:1.2,decimals:2,description:'每回合击杀数。雷达刻度 0–1.2。'},
 {key:'dpr',label:'DPR ↓',name:'回合均死亡',min:0,max:1,decimals:2,inverse:true,description:'每回合死亡数，越低越好。绘图使用 (1−DPR)×100；原始数值不变。'},
 {key:'swing',label:'Swing',name:'回合胜率贡献',min:-10,max:10,decimals:2,unit:'%',description:'HLTV Round Swing。雷达刻度 −10% 至 +10%，零位于半径中点。'},
 {key:'firepower',label:'Firepower',name:'火力值',min:0,max:100,decimals:0,description:'当前统计范围内 HLTV 官方火力属性，0–100；未提供时不估算。'},
];
export const attributes:Metric[] = [
 ['firepower','Firepower','火力','击杀、伤害与多杀输出'],['entrying','Entrying','突破','被补枪死亡相关的进点倾向'],['trading','Trading','补枪','补枪及协助击杀倾向'],['opening','Opening','开局','参与开局对枪的倾向'],['clutching','Clutching','残局','残局参与及获胜情况'],['sniping','Sniping','狙击','AWP 与鸟狙的使用倾向'],['utility','Utility','道具','道具伤害及闪光使用']
].map(([key,label,name,description])=>({key,label,name,min:0,max:100,decimals:0,description:description+'。官方刻度 0–100；部分属性表示打法倾向，并非越高越好。'}));
export const extraMetrics:Metric[] = [
 {key:'kills',label:'K',name:'击杀',min:0,max:100,decimals:0,description:'统计范围内总击杀数。'},
 {key:'deaths',label:'D',name:'死亡',min:0,max:100,decimals:0,description:'统计范围内总死亡数。'},
 {key:'kdDiff',label:'K−D',name:'击杀死亡差',min:-100,max:100,decimals:0,description:'总击杀数减去总死亡数。'},
 {key:'kd',label:'K/D',name:'击杀死亡比',min:0,max:3,decimals:2,description:'总击杀数除以总死亡数；零死亡时不计算。'},
 {key:'multiKill',label:'MK Rating',name:'多杀评分',min:0,max:2,decimals:2,description:'HLTV Multi-Kill Rating。'},
 {key:'hs',label:'HS',name:'爆头率',min:0,max:100,decimals:1,unit:'%',description:'爆头击杀占总击杀的比例。'},
];
export const normalized=(value:number,m:Metric)=>Math.max(0,(m.inverse?1-(value-m.min)/(m.max-m.min):(value-m.min)/(m.max-m.min))*100);
export const format=(value:number|undefined,m:Metric)=>value===undefined||!Number.isFinite(value)?'—':(m.key==='swing'&&value>0?'+':'')+value.toFixed(m.decimals)+(m.unit||'');
export function sharedMetrics(ms:Metric[],a:Stats,b?:Stats,versionA?:string,versionB?:string){return ms.filter(m=>Number.isFinite(a[m.key])&&(!b||Number.isFinite(b[m.key]))&&(!(b&&m.key==='rating')||(versionA===versionB&&versionA!=='未标注')));}
export const demo:Dataset={id:'demo',title:'图表演示 · 虚构比赛',event:'示例赛事',date:'',kind:'match',sourceUrl:'',importedAt:'',demo:true,notes:['所有示例数值均为虚构，仅用于体验图表，不代表真实选手或比赛。'],scopes:[{id:'all',name:'整场比赛'},{id:'map-1',name:'Mirage · 示例'}],players:[
 {id:'demo-a',name:'PLAYER A',team:'示例战队 ALPHA',ratingVersion:'3.0（演示）',stats:{all:{rating:1.42,adr:91.5,kast:80.2,kpr:.86,dpr:.59,swing:3.2,firepower:87,entrying:63,trading:72,opening:85,clutching:45,sniping:20,utility:56,kills:49,deaths:34,kdDiff:15,kd:49/34,rounds:57,maps:3},'map-1':{rating:1.61,adr:102.4,kast:85,kpr:1,dpr:.55,swing:5.1,kills:20,deaths:11,rounds:20,maps:1}}},
 {id:'demo-b',name:'PLAYER B',team:'示例战队 BRAVO',ratingVersion:'3.0（演示）',stats:{all:{rating:1.26,adr:79.4,kast:84.2,kpr:.79,dpr:.53,swing:2.4,firepower:79,entrying:30,trading:81,opening:65,clutching:83,sniping:90,utility:42,kills:45,deaths:30,kdDiff:15,kd:1.5,rounds:57,maps:3},'map-1':{rating:1.31,adr:83.2,kast:80,kpr:.85,dpr:.6,swing:2.1,kills:17,deaths:12,rounds:20,maps:1}}}
]};
