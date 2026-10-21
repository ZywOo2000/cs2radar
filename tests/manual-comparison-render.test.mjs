import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio/slim';
import { emptyManual, manualDataset, parseManual } from '../lib/manual-data.ts';
import { broadcastMetrics, sharedMetrics } from '../lib/stats.ts';

await build({ entryPoints: ['components/broadcast-radar.tsx'], outfile: '.checks/manual-broadcast-test.mjs',
  bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', alias: { '@': resolve('.') } });
const { BroadcastRadar } = await import('../.checks/manual-broadcast-test.mjs');

test('manual adapters feed two independent polygons, Best colors and opposite Swing bars', () => {
  const a = emptyManual(), b = emptyManual();
  a.name = 'Manual <A>'; b.name = '手动 B'; a.color = '#ff9b61'; b.color = '#b79cff';
  a.ratingVersion = b.ratingVersion = '3.0'; a.bestKeys = ['rating', 'firepower']; b.bestKeys = ['kast', 'firepower'];
  Object.assign(a.values, { kpr: '1.2', surviving: '60', adr: '140', kast: '85', multiKillPct: '29', rating: '2.1', swing: '8', firepower: '96' });
  Object.assign(b.values, { kpr: '.8', surviving: '43', adr: '80', kast: '78', multiKillPct: '20', rating: '1.2', swing: '-3', firepower: '81' });
  const da = manualDataset(a, 'A', true), db = manualDataset(b, 'B', true);
  const statsA = da.players[0].stats.manual, statsB = db.players[0].stats.manual;
  const $ = load(renderToStaticMarkup(createElement(BroadcastRadar, { metrics: broadcastMetrics,
    a: statsA, b: statsB, nameA: da.players[0].name, nameB: db.players[0].name,
    drawKeys: sharedMetrics(broadcastMetrics, statsA, statsB, a.ratingVersion, b.ratingVersion).map(m => m.key),
    colorA: a.color, colorB: b.color, bestA: a.bestKeys, bestB: b.bestKeys })));
  assert.equal($('[data-series="A"] polygon').attr('stroke'), a.color);
  assert.equal($('[data-series="B"] polygon').attr('stroke'), b.color);
  assert.notEqual($('[data-series="A"] polygon').attr('points'), $('[data-series="B"] polygon').attr('points'));
  assert.equal($('[data-metric-value="rating"] [data-best-label="A"]').attr('fill'), a.color);
  assert.equal($('[data-metric-value="kast"] [data-best-label="B"]').attr('fill'), b.color);
  assert.equal($('[data-swing="A"] rect').attr('fill'), '#22d559');
  assert.equal($('[data-swing="B"] rect').attr('fill'), '#f06469');
  assert.match($('[data-firepower]').text(), /A 96.*B 81/);
  assert.equal($('[data-firepower] [data-best-label-for="A-firepower"]').length, 1);
  assert.equal($('[data-firepower] [data-best-label-for="B-firepower"]').length, 1);
  assert.notEqual($('[data-best-anchor="A-firepower"]').attr('x'), $('[data-best-anchor="B-firepower"]').attr('x'));
  assert.match($('svg').attr('aria-label'), /Manual <A> 与 手动 B/);
});

test('unknown Rating and missing manual metrics produce partial lines without invented values', () => {
  const a = emptyManual(), b = emptyManual();
  for (const d of [a, b]) Object.assign(d.values, { kpr: '.8', adr: '85', kast: '75', rating: '1.3' });
  const sa = parseManual(a).stats, sb = parseManual(b).stats;
  const drawKeys = sharedMetrics(broadcastMetrics, sa, sb, a.ratingVersion, b.ratingVersion).map(m => m.key);
  assert.equal(drawKeys.includes('rating'), false);
  const html = renderToStaticMarkup(createElement(BroadcastRadar, { metrics: broadcastMetrics, a: sa, b: sb, nameA: 'A', nameB: 'B', drawKeys }));
  const $ = load(html);
  assert.equal($('[data-series="A"] polygon, [data-series="B"] polygon').length, 0);
  assert.equal($('[data-series="A"] line, [data-series="B"] line').length, 2);
  assert.match($('[data-metric-value="rating"]').text(), /1\.30.*1\.30/);
  assert.match($('[data-metric-value="surviving"]').text(), /—/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
