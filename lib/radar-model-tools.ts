import { MANUAL_LABEL, parseManual } from './manual-data';
import { manualComparisonState, type ManualWorkspace } from './manual-comparison';
import { player, stats } from './slot-view';
import type { createSlotStore } from './slot-store';

type SlotStore = ReturnType<typeof createSlotStore>;
type Actions = {
  load: (index: number, url?: string) => Promise<unknown>;
  choose: (index: number, playerId: string, scopeId?: string) => Promise<unknown>;
};
export type RadarTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
export type RadarToolState = {
  store: SlotStore;
  workspace: ManualWorkspace;
  mode: string;
  view: string;
  actions: Actions;
  setMode: (mode: string) => void;
  canMutate?: () => boolean;
};

// Read through a getter so a registered tool never holds a stale render's state.
export function createRadarTools(current: () => RadarToolState): RadarTool[] {
  const requireEditable = () => {
    if (current().canMutate?.() === false) throw new Error('正在导出，请等待导出完成后再修改数据。');
  };
  const read = () => {
    const { mode, view, workspace, store } = current();
    const comparison = manualComparisonState(workspace);
    return {
      mode, view,
      manual: { ...workspace.drafts.A, ...parseManual(workspace.drafts.A), source: MANUAL_LABEL },
      manualComparison: {
        mode: workspace.mode,
        A: { ...workspace.drafts.A, ...parseManual(workspace.drafts.A) },
        B: { ...workspace.drafts.B, ...parseManual(workspace.drafts.B) },
        ready: comparison.ready,
        comparableMetrics: comparison.comparable.map(m => m.key),
      },
      slots: store.getSnapshot().map((s, i) => ({
        slot: 'ABCDE'[i], source: s.data?.sourceUrl || null, origin: s.data?.origin || null,
        player: player(s)?.name || null, playerId: s.playerId, scopeId: s.scopeId,
        stats: stats(s), error: s.error, busy: s.busy, demo: !!s.data?.demo,
      })),
    };
  };
  return [
    {
      name: 'import_hltv_source',
      description: '在雷达图页面导入一份 HLTV 比赛或赛事链接，更新指定侧。失败返回错误并保留原数据。',
      inputSchema: { type: 'object', properties: { slot: { enum: ['A', 'B', 'C', 'D', 'E'] }, url: { type: 'string' } }, required: ['slot', 'url'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async input => {
        const x = input as { slot?: string; url?: string };
        if (!x || !['A', 'B', 'C', 'D', 'E'].includes(x.slot || '') || typeof x.url !== 'string')
          throw new Error('需要 slot A–E 与 url。');
        requireEditable();
        await current().actions.load('ABCDE'.indexOf(x.slot!), x.url);
        return read();
      },
    },
    {
      name: 'select_comparison_player',
      description: '选择已导入来源中的选手和统计范围，可切换单人或双人展示。',
      inputSchema: { type: 'object', properties: { slot: { enum: ['A', 'B', 'C', 'D', 'E'] }, playerId: { type: 'string' }, scopeId: { type: 'string' }, mode: { enum: ['single', 'compare', 'video', 'manual'] } }, required: ['slot', 'playerId'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async input => {
        const x = input as { slot?: string; playerId?: string; scopeId?: string; mode?: string };
        if (!x || !['A', 'B', 'C', 'D', 'E'].includes(x.slot || '') || typeof x.playerId !== 'string' ||
            (x.mode && !['single', 'compare', 'video', 'manual'].includes(x.mode)))
          throw new Error('选择参数无效。');
        requireEditable();
        await current().actions.choose('ABCDE'.indexOf(x.slot!), x.playerId, x.scopeId);
        if (x.mode) {
          requireEditable();
          // React may not commit until after this call returns; report the new mode immediately.
          current().mode = x.mode;
          current().setMode(x.mode);
        }
        return read();
      },
    },
    {
      name: 'get_radar_comparison', description: '读取当前选手、统计范围、原始数据与读取状态。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: read,
    },
  ];
}
