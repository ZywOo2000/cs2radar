export type RadarDisplayMode='static'|'dynamic';
export type RadarMotionKind='rings'|'center';
export type RadarMotionState={mode:RadarDisplayMode;kind:RadarMotionKind;runId:number};

export const RADAR_RING_PAUSE_MS=300;
export const RADAR_RING_EXPAND_MS=1100;

// Source identity stays constant while manual fields are edited. Include the
// geometry and comparable axes so new SVG segments always receive a fresh run.
export const radarMotionDataKey=(sourceKey:string|undefined,metrics:readonly {key:string}[],a:Readonly<Record<string,number|undefined>>,b?:Readonly<Record<string,number|undefined>>,drawKeys?:readonly string[])=>JSON.stringify([
 sourceKey||'',metrics.map(m=>[m.key,a[m.key],b?.[m.key]]),!!b,drawKeys??null,
 a.swing,b?.swing,a.firepower,b?.firepower,
]);

export const initialRadarMotion:RadarMotionState={mode:'static',kind:'center',runId:0};

export const pickRadarMotion=(random:()=>number=Math.random):RadarMotionKind=>random()<.5?'rings':'center';

export const replayRadarMotion=(state:RadarMotionState,kind:RadarMotionKind):RadarMotionState=>({mode:'dynamic',kind,runId:state.runId+1});

export const refreshDynamicRadar=(state:RadarMotionState,kind:RadarMotionKind):RadarMotionState=>state.mode==='dynamic'?replayRadarMotion(state,kind):state;

export const stopRadarMotion=(state:RadarMotionState):RadarMotionState=>({...state,mode:'static'});

export const radarRingProgress=(elapsedMs:number,expandMs=RADAR_RING_EXPAND_MS)=>Math.max(0,Math.min(1,(elapsedMs-RADAR_RING_PAUSE_MS)/expandMs));

export const beginRadarRingAnimations=(animations:Iterable<{beginElement:()=>void}>)=>{
 let count=0;
 for(const animation of animations){animation.beginElement();count++}
 return count;
};
