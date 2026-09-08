import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRadarViewBox,radarViewBox} from '../lib/radar-bounds.ts';

const element=attributes=>({getAttribute:name=>attributes[name]??null});
const series={querySelectorAll(selector){
 if(selector==='polygon')return [element({'data-final-points':'-40,-25 1040,1025 500,300'})];
 if(selector==='line')return [element({'data-final-x1':'-70','data-final-y1':'400','data-final-x2':'1070','data-final-y2':'450'})];
 if(selector==='circle')return [element({'data-final-cx':'500','data-final-cy':'-55'})];
 return [];
}};

test('export viewBox expands in every direction around final radar geometry',()=>{
 const attributes={viewBox:'0 0 1000 960'};
 const svg={getAttribute:name=>attributes[name]??null,setAttribute:(name,value)=>attributes[name]=value,querySelectorAll:()=>[series]};
 assert.deepEqual(radarViewBox(svg,20),{x:-90,y:-75,width:1180,height:1120});
 assert.deepEqual(applyRadarViewBox(svg,20),{x:-90,y:-75,width:1180,height:1120});
 assert.equal(attributes.viewBox,'-90 -75 1180 1120');
 assert.equal(attributes.overflow,'visible');
});

test('ordinary values retain the original export area',()=>{
 const ordinary={querySelectorAll(selector){return selector==='polygon'?[element({'data-final-points':'200,200 800,700'})]:[]}};
 const svg={getAttribute:()=> '0 0 1000 960',querySelectorAll:()=>[ordinary]};
 assert.deepEqual(radarViewBox(svg,20),{x:0,y:0,width:1000,height:960});
});
