import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { emptyManual } from '../lib/manual-data.ts';

await build({
  entryPoints: ['lib/manual-draft-store.ts'],
  outfile: '.checks/manual-draft-store.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { createManualDraftStore } =
  await import('../.checks/manual-draft-store.mjs');
function storage(raw = null) {
  return {
    raw,
    writes: 0,
    getItem() {
      return this.raw;
    },
    setItem(key, value) {
      this.raw = value;
      this.writes++;
    },
  };
}
test('load restores once without writing; server snapshot stays stable for hydration', () => {
  const draft = { ...emptyManual(), name: 'Saved' },
    db = storage(JSON.stringify(draft));
  const store = createManualDraftStore(() => db),
    initial = store.getServerSnapshot();
  store.load();
  store.load();
  assert.deepEqual(store.getSnapshot().draft, draft);
  assert.equal(db.writes, 0);
  assert.equal(store.getSnapshot().loaded, true);
  assert.equal(store.getServerSnapshot(), initial);
  assert.equal(initial.loaded, false);
});
test('corrupt cache is not silently replaced by an empty draft', () => {
  const db = storage('{broken'),
    store = createManualDraftStore(() => db);
  store.load();
  assert.equal(db.raw, '{broken');
  assert.equal(db.writes, 0);
  assert.match(store.getSnapshot().storageMessage, /读取失败/);
  store.setDraft((d) => ({ ...d, name: 'New' }));
  assert.equal(JSON.parse(db.raw).name, 'New');
  assert.equal(store.getSnapshot().storageMessage, '');
});
test('unavailable storage retains edits and recovers on the next successful write', () => {
  const db = storage();
  let denied = true;
  const store = createManualDraftStore(() => {
    if (denied) throw Error('denied');
    return db;
  });
  store.load();
  store.setDraft((d) => ({ ...d, name: 'Kept' }));
  assert.equal(store.getSnapshot().draft.name, 'Kept');
  assert.match(store.getSnapshot().storageMessage, /本机存储不可用/);
  denied = false;
  store.setDraft((d) => ({ ...d, team: 'Recovered' }));
  assert.equal(JSON.parse(db.raw).name, 'Kept');
  assert.equal(store.getSnapshot().storageMessage, '');
});
test('preload edits cannot overwrite saved data; clear only writes the manual key', () => {
  const db = storage(JSON.stringify({ ...emptyManual(), name: 'Existing' }));
  let key;
  const original = db.setItem.bind(db);
  db.setItem = (k, v) => {
    key = k;
    original(k, v);
  };
  const store = createManualDraftStore(() => db);
  store.setDraft(emptyManual());
  assert.equal(db.writes, 0);
  store.load();
  assert.equal(store.getSnapshot().draft.name, 'Existing');
  store.setDraft(emptyManual());
  assert.equal(key, 'cs2-radar-manual-v1');
  assert.deepEqual(JSON.parse(db.raw), emptyManual());
});
