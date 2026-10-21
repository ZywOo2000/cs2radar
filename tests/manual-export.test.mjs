import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { emptyManual, manualDataset, parseManual, MANUAL_LABEL } from '../lib/manual-data.ts';
import { broadcastMetrics } from '../lib/stats.ts';

await build({ entryPoints: ['lib/export-chart.ts'], outfile: '.checks/manual-export-test.mjs',
  bundle: true, platform: 'node', format: 'esm' });
const { exportChart } = await import('../.checks/manual-export-test.mjs');

test('dual manual PNG metadata preserves both sources, raw ratings and independent colors', async t => {
  const blobs = [], downloads = [];
  const original = Object.fromEntries(['document', 'Image', 'XMLSerializer'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const clone = { children: [], getAttribute: key => key === 'viewBox' ? '0 0 1000 960' : null,
    setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [] };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
    toBlob: callback => callback(new Blob(['png'], { type: 'image/png' })) };
  globalThis.document = {
    getElementById: () => ({ ...clone, cloneNode: () => clone }),
    createElement: tag => tag === 'canvas' ? canvas : { click() { downloads.push({ name: this.download, href: this.href }); } },
  };
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.XMLSerializer = class { serializeToString() { return '<svg><g data-series="A"/><g data-series="B"/></svg>'; } };
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return `blob:manual-${blobs.length}`; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(globalThis, 'setTimeout', () => 0);
  t.after(() => { for (const [key, descriptor] of Object.entries(original)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  } });
  const makeSide = (side, color, ratingVersion) => {
    const draft = emptyManual(); draft.name = `Manual ${side}`; draft.color = color; draft.ratingVersion = ratingVersion;
    Object.assign(draft.values, { kpr: '.9', adr: '98', kast: '81', rating: side === 'A' ? '1.4' : '1.2' });
    const dataset = manualDataset(draft, side, true);
    return { name: dataset.players[0].name, context: `Team ${side} · 自定义范围`, source: MANUAL_LABEL,
      version: ratingVersion, stats: parseManual(draft).stats, manual: true, demo: false, color };
  };
  await exportChart('选手比赛表现', broadcastMetrics, makeSide('A', '#ff9b61', '3.0'), makeSide('B', '#b79cff', '2.1'));
  const svg = await blobs[0].text();
  assert.ok(svg.includes('A 手动填写 · 非 HLTV 验证数据'));
  assert.ok(svg.includes('B 手动填写 · 非 HLTV 验证数据'));
  assert.ok(svg.includes('A Manual A · Team A · 自定义范围 · Rating 3.0'));
  assert.ok(svg.includes('B Manual B · Team B · 自定义范围 · Rating 2.1'));
  assert.match(svg, /fill="#ff9b61"[^>]*>A 1\.40/);
  assert.match(svg, /fill="#b79cff"[^>]*>B 1\.20/);
  assert.ok(!svg.includes('存活率由死亡数')); assert.ok(!svg.includes('https://'));
  assert.equal(blobs[1].type, 'image/png');
  assert.match(downloads[0].name, /Manual_A-vs-Manual_B\.png$/);
  assert.equal(canvas.width, 2400);
});
