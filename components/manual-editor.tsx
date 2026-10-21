'use client';
import type { ReactNode } from 'react';
import { MANUAL_FIELDS, MANUAL_LABEL, RATING_VERSIONS, type ManualDraft, type ManualKey } from '@/lib/manual-data';
import type { ManualSide } from '@/lib/manual-comparison';

export function ManualEditor({ draft, onChange, errors, count, colors, storageMessage, disabled, side, compare, onClear }: {
  draft: ManualDraft; onChange: (draft: ManualDraft) => void;
  errors: Partial<Record<ManualKey, string>>; count: number; colors: ReactNode;
  storageMessage: string; disabled: boolean; side: ManualSide; compare: boolean; onClear: () => void;
}) {
  return <div className="manual-editor">
    <p className="manual-provenance">{MANUAL_LABEL}</p>
    {compare && <h3>手动 {side} · {draft.name.trim() || `自定义选手 ${side}`}</h3>}
    <p className="muted small">填写至少三项雷达指标。留空表示缺失，75.5 表示 75.5%。</p>
    <fieldset disabled={disabled} className="manual-fields">
      {(['name', 'team', 'scope'] as const).map((key, i) => <label key={key} className="manual-field" htmlFor={'manual-' + key}>
        <span>{['选手姓名', '战队（选填）', '统计范围说明（选填）'][i]}</span>
        <input id={'manual-' + key} value={draft[key]} maxLength={key === 'scope' ? 120 : 60}
          placeholder={key === 'name' ? (compare ? `自定义选手 ${side}` : '自定义选手') : ''} onChange={e => onChange({ ...draft, [key]: e.target.value })} />
      </label>)}
      <label className="manual-field" htmlFor="manual-rating-version"><span>Rating 版本</span>
        <select id="manual-rating-version" value={draft.ratingVersion} onChange={e => onChange({ ...draft, ratingVersion: e.target.value })}>
          {RATING_VERSIONS.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <div className="manual-metrics">
        {MANUAL_FIELDS.map(f => <label key={f.key} className="manual-field" htmlFor={'manual-' + f.key}>
          <span>{f.label}</span>
          <input id={'manual-' + f.key} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
            value={draft.values[f.key]} placeholder="暂无" aria-invalid={!!errors[f.key]}
            aria-describedby={errors[f.key] ? 'manual-error-' + f.key : undefined}
            onChange={e => onChange({ ...draft, values: { ...draft.values, [f.key]: e.target.value } })} />
          {errors[f.key] && <small role="alert" className="manual-error" id={'manual-error-' + f.key}>{errors[f.key]}</small>}
        </label>)}
      </div>
      {colors}
      <fieldset className="best-editor"><legend>Best 标记</legend><div className="best-options">
        {MANUAL_FIELDS.map(f => <button type="button" key={f.key} aria-pressed={draft.bestKeys.includes(f.key)}
          data-active={draft.bestKeys.includes(f.key) || undefined} disabled={!draft.values[f.key].trim() || !!errors[f.key]}
          onClick={() => onChange({ ...draft, bestKeys: draft.bestKeys.includes(f.key) ? draft.bestKeys.filter(k => k !== f.key) : [...draft.bestKeys, f.key] })}>
          {f.label.split(' · ')[0]}
        </button>)}
      </div></fieldset>
      <button type="button" className="button secondary full" onClick={() => {
        if (window.confirm(`清空手动 ${side} 的数据、颜色和 Best？另一份手动数据和已导入的 A–E 数据不会改变。`)) onClear();
      }}>{compare ? `清空手动 ${side}` : '清空手动数据'}</button>
    </fieldset>
    <p className="muted small" aria-live="polite">{count}/6 项雷达指标有效{count < 3 ? ' · 再填至少 ' + (3 - count) + ' 项即可导出' : ''}</p>
    <p className="muted small" role={storageMessage ? 'status' : undefined}>{storageMessage || '自动保存在当前浏览器；不同域名之间不共享草稿。'}</p>
  </div>;
}
