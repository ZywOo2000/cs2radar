import { broadcastStats, type Stats } from './stats';
import type { Slot } from './slot-store';
export const player = (s: Slot) =>
  s.data?.players.find((p) => p.id === s.playerId);
export const stats = (s: Slot): Stats =>
  broadcastStats(player(s)?.stats[s.scopeId] || {});
export const context = (s: Slot) =>
  [
    s.data?.title,
    s.data?.scopes.find((x) => x.id === s.scopeId)?.name,
    s.data?.date,
  ]
    .filter(Boolean)
    .join(' · ');
