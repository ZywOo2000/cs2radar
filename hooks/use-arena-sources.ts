'use client';
import { useState, type RefObject } from 'react';
import type { Dataset } from '@/lib/stats';
import { emptySlot, type Slot, type createSlotStore } from '@/lib/slot-store';
import { arenaDataset } from '@/lib/local-arena';
import type { ArenaPacket } from '@/lib/local-arena-protocol';
export function arenaPlayerId(data: Dataset) {
    return data.players.find(p => p.id === data.origin?.preferredPlayerId)?.id ||
      data.players.find(p => !p.isBot)?.id || data.players[0].id;
  }

type Args = { store: ReturnType<typeof createSlotStore>; slots: Slot[]; busy: boolean; sequencePlaying: boolean;
  exporting: boolean; exportingVideo: boolean; exportLock: RefObject<boolean>;
  setMode: (value: string) => void; setView: (value: string) => void; setActiveSlot: (value: number) => void;
  setNotice: (value: string) => void; };
export function useArenaSources({store,slots,busy,sequencePlaying,exporting,exportingVideo,exportLock,
  setMode,setView,setActiveSlot,setNotice}: Args) {
  const [localDataset, setLocalDataset] = useState<Dataset | null>(null);
  function setArenaSlot(index: number, data: Dataset, id: string) {
    store.reset(index, { ...emptySlot(), data, playerId: id, scopeId: 'all' });
  }
  function importArena(packet: ArenaPacket) {
    if (exporting || exportingVideo || exportLock.current || busy || sequencePlaying)
      throw Error('正在读取或导出，请结束后再导入本地对局。');
    const data = arenaDataset(packet);
    setArenaSlot(0, data, arenaPlayerId(data));
    setLocalDataset(data); setMode('single'); setView('performance'); setActiveSlot(0);
    setNotice('Local Arena 全员数据已导入。Rating 为离线模型，非 HLTV 官方评分。');
  }
  function compareArena(id: string) {
    if (!localDataset || exporting || exportingVideo || exportLock.current || busy || sequencePlaying) return;
    const ownId = slots[0].data?.id === localDataset.id ? slots[0].playerId : arenaPlayerId(localDataset);
    if (!localDataset.players.some(p => p.id === id) || id === ownId) return;
    setArenaSlot(0, localDataset, ownId); setArenaSlot(1, localDataset, id);
    setMode('compare'); setView('performance'); setActiveSlot(0);
  }
  function videoArena(ids: string[]) {
    if (!localDataset || exporting || exportingVideo || exportLock.current || busy || sequencePlaying) return;
    if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length || ids.some(id => !localDataset.players.some(p => p.id === id))) return;
    ids.forEach((id, index) => setArenaSlot(index, localDataset, id));
    for (let index = ids.length; index < 5; index++) store.reset(index);
    setMode('video'); setView('performance'); setActiveSlot(0);
  }
  return { localDataset, importArena, compareArena, videoArena };
}
