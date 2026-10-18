import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freezeVideoFrame,
  holdFinalVideoFrame,
  VIDEO_FINAL_HOLD_MS,
} from '../lib/video-final-hold.ts';
import {
  sequenceArrivalTime,
  sequenceDuration,
  sequenceFrameAt,
} from '../lib/video-sequence.ts';

test('final bitmap is captured once and stays unchanged when the original canvas changes', () => {
  let copies = 0;
  const snapshot = {
    width: 0,
    height: 0,
    pixels: '',
    getContext: () => ({
      drawImage: (canvas) => {
        copies++;
        snapshot.pixels = canvas.pixels;
      },
    }),
  };
  const canvas = {
    width: 1920,
    height: 1080,
    pixels: 'complete final frame',
    ownerDocument: { createElement: () => snapshot },
  };
  const paint = freezeVideoFrame({
    canvas,
    drawImage: (saved) => {
      canvas.pixels = saved.pixels;
    },
  });
  canvas.pixels = 'another frame';
  paint();
  assert.equal(canvas.pixels, 'complete final frame');
  canvas.pixels = 'cleared';
  paint();
  assert.equal(canvas.pixels, 'complete final frame');
  assert.equal(copies, 1);
  assert.equal(snapshot.width, 1920);
  assert.equal(snapshot.height, 1080);
});

function clock() {
  let time = 0;
  const events = [];
  return {
    events,
    now: () => time,
    nextFrame: async () => {
      time += 16;
      events.push(['frame', time]);
    },
    drawFrame: async () => {
      time += 40;
      events.push(['draw', time]);
    },
    requestFrame: () => events.push(['capture', time]),
    onProgress: (progress) => events.push(['progress', time, progress]),
  };
}

test('hold starts after final drawing and keeps sending frames for a full second', async () => {
  const c = clock();
  await holdFinalVideoFrame(c);
  const draws = c.events.filter(([kind]) => kind === 'draw');
  const captures = c.events.filter(([kind]) => kind === 'capture');
  assert.ok(captures.length > 10, 'must submit frames throughout the hold');
  assert.equal(captures.length, draws.length);
  assert.ok(captures.at(-1)[1] - captures[0][1] >= VIDEO_FINAL_HOLD_MS);
  assert.deepEqual(c.events.slice(0, 3), [
    ['draw', 40],
    ['capture', 40],
    ['progress', 40, 0],
  ]);
  const progress = c.events
    .filter(([kind]) => kind === 'progress')
    .map(([, , value]) => value);
  assert.equal(progress.at(-1), 1);
  assert.ok(
    progress.every((p, i) => p >= 0 && p <= 1 && (!i || p >= progress[i - 1])),
  );
});

test('recorder is stopped only after the last capture crosses a paint boundary', async () => {
  const c = clock();
  await holdFinalVideoFrame(c);
  c.events.push(['stop', c.now()]);
  assert.deepEqual(
    c.events.slice(-3).map(([kind]) => kind),
    ['frame', 'frame', 'stop'],
  );
  assert.ok(
    c.events.at(-1)[1] > c.events.findLast(([kind]) => kind === 'capture')[1],
  );
});

test('automatic canvas capture still redraws when requestFrame is unavailable', async () => {
  const c = clock();
  await holdFinalVideoFrame({ ...c, requestFrame: undefined });
  const draws = c.events.filter(([kind]) => kind === 'draw');
  assert.ok(draws.at(-1)[1] - draws[0][1] >= VIDEO_FINAL_HOLD_MS);
  assert.ok(draws.length > 10);
});

test('drawing failure propagates without reporting successful hold completion', async () => {
  const c = clock();
  await assert.rejects(
    holdFinalVideoFrame({
      ...c,
      drawFrame: async () => {
        throw Error('decode failed');
      },
    }),
    /decode failed/,
  );
  assert.equal(c.events.length, 0);
});

test('a slow final draw does not consume the one-second hold', async () => {
  let time = 0;
  const captures = [];
  await holdFinalVideoFrame({
    now: () => time,
    drawFrame: async () => {
      time += captures.length ? 20 : 2500;
    },
    requestFrame: () => captures.push(time),
    nextFrame: async () => {
      time += 16;
    },
  });
  assert.equal(captures[0], 2500);
  assert.ok(captures.at(-1) - captures[0] >= 1000);
});

test('both animations and 2–5 people have exactly one final second, with unchanged intermediate holds', () => {
  const metrics = [
    { key: 'adr', min: 0, max: 120, name: '伤害', label: 'ADR', decimals: 1 },
  ];
  for (const motion of ['rings', 'center']) {
    for (const count of [2, 3, 4, 5]) {
      const people = Array.from({ length: count }, (_, i) => ({
        name: String(i),
        context: '',
        stats: { adr: 70 + i * 10 },
        color: '#bddbff',
        bestKeys: ['adr'],
        ratingVersion: '3.0',
      }));
      const arrival = sequenceArrivalTime(count - 1, motion);
      assert.equal(
        sequenceDuration(count, motion) - arrival,
        VIDEO_FINAL_HOLD_MS,
      );
      const final = sequenceFrameAt(people, metrics, arrival, motion);
      for (const delta of [0, 500, 999]) {
        assert.deepEqual(
          sequenceFrameAt(people, metrics, arrival + delta, motion),
          final,
        );
      }
      for (let i = 0; i < count - 1; i++) {
        const start = sequenceArrivalTime(i, motion);
        assert.deepEqual(
          sequenceFrameAt(people, metrics, start + 699, motion).stats,
          people[i].stats,
        );
      }
      assert.equal(
        sequenceFrameAt(people, metrics, arrival + 1000, motion).done,
        true,
      );
    }
  }
});
