import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load} from 'cheerio/slim';
import {attributes} from '../lib/stats.ts';

await build({entryPoints:['components/radar.tsx'],outfile:'.checks/radar-component.mjs',bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',alias:{'@':resolve('.')}});
const {Radar}=await import('../.checks/radar-component.mjs');

test('attribute radar exposes its fixed inner polygon and final geometry for animation and video export',()=>{
 const stats=Object.fromEntries(attributes.map((metric,index)=>[metric.key,55+index*5]));
 const $=load(renderToStaticMarkup(createElement(Radar,{metrics:attributes,a:stats,nameA:'A'})));
 assert.equal($('[data-reference-ring="20"]').length,1);
 assert.equal($('clipPath').length,0);
 assert.equal($('[data-series="A"] polygon').attr('data-final-points'),$('[data-series="A"] polygon').attr('points'));
 assert.equal($('[data-series="A"] circle[data-axis]').length,attributes.length);
 assert.equal($('animate').length,0);
});

test('attribute radar renders side-specific Best emphasis with the series colors',()=>{
 const stats=Object.fromEntries(attributes.map(metric=>[metric.key,75]));
 const $=load(renderToStaticMarkup(createElement(Radar,{metrics:attributes,a:stats,b:stats,nameA:'A',nameB:'B',bestA:['firepower'],bestB:['entrying'],colorA:'#6aaeff',colorB:'#54ddc2'})));
 assert.equal($('[data-metric-value="firepower"] [data-best-label="A"]').text(),' BEST');
 assert.equal($('[data-metric-value="firepower"] [data-best-value]').first().attr('fill'),'#6aaeff');
 assert.equal($('[data-metric-value="firepower"] [data-best-value]').first().attr('filter'),'url(#radar-best-a-value)');
 assert.equal($('[data-metric-value="firepower"] [data-best-value]').first().attr('data-best-motion'),'true');
 assert.equal($('#radar-best-a-glow feFlood').attr('flood-color'),'#6aaeff');
 assert.equal($('#radar-best-a-value feFlood').first().attr('flood-color'),'#6aaeff');
 assert.equal($('#radar-best-a-value feSpecularLighting').attr('lighting-color'),'#ffffff');
 assert.equal($('[data-metric-value="entrying"] [data-best-label="B"]').attr('fill'),'#54ddc2');
});
