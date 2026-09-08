export type RadarViewBox={x:number;y:number;width:number;height:number};

const numbers=(value:string|null)=>value?.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite)||[];

export function radarViewBox(svg:Element,padding=18):RadarViewBox{
 const original=numbers(svg.getAttribute('viewBox'));
 const base:RadarViewBox=original.length>=4?{x:original[0],y:original[1],width:original[2],height:original[3]}:{x:0,y:0,width:600,height:500};
 let minX=base.x,minY=base.y,maxX=base.x+base.width,maxY=base.y+base.height;
 const include=(x:number,y:number)=>{if(!Number.isFinite(x)||!Number.isFinite(y))return;minX=Math.min(minX,x-padding);minY=Math.min(minY,y-padding);maxX=Math.max(maxX,x+padding);maxY=Math.max(maxY,y+padding)};

 svg.querySelectorAll('[data-series="A"],[data-series="B"]').forEach(series=>{
  series.querySelectorAll('polygon').forEach(node=>{
   const points=numbers(node.getAttribute('data-final-points')||node.getAttribute('points'));
   for(let i=0;i+1<points.length;i+=2)include(points[i],points[i+1]);
  });
  series.querySelectorAll('line').forEach(node=>{
   include(Number(node.getAttribute('data-final-x1')||node.getAttribute('x1')),Number(node.getAttribute('data-final-y1')||node.getAttribute('y1')));
   include(Number(node.getAttribute('data-final-x2')||node.getAttribute('x2')),Number(node.getAttribute('data-final-y2')||node.getAttribute('y2')));
  });
  series.querySelectorAll('circle').forEach(node=>include(Number(node.getAttribute('data-final-cx')||node.getAttribute('cx')),Number(node.getAttribute('data-final-cy')||node.getAttribute('cy'))));
 });

 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

export function applyRadarViewBox(svg:Element,padding=18){
 const box=radarViewBox(svg,padding);
 svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);
 svg.setAttribute('width',String(box.width));
 svg.setAttribute('height',String(box.height));
 svg.setAttribute('overflow','visible');
 return box;
}
