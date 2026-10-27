import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

async function load(file) {
  const result = await build({ entryPoints: [file], bundle: true, write: false, platform: 'node', format: 'esm' });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
const { parseArenaPacket, encodeArenaUrl, decodeArenaFragment } = await load('lib/local-arena-protocol.ts');
const { arenaStats } = await load('lib/local-arena.ts');
const status = () => ({ kpr:'valid', surviving:'valid', adr:'valid', kast:'valid', multiKillPct:'valid', rating:'valid' });
const player = id => ({ id, name:id, teamId:'A', isBot:false, warnings:[], metricStatus:status(), rating:1.2,
  raw:{ rounds:3, kills:2, deaths:2, assists:0, damage:120, headshots:1, survivedRounds:1, kastRounds:2,
    multikill2:1, multikill3:0, multikill4:0, multikill5:0, tradeKills:0, clutchAttempts:0, clutchesWon:0 } });
const packet = () => ({ schema:'cs2-radar.local-arena', version:2, appVersion:'test', ratingModel:'local-arena-offline-v1',
  preferredPlayerId:'a', warnings:[], match:{ id:'1', map:'test', startedAt:'2026-01-01', endedAt:null,
    endReason:null, rounds:3, teamAScore:2, teamBScore:1, partial:false, captureVersion:1 }, players:[player('a'),player('b')] });

test('v2 real zeroes stay valid, and the compressed URL round trips', async () => {
  const input=packet(), p=input.players[0];
  Object.assign(p.raw,{ multikill2:0,multikill3:0,multikill4:0,multikill5:0, tradeKills:0,clutchAttempts:0,clutchesWon:0 });
  const parsed=parseArenaPacket(input);
  assert.equal(arenaStats(parsed.players[0]).multiKillPct,0);
  assert.equal(parsed.players[0].rating,1.2);
  const url=await encodeArenaUrl(parsed,'https://cs2shuju.top/');
  assert.deepEqual(await decodeArenaFragment(new URL(url).hash),parsed);
});
test('legacy default zeroes are unknown while unrelated base metrics remain', () => {
  const input=packet(); input.version=1; delete input.match.captureVersion;
  for (const p of input.players) { delete p.metricStatus; Object.assign(p.raw,{kastRounds:0,multikill2:0,multikill3:0,multikill4:0,multikill5:0,tradeKills:0,clutchAttempts:0,clutchesWon:0}); }
  const p=parseArenaPacket(input).players[0];
  assert.equal(p.raw.kastRounds,undefined); assert.equal(p.raw.multikill2,undefined);
  assert.equal(p.rating,undefined); assert.equal(arenaStats(p).kpr,2/3);
});
test('KAST conflict excludes only KAST and dependent rating', () => {
  const input=packet(); input.players[0].raw.kastRounds=0;
  const p=parseArenaPacket(input).players[0];
  assert.equal(p.raw.survivedRounds,1); assert.equal(p.raw.kastRounds,undefined);
  assert.equal(p.metricStatus.kast,'conflict'); assert.equal(p.rating,undefined);
  assert.equal(p.raw.multikill2,1); assert.equal(arenaStats(p).adr,40);
});
test('invalid basic stats skip one player but duplicate identities remain fatal', () => {
  const input=packet(); input.players[0].raw.deaths=4;
  const parsed=parseArenaPacket(input);
  assert.deepEqual(parsed.players.map(p=>p.id),['b']); assert.match(parsed.warnings.join(' '),/跳过/);
  input.players[1].id='a'; assert.throws(()=>parseArenaPacket(input),/重复/);
  input.players[1].id='b'; input.players[1].raw.deaths=4;
  assert.throws(()=>parseArenaPacket(input),/没有可用/);
});
test('optional missing data are not fabricated; unsupported versions fail', () => {
  const input=packet(), p=input.players[0]; p.metricStatus.surviving='unknown'; delete p.raw.survivedRounds;
  p.metricStatus.multiKillPct='unknown'; delete p.raw.multikill2; p.metricStatus.rating='unknown'; delete p.rating;
  const stats=arenaStats(parseArenaPacket(input).players[0]);
  assert.equal(stats.surviving,undefined); assert.equal(stats.multiKillPct,undefined); assert.equal(stats.rating,undefined);
  input.version=3; assert.throws(()=>parseArenaPacket(input),/版本/);
});
test('Rust snapshot contract can be assembled and parsed without losing measured zeroes', async () => {
  const snapshot=JSON.parse(await readFile(new URL('./fixtures/arena-v2-snapshot.json',import.meta.url),'utf8'));
  const input={...snapshot,schema:'cs2-radar.local-arena',version:2,ratingModel:'local-arena-offline-v1'};
  input.players[0].rating=0;
  const parsed=parseArenaPacket(input), p=parsed.players[0];
  assert.equal(p.raw.kastRounds,0); assert.equal(p.raw.survivedRounds,0);
  assert.equal(p.raw.multikill2,0); assert.equal(p.rating,0);
  assert.equal(parsed.match.captureVersion,1);
});
