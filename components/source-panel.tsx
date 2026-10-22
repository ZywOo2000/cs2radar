'use client';
import type { CSSProperties } from 'react';
import {
  Crosshair,
  ArrowUpRight,
  Link2,
  X,
  LoaderCircle,
  TriangleAlert,
  Copy,
  Check,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { performance, format, type Metric } from '@/lib/stats';
import type { Slot, Side } from '@/lib/slot-store';
import { player, stats } from '@/lib/slot-view';
import {
  SIDE_NAMES,
  DEFAULT_SERIES_COLORS,
  SERIES_COLOR_PRESETS,
} from '@/lib/series-colors';
export function Picker({
  label,
  id,
  value,
  items,
  onChange,
  disabled,
}: {
  label: string;
  id: string;
  value: string;
  items: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="picker-field">
      <label className="field-label" id={id + '-label'}>
        {label}
      </label>
      <Select
        items={items}
        value={value || null}
        onValueChange={(v) => v && onChange(String(v))}
        disabled={disabled}
      >
        <SelectTrigger aria-labelledby={id + '-label'} className="picker">
          <SelectValue placeholder="请选择" />
        </SelectTrigger>
        <SelectContent>
          {items.map((i) => (
            <SelectItem value={i.value} key={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function ColorEditor({
  side,
  color,
  onChange,
}: {
  side: Side;
  color: string;
  onChange: (color: string) => void;
}) {
  return (
    <fieldset className="color-editor">
      <legend>数据图颜色</legend>
      <div
        className="color-presets"
        aria-label={'数据 ' + side.toUpperCase() + ' 的颜色'}
      >
        {SERIES_COLOR_PRESETS.map((preset) => {
          const active = preset.value === color;
          return (
            <button
              key={preset.value}
              type="button"
              className="color-swatch"
              aria-pressed={active}
              aria-label={preset.name}
              title={preset.name}
              data-active={active || undefined}
              style={{ '--swatch-color': preset.value } as CSSProperties}
              onClick={() => onChange(preset.value)}
            >
              {active && <Check size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="color-reset"
        disabled={color === DEFAULT_SERIES_COLORS['abcde'.indexOf(side)]}
        onClick={() => onChange(DEFAULT_SERIES_COLORS['abcde'.indexOf(side)])}
      >
        恢复默认颜色
      </button>
    </fieldset>
  );
}
export function SourcePanel({
  side,
  slot,
  color,
  setColor,
  bestOptions,
  toggleBest,
  edit,
  load,
  choose,
  clear,
  copy,
  cancel,
}: {
  side: Side;
  slot: Slot;
  color: string;
  setColor: (color: string) => void;
  bestOptions: Metric[];
  toggleBest: (key: string) => void;
  edit: (url: string) => void;
  load: () => void;
  choose: (id: string, scope?: string) => void;
  clear: () => void;
  copy?: () => void;
  cancel: () => void;
}) {
  const p = player(slot),
    st = stats(slot);
  return (
    <aside
      className={'source-panel source-' + side}
      style={{ '--slot-color': color } as CSSProperties}
      aria-label={'数据 ' + side.toUpperCase()}
    >
      <div className="panel-title">
        <span className="slot-badge">{side.toUpperCase()}</span>
        <h2>{SIDE_NAMES['abcde'.indexOf(side)]}</h2>
        {slot.data && (
          <button
            className="icon-button panel-clear"
            aria-label={'清空数据 ' + side.toUpperCase()}
            onClick={clear}
            disabled={slot.busy}
          >
            <X size={16} />
          </button>
        )}
      </div>
      {slot.data?.origin?.type !== 'local-arena' && <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="field-label" htmlFor={'url-' + side}>
          HLTV 比赛 / 赛事链接
        </label>
        <div className="url-field">
          <Link2 size={16} />
          <input
            id={'url-' + side}
            type="url"
            required
            autoComplete="off"
            spellCheck={false}
            value={slot.url}
            onChange={(e) => edit(e.target.value)}
            placeholder="https://www.hltv.org/..."
            disabled={slot.busy}
          />
        </div>
        <button
          className="button primary full"
          type="submit"
          disabled={!slot.url.trim() || slot.busy}
        >
          {slot.busy ? (
            <>
              <LoaderCircle className="spin" size={16} />
              读取中…
            </>
          ) : (
            <>
              导入数据 <ArrowUpRight size={16} />
            </>
          )}
        </button>
      </form>}
      {slot.busy && (
        <output className="import-progress">
          <p>{slot.progress || '正在读取统计数据…'}</p>
          <button className="text-button" onClick={cancel}>
            取消读取
          </button>
        </output>
      )}
      {slot.error && (
        <div className="error-box" role="alert">
          <TriangleAlert size={16} />
          <div>
            {slot.error}
            {slot.data && <p>已保留当前数据。</p>}
          </div>
        </div>
      )}
      {slot.data && p ? (
        <>
          <div className="import-status">
            <span
              className={
                slot.data.demo ? 'demo-indicator' : 'success-indicator'
              }
            >
              {slot.data.demo ? '虚构示例' : slot.data.origin?.type === 'local-arena' ? 'Local Arena · 本地读取' : '已读取 HLTV'}
            </span>
            <span>{slot.data.players.length} 位选手</span>
          </div>
          <Picker
            label="选手"
            id={'player-' + side}
            value={p.id}
            items={slot.data.players.map((x) => ({
              value: x.id,
              label: x.name + ' · ' + x.team,
            }))}
            onChange={(v) => choose(v)}
            disabled={slot.busy}
          />
          <Picker
            label="统计范围"
            id={'scope-' + side}
            value={slot.scopeId}
            items={slot.data.scopes.map((x) => ({
              value: x.id,
              label: x.name,
            }))}
            onChange={(v) => choose(p.id, v)}
            disabled={slot.busy}
          />
          <div className="player-identity">
            <div className="player-monogram">
              {p.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3>{p.name}</h3>
              <p>{p.team}</p>
            </div>
          </div>
          <p className="source-title">{slot.data.title}</p>
          <p className="source-date">
            {slot.data.date || '日期以来源页面为准'} · 双方阵营合计
            {slot.data.origin?.type === 'local-arena' && ' · 非 HLTV 官方数据'}
          </p>
          <div className="rating-highlight rating-only">
            <div>
              <span>Rating {p.ratingVersion}</span>
              <strong>{format(st.rating, performance[0])}</strong>
            </div>
          </div>
          <div className="sample-count">
            <span>{st.maps === undefined ? '暂无' : st.maps} 张地图</span>
            <span>{st.rounds === undefined ? '暂无' : st.rounds} 回合</span>
          </div>
          {slot.data.sourceUrl && (
            <a
              className="source-link"
              href={p.profileUrl || slot.data.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              核对 HLTV 来源 <ArrowUpRight size={14} />
            </a>
          )}
          {slot.data.importedAt && (
            <p className="fetched-at">
              读取于{' '}
              {new Date(slot.data.importedAt).toLocaleString('zh-CN', {
                hour12: false,
              })}
            </p>
          )}
          <ColorEditor side={side} color={color} onChange={setColor} />
          <fieldset className="best-editor">
            <legend>Best 标记</legend>
            <p>选择要在数据图中强调的数值</p>
            <div className="best-options">
              {bestOptions.map((m) => {
                const active = slot.bestKeys.includes(m.key),
                  available = Number.isFinite(st[m.key]);
                return (
                  <button
                    key={m.key}
                    type="button"
                    aria-pressed={active}
                    data-active={active || undefined}
                    disabled={!available || slot.busy}
                    onClick={() => toggleBest(m.key)}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      ) : (
        <div className="source-empty">
          <Crosshair size={35} />
          <h3>{side === 'a' ? '从一份数据开始' : '选择序列中的选手'}</h3>
          <p>
            {side === 'a'
              ? '粘贴比赛、赛事或 HLTV 选手统计链接，导入后选择选手与统计范围。'
              : '可独立导入来源，也可复制上一份来源后快速换选手。'}
          </p>
          {copy && (
            <button className="text-button" onClick={copy} disabled={slot.busy}>
              <Copy size={14} />
              复制上一份数据来源
            </button>
          )}
        </div>
      )}
      <div className="source-footer">
        <span className="status-dot" />
        {slot.data?.origin?.type === 'local-arena'
          ? 'Local Arena 本机数据'
          : slot.transport === 'extension'
          ? '浏览器扩展读取'
          : '服务器直接读取'} ·
        不估算缺失指标
      </div>
    </aside>
  );
}
