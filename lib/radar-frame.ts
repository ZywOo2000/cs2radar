/** Shared visible frame and background clip; foreground geometry may overflow. */
export type RadarFrame={x:number;y:number;width:number;height:number;rx:number};
export const BROADCAST_FRAME:RadarFrame={x:10,y:10,width:980,height:940,rx:30};
export const DEFAULT_BACKGROUND_FRAME:RadarFrame={x:0,y:0,width:1000,height:960,rx:30};
