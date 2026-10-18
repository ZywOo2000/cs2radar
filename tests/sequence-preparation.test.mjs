import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSequenceMeasurements } from '../lib/sequence-preparation.ts';

test('sequence preparation yields before rendering and measures every participant in order', async () => {
  const calls = [];
  let current = -1;
  const result = await collectSequenceMeasurements(
    3,
    (i) => {
      current = i;
      calls.push('render');
    },
    () => current,
    () => true,
    async () => {
      calls.push('yield');
    },
  );
  assert.deepEqual(result, [0, 1, 2]);
  assert.deepEqual(calls, [
    'yield',
    'render',
    'yield',
    'yield',
    'render',
    'yield',
    'yield',
    'render',
    'yield',
  ]);
});
test('unmount before render or before measure prevents all stale side effects', async () => {
  for (const cancelledFrame of [1, 2]) {
    let active = true,
      frames = 0,
      renders = 0,
      measures = 0;
    const result = await collectSequenceMeasurements(
      5,
      () => {
        renders++;
      },
      () => {
        measures++;
        return 1;
      },
      () => active,
      async () => {
        if (++frames === cancelledFrame) active = false;
      },
    );
    assert.equal(result, null);
    assert.equal(renders, cancelledFrame - 1);
    assert.equal(measures, 0);
  }
});
