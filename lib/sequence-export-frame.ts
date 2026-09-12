import type {RadarViewBox} from './radar-bounds';

export const SEQUENCE_VIDEO_FRAME={
 width:1920,
 height:1080,
 borderInset:24,
 contentPaddingX:72,
 contentPaddingY:56,
 borderRadius:30,
} as const;

export function unionRadarBoxes(boxes:RadarViewBox[]):RadarViewBox{
 if(!boxes.length)return {x:0,y:0,width:600,height:500};
 const x=Math.min(...boxes.map(box=>box.x)),y=Math.min(...boxes.map(box=>box.y));
 const right=Math.max(...boxes.map(box=>box.x+box.width)),bottom=Math.max(...boxes.map(box=>box.y+box.height));
 return {x,y,width:right-x,height:bottom-y};
}

export function sequenceRadarFit(box:RadarViewBox){
 const frame=SEQUENCE_VIDEO_FRAME;
 const contentX=frame.borderInset+frame.contentPaddingX,contentY=frame.borderInset+frame.contentPaddingY;
 const contentWidth=frame.width-2*contentX,contentHeight=frame.height-2*contentY;
 const scale=Math.min(contentWidth/box.width,contentHeight/box.height);
 return {
  scale,
  x:contentX+(contentWidth-box.width*scale)/2-box.x*scale,
  y:contentY+(contentHeight-box.height*scale)/2-box.y*scale,
 };
}

export function sequenceExportFrameMarkup(radarXml:string,box:RadarViewBox){
 const frame=SEQUENCE_VIDEO_FRAME,fit=sequenceRadarFit(box);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}"><rect width="100%" height="100%" fill="#10151b"/><rect data-sequence-export-border="true" x="${frame.borderInset}" y="${frame.borderInset}" width="${frame.width-frame.borderInset*2}" height="${frame.height-frame.borderInset*2}" rx="${frame.borderRadius}" fill="#151e28" stroke="#35485b" stroke-width="3"/><g transform="translate(${fit.x} ${fit.y}) scale(${fit.scale})">${radarXml}</g></svg>`;
}
