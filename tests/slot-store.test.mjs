import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlotStore, emptySlot } from '../lib/slot-store.ts';

const dataset = (id = 'p', overrides = {}) => ({
  id,
  title: id,
  kind: 'event',
  event: '',
  date: '',
  sourceUrl: id,
  importedAt: '',
  notes: [],
  scopes: [{ id: 'event', name: '整届赛事' }],
  players: [
    {
      id,
      name: id,
      team: 'Team',
      ratingVersion: '3.0',
      detailLoaded: true,
      stats: { event: { rating: 1.3 } },
    },
  ],
  ...overrides,
});
function pendingTransport() {
  const calls = [];
  const fetch = (url, via, signal, progress) =>
    new Promise((resolve, reject) =>
      calls.push({ url, via, signal, progress, resolve, reject }),
    );
  return { calls, fetch };
}
const seed = (store, index, data) =>
  store.reset(index, {
    ...emptySlot(),
    data,
    playerId: data.players[0].id,
    scopeId: 'event',
  });

test('latest import owns results, progress, errors and busy state', async () => {
  const store = createSlotStore(),
    transport = pendingTransport();
  const old = store.load(0, 'old', 'server', transport.fetch);
  const next = store.load(0, 'new', 'extension', transport.fetch);
  assert.equal(transport.calls[0].signal.aborted, true);
  transport.calls[1].progress('new progress');
  transport.calls[0].progress('stale progress');
  transport.calls[0].reject(new Error('stale error'));
  await old;
  assert.equal(store.getSnapshot()[0].progress, 'new progress');
  assert.equal(store.getSnapshot()[0].busy, true);
  assert.equal(store.getSnapshot()[0].error, '');
  transport.calls[1].resolve(dataset('new'));
  await next;
  assert.equal(store.getSnapshot()[0].playerId, 'new');
  assert.equal(store.getSnapshot()[0].busy, false);
  assert.equal(store.getSnapshot()[0].progress, '');
});

test('cancel and clear reject late callbacks, while failed imports preserve data', async () => {
  for (const action of ['cancel', 'reset']) {
    const store = createSlotStore(),
      transport = pendingTransport();
    seed(store, 0, dataset('saved'));
    const work = store.load(0, 'pending', 'server', transport.fetch);
    store[action](0);
    const snapshot = store.getSnapshot();
    transport.calls[0].progress('late');
    transport.calls[0].resolve(dataset('late'));
    await work;
    assert.equal(store.getSnapshot(), snapshot);
    assert.equal(transport.calls[0].signal.aborted, true);
    assert.equal(
      store.getSnapshot()[0].data?.id,
      action === 'cancel' ? 'saved' : undefined,
    );
  }
  const store = createSlotStore();
  seed(store, 0, dataset('saved'));
  await store.load(0, 'bad', 'server', async () => {
    throw new Error('failed');
  });
  assert.equal(store.getSnapshot()[0].data.id, 'saved');
  assert.equal(store.getSnapshot()[0].error, 'failed');
  assert.equal(store.getSnapshot()[0].busy, false);
});

test('choosing a cached player cancels another player detail request', async () => {
  const store = createSlotStore(),
    transport = pendingTransport();
  const data = dataset('uncached');
  data.players[0].detailLoaded = false;
  data.players[0].profileUrl = 'detail';
  data.players.push(dataset('cached').players[0]);
  seed(store, 0, data);
  const work = store.choose(0, 'uncached', undefined, transport.fetch);
  await store.choose(0, 'cached', undefined, transport.fetch);
  assert.equal(transport.calls[0].signal.aborted, true);
  transport.calls[0].progress('late detail');
  transport.calls[0].resolve(dataset('uncached'));
  await work;
  assert.equal(store.getSnapshot()[0].playerId, 'cached');
  assert.equal(store.getSnapshot()[0].busy, false);
  assert.equal(store.getSnapshot()[0].progress, '');
  assert.equal(store.getSnapshot()[0].data.players[0].detailLoaded, false);
});

test('detail merge preserves source team, rating version and unrelated map stats', async () => {
  const store = createSlotStore(),
    data = dataset();
  Object.assign(data.players[0], {
    profileUrl: 'detail',
    detailLoaded: false,
    stats: { event: { rating: 1.3 }, map1: { adr: 80 } },
  });
  seed(store, 0, data);
  const detail = dataset();
  Object.assign(detail.players[0], {
    team: 'Different team',
    ratingVersion: '未标注',
    stats: { event: { kast: 75 } },
  });
  await store.choose(0, 'p', 'event', async () => detail);
  const player = store.getSnapshot()[0].data.players[0];
  assert.equal(player.team, 'Team');
  assert.equal(player.ratingVersion, '3.0');
  assert.deepEqual(player.stats, {
    event: { rating: 1.3, kast: 75 },
    map1: { adr: 80 },
  });
  assert.equal(player.detailLoaded, true);
});

test('showing demo cancels A/B only; C–E requests still complete', async () => {
  const store = createSlotStore(),
    transport = pendingTransport();
  const a = store.load(0, 'A', 'extension', transport.fetch);
  const c = store.load(2, 'C', 'extension', transport.fetch);
  store.showDemo(dataset('demo'));
  assert.equal(transport.calls[0].signal.aborted, true);
  assert.equal(transport.calls[1].signal.aborted, false);
  transport.calls[0].resolve(dataset('late A'));
  transport.calls[1].resolve(dataset('C'));
  await Promise.all([a, c]);
  assert.equal(store.getSnapshot()[0].playerId, 'demo-a');
  assert.equal(store.getSnapshot()[2].playerId, 'C');
  assert.equal(store.getSnapshot()[2].busy, false);
});

test('copy aborts destination request without sharing mutable Best settings', async () => {
  const store = createSlotStore(),
    transport = pendingTransport();
  seed(store, 0, dataset('source'));
  store.toggleBest(0, 'rating');
  const work = store.load(1, 'old', 'server', transport.fetch);
  store.copySource(1);
  assert.equal(transport.calls[0].signal.aborted, true);
  transport.calls[0].resolve(dataset('late'));
  await work;
  store.toggleBest(1, 'adr');
  assert.equal(store.getSnapshot()[1].playerId, 'source');
  assert.deepEqual(store.getSnapshot()[0].bestKeys, ['rating']);
  assert.deepEqual(store.getSnapshot()[1].bestKeys, ['rating', 'adr']);
});

test('busy slots cannot be reordered and cancelAll invalidates every request', async () => {
  const store = createSlotStore(),
    transport = pendingTransport();
  seed(store, 1, dataset('B'));
  const tasks = [0, 2, 3, 4].map((i) =>
    store.load(i, String(i), 'server', transport.fetch),
  );
  assert.equal(store.swap(0, 1), false);
  store.cancelAll();
  const snapshot = store.getSnapshot();
  for (const call of transport.calls) {
    assert.equal(call.signal.aborted, true);
    call.progress('late');
    call.resolve(dataset());
  }
  await Promise.all(tasks);
  assert.equal(store.getSnapshot(), snapshot);
  assert.equal(
    snapshot.some((s) => s.busy),
    false,
  );
  assert.equal(store.swap(0, 1), true);
  assert.equal(store.getSnapshot()[0].playerId, 'B');
  assert.throws(() => store.reset(-1), /数据位/);
  assert.throws(() => store.swap(0, 5), /数据位/);
});

test('stores and slot arrays are independent with stable snapshots and subscriptions', () => {
  const a = createSlotStore(),
    b = createSlotStore();
  const first = a.getSnapshot();
  let calls = 0;
  const unsubscribe = a.subscribe(() => calls++);
  a.toggleBest(0, 'kpr');
  assert.equal(calls, 1);
  assert.notEqual(a.getSnapshot(), first);
  assert.deepEqual(b.getSnapshot()[0].bestKeys, []);
  assert.deepEqual(a.getSnapshot()[1].bestKeys, []);
  unsubscribe();
  a.reset(0);
  assert.equal(calls, 1);
});
