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
  ArrowLeftRight,
  Download,
  Video,
  LoaderCircle,
  Info,
  X,
  TriangleAlert,
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
  attributes,
  extraMetrics,
  demo,
  format,
  sharedMetrics,
  type Dataset,
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
import { manualComparisonState, type ManualSide } from '@/lib/manual-comparison';
import { SourcePanel, ColorEditor, Picker } from '@/components/source-panel';
import {
  emptySlot as empty,
  type Slot,
  type Side,
  type Transport,
} from '@/lib/slot-store';
import { player, stats, context } from '@/lib/slot-view';
import {
  DEFAULT_SERIES_COLORS,
  SERIES_COLOR_PRESETS,
} from '@/lib/series-colors';
import { useSlots } from '@/hooks/use-slots';
import { DonationButton } from '@/components/donation-button';
import { LocalArenaImport } from '@/components/local-arena-import';
import { arenaDataset } from '@/lib/local-arena';
import { ARENA_LABEL, type ArenaPacket } from '@/lib/local-arena-protocol';
export default function Home() {
  const extension = useHltvExtension();
  const manual = useManualDraft();
  const [activeManualSide, setActiveManualSide] = useState<ManualSide>('A');
  const manualCompare = manual.workspace.mode === 'compare';
  const editingManualSide = manualCompare ? activeManualSide : 'A';
  const manualDraft = manual.workspace.drafts[editingManualSide];
  const manualResult = useMemo(() => parseManual(manualDraft), [manualDraft]);
  const manualComparison = useMemo(() => manualComparisonState(manual.workspace), [manual.workspace]);
  const manualDataA = useMemo(() => manualDataset(manual.workspace.drafts.A, 'A', manualCompare), [manual.workspace.drafts.A, manualCompare]);
  const manualDataB = useMemo(() => manualDataset(manual.workspace.drafts.B, 'B', manualCompare), [manual.workspace.drafts.B, manualCompare]);
  const [localDataset, setLocalDataset] = useState<Dataset | null>(null);
  const [transport, setTransport] = useState<Transport>('auto');
  const videoExportLock = useRef(false);
  const sequenceRef = useRef<SequenceRadarHandle>(null);
  const { slots, store } = useSlots();
  const { update, cancel, copySource, toggleBest } = store;
  const clear = (i: number) => store.reset(i);
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
  const arenaActive = !isManual && (mode === 'video'
    ? slots.some(slot => slot.data?.origin?.type === 'local-arena')
    : slots[0].data?.origin?.type === 'local-arena' || (mode === 'compare' && slots[1].data?.origin?.type === 'local-arena'));
  const view = isManual || arenaActive ? 'performance' : importView;
  async function fetchData(
    url: string,
    via: Transport,
    signal: AbortSignal,
    onProgress: (message: string) => void,
  ): Promise<Dataset> {
    if (via === 'extension') return extension.request(url, onProgress, signal);
    onProgress('正在通过服务器读取 HLTV…');
    const res = await fetch('/api/hltv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.any([AbortSignal.timeout(65000), signal]),
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
  function choose(i: number, id: string, scope?: string) {
    return store.choose(i, id, scope, fetchData);
  }
  async function load(i: number, url = store.getSnapshot()[i].url) {
    const via =
      transport === 'auto'
        ? extension.connected
          ? 'extension'
          : 'server'
        : transport;
    const result = await store.load(i, url, via, fetchData);
    if (result) setNotice('');
    return result;
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
    store.showDemo(demo);
    setNotice('当前展示虚构示例。粘贴真实 HLTV 链接可替换任一侧。');
  }
  function moveSlot(i: number, direction: -1 | 1) {
    const j = i + direction;
    if (j < 0 || j > 4) return;
    if (!store.swap(i, j)) return;
    setSeriesColors((colors) => {
      const copy = [...colors];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      try {
        localStorage.setItem('cs2-radar-series-colors', JSON.stringify(copy));
      } catch {}
      return copy;
    });
  }
  const manualSlotA: Slot = {
    ...empty(),
    data: manualDataA,
    playerId: 'manual-A',
    scopeId: 'manual',
    bestKeys: manual.workspace.drafts.A.bestKeys,
  };
  const manualSlotB: Slot = {
    ...empty(), data: manualDataB, playerId: 'manual-B', scopeId: 'manual',
    bestKeys: manual.workspace.drafts.B.bestKeys,
  };
  const a = isManual ? manualSlotA : slots[0],
    b = isManual ? manualSlotB : slots[1],
    pa = player(a),
    pb = player(b),
    sa = stats(a),
    sb = stats(b),
    comp = mode === 'compare' || (isManual && manualCompare),
    isVideo = mode === 'video';
  const primaryColor = isManual ? manual.draft.color : seriesColors[0];
  const secondaryColor = isManual ? manual.workspace.drafts.B.color : seriesColors[1];
  const ms = view === 'performance' ? broadcastMetrics : attributes;
  const bestOptions =
    view === 'performance'
      ? [
          ...broadcastMetrics,
          performance.find((m) => m.key === 'firepower')!,
          performance.find((m) => m.key === 'swing')!,
        ]
      : attributes;
  const comparable = isManual
    ? manualComparison.comparable
    : sharedMetrics(
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
  const ready = isManual
    ? manual.loaded && manualComparison.ready
    : isVideo
      ? sequenceReady
      : comparable.length >= 3;
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
  const tableMetrics = isManual
    ? allTableMetrics.filter((m) => keyMetricKeys.has(m.key))
    : allTableMetrics;
  const visibleTableMetrics = showAllStats
    ? tableMetrics
    : tableMetrics.filter((metric) => keyMetricKeys.has(metric.key));
  const ratingVersionMismatch =
    comp &&
    pa &&
    pb &&
    (pa.ratingVersion !== pb.ratingVersion || pa.ratingVersion === '未标注');
  const ratingMismatch = ratingVersionMismatch && !isManual;
  const manualRatingVersionNotice = isManual && ratingVersionMismatch &&
    Number.isFinite(sa.rating) && Number.isFinite(sb.rating);
  function arenaPlayerId(data: Dataset) {
    return data.players.find(p => p.id === data.origin?.preferredPlayerId)?.id ||
      data.players.find(p => !p.isBot)?.id || data.players[0].id;
  }
  function setArenaSlot(index: number, data: Dataset, id: string) {
    store.reset(index, { ...empty(), data, playerId: id, scopeId: 'all' });
  }
  function importArena(packet: ArenaPacket) {
    if (exporting || exportingVideo || videoExportLock.current || busy || sequencePlaying)
      throw Error('正在读取或导出，请结束后再导入本地对局。');
    const data = arenaDataset(packet);
    setArenaSlot(0, data, arenaPlayerId(data));
    setLocalDataset(data); setMode('single'); setView('performance'); setActiveSlot(0);
    setNotice('Local Arena 全员数据已导入。Rating 为离线模型，非 HLTV 官方评分。');
  }
  function compareArena(id: string) {
    if (!localDataset || exporting || exportingVideo || busy || sequencePlaying) return;
    const ownId = slots[0].data?.id === localDataset.id ? slots[0].playerId : arenaPlayerId(localDataset);
    if (!localDataset.players.some(p => p.id === id) || id === ownId) return;
    setArenaSlot(0, localDataset, ownId); setArenaSlot(1, localDataset, id);
    setMode('compare'); setView('performance'); setActiveSlot(0);
  }
  function videoArena(ids: string[]) {
    if (!localDataset || exporting || exportingVideo || busy || sequencePlaying) return;
    if (ids.length < 2 || ids.length > 5 || new Set(ids).size !== ids.length || ids.some(id => !localDataset.players.some(p => p.id === id))) return;
    ids.forEach((id, index) => setArenaSlot(index, localDataset, id));
    for (let index = ids.length; index < 5; index++) store.reset(index);
    setMode('video'); setView('performance'); setActiveSlot(0);
  }
  async function download() {
    if (!ready || busy || exporting || exportingVideo) return;
    setExporting(true);
    setNotice('');
    try {
      if (!pa) throw new Error('请先选择选手。');
      await exportChart(
        view === 'performance' ? '选手比赛表现' : 'HLTV 选手属性',
        view === 'performance'
          ? [...ms, performance.find((m) => m.key === 'swing')!].filter(m =>
              (!isManual && !arenaActive) || m.key !== 'swing' || Number.isFinite(sa.swing) ||
              (comp && pb && Number.isFinite(sb.swing)))
          : comparable,
        {
          name: pa.name,
          context: context(a),
          source: isManual
            ? MANUAL_LABEL
            : a.data?.origin?.type === 'local-arena' ? ARENA_LABEL : pa.profileUrl || a.data?.sourceUrl || '',
          manual: isManual,
          provenance: a.data?.origin?.type,
          color: primaryColor,
          version: pa.ratingVersion,
          stats: sa,
          demo: !!a.data?.demo,
        },
        comp && pb
          ? {
              name: pb.name,
              context: context(b),
              source: isManual ? MANUAL_LABEL : b.data?.origin?.type === 'local-arena' ? ARENA_LABEL : pb.profileUrl || b.data?.sourceUrl || '',
              manual: isManual,
              provenance: b.data?.origin?.type,
              color: secondaryColor,
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
  const manualRef = useRef(manual.workspace);
  const configRef = useRef({ mode, view });
  useEffect(() => {
    actions.current = { load, choose };
    manualRef.current = manual.workspace;
    configRef.current = { mode, view };
  });
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
      manual: {
        ...manualRef.current.drafts.A,
        ...parseManual(manualRef.current.drafts.A),
        source: MANUAL_LABEL,
      },
      manualComparison: {
        mode: manualRef.current.mode,
        A: { ...manualRef.current.drafts.A, ...parseManual(manualRef.current.drafts.A) },
        B: { ...manualRef.current.drafts.B, ...parseManual(manualRef.current.drafts.B) },
        ready: manualComparisonState(manualRef.current).ready,
        comparableMetrics: manualComparisonState(manualRef.current).comparable.map(m => m.key),
      },
      slots: store.getSnapshot().map((s, i) => ({
        slot: 'ABCDE'[i],
        source: s.data?.sourceUrl || null,
        origin: s.data?.origin || null,
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
            (x.mode &&
              !['single', 'compare', 'video', 'manual'].includes(x.mode))
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
  }, [store]);
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
          <div className="topbar-actions">
            <a
              className="quiet-link"
              href="https://www.hltv.org/stats"
              target="_blank"
              rel="noreferrer"
            >
              HLTV <ArrowUpRight size={16} />
            </a>
            <DonationButton />
          </div>
        </header>
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">PLAYER COMPARISON</div>
            <h1>
              数据雷达图<span className="heading-dot">.</span>
            </h1>
            <p>
              {isManual
                ? manualCompare ? '手动填写两位选手，叠加对比比赛表现并导出。' : '手动填写比赛表现，实时生成雷达图并导出。'
                : isVideo
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
        {!isManual && !arenaActive && (
          <div className="extension-bar">
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
          </div>
        )}
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
            <span className="muted small">{isManual ? '独立手动草稿 · 自动保存' : '跨比赛 · 跨赛事 · 同一选手'}</span>
            {comp && (
              <button
                className="icon-button"
                aria-label="交换两份数据"
                disabled={busy || exporting || exportingVideo || (isManual && !manual.loaded) || (!a.data && !b.data)}
                onClick={() => isManual ? manual.swap() : moveSlot(0, 1)}
              >
                <ArrowLeftRight size={17} />
              </button>
            )}
          </div>
        </div>
        <LocalArenaImport dataset={localDataset}
          currentPlayerId={localDataset && slots[0].data?.id === localDataset.id ? slots[0].playerId : localDataset ? arenaPlayerId(localDataset) : ''}
          disabled={busy || exporting || exportingVideo || sequencePlaying}
          onImport={importArena} onCompare={compareArena} onVideo={videoArena} />
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
              {!arenaActive && <Tabs
                value={view}
                onValueChange={(v) => setView(String(v))}
                className="chart-tabs"
              >
                <TabsList className="metric-tabs">
                  <TabsTrigger value="performance">比赛指标</TabsTrigger>
                  <TabsTrigger value="attributes">HLTV 属性</TabsTrigger>
                </TabsList>
              </Tabs>}
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
                    hideMissingExtras={!!arenaActive}
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
              className={
                'comparison-workspace ' +
                (!comp ? 'single' : '') +
                (isManual ? ' manual-workspace' : '')
              }
            >
              <div className="control-console">
                <div className="console-heading">
                  <div>
                    <span className="eyebrow">DATA CONTROL</span>
                    <h2>数据控制台</h2>
                  </div>
                  <SlidersHorizontal size={18} />
                </div>
                {isManual && (
                  <fieldset className="manual-mode-controls" aria-label="手动展示模式">
                    <button type="button" aria-pressed={!manualCompare}
                      disabled={!manual.loaded || exporting || exportingVideo}
                      onClick={() => manual.setMode('single')}>单人展示</button>
                    <button type="button" aria-pressed={manualCompare}
                      disabled={!manual.loaded || exporting || exportingVideo}
                      onClick={() => manual.setMode('compare')}>双人对比</button>
                  </fieldset>
                )}
                {comp && (
                  <div
                    className="slot-switch"
                    role="tablist"
                    aria-label="选择编辑的数据"
                  >
                    {[0, 1].map((i) => {
                      const side = i === 0 ? 'A' : 'B';
                      const selectedPlayer = player(isManual ? (i === 0 ? a : b) : slots[i]);
                      const selected = isManual ? editingManualSide === side : activeSlot === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          data-active={selected || undefined}
                          disabled={exporting || exportingVideo || (isManual && !manual.loaded)}
                          onClick={() => isManual ? setActiveManualSide(side) : setActiveSlot(i)}
                        >
                          <span style={{ background: i === 0 ? primaryColor : secondaryColor }}>
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
                {isManual ? (
                  <ManualEditor
                    draft={manualDraft}
                    onChange={(draft) => manual.setSideDraft(editingManualSide, draft)}
                    side={editingManualSide}
                    compare={manualCompare}
                    onClear={() => manual.clearSide(editingManualSide)}
                    errors={manualResult.errors}
                    count={manualResult.count}
                    storageMessage={manual.storageMessage}
                    disabled={!manual.loaded || exporting || exportingVideo}
                    colors={
                      <ColorEditor
                        side={editingManualSide === 'A' ? 'a' : 'b'}
                        color={manualDraft.color}
                        onChange={(color) =>
                          manual.setSideDraft(editingManualSide, (d) => ({ ...d, color }))
                        }
                      />
                    }
                  />
                ) : !comp || activeSlot === 0 ? (
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
                {!isManual && !arenaActive && (
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
                )}
                {isManual && (
                  <p className="manual-provenance">{MANUAL_LABEL}</p>
                )}
                <div className="chart-wrap">
                  <Radar
                    metrics={radarMetrics}
                    a={displayed}
                    b={displayedB}
                    nameA={pa?.name || '数据 A'}
                    nameB={pb?.name || '数据 B'}
                    drawKeys={comparable.map((m) => m.key)}
                    hideMissingExtras={isManual || arenaActive}
                    bestA={a.bestKeys}
                    bestB={b.bestKeys}
                    colorA={primaryColor}
                    colorB={secondaryColor}
                    dataKey={[
                      mode,
                      isManual ? manual.workspace.mode : '',
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
                {isManual && !ready && (
                  <output className="manual-provenance">
                    {manualComparison.message}
                  </output>
                )}
                <div className="chart-caption">
                  <span style={{ color: primaryColor }}>
                    <i
                      className="legend-dot"
                      style={{ background: primaryColor }}
                    />
                    A · {pa?.name || '等待选择'}
                  </span>
                  {comp && (
                    <span style={{ color: secondaryColor }}>
                      <i
                        className="legend-dot"
                        style={{ background: secondaryColor }}
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
                  {isManual
                    ? MANUAL_LABEL
                    : arenaActive
                      ? ARENA_LABEL + ' · 离线评分模型，非 HLTV 官方数据'
                    : hasDemo
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
        {manualRatingVersionNotice && (
          <div className="notice">
            <TriangleAlert size={16} />
            <span>Rating 按手动填写值比较；两侧版本未统一或未标注。</span>
          </div>
        )}
        <section
          className={'data-section' + (isManual ? ' manual-data-section' : '')}
        >
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE NUMBERS</div>
              <h2>原始数据</h2>
            </div>
            <div className="section-heading-actions">
              <span className="muted small">
                {isManual ? '“暂无”表示尚未填写' : '“暂无”表示来源未提供'}
              </span>
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
                  <TableHead className="text-a" style={{ color: primaryColor }}>
                    A · {pa?.name || '未选择'}
                    <small>
                      {a.data?.scopes.find((x) => x.id === a.scopeId)?.name}
                    </small>
                  </TableHead>
                  {comp && (
                    <TableHead
                      className="text-b"
                      style={{ color: secondaryColor }}
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
                              {arenaActive && m.key === 'rating' ? 'Local Arena 离线评分模型，与 HLTV 官方 Rating 不同。' : m.description}
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
                          style={{ color: secondaryColor }}
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
