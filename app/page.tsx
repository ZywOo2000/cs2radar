'use client';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Crosshair,
  ArrowUpRight,
  Link2,
  ArrowLeftRight,
  Download,
  Video,
  LoaderCircle,
  Info,
  X,
  Copy,
  TriangleAlert,
  Check,
  RotateCcw,
  Play,
  ChevronUp,
  ChevronDown,
  Radio,
  Database,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Radar } from '@/components/radar';
import {
  performance,
  broadcastMetrics,
  broadcastStats,
  attributes,
  extraMetrics,
  demo,
  format,
  sharedMetrics,
  type Dataset,
  type Metric,
  type Stats,
  type Player,
} from '@/lib/stats';
import { exportChart } from '@/lib/export-chart';
import { exportDynamicVideo } from '@/lib/export-video';
import { exportSequenceVideo } from '@/lib/export-sequence-video';
import {
  SequenceRadar,
  type SequenceRadarHandle,
} from '@/components/sequence-radar';
import {
  commonSequenceMetrics,
  type SequenceParticipant,
} from '@/lib/video-sequence';
import { useHltvExtension } from '@/lib/extension-client';
import { ExtensionGuide } from '@/components/extension-guide';
import { ManualEditor } from '@/components/manual-editor';
import { useManualDraft } from '@/hooks/use-manual-draft';
import { manualDataset, parseManual, MANUAL_LABEL } from '@/lib/manual-data';
type Transport = 'auto' | 'server' | 'extension';
type Slot = {
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
type Side = 'a' | 'b' | 'c' | 'd' | 'e';
const SIDE_NAMES = [
  '第一份数据',
  '第二份数据',
  '第三份数据',
  '第四份数据',
  '第五份数据',
] as const;
const DEFAULT_SERIES_COLORS = [
  '#bddbff',
  '#61dac8',
  '#ff9b61',
  '#b79cff',
  '#ffd166',
] as const;
const SERIES_COLOR_PRESETS = [
  { name: '冰蓝', value: '#bddbff' },
  { name: '薄荷青', value: '#61dac8' },
  { name: '亮橙', value: '#ff9b61' },
  { name: '珊瑚红', value: '#ff6f7d' },
  { name: '电光紫', value: '#b79cff' },
  { name: '玫红', value: '#ff79b0' },
  { name: '亮金', value: '#ffd166' },
  { name: '青蓝', value: '#65d7ff' },
] as const;
const empty = (): Slot => ({
  url: '',
  data: null,
  playerId: '',
  scopeId: '',
  busy: false,
  error: '',
  progress: '',
  bestKeys: [],
});
const player = (s: Slot) => s.data?.players.find((p) => p.id === s.playerId);
const stats = (s: Slot): Stats =>
  broadcastStats(player(s)?.stats[s.scopeId] || {});
const context = (s: Slot) =>
  [
    s.data?.title,
    s.data?.scopes.find((x) => x.id === s.scopeId)?.name,
    s.data?.date,
  ]
    .filter(Boolean)
    .join(' · ');
function Picker({
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
function ColorEditor({
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
function SourcePanel({
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
      <form
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
      </form>
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
              {slot.data.demo ? '虚构示例' : '已读取 HLTV'}
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
        {slot.transport === 'extension'
          ? '浏览器扩展读取'
          : '服务器直接读取'} ·
        不估算缺失指标
      </div>
    </aside>
  );
}
export default function Home() {
  const extension = useHltvExtension();
  const manual = useManualDraft();
  const manualResult = useMemo(() => parseManual(manual.draft), [manual.draft]);
  const manualData = useMemo(() => manualDataset(manual.draft), [manual.draft]);
  const [transport, setTransport] = useState<Transport>('auto');
  const controllers = useRef<(AbortController | null)[]>([
    null,
    null,
    null,
    null,
    null,
  ]);
  const videoExportLock = useRef(false);
  const sequenceRef = useRef<SequenceRadarHandle>(null);
  const [slots, setSlots] = useState<Slot[]>([
    empty(),
    empty(),
    empty(),
    empty(),
    empty(),
  ]);
  const ref = useRef(slots);
  const seq = useRef([0, 0, 0, 0, 0]);
  const [seriesColors, setSeriesColors] = useState<string[]>([
    ...DEFAULT_SERIES_COLORS,
  ]);
  const [mode, setMode] = useState('compare'),
    [importView, setView] = useState('performance'),
    [activeSlot, setActiveSlot] = useState(0),
    [showAllStats, setShowAllStats] = useState(false),
    [exporting, setExporting] = useState(false),
    [exportingVideo, setExportingVideo] = useState(false),
    [videoProgress, setVideoProgress] = useState(0),
    [notice, setNotice] = useState('');
  const isManual = mode === 'manual';
  const view = isManual ? 'performance' : importView;
  function update(i: number, patch: Partial<Slot>) {
    const next = [...ref.current];
    next[i] = { ...next[i], ...patch };
    ref.current = next;
    setSlots(next);
  }
  function replace(next: Slot[]) {
    ref.current = next;
    setSlots(next);
  }
  async function fetchData(
    url: string,
    i: number,
    via: Transport,
  ): Promise<Dataset> {
    controllers.current[i]?.abort();
    const controller = new AbortController();
    controllers.current[i] = controller;
    if (via === 'extension')
      return extension.request(
        url,
        (message) => update(i, { progress: message }),
        controller.signal,
      );
    update(i, { progress: '正在通过服务器读取 HLTV…' });
    const res = await fetch('/api/hltv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.any([AbortSignal.timeout(65000), controller.signal]),
    });
    let body: { ok: boolean; data?: Dataset; error?: { message?: string } };
    try {
      body = (await res.json()) as typeof body;
    } catch {
      throw new Error('服务器没有返回可识别的数据，请稍后重试。');
    }
    if (!res.ok || !body.ok)
      throw new Error(body.error?.message || '读取失败，请稍后重试。');
    if (!body.data) throw new Error('来源未返回选手数据。');
    return body.data;
  }
  async function choose(i: number, id: string, scope?: string) {
    const s = ref.current[i],
      p = s.data?.players.find((x) => x.id === id);
    if (!p) throw new Error('选手不存在。');
    if (scope && !s.data?.scopes.some((x) => x.id === scope))
      throw new Error('统计范围不存在。');
    update(i, { playerId: id, scopeId: scope || s.scopeId, error: '' });
    if (!p.profileUrl || p.detailLoaded || s.data?.demo) return;
    const ticket = ++seq.current[i];
    update(i, { busy: true });
    try {
      const detail = await fetchData(p.profileUrl, i, s.transport || 'server');
      if (ticket !== seq.current[i]) return;
      const found = detail.players.find((x) => x.id === id);
      if (!found) throw new Error('详情返回的选手不匹配。');
      const current = ref.current[i];
      if (!current.data) return;
      const merged: Player = {
        ...p,
        ...found,
        team: p.team === '战队未提供' ? found.team : p.team,
        stats: {
          ...p.stats,
          event: { ...p.stats.event, ...found.stats.event },
        },
        ratingVersion:
          found.ratingVersion === '未标注'
            ? p.ratingVersion
            : found.ratingVersion,
        detailLoaded: true,
      };
      update(i, {
        data: {
          ...current.data,
          players: current.data.players.map((x) => (x.id === id ? merged : x)),
        },
        busy: false,
      });
    } catch (e) {
      if (ticket === seq.current[i])
        update(i, {
          busy: false,
          error:
            '选手详情读取失败：' +
            (e instanceof Error ? e.message : '请重试。'),
        });
    }
  }
  async function load(i: number, url = ref.current[i].url) {
    const ticket = ++seq.current[i];
    const via =
      transport === 'auto'
        ? extension.connected
          ? 'extension'
          : 'server'
        : transport;
    update(i, { url, busy: true, error: '', progress: '', transport: via });
    try {
      const data = await fetchData(url, i, via);
      if (ticket !== seq.current[i]) return null;
      const id = data.players[0]?.id,
        scope = data.scopes[0]?.id;
      if (!id || !scope)
        throw new Error('来源没有提供可选取的选手或统计范围。');
      update(i, { data, playerId: id, scopeId: scope, busy: false });
      setNotice('');
      await choose(i, id, scope);
      return {
        players: data.players.map((p) => ({ id: p.id, name: p.name })),
        scopes: data.scopes,
      };
    } catch (e) {
      if (ticket === seq.current[i])
        update(i, {
          busy: false,
          error:
            e instanceof Error
              ? e.name === 'TimeoutError'
                ? '读取超时，请稍后重试。'
                : e.message
              : '读取失败，请稍后重试。',
        });
      return null;
    }
  }
  function cancel(i: number) {
    seq.current[i]++;
    controllers.current[i]?.abort();
    update(i, {
      busy: false,
      progress: '',
      error: '已取消读取，原有数据保留。',
    });
  }
  function clear(i: number) {
    seq.current[i]++;
    controllers.current[i]?.abort();
    update(i, empty());
  }
  function toggleBest(i: number, key: string) {
    const current = ref.current[i].bestKeys;
    update(i, {
      bestKeys: current.includes(key)
        ? current.filter((x) => x !== key)
        : [...current, key],
    });
  }
  function setSeriesColor(i: number, color: string) {
    setSeriesColors((current) => {
      const next = [...current];
      next[i] = color;
      try {
        localStorage.setItem('cs2-radar-series-colors', JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  function showDemo() {
    seq.current = seq.current.map((v) => v + 1);
    replace([
      { ...empty(), data: demo, playerId: 'demo-a', scopeId: 'all' },
      { ...empty(), data: demo, playerId: 'demo-b', scopeId: 'all' },
      ...ref.current.slice(2),
    ]);
    setNotice('当前展示虚构示例。粘贴真实 HLTV 链接可替换任一侧。');
  }
  function copySource(i: number) {
    const source = ref.current[Math.max(0, i - 1)];
    seq.current[i]++;
    update(i, { ...source, busy: false, error: '', progress: '' });
  }
  function moveSlot(i: number, direction: -1 | 1) {
    const j = i + direction;
    if (j < 0 || j > 4) return;
    const next = [...ref.current];
    [next[i], next[j]] = [next[j], next[i]];
    ref.current = next;
    setSlots(next);
    setSeriesColors((colors) => {
      const copy = [...colors];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      try {
        localStorage.setItem('cs2-radar-series-colors', JSON.stringify(copy));
      } catch {}
      return copy;
    });
  }
  const manualSlot: Slot = { ...empty(), data: manualData, playerId: 'manual', scopeId: 'manual', bestKeys: manual.draft.bestKeys };
  const a = isManual ? manualSlot : slots[0],
    b = slots[1],
    pa = player(a),
    pb = player(b),
    sa = stats(a),
    sb = stats(b),
    comp = mode === 'compare',
    isVideo = mode === 'video';
  const primaryColor = isManual ? manual.draft.color : seriesColors[0];
  const ms = view === 'performance' ? broadcastMetrics : attributes;
  const bestOptions =
    view === 'performance'
      ? [
          ...broadcastMetrics,
          performance.find((m) => m.key === 'firepower')!,
          performance.find((m) => m.key === 'swing')!,
        ]
      : attributes;
  const comparable = sharedMetrics(
    ms,
    sa,
    comp && pb ? sb : undefined,
    pa?.ratingVersion,
    pb?.ratingVersion,
  );
  const videoPeople = useMemo<SequenceParticipant[]>(
    () =>
      slots.flatMap((slot, i) => {
        const p = player(slot);
        return p
          ? [
              {
                name: p.name,
                context: context(slot),
                stats: stats(slot),
                color: seriesColors[i],
                bestKeys: slot.bestKeys,
                ratingVersion: p.ratingVersion,
              },
            ]
          : [];
      }),
    [slots, seriesColors],
  );
  const sequenceComparable = useMemo(
    () => commonSequenceMetrics(ms, videoPeople),
    [ms, videoPeople],
  );
  const sequenceReady =
    videoPeople.length >= 2 && sequenceComparable.length >= 3;
  const ready = isManual ? manual.loaded && manualResult.ready : isVideo ? sequenceReady : comparable.length >= 3;
  const radarMetrics = view === 'performance' ? ms : ready ? comparable : ms;
  const excluded = ms.filter((m) => !comparable.includes(m));
  const anyData = isVideo
      ? slots.some((s) => !!s.data)
      : !!(a.data || (comp && b.data)),
    hasDemo = !!(a.data?.demo || (comp && b.data?.demo));
  const busy = !isManual && slots.some((s) => s.busy);
  const [sequencePlaying, setSequencePlaying] = useState(false);
  const graphEmpty = anyData && !ready;
  const displayed = view === 'performance' ? sa : ready ? sa : {};
  const displayedB =
    comp && pb && (view === 'performance' || ready) ? sb : undefined;
  const allTableMetrics = [
    ...ms,
    ...(view === 'performance'
      ? [
          ...performance.filter((m) => !ms.some((x) => x.key === m.key)),
          ...extraMetrics,
        ]
      : []),
  ];
  const keyMetricKeys = new Set([
    'rating',
    'adr',
    'kast',
    'kpr',
    'surviving',
    'multiKillPct',
    'firepower',
    'swing',
  ]);
  const tableMetrics = isManual ? allTableMetrics.filter(m => keyMetricKeys.has(m.key)) : allTableMetrics;
  const visibleTableMetrics = showAllStats
    ? tableMetrics
    : tableMetrics.filter((metric) => keyMetricKeys.has(metric.key));
  const ratingMismatch =
    comp &&
    pa &&
    pb &&
    (pa.ratingVersion !== pb.ratingVersion || pa.ratingVersion === '未标注');
  async function download() {
    if (!ready || busy || exporting || exportingVideo) return;
    setExporting(true);
    setNotice('');
    try {
      if (!pa) throw new Error('请先选择选手。');
      await exportChart(
        view === 'performance' ? '选手比赛表现' : 'HLTV 选手属性',
        view === 'performance'
          ? [...ms, performance.find((m) => m.key === 'swing')!]
          : comparable,
        {
          name: pa.name,
          context: context(a),
          source: isManual ? MANUAL_LABEL : pa.profileUrl || a.data?.sourceUrl || '',
          manual: isManual,
          version: pa.ratingVersion,
          stats: sa,
          demo: !!a.data?.demo,
        },
        comp && pb
          ? {
              name: pb.name,
              context: context(b),
              source: pb.profileUrl || b.data?.sourceUrl || '',
              version: pb.ratingVersion,
              stats: sb,
              demo: !!b.data?.demo,
            }
          : undefined,
      );
      setNotice('PNG 已生成，浏览器将开始下载。');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导出失败。');
    } finally {
      setExporting(false);
    }
  }
  async function downloadVideo() {
    if (videoExportLock.current || !ready || busy || exporting) return;
    videoExportLock.current = true;
    setExportingVideo(true);
    setVideoProgress(0);
    setNotice('');
    try {
      if (isVideo) {
        if (!sequenceRef.current) throw new Error('视频预览尚未就绪。');
        if (!sequenceReady)
          throw new Error('至少选择两人，且共同可绘制指标不少于三项。');
        const result = await exportSequenceVideo(
          view === 'performance' ? '选手比赛表现' : 'HLTV 选手属性',
          videoPeople,
          sequenceRef.current,
          setVideoProgress,
        );
        setNotice(
          `连续视频已生成：${result.fileName}（${result.format}，浏览器将开始下载）`,
        );
        return;
      }
      if (!pa) throw new Error('请先选择选手。');
      const result = await exportDynamicVideo(
        view === 'performance' ? '选手比赛表现' : 'HLTV 选手属性',
        { name: pa.name, context: context(a) },
        comp && pb ? { name: pb.name, context: context(b) } : undefined,
        setVideoProgress,
      );
      setNotice(
        `动态视频已生成：${result.fileName}（${result.format}，浏览器将开始下载）`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '视频导出失败，请重试。');
    } finally {
      videoExportLock.current = false;
      setExportingVideo(false);
      setVideoProgress(0);
    }
  }
  const actions = useRef({ load, choose });
  actions.current = { load, choose };
  const manualRef = useRef(manual.draft);
  manualRef.current = manual.draft;
  const configRef = useRef({ mode, view });
  configRef.current = { mode, view };
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('cs2-radar-series-colors') || 'null',
      );
      if (Array.isArray(saved)) {
        const next = [...DEFAULT_SERIES_COLORS];
        saved.slice(0, 5).forEach((color: string, i: number) => {
          if (SERIES_COLOR_PRESETS.some((preset) => preset.value === color))
            next[i] = color as (typeof next)[number];
        });
        queueMicrotask(() => setSeriesColors(next));
      }
    } catch {}
  }, []);
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (x: unknown) => unknown;
    };
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            opts: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    const read = () => ({
      mode: configRef.current.mode,
      view: configRef.current.view,
      manual: { ...manualRef.current, ...parseManual(manualRef.current), source: MANUAL_LABEL },
      slots: ref.current.map((s, i) => ({
        slot: 'ABCDE'[i],
        source: s.data?.sourceUrl || null,
        player: player(s)?.name || null,
        playerId: s.playerId,
        scopeId: s.scopeId,
        stats: stats(s),
        error: s.error,
        busy: s.busy,
        demo: !!s.data?.demo,
      })),
    });
    const tools: Tool[] = [
      {
        name: 'import_hltv_source',
        description:
          '在雷达图页面导入一份 HLTV 比赛或赛事链接，更新指定侧。失败返回错误并保留原数据。',
        inputSchema: {
          type: 'object',
          properties: {
            slot: { enum: ['A', 'B', 'C', 'D', 'E'] },
            url: { type: 'string' },
          },
          required: ['slot', 'url'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const x = input as { slot?: string; url?: string };
          if (
            !x ||
            !['A', 'B', 'C', 'D', 'E'].includes(x.slot || '') ||
            typeof x.url !== 'string'
          )
            throw new Error('需要 slot A–E 与 url。');
          await actions.current.load('ABCDE'.indexOf(x.slot!), x.url);
          return read();
        },
      },
      {
        name: 'select_comparison_player',
        description: '选择已导入来源中的选手和统计范围，可切换单人或双人展示。',
        inputSchema: {
          type: 'object',
          properties: {
            slot: { enum: ['A', 'B', 'C', 'D', 'E'] },
            playerId: { type: 'string' },
            scopeId: { type: 'string' },
            mode: { enum: ['single', 'compare', 'video', 'manual'] },
          },
          required: ['slot', 'playerId'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (input) => {
          const x = input as {
            slot?: string;
            playerId?: string;
            scopeId?: string;
            mode?: string;
          };
          if (
            !x ||
            !['A', 'B', 'C', 'D', 'E'].includes(x.slot || '') ||
            typeof x.playerId !== 'string' ||
            (x.mode && !['single', 'compare', 'video', 'manual'].includes(x.mode))
          )
            throw new Error('选择参数无效。');
          await actions.current.choose(
            'ABCDE'.indexOf(x.slot!),
            x.playerId,
            x.scopeId,
          );
          if (x.mode) {
            configRef.current.mode = x.mode;
            setMode(x.mode);
          }
          return read();
        },
      },
      {
        name: 'get_radar_comparison',
        description: '读取当前选手、统计范围、原始数据与读取状态。',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: read,
      },
    ];
    for (const tool of tools)
      try {
        void Promise.resolve(
          ctx.registerTool(tool, { signal: life.signal }),
        ).catch(() => {});
      } catch {}
    return () => life.abort();
  }, []);
  return (
    <TooltipProvider>
      <main className="site-shell">
        <header className="topbar">
          <div className="brand" aria-label="RADAR / CS2">
            <span className="brand-mark">
              <Crosshair size={23} />
            </span>
            <b>
              RADAR<span> / CS2</span>
            </b>
          </div>
          <span className="top-note">
            <Radio size={14} /> LIVE DATA WORKBENCH
          </span>
          <a
            className="quiet-link"
            href="https://www.hltv.org/stats"
            target="_blank"
            rel="noreferrer"
          >
            HLTV <ArrowUpRight size={16} />
          </a>
        </header>
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">PLAYER COMPARISON</div>
            <h1>
              数据雷达图<span className="heading-dot">.</span>
            </h1>
            <p>
              {isManual ? '手动填写比赛表现，实时生成雷达图并导出。' : isVideo
                ? '按顺序将 2–5 位选手的数据连续变形并导出视频。'
                : comp
                  ? '独立选择两份数据，快速完成赛场表现对比。'
                  : '聚焦一位选手，制作清晰的比赛表现数据图。'}
            </p>
          </div>
          <div className="heading-actions">
            <button
              className="button secondary"
              hidden={isManual}
              onClick={showDemo}
              disabled={busy || exportingVideo}
            >
              <RotateCcw size={15} />
              查看示例
            </button>
            <div className="export-actions">
              {!isVideo && (
                <button
                  className="button secondary export-button"
                  onClick={download}
                  disabled={!ready || exporting || exportingVideo || busy}
                >
                  {exporting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  导出 PNG
                </button>
              )}
              <button
                className="button secondary export-button video-export-button"
                onClick={downloadVideo}
                disabled={!ready || exporting || exportingVideo || busy}
                aria-live="polite"
              >
                {exportingVideo ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Video size={16} />
                )}
                <span>
                  {exportingVideo
                    ? `正在生成视频… ${videoProgress}%`
                    : isVideo
                      ? '导出连续视频'
                      : '导出动态视频'}
                </span>
              </button>
            </div>
          </div>
        </section>
        {!isManual && <div className="extension-bar">
          <div>
            <Database size={18} />
            <strong>
              {extension.connected
                ? '扩展已连接 · v' + extension.version
                : '扩展未连接'}
            </strong>
            <p>
              {extension.connected &&
              ['1.0.1', '1.0.2', '1.0.3'].includes(extension.version)
                ? '当前为旧版扩展，请下载新版、重新加载扩展，再刷新本页。'
                : '补读多杀时可能打开详细统计页；如需验证，请在该页完成。'}
            </p>
          </div>
          <Picker
            label="读取方式"
            id="transport"
            value={transport}
            items={[
              { value: 'auto', label: '自动 · 扩展优先' },
              { value: 'extension', label: '仅浏览器扩展' },
              { value: 'server', label: '仅服务器' },
            ]}
            onChange={(v) => setTransport(v as Transport)}
            disabled={busy}
          />
          <ExtensionGuide connected={extension.connected} />
        </div>}
        <div className="workspace-toolbar">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              if (exporting || exportingVideo) return;
              const nextMode = String(v);
              setMode(nextMode);
              setActiveSlot(nextMode === 'video' ? 0 : Math.min(activeSlot, 1));
            }}
          >
            <TabsList className="mode-tabs">
              <TabsTrigger value="compare">
                <ArrowLeftRight size={15} />
                双人对比
              </TabsTrigger>
              <TabsTrigger value="single">单人展示</TabsTrigger>
              <TabsTrigger value="manual">手动填写</TabsTrigger>
              <TabsTrigger value="video">
                <Video size={15} />
                视频模式
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="toolbar-right">
            <span className="muted small">跨比赛 · 跨赛事 · 同一选手</span>
            {comp && (
              <button
                className="icon-button"
                aria-label="交换两份数据"
                disabled={busy || (!a.data && !b.data)}
                onClick={() => replace([b, a, ...ref.current.slice(2)])}
              >
                <ArrowLeftRight size={17} />
              </button>
            )}
          </div>
        </div>
        {notice && (
          <output className="notice">
            <Info size={15} />
            <span>{notice}</span>
            <button
              className="icon-button"
              aria-label="关闭提示"
              onClick={() => setNotice('')}
            >
              <X size={14} />
            </button>
          </output>
        )}
        {isVideo ? (
          <section className="video-workspace">
            <div className="video-sequence-editor">
              <div className="video-sequence-summary">
                <div>
                  <span className="eyebrow">SEQUENCE · A–E</span>
                  <h2>五人序列编辑</h2>
                  <p>空位置不会进入视频；按当前顺序连续变形。</p>
                </div>
                <strong>{videoPeople.length} / 5 人</strong>
              </div>
              <div className="sequence-list" aria-label="视频选手顺序">
                {slots.map((slot, i) => {
                  const selectedPlayer = player(slot);
                  return (
                    <div
                      className="sequence-row"
                      data-active={activeSlot === i || undefined}
                      key={i}
                    >
                      <button
                        className="sequence-row-main"
                        type="button"
                        onClick={() => setActiveSlot(i)}
                      >
                        <span
                          className="slot-badge"
                          style={
                            { '--slot-color': seriesColors[i] } as CSSProperties
                          }
                        >
                          {'ABCDE'[i]}
                        </span>
                        <span>
                          <strong>{selectedPlayer?.name || '添加选手'}</strong>
                          <small>
                            {selectedPlayer?.team || `第 ${i + 1} 位`}
                          </small>
                        </span>
                      </button>
                      <div className="sequence-row-actions">
                        <button
                          className="icon-button"
                          aria-label="上移"
                          disabled={i === 0 || busy}
                          onClick={() => moveSlot(i, -1)}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="下移"
                          disabled={i === 4 || busy}
                          onClick={() => moveSlot(i, 1)}
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const i = activeSlot;
                const side = 'abcde'[i] as Side;
                const slot = slots[i];
                return (
                  <div className="video-slot active-video-slot">
                    <SourcePanel
                      side={side}
                      slot={slot}
                      color={seriesColors[i]}
                      setColor={(color) => setSeriesColor(i, color)}
                      bestOptions={bestOptions}
                      toggleBest={(key) => toggleBest(i, key)}
                      edit={(url) => update(i, { url })}
                      load={() => void load(i)}
                      choose={(id, scope) => void choose(i, id, scope)}
                      clear={() => clear(i)}
                      cancel={() => cancel(i)}
                      copy={
                        i > 0 && slots[i - 1].data
                          ? () => copySource(i)
                          : undefined
                      }
                    />
                  </div>
                );
              })()}
            </div>
            <section className="chart-panel sequence-chart">
              <div className="chart-heading">
                <div>
                  <span className="eyebrow">CONTINUOUS MORPH VIDEO</span>
                  <h2>
                    {view === 'performance'
                      ? '比赛表现连续数据图'
                      : 'HLTV 属性连续数据图'}
                  </h2>
                </div>
                <span className="chart-label">
                  {videoPeople.length < 2
                    ? '至少选择 2 人'
                    : sequenceComparable.length + ' 项共同指标'}
                </span>
              </div>
              <Tabs
                value={view}
                onValueChange={(v) => setView(String(v))}
                className="chart-tabs"
              >
                <TabsList className="metric-tabs">
                  <TabsTrigger value="performance">比赛指标</TabsTrigger>
                  <TabsTrigger value="attributes">HLTV 属性</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="sequence-preview-actions">
                <button
                  className="button secondary"
                  disabled={!sequenceReady || sequencePlaying || exportingVideo}
                  onClick={() => sequenceRef.current?.play()}
                >
                  <Play size={15} />
                  {sequencePlaying ? '正在播放…' : '播放预览'}
                </button>
                <span>
                  1920×1080 · 仅导出雷达框 · 每次变形 1.1 秒 · 停留 0.7 秒
                </span>
              </div>
              <div className="chart-wrap">
                {videoPeople.length ? (
                  <SequenceRadar
                    key={[
                      view,
                      ...videoPeople.flatMap((p) => [
                        p.name,
                        p.context,
                        p.color,
                        ...p.bestKeys,
                        ...Object.values(p.stats),
                      ]),
                    ].join('|')}
                    ref={sequenceRef}
                    people={videoPeople}
                    metrics={view === 'performance' ? ms : sequenceComparable}
                    onPlaying={setSequencePlaying}
                  />
                ) : (
                  <div className="sequence-empty">
                    <Video size={36} />
                    <strong>添加至少两位选手</strong>
                    <span>
                      可以使用不同来源，也可以复制上一份来源后更换选手。
                    </span>
                  </div>
                )}
              </div>
              {videoPeople.length >= 2 && !sequenceReady && (
                <p className="chart-note">
                  五人共同可绘制指标不足 3 项，或 Rating
                  版本不一致。请选择其他统计范围。
                </p>
              )}
            </section>
          </section>
        ) : (
          <>
            <section
              className={'comparison-workspace ' + (!comp ? 'single' : '') + (isManual ? ' manual-workspace' : '')}
            >
              <div className="control-console">
                <div className="console-heading">
                  <div>
                    <span className="eyebrow">DATA CONTROL</span>
                    <h2>数据控制台</h2>
                  </div>
                  <SlidersHorizontal size={18} />
                </div>
                {comp && (
                  <div
                    className="slot-switch"
                    role="tablist"
                    aria-label="选择编辑的数据"
                  >
                    {[0, 1].map((i) => {
                      const selectedPlayer = player(slots[i]);
                      return (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={activeSlot === i}
                          data-active={activeSlot === i || undefined}
                          onClick={() => setActiveSlot(i)}
                        >
                          <span style={{ background: seriesColors[i] }}>
                            {i === 0 ? 'A' : 'B'}
                          </span>
                          <b>
                            {selectedPlayer?.name ||
                              `数据 ${i === 0 ? 'A' : 'B'}`}
                          </b>
                        </button>
                      );
                    })}
                  </div>
                )}
                {isManual ? <ManualEditor draft={manual.draft} onChange={manual.setDraft}
                  errors={manualResult.errors} count={manualResult.count} storageMessage={manual.storageMessage}
                  disabled={!manual.loaded || exporting || exportingVideo}
                  colors={<ColorEditor side="a" color={primaryColor} onChange={color => manual.setDraft(d => ({ ...d, color }))} />}
                /> : !comp || activeSlot === 0 ? (
                  <SourcePanel
                    side="a"
                    slot={a}
                    color={primaryColor}
                    setColor={(color) => setSeriesColor(0, color)}
                    bestOptions={bestOptions}
                    toggleBest={(key) => toggleBest(0, key)}
                    edit={(url) => update(0, { url })}
                    load={() => void load(0)}
                    choose={(id, scope) => void choose(0, id, scope)}
                    clear={() => clear(0)}
                    cancel={() => cancel(0)}
                  />
                ) : (
                  <SourcePanel
                    side="b"
                    slot={b}
                    color={seriesColors[1]}
                    setColor={(color) => setSeriesColor(1, color)}
                    bestOptions={bestOptions}
                    toggleBest={(key) => toggleBest(1, key)}
                    edit={(url) => update(1, { url })}
                    load={() => void load(1)}
                    choose={(id, scope) => void choose(1, id, scope)}
                    clear={() => clear(1)}
                    cancel={() => cancel(1)}
                    copy={a.data ? () => copySource(1) : undefined}
                  />
                )}
              </div>
              <section className="chart-panel">
                <div className="chart-heading">
                  <div>
                    <span className="eyebrow">PERFORMANCE RADAR</span>
                    <h2>
                      {view === 'performance' ? '比赛表现' : 'HLTV 七项属性'}
                    </h2>
                  </div>
                  <span
                    className={'chart-label ' + (hasDemo ? 'demo-tag' : '')}
                  >
                    {hasDemo
                      ? '含虚构示例'
                      : view === 'performance'
                        ? '六项表现 · ' + comparable.length + '/6 项可绘制'
                        : ready
                          ? comparable.length + ' 维雷达图'
                          : '等待数据'}
                  </span>
                </div>
                {!isManual && <Tabs
                  value={view}
                  onValueChange={(v) => setView(String(v))}
                  className="chart-tabs"
                >
                  <TabsList className="metric-tabs">
                    <TabsTrigger value="performance">比赛指标</TabsTrigger>
                    <TabsTrigger value="attributes">HLTV 属性</TabsTrigger>
                  </TabsList>
                </Tabs>}
                {isManual && <p className="manual-provenance">{MANUAL_LABEL}</p>}
                <div className="chart-wrap">
                  <Radar
                    metrics={radarMetrics}
                    a={displayed}
                    b={displayedB}
                    nameA={pa?.name || '数据 A'}
                    nameB={pb?.name || '数据 B'}
                    drawKeys={comparable.map((m) => m.key)}
                    bestA={a.bestKeys}
                    bestB={b.bestKeys}
                    colorA={primaryColor}
                    colorB={seriesColors[1]}
                    dataKey={[
                      mode,
                      view,
                      a.data?.importedAt,
                      a.playerId,
                      a.scopeId,
                      b.data?.importedAt,
                      b.playerId,
                      b.scopeId,
                    ].join('|')}
                  />
                  {graphEmpty && view === 'attributes' && (
                    <div className="chart-empty-message">
                      <Info size={19} />
                      <strong>可比较指标不足 3 项</strong>
                      <span>
                        当前范围没有足够的官方属性，请切换比赛指标或导入赛事数据。
                      </span>
                    </div>
                  )}
                </div>
                {isManual && !ready && <p className="manual-provenance" role="status">{Object.keys(manualResult.errors).length ? '请修正左侧无效数值后再导出。' : '至少填写三项雷达指标后即可导出。'}</p>}
                <div className="chart-caption">
                  <span style={{ color: primaryColor }}>
                    <i
                      className="legend-dot"
                      style={{ background: primaryColor }}
                    />
                    A · {pa?.name || '等待选择'}
                  </span>
                  {comp && (
                    <span style={{ color: seriesColors[1] }}>
                      <i
                        className="legend-dot"
                        style={{ background: seriesColors[1] }}
                      />
                      B · {pb?.name || '等待选择'}
                    </span>
                  )}
                </div>
                {[a, ...(comp ? [b] : [])]
                  .flatMap(
                    (s) =>
                      s.data?.notes.filter((n) =>
                        n.startsWith('多杀补读失败'),
                      ) || [],
                  )
                  .map((n, i) => (
                    <output className="chart-note" key={'detail-warning-' + i}>
                      {n}
                    </output>
                  ))}
                <p className="chart-note">
                  {isManual ? MANUAL_LABEL : hasDemo
                    ? '示例数值为虚构数据，不代表真实选手。'
                    : view === 'attributes'
                      ? '属性用于描述打法倾向，并非所有分数都越高越好。'
                      : '外圈为参考满刻度，超出参考值会越出外圈；两份数据共用同一刻度。'}
                  {anyData && excluded.length > 0 && (
                    <span className="excluded-note">
                      未绘制：{excluded.map((m) => m.label).join('、')}
                      （数据缺失或版本不可比）
                    </span>
                  )}
                  {comp && !!pa !== !!pb && (
                    <span className="excluded-note">
                      目前仅显示一侧数据；导入另一侧后自动叠加对比。
                    </span>
                  )}
                </p>
              </section>
            </section>
          </>
        )}{' '}
        {ratingMismatch && (
          <div className="notice">
            <TriangleAlert size={16} />
            <span>
              两份 Rating 版本不同或未标注，已从雷达图排除
              Rating；下方保留原始评分。
            </span>
          </div>
        )}
        <section className={"data-section" + (isManual ? " manual-data-section" : "")}>
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE NUMBERS</div>
              <h2>原始数据</h2>
            </div>
            <div className="section-heading-actions">
              <span className="muted small">{isManual ? '“暂无”表示尚未填写' : '“暂无”表示来源未提供'}</span>
              {anyData && tableMetrics.length > visibleTableMetrics.length && (
                <button
                  className="button secondary compact-button"
                  type="button"
                  onClick={() => setShowAllStats(true)}
                >
                  <Eye size={15} />
                  查看全部 {tableMetrics.length} 项
                </button>
              )}
              {anyData && showAllStats && (
                <button
                  className="button secondary compact-button"
                  type="button"
                  onClick={() => setShowAllStats(false)}
                >
                  收起数据
                </button>
              )}
            </div>
          </div>
          {anyData ? (
            <Table className="stats-table">
              <TableHeader>
                <TableRow>
                  <TableHead>数据指标</TableHead>
                  <TableHead
                    className="text-a"
                    style={{ color: primaryColor }}
                  >
                    A · {pa?.name || '未选择'}
                    <small>
                      {a.data?.scopes.find((x) => x.id === a.scopeId)?.name}
                    </small>
                  </TableHead>
                  {comp && (
                    <TableHead
                      className="text-b"
                      style={{ color: seriesColors[1] }}
                    >
                      B · {pb?.name || '未选择'}
                      <small>
                        {b.data?.scopes.find((x) => x.id === b.scopeId)?.name}
                      </small>
                    </TableHead>
                  )}
                  {comp && <TableHead>差值 A − B</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTableMetrics.map((m) => {
                  const av = sa[m.key],
                    bv = sb[m.key],
                    delta =
                      av !== undefined && bv !== undefined
                        ? av - bv
                        : undefined,
                    noDelta = m.key === 'rating' && ratingMismatch;
                  return (
                    <TableRow key={m.key}>
                      <TableCell>
                        <div className="metric-name">
                          <b>{m.label}</b>
                          <span>{m.name}</span>
                          <Tooltip>
                            <TooltipTrigger
                              className="info-button"
                              aria-label={m.label + '说明'}
                            >
                              <Info size={14} />
                            </TooltipTrigger>
                            <TooltipContent className="metric-tooltip">
                              {m.description}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell
                        className="numeric text-a"
                        style={{ color: primaryColor }}
                      >
                        {format(av, m)}
                      </TableCell>
                      {comp && (
                        <TableCell
                          className="numeric text-b"
                          style={{ color: seriesColors[1] }}
                        >
                          {format(bv, m)}
                        </TableCell>
                      )}
                      {comp && (
                        <TableCell className="numeric muted">
                          {noDelta
                            ? '版本不可比'
                            : delta === undefined
                              ? '暂无'
                              : (delta > 0 ? '+' : '') +
                                delta.toFixed(m.decimals) +
                                (m.unit === '%' ? ' 个百分点' : '')}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="table-empty">
              <div className="empty-grid-icon">
                <Crosshair size={22} />
              </div>
              <p>导入数据后，Rating、ADR、KAST 与火力值将在这里展示。</p>
              <button className="text-button" onClick={showDemo}>
                使用虚构示例体验图表 <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </section>
        <details className="methodology">
          <summary>
            <Info size={16} />
            数据与雷达图说明
          </summary>
          <div className="method-content">
            <p>
              六项表现采用参考视频的非零圆心，按（原值 − 圆心值）÷（外圈值 −
              圆心值）换算半径。实线参考圈表示该轴的参考满刻度；不代表选手百分位，也不是新的综合评分。超标数值按比例越出参考圈，图形视野随之扩展，两份数据共用同一刻度。低于中心端点时画在中心，表格保留原始值。
            </p>
            <div className="scale-grid">
              {broadcastMetrics.map((m) => (
                <div key={m.key}>
                  <b>{m.label}</b>
                  <span>
                    {m.min}–{m.max}
                    {m.unit || ''}
                    {m.inverse ? ' · 反向绘图' : ''}
                  </span>
                </div>
              ))}
            </div>
            <p>
              比赛表现使用未经济校正的 ADR、KAST、击杀等原值；Rating 按 HLTV
              页面版本原样保留。不同版本不作差，也不共同绘图。赛事总评分直接采用
              HLTV 赛事统计，不将单图 Rating 简单平均。
            </p>
            <p>
              六边形依次显示 KPR、存活率、ADR、KAST、多杀回合占比、Rating，Swing
              单独使用正负条形。橙色参考线采用你提供的截图数值，并非实时职业选手平均值。存活率优先使用总死亡与回合数计算；仅有
              DPR 时由 (1−DPR)×100 换算，精度受来源舍入影响。多杀回合占比与 MK
              Rating
              分开记录；缺失时留空，不用零替代。只有当前范围内的官方火力与属性才会显示。缺失值不按零分处理；双方只比较共同拥有的指标。七项属性部分用于描述打法倾向。
            </p>
            <p>
              自动模式优先通过已连接的浏览器扩展读取
              HLTV，否则使用服务器。扩展遇到验证时需要你在 HLTV
              页面完成；服务器遇到 403
              或字段无法识别时会提示失败。页面刷新后不会保留本次数据。
            </p>
            <p>
              <a
                href="https://www.hltv.org/news/42485/introducing-rating-30"
                target="_blank"
                rel="noreferrer"
              >
                HLTV Rating 3.0 说明 ↗
              </a>
              <a
                href="https://www.hltv.org/news/39672/introducing-hltv-attributes"
                target="_blank"
                rel="noreferrer"
              >
                HLTV 属性说明 ↗
              </a>
            </p>
            {[a, ...(comp ? [b] : [])]
              .filter((s) => s.data)
              .map((s, i) => (
                <div className="source-notes" key={i}>
                  <b>
                    数据 {i === 0 ? 'A' : 'B'} · {s.data!.title}
                  </b>
                  {s.data!.notes.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </div>
              ))}
          </div>
        </details>
        <footer className="page-footer">
          <span>
            RADAR / CS2 <span className="muted">· 数据来源 HLTV.org</span>
          </span>
          <span className="muted">独立数据可视化工具 · 非 HLTV 官方产品</span>
        </footer>
      </main>
    </TooltipProvider>
  );
}
