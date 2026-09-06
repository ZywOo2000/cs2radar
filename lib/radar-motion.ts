export type RadarDisplayMode='static'|'dynamic';
export type RadarMotionKind='rings'|'center';
export type RadarMotionState={mode:RadarDisplayMode;kind:RadarMotionKind;runId:number};

export const initialRadarMotion:RadarMotionState={mode:'static',kind:'center',runId:0};

export const pickRadarMotion=(random:()=>number=Math.random):RadarMotionKind=>random()<.5?'rings':'center';

export const replayRadarMotion=(state:RadarMotionState,kind:RadarMotionKind):RadarMotionState=>({mode:'dynamic',kind,runId:state.runId+1});

export const stopRadarMotion=(state:RadarMotionState):RadarMotionState=>({...state,mode:'static'});
