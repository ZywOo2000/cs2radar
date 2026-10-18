import type { Dataset, Player } from './stats';

export type Transport = 'auto' | 'server' | 'extension';
export type Side = 'a' | 'b' | 'c' | 'd' | 'e';
export type Slot = {
  url: string;
  data: Dataset | null;
  playerId: string;
  scopeId: string;
  busy: boolean;
  error: string;
  progress: string;
  bestKeys: string[];
  transport?: Transport;
};
export type FetchDataset = (
  url: string,
  via: Transport,
  signal: AbortSignal,
  progress: (message: string) => void,
) => Promise<Dataset>;

export const emptySlot = (): Slot => ({
  url: '',
  data: null,
  playerId: '',
  scopeId: '',
  busy: false,
  error: '',
  progress: '',
  bestKeys: [],
});

// One request owner per slot. Transport callbacks must pass the same ownership
// check as results: even a transport that ignores abort cannot update a new slot.
export function createSlotStore() {
  let slots = Array.from({ length: 5 }, emptySlot);
  const listeners = new Set<() => void>();
  const requests: (AbortController | null)[] = Array(5).fill(null);
  function check(i: number) {
    if (!Number.isInteger(i) || i < 0 || i >= slots.length)
      throw new Error('数据位不存在。');
  }
  function update(i: number, patch: Partial<Slot>) {
    check(i);
    slots = slots.map((slot, index) =>
      index === i ? { ...slot, ...patch } : slot,
    );
    listeners.forEach((listener) => listener());
  }
  function invalidate(i: number) {
    check(i);
    const previous = requests[i];
    requests[i] = null;
    previous?.abort();
  }
  function begin(i: number) {
    invalidate(i);
    const controller = new AbortController();
    requests[i] = controller;
    update(i, { busy: true, error: '', progress: '' });
    return {
      controller,
      current: () => requests[i] === controller && !controller.signal.aborted,
      progress: (message: string) => {
        if (requests[i] === controller && !controller.signal.aborted)
          update(i, { progress: message });
      },
    };
  }
  function finish(i: number, controller: AbortController) {
    if (requests[i] !== controller) return;
    requests[i] = null;
    update(i, { busy: false, progress: '' });
  }
  async function choose(
    i: number,
    id: string,
    scope: string | undefined,
    fetchData: FetchDataset,
  ) {
    check(i);
    const slot = slots[i],
      selected = slot.data?.players.find((p) => p.id === id);
    if (!selected) throw new Error('选手不存在。');
    if (scope && !slot.data?.scopes.some((s) => s.id === scope))
      throw new Error('统计范围不存在。');
    // A cached selection must cancel an earlier detail request as well.
    invalidate(i);
    update(i, {
      playerId: id,
      scopeId: scope || slot.scopeId,
      busy: false,
      error: '',
      progress: '',
    });
    if (!selected.profileUrl || selected.detailLoaded || slot.data?.demo)
      return;
    const job = begin(i);
    try {
      const detail = await fetchData(
        selected.profileUrl,
        slot.transport || 'server',
        job.controller.signal,
        job.progress,
      );
      if (!job.current()) return;
      const found = detail.players.find((p) => p.id === id);
      if (!found) throw new Error('详情返回的选手不匹配。');
      const data = slots[i].data;
      if (!data) return;
      const merged: Player = {
        ...selected,
        ...found,
        team: selected.team === '战队未提供' ? found.team : selected.team,
        stats: {
          ...selected.stats,
          event: { ...selected.stats.event, ...found.stats.event },
        },
        ratingVersion:
          found.ratingVersion === '未标注'
            ? selected.ratingVersion
            : found.ratingVersion,
        detailLoaded: true,
      };
      update(i, {
        data: {
          ...data,
          players: data.players.map((p) => (p.id === id ? merged : p)),
        },
      });
    } catch (error) {
      if (job.current())
        update(i, {
          error:
            '选手详情读取失败：' +
            (error instanceof Error ? error.message : '请重试。'),
        });
    } finally {
      finish(i, job.controller);
    }
  }
  async function load(
    i: number,
    url: string,
    via: Transport,
    fetchData: FetchDataset,
  ) {
    const job = begin(i);
    update(i, { url, transport: via });
    try {
      const data = await fetchData(
        url,
        via,
        job.controller.signal,
        job.progress,
      );
      if (!job.current()) return null;
      const id = data.players[0]?.id,
        scope = data.scopes[0]?.id;
      if (!id || !scope)
        throw new Error('来源没有提供可选取的选手或统计范围。');
      update(i, { data, playerId: id, scopeId: scope });
      await choose(i, id, scope, fetchData);
      return {
        players: data.players.map((p) => ({ id: p.id, name: p.name })),
        scopes: data.scopes,
      };
    } catch (error) {
      if (job.current())
        update(i, {
          error:
            error instanceof Error
              ? error.name === 'TimeoutError'
                ? '读取超时，请稍后重试。'
                : error.message
              : '读取失败，请稍后重试。',
        });
      return null;
    } finally {
      finish(i, job.controller);
    }
  }
  function reset(i: number, slot = emptySlot()) {
    invalidate(i);
    update(i, {
      ...slot,
      bestKeys: [...slot.bestKeys],
      busy: false,
      error: '',
      progress: '',
    });
  }
  return {
    getSnapshot: () => slots,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update,
    load,
    choose,
    reset,
    cancel(this: void, i: number) {
      invalidate(i);
      update(i, {
        busy: false,
        progress: '',
        error: '已取消读取，原有数据保留。',
      });
    },
    cancelAll(this: void) {
      slots.forEach((_, i) => {
        invalidate(i);
        update(i, { busy: false, progress: '' });
      });
    },
    copySource(this: void, i: number) {
      check(i);
      reset(i, slots[Math.max(0, i - 1)]);
    },
    swap(this: void, i: number, j: number) {
      check(i);
      check(j);
      if (i === j || slots[i].busy || slots[j].busy) return false;
      invalidate(i);
      invalidate(j);
      const next = [...slots];
      [next[i], next[j]] = [next[j], next[i]];
      slots = next;
      listeners.forEach((listener) => listener());
      return true;
    },
    showDemo(this: void, data: Dataset) {
      reset(0, { ...emptySlot(), data, playerId: 'demo-a', scopeId: 'all' });
      reset(1, { ...emptySlot(), data, playerId: 'demo-b', scopeId: 'all' });
    },
    toggleBest(this: void, i: number, key: string) {
      check(i);
      const keys = slots[i].bestKeys;
      update(i, {
        bestKeys: keys.includes(key)
          ? keys.filter((k) => k !== key)
          : [...keys, key],
      });
    },
  };
}
