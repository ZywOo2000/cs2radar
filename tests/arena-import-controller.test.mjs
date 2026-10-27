import test from 'node:test';
import assert from 'node:assert/strict';
import { createArenaImportController } from '../lib/arena-import-controller.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup() {
  const state = { busy: false, message: '', commits: [], consumed: [] };
  const controller = createArenaImportController({
    busy: value => { state.busy = value; },
    message: value => { state.message = value; },
    commit: value => { state.commits.push(value); },
  });
  return { state, controller };
}

test('newest file or fragment owns results, status and consumed fragment', async () => {
  const { state, controller } = setup(), old = deferred(), next = deferred();
  const first = controller.run(() => old.promise, () => state.consumed.push('old'));
  const second = controller.run(() => next.promise, () => state.consumed.push('new'));
  old.resolve('old'); await first;
  assert.equal(state.busy, true);
  assert.deepEqual(state.commits, []);
  next.resolve('new'); await second;
  assert.deepEqual(state.commits, ['new']);
  assert.deepEqual(state.consumed, ['new']);
  assert.equal(state.busy, false);
  assert.equal(state.message, '本场全员已导入。');
});

test('removing a fragment or unmounting cancels pending results and failures', async () => {
  const { state, controller } = setup(), first = deferred(), next = deferred();
  const pending = controller.run(() => first.promise);
  controller.cancel(); first.resolve('old'); await pending;
  assert.deepEqual(state.commits, []); assert.equal(state.busy, false);
  const unmounted = controller.run(() => next.promise);
  controller.dispose(); next.reject(Error('late')); await unmounted;
  assert.deepEqual(state.commits, []); assert.equal(state.message, '');
});

test('failure preserves previous data and never consumes fragment', async () => {
  const { state, controller } = setup();
  await controller.run(async () => 'first');
  await controller.run(async () => { throw Error('invalid packet'); }, () => state.consumed.push('bad'));
  assert.deepEqual(state.commits, ['first']);
  assert.deepEqual(state.consumed, []);
  assert.equal(state.message, 'invalid packet');
  assert.equal(state.busy, false);
});
