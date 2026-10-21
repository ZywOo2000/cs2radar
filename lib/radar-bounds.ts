export type RadarViewBox={x:number;y:number;width:number;height:number};

const numbers=(value:string|null)=>value?.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite)||[];

// Detached SVG clones cannot measure font geometry. Retain the live text bounds
// before serialization so enlarged values and Best labels fit the export area.
export function copyRadarTextBounds(source:Element,target:Element){
 const originals=source.querySelectorAll('text');
 target.querySelectorAll('text').forEach((node,index)=>{
  const original=originals[index] as SVGGraphicsElement|undefined;
  if(typeof original?.getBBox!=='function')return;
  const box=original.getBBox();
  if([box.x,box.y,box.width,box.height].every(Number.isFinite))
   node.setAttribute('data-radar-text-bounds',`${box.x} ${box.y} ${box.width} ${box.height}`);
 });
}

export function radarEffectPadding(svg:Element){
 let stroke=0,radius=0,blur=0,shadow=0;
 svg.querySelectorAll('[data-series="A"] *,[data-series="B"] *,[data-swing] rect').forEach(node=>{
  stroke=Math.max(stroke,Number(node.getAttribute('stroke-width')||0)/2);
  radius=Math.max(radius,Number(node.getAttribute('r')||0));
 });
 svg.querySelectorAll('feGaussianBlur').forEach(node=>{blur=Math.max(blur,...numbers(node.getAttribute('stdDeviation')))});
 svg.querySelectorAll('feDropShadow').forEach(node=>{
  const spread=Math.max(Math.abs(Number(node.getAttribute('dx')||0)),Math.abs(Number(node.getAttribute('dy')||0)))+3*Math.max(0,...numbers(node.getAttribute('stdDeviation')));
  shadow=Math.max(shadow,spread);
 });
 return Math.ceil(stroke+radius+Math.max(blur*3,shadow)+2);
}

export function radarViewBox(svg:Element,padding=radarEffectPadding(svg)):RadarViewBox{
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
 svg.querySelectorAll('[data-swing] rect').forEach(node=>{
  const x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y')),width=Number(node.getAttribute('width')),height=Number(node.getAttribute('height'));
  include(x,y);include(x+width,y+height);
 });
 svg.querySelectorAll('text[data-radar-text-bounds]').forEach(node=>{
  const box=numbers(node.getAttribute('data-radar-text-bounds'));
  if(box.length===4){include(box[0],box[1]);include(box[0]+box[2],box[1]+box[3])}
 });

 return {x:minX,y:minY,width:maxX-minX,height:maxY-minY};
}

export function applyRadarViewBox(svg:Element,padding=radarEffectPadding(svg)){
 const box=radarViewBox(svg,padding);
 svg.setAttribute('viewBox',`${box.x} ${box.y} ${box.width} ${box.height}`);
 svg.setAttribute('width',String(box.width));
 svg.setAttribute('height',String(box.height));
 svg.setAttribute('overflow','visible');
 const background=Array.from(svg.children).find(node=>node.tagName.toLowerCase()==='rect');
 if(background){background.setAttribute('x',String(box.x));background.setAttribute('y',String(box.y));background.setAttribute('width',String(box.width));background.setAttribute('height',String(box.height));background.setAttribute('rx','0')}
 return box;
}
