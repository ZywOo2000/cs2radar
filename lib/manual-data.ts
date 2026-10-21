import type { Dataset, Stats } from './stats';

export const MANUAL_STORAGE_KEY = 'cs2-radar-manual-v1';
export const MANUAL_LABEL = '手动填写 · 非 HLTV 验证数据';
export const MANUAL_COLORS = ['#bddbff', '#61dac8', '#ff9b61', '#ff6f7d', '#b79cff', '#ff79b0', '#ffd166', '#65d7ff'];
export const RATING_VERSIONS = ['3.0', '2.1', '2.0', '未标注'];
export const MANUAL_FIELDS = [
  { key: 'kpr', label: 'KPR · 回合击杀', min: 0 },
  { key: 'surviving', label: 'Surviving · 存活率 (%)', min: 0, max: 100 },
  { key: 'adr', label: 'ADR · 回合伤害', min: 0 },
  { key: 'kast', label: 'KAST · 回合贡献率 (%)', min: 0, max: 100 },
  { key: 'multiKillPct', label: 'Multi-kill · 多杀回合占比 (%)', min: 0, max: 100 },
  { key: 'rating', label: 'Rating · 综合评分', min: 0 },
  { key: 'swing', label: 'Round Swing · 回合胜率贡献 (%)', min: -100, max: 100 },
  { key: 'firepower', label: 'Firepower · 火力值', min: 0, max: 100 },
] as const;
export type ManualKey = typeof MANUAL_FIELDS[number]['key'];
export type ManualDraft = {
  version: 1; name: string; team: string; scope: string; ratingVersion: string;
  values: Record<ManualKey, string>; color: string; bestKeys: string[];
};
export function emptyManual(): ManualDraft {
  return { version: 1, name: '', team: '', scope: '', ratingVersion: '未标注',
    values: Object.fromEntries(MANUAL_FIELDS.map(f => [f.key, ''])) as Record<ManualKey, string>,
    color: MANUAL_COLORS[0], bestKeys: [] };
}
export function parseManual(draft: ManualDraft) {
  const stats: Stats = {}, errors: Partial<Record<ManualKey, string>> = {};
  for (const field of MANUAL_FIELDS) {
    const raw = draft.values[field.key].trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw) || !Number.isFinite(value)) {
      errors[field.key] = '请填写有效数字，不需要输入 %。';
    } else if (value < field.min || ('max' in field && value > field.max)) {
      errors[field.key] = 'max' in field ? `请输入 ${field.min}–${field.max}。` : '请输入非负数。';
    } else stats[field.key] = value;
  }
  const count = MANUAL_FIELDS.slice(0, 6).filter(f => stats[f.key] !== undefined).length;
  return { stats, errors, count, ready: count >= 3 && Object.keys(errors).length === 0 };
}
export function restoreManual(raw: string | null): ManualDraft {
  const draft = emptyManual();
  if (!raw) return draft;
  const saved = JSON.parse(raw);
  if (!saved || saved.version !== 1 || !saved.values || typeof saved.values !== 'object') throw Error('手动草稿格式无效');
  for (const key of ['name', 'team', 'scope'] as const) {
    if (typeof saved[key] === 'string') draft[key] = saved[key].slice(0, key === 'scope' ? 120 : 60);
  }
  if (RATING_VERSIONS.includes(saved.ratingVersion)) draft.ratingVersion = saved.ratingVersion;
  if (MANUAL_COLORS.includes(saved.color)) draft.color = saved.color;
  for (const { key } of MANUAL_FIELDS) if (typeof saved.values[key] === 'string') draft.values[key] = saved.values[key];
  if (Array.isArray(saved.bestKeys)) draft.bestKeys = MANUAL_FIELDS.filter(f => saved.bestKeys.includes(f.key)).map(f => f.key);
  return draft;
}
export function manualDataset(draft: ManualDraft, side?: 'A' | 'B', compare = false): Dataset {
  const id = side ? `manual-${side}` : 'manual';
  return {
    id, kind: 'player', title: MANUAL_LABEL, event: '', date: '', sourceUrl: '', importedAt: '',
    scopes: [{ id: 'manual', name: [draft.team.trim(), draft.scope.trim()].filter(Boolean).join(' · ') }],
    notes: [MANUAL_LABEL],
    players: [{ id, name: draft.name.trim() || (compare && side ? `自定义选手 ${side}` : '自定义选手'), team: draft.team.trim(),
      ratingVersion: draft.ratingVersion, detailLoaded: true, stats: { manual: parseManual(draft).stats } }],
  };
}
