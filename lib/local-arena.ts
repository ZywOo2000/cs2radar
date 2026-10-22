import { type Dataset, type Stats } from './stats';
import { ARENA_LABEL, type ArenaPacket, type ArenaPlayer } from './local-arena-protocol';
export function arenaStats(player: ArenaPlayer): Stats {
  const r = player.raw, s: Stats = { rounds: r.rounds, kills: r.kills, deaths: r.deaths,
    assists: r.assists, kpr: r.kills / r.rounds, dpr: r.deaths / r.rounds, adr: r.damage / r.rounds,
    kdDiff: r.kills - r.deaths };
  if (r.deaths > 0) s.kd = r.kills / r.deaths;
  if (r.kills > 0) s.hs = r.headshots / r.kills * 100;
  if (r.survivedRounds !== undefined) s.surviving = r.survivedRounds / r.rounds * 100;
  if (r.kastRounds !== undefined) s.kast = r.kastRounds / r.rounds * 100;
  const mk = [r.multikill2, r.multikill3, r.multikill4, r.multikill5];
  if (mk.every(v => v !== undefined)) s.multiKillPct = mk.reduce<number>((n, v) => n + v!, 0) / r.rounds * 100;
  if (player.rating !== undefined) s.rating = player.rating;
  return s;
}
export function arenaDataset(packet: ArenaPacket): Dataset {
  const m = packet.match;
  return { id: `local-arena:${m.id}:${m.startedAt}:${m.map}`, kind: 'match',
    title: `${m.map} · ${m.teamAScore}:${m.teamBScore} · ${m.rounds} 回合${m.partial ? ' · 部分记录' : ''}`,
    event: ARENA_LABEL, date: m.startedAt.slice(0, 10), sourceUrl: '', importedAt: new Date().toISOString(),
    origin: { type: 'local-arena', appVersion: packet.appVersion, ratingModel: packet.ratingModel,
      preferredPlayerId: packet.preferredPlayerId, endReason: m.endReason, partial: m.partial },
    scopes: [{ id: 'all', name: m.partial ? '已记录回合' : '整场对局' }],
    notes: [ARENA_LABEL + ' · 非 HLTV 官方数据', ...packet.warnings,
      ...packet.players.flatMap(p => p.warnings.map(w => `${p.name}：${w}`))],
    players: packet.players.map(p => ({ id: p.id, name: p.name || p.id,
      team: p.teamId ? `队伍 ${p.teamId}` : '队伍未知', isBot: p.isBot,
      ratingVersion: 'Local Arena 离线 v1', detailLoaded: true, stats: { all: arenaStats(p) } })) };
}
