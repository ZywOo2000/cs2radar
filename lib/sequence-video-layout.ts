import type {RadarViewBox} from './radar-bounds';

export const SEQUENCE_VIDEO_LAYOUT={
 width:1920,height:1080,
 left:{x:48,y:48,width:1280,height:984},
 radar:{x:76,y:154,width:1224,height:846},
 right:{x:1370,y:48,width:502,height:984},
} as const;

export function unionRadarBoxes(boxes:RadarViewBox[]):RadarViewBox{
 if(!boxes.length)return {x:-90,y:-55,width:780,height:610};
 const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
 const right=Math.max(...boxes.map(b=>b.x+b.width)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
 // SVG geometry bounds do not include the rendered width of anchored metric text.
 // Keep a fixed label gutter so long axis names and Best labels never touch the frame.
 return {x:x-90,y:y-55,width:right-x+180,height:bottom-y+110};
}

export function sequenceRadarFit(box:RadarViewBox){
 const area=SEQUENCE_VIDEO_LAYOUT.radar,scale=Math.min(area.width/box.width,area.height/box.height);
 return {scale,x:area.x+(area.width-box.width*scale)/2,y:area.y+(area.height-box.height*scale)/2};
}
