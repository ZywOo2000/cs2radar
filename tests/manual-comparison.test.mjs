import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { emptyManual, manualDataset, MANUAL_STORAGE_KEY, MANUAL_COLORS } from '../lib/manual-data.ts';

await build({ entryPoints: ['lib/manual-comparison.ts', 'lib/manual-draft-store.ts'],
  outdir: '.checks/manual-compare-tests', outExtension: { '.js': '.mjs' },
  bundle: true, platform: 'node', format: 'esm' });
const { emptyManualWorkspace, MANUAL_WORKSPACE_KEY, restoreManualWorkspace, manualComparisonState } =
  await import('../.checks/manual-compare-tests/manual-comparison.mjs');
const { createManualWorkspaceStore } = await import('../.checks/manual-compare-tests/manual-draft-store.mjs');

function database(entries = []) {
  return { values: new Map(entries), writes: [], denied: false,
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { if (this.denied) throw Error('quota'); this.values.set(key, value); this.writes.push(key); } };
}
function complete(side = 'A') {
  const draft = emptyManual();
  Object.assign(draft, { name: side, team: `Team ${side}`, scope: `${side} scope`,
    color: MANUAL_COLORS[side === 'A' ? 0 : 1], bestKeys: ['rating', 'swing'], ratingVersion: '3.0' });
  Object.assign(draft.values, { kpr: '0.90', surviving: '60', adr: '95', kast: '85',
    multiKillPct: '22', rating: '1.40', swing: side === 'A' ? '6.5' : '-2.3', firepower: '90' });
  return draft;
}

test('legacy single draft migrates into A without writing or losing raw edits', () => {
  const legacy = complete(); legacy.values.kast = '-';
  const raw = JSON.stringify(legacy), db = database([[MANUAL_STORAGE_KEY, raw]]);
  const store = createManualWorkspaceStore(() => db), server = store.getServerSnapshot();
  store.load(); store.load();
  const saved = store.getSnapshot().draft;
  assert.equal(saved.version, 2); assert.equal(saved.mode, 'single');
  assert.deepEqual(saved.drafts.A, legacy);
  assert.equal(saved.drafts.B.color, MANUAL_COLORS[1]);
  assert.equal(saved.drafts.B.values.kpr, '');
  assert.deepEqual(db.writes, []);
  assert.equal(store.getServerSnapshot(), server); assert.equal(server.loaded, false);
  store.setSideDraft('B', complete('B'));
  assert.equal(db.values.get(MANUAL_STORAGE_KEY), raw);
  assert.deepEqual(db.writes, [MANUAL_WORKSPACE_KEY]);
});

test('independent A/B values, mode and settings survive refresh; single keeps B', () => {
  const db = database(), store = createManualWorkspaceStore(() => db);
  store.load(); store.setSideDraft('A', complete()); store.setSideDraft('B', complete('B')); store.setMode('compare');
  const refreshed = createManualWorkspaceStore(() => db); refreshed.load();
  assert.deepEqual(refreshed.getSnapshot().draft, store.getSnapshot().draft);
  refreshed.setMode('single'); assert.deepEqual(refreshed.getSnapshot().draft.drafts.B, complete('B'));
  refreshed.setSideDraft('A', a => ({ ...a, name: 'Changed A' }));
  assert.equal(refreshed.getSnapshot().draft.drafts.B.name, 'B');
});

test('swap moves full drafts; clearing B resets only B and its default color', () => {
  const db = database(), store = createManualWorkspaceStore(() => db); store.load();
  store.setSideDraft('A', complete()); store.setSideDraft('B', complete('B'));
  store.swap();
  assert.deepEqual(store.getSnapshot().draft.drafts.A, complete('B'));
  assert.deepEqual(store.getSnapshot().draft.drafts.B, complete());
  store.clearSide('B');
  assert.deepEqual(store.getSnapshot().draft.drafts.A, complete('B'));
  assert.deepEqual(store.getSnapshot().draft.drafts.B, emptyManualWorkspace().drafts.B);
  assert.ok(db.writes.every(key => key === MANUAL_WORKSPACE_KEY));
});

test('corrupt v2 does not silently fall back to or overwrite the legacy draft', () => {
  const legacy = JSON.stringify(complete()), db = database([[MANUAL_STORAGE_KEY, legacy], [MANUAL_WORKSPACE_KEY, '{broken']]);
  const store = createManualWorkspaceStore(() => db); store.load();
  assert.match(store.getSnapshot().storageMessage, /读取失败/);
  assert.equal(db.values.get(MANUAL_WORKSPACE_KEY), '{broken'); assert.deepEqual(db.writes, []);
  assert.throws(() => restoreManualWorkspace(JSON.stringify({ version: 2, mode: 'compare', drafts: { A: complete() } })));
  store.setSideDraft('B', complete('B'));
  assert.equal(JSON.parse(db.values.get(MANUAL_WORKSPACE_KEY)).drafts.B.name, 'B');
  assert.equal(db.values.get(MANUAL_STORAGE_KEY), legacy);
});

test('storage read/write failures retain current input; success clears warning', () => {
  const db = database(); let readDenied = true;
  const store = createManualWorkspaceStore(() => { if (readDenied) throw Error('denied'); return db; });
  store.setSideDraft('A', complete()); assert.deepEqual(db.writes, []);
  store.load(); store.setSideDraft('A', complete()); store.setSideDraft('B', complete('B'));
  assert.equal(store.getSnapshot().draft.drafts.A.name, 'A');
  assert.equal(store.getSnapshot().draft.drafts.B.name, 'B');
  assert.match(store.getSnapshot().storageMessage, /本机存储不可用/);
  readDenied = false; db.denied = true; store.setMode('compare');
  assert.equal(store.getSnapshot().draft.mode, 'compare');
  db.denied = false; store.setSideDraft('B', d => ({ ...d, name: 'Recovered B' }));
  assert.equal(store.getSnapshot().storageMessage, '');
  assert.equal(JSON.parse(db.values.get(MANUAL_WORKSPACE_KEY)).drafts.A.name, 'A');
});

test('comparison requires three shared radar metrics and valid input on both sides', () => {
  const w = emptyManualWorkspace(); w.mode = 'compare';
  Object.assign(w.drafts.A.values, { kpr: '0', adr: '95', kast: '85', swing: '0', firepower: '0' });
  Object.assign(w.drafts.B.values, { kpr: '1', adr: '100', surviving: '60', swing: '-6', firepower: '100' });
  assert.equal(manualComparisonState(w).ready, false);
  assert.equal(manualComparisonState(w).comparable.length, 2);
  w.drafts.B.values.kast = '0'; assert.equal(manualComparisonState(w).ready, true);
  w.drafts.B.values.swing = '-'; assert.equal(manualComparisonState(w).ready, false);
  assert.match(manualComparisonState(w).message, /手动 B/);
  w.mode = 'single'; assert.equal(manualComparisonState(w).ready, true);
});

test('manual ratings are compared as entered even when versions are unknown or different', () => {
  const w = emptyManualWorkspace(); w.mode = 'compare';
  for (const side of ['A', 'B']) Object.assign(w.drafts[side].values, { kpr: '.9', adr: '98', rating: '1.3' });
  let state = manualComparisonState(w);
  assert.equal(state.ready, true);
  assert.ok(state.comparable.some(m => m.key === 'rating'));
  for (const side of ['A', 'B']) w.drafts[side].ratingVersion = '3.0';
  assert.equal(manualComparisonState(w).ready, true);
  w.drafts.B.ratingVersion = '2.1';
  state = manualComparisonState(w);
  assert.equal(state.ready, true); assert.equal(state.a.stats.rating, 1.3); assert.equal(state.b.stats.rating, 1.3);
  assert.ok(state.comparable.some(m => m.key === 'rating'));
  w.drafts.B.values.rating = '';
  state = manualComparisonState(w);
  assert.equal(state.ready, false);
  assert.ok(!state.comparable.some(m => m.key === 'rating'));
  assert.equal(state.b.stats.rating, undefined);
});

test('side adapters have distinct identity and names without profile links or invented numbers', () => {
  const a = manualDataset(emptyManual(), 'A', true), b = manualDataset(emptyManual(), 'B', true);
  assert.notEqual(a.id, b.id); assert.notEqual(a.players[0].id, b.players[0].id);
  assert.equal(a.players[0].name, '自定义选手 A'); assert.equal(b.players[0].name, '自定义选手 B');
  assert.equal(a.sourceUrl, ''); assert.equal(b.players[0].profileUrl, undefined);
  assert.deepEqual(a.players[0].stats.manual, {});
  const extreme = complete(); Object.assign(extreme.values, { kpr: '8', adr: '999', rating: '10', swing: '-100' });
  assert.equal(manualDataset(extreme, 'A').players[0].stats.manual.adr, 999);
});
