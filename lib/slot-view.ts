import { broadcastStats, type Stats } from './stats';
import type { Slot } from './slot-store';
export const player = (s: Slot) =>
  s.data?.players.find((p) => p.id === s.playerId);
export const stats = (s: Slot): Stats => {
  const raw = player(s)?.stats[s.scopeId] || {};
  // Local imports carry explicit availability; do not invent missing survival from DPR.
  return s.data?.origin?.type === 'local-arena' ? raw : broadcastStats(raw);
};
export const context = (s: Slot) =>
  [
    s.data?.origin?.type === 'local-arena' ? 'Local Arena · 本机离线对局' : '',
    s.data?.title,
    s.data?.scopes.find((x) => x.id === s.scopeId)?.name,
    s.data?.date,
  ]
    .filter(Boolean)
    .join(' · ');
