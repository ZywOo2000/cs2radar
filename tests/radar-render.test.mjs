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
