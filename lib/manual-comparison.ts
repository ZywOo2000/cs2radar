import { emptyManual, MANUAL_COLORS, parseManual, restoreManual, type ManualDraft } from './manual-data';
import { broadcastMetrics, sharedMetrics } from './stats';

export const MANUAL_WORKSPACE_KEY = 'cs2-radar-manual-v2';
export type ManualSide = 'A' | 'B';
export type ManualMode = 'single' | 'compare';
export type ManualWorkspace = {
  version: 2;
  mode: ManualMode;
  drafts: Record<ManualSide, ManualDraft>;
};

export function emptyManualSide(side: ManualSide): ManualDraft {
  return { ...emptyManual(), color: MANUAL_COLORS[side === 'A' ? 0 : 1] };
}

export function emptyManualWorkspace(): ManualWorkspace {
  return { version: 2, mode: 'single', drafts: { A: emptyManualSide('A'), B: emptyManualSide('B') } };
}

export function restoreManualWorkspace(raw: string | null, legacy: string | null = null): ManualWorkspace {
  if (raw === null) {
    const workspace = emptyManualWorkspace();
    if (legacy !== null) workspace.drafts.A = restoreManual(legacy);
    return workspace;
  }
  const saved = JSON.parse(raw);
  if (!saved || saved.version !== 2 || !['single', 'compare'].includes(saved.mode) ||
    !saved.drafts?.A || !saved.drafts?.B) throw new Error('手动双人草稿格式无效');
  return {
    version: 2,
    mode: saved.mode,
    drafts: { A: restoreManual(JSON.stringify(saved.drafts.A)), B: restoreManual(JSON.stringify(saved.drafts.B)) },
  };
}

export function manualComparisonState(workspace: ManualWorkspace) {
  const a = parseManual(workspace.drafts.A), b = parseManual(workspace.drafts.B);
  const compare = workspace.mode === 'compare';
  const comparable = sharedMetrics(broadcastMetrics, a.stats, compare ? b.stats : undefined,
    workspace.drafts.A.ratingVersion, workspace.drafts.B.ratingVersion);
  const invalidSides = (['A', ...(compare ? ['B'] : [])] as ManualSide[])
    .filter(side => Object.keys((side === 'A' ? a : b).errors).length > 0);
  const ready = invalidSides.length === 0 && comparable.length >= 3;
  const message = invalidSides.length
    ? `请修正手动 ${invalidSides.join('、')} 的无效数值后再导出。`
    : compare
      ? `两人共同可比较的雷达指标为 ${comparable.length}/6 项，至少需要三项；Round Swing 和 Firepower 不计入。`
      : '至少填写三项雷达指标后即可导出。';
  return { a, b, comparable, ready, message };
}
