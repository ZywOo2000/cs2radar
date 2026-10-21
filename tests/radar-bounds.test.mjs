import test from 'node:test';
import assert from 'node:assert/strict';
import {applyRadarViewBox,copyRadarTextBounds,radarEffectPadding,radarViewBox} from '../lib/radar-bounds.ts';

const element=attributes=>({getAttribute:name=>attributes[name]??null});
const series={querySelectorAll(selector){
 if(selector==='polygon')return [element({'data-final-points':'-40,-25 1040,1025 500,300'})];
 if(selector==='line')return [element({'data-final-x1':'-70','data-final-y1':'400','data-final-x2':'1070','data-final-y2':'450'})];
 if(selector==='circle')return [element({'data-final-cx':'500','data-final-cy':'-55'})];
 return [];
}};

test('export viewBox expands in every direction around final radar geometry',()=>{
 const attributes={viewBox:'0 0 1000 960'};
 const background={tagName:'rect',setAttribute:(name,value)=>attributes['background-'+name]=value};
 const svg={children:[background],getAttribute:name=>attributes[name]??null,setAttribute:(name,value)=>attributes[name]=value,querySelectorAll:selector=>selector.startsWith('[data-series=')?[series]:[]};
 assert.deepEqual(radarViewBox(svg,20),{x:-90,y:-75,width:1180,height:1120});
 assert.deepEqual(applyRadarViewBox(svg,20),{x:-90,y:-75,width:1180,height:1120});
 assert.equal(attributes.viewBox,'-90 -75 1180 1120');
 assert.equal(attributes.overflow,'visible');
 assert.equal(attributes['background-x'],'-90');assert.equal(attributes['background-width'],'1180');
});

test('effect padding includes stroke, point radius and three blur deviations',()=>{
 const shape=element({'stroke-width':'3','r':'5'}),blur=element({stdDeviation:'4'});
 const svg={querySelectorAll(selector){if(selector.startsWith('[data-series='))return [shape];if(selector==='feGaussianBlur')return [blur];return []}};
 assert.equal(radarEffectPadding(svg),21);
});

test('ordinary values retain the original export area',()=>{
 const ordinary={querySelectorAll(selector){return selector==='polygon'?[element({'data-final-points':'200,200 800,700'})]:[]}};
 const svg={getAttribute:()=> '0 0 1000 960',querySelectorAll:selector=>selector==='[data-series="A"],[data-series="B"]'?[ordinary]:[]};
 assert.deepEqual(radarViewBox(svg,20),{x:0,y:0,width:1000,height:960});
});

test('export bounds include positive and negative swing overflow',()=>{
 const left=element({x:'-300',y:'780',width:'400',height:'20'}),right=element({x:'500',y:'840',width:'800',height:'20'});
 const svg={getAttribute:name=>name==='viewBox'?'0 0 1000 960':null,querySelectorAll(selector){if(selector==='[data-swing] rect')return [left,right];if(selector.includes('[data-swing] rect'))return [left,right];return []}};
 assert.deepEqual(radarViewBox(svg),{x:-302,y:0,width:1604,height:960});
});

test('export bounds retain measured Best text beyond the SVG edge',()=>{
 const attributes={};
 const text={getAttribute:key=>attributes[key]??null,setAttribute:(key,value)=>attributes[key]=value};
 const source={querySelectorAll:()=>[{getBBox:()=>({x:970,y:40,width:150,height:52})}]};
 const target={getAttribute:()=> '0 0 1000 960',querySelectorAll:selector=>selector==='text'||selector==='text[data-radar-text-bounds]'?[text]:[]};
 copyRadarTextBounds(source,target);
 assert.equal(attributes['data-radar-text-bounds'],'970 40 150 52');
 assert.deepEqual(radarViewBox(target,20),{x:0,y:0,width:1140,height:960});
});
