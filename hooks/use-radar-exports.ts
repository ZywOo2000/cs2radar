'use client';
import type { RefObject } from 'react';
import type { Metric, Player, Stats } from '@/lib/stats';
import { performance } from '@/lib/stats';
import type { Slot } from '@/lib/slot-store';
import { context } from '@/lib/slot-view';
import { ARENA_LABEL } from '@/lib/local-arena-protocol';
import { MANUAL_LABEL } from '@/lib/manual-data';
import { exportChart } from '@/lib/export-chart';
import { exportDynamicVideo } from '@/lib/export-video';
import { exportSequenceVideo } from '@/lib/export-sequence-video';
import type { SequenceRadarHandle } from '@/components/sequence-radar';
import type { SequenceParticipant } from '@/lib/video-sequence';

type Args = {
  ready: boolean; busy: boolean; exporting: boolean; exportingVideo: boolean; isVideo: boolean;
  sequenceReady: boolean; isManual: boolean; arenaActive: boolean; comp: boolean; view: string;
  ms: Metric[]; comparable: Metric[]; a: Slot; b: Slot; pa: Player | undefined; pb: Player | undefined;
  sa: Stats; sb: Stats; primaryColor: string; secondaryColor: string;
  createSequenceExport: () => Promise<{ controller: SequenceRadarHandle; people: SequenceParticipant[] }>;
  releaseSequenceExport: () => void; isSourceBusy: () => boolean; exportLock: RefObject<boolean>;
  setExporting: (value: boolean) => void; setExportingVideo: (value: boolean) => void;
  setVideoProgress: (value: number) => void; setNotice: (value: string) => void;
};
export function useRadarExports({ ready, busy, exporting, exportingVideo, isVideo, sequenceReady, isManual,
  arenaActive, comp, view, ms, comparable, a, b, pa, pb, sa, sb, primaryColor, secondaryColor,
  createSequenceExport, releaseSequenceExport, isSourceBusy, exportLock, setExporting, setExportingVideo, setVideoProgress, setNotice }: Args) {
  async function download() {
    if (exportLock.current || !ready || busy || isSourceBusy() || exporting || exportingVideo) return;
    exportLock.current = true;
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
      exportLock.current = false;
      setExporting(false);
    }
  }
  async function downloadVideo() {
    if (exportLock.current || !ready || busy || isSourceBusy() || exporting) return;
    exportLock.current = true;
    setExportingVideo(true);
    setVideoProgress(0);
    setNotice('');
    try {
      if (isVideo) {
        if (!sequenceReady)
          throw new Error('至少选择两人，且共同可绘制指标不少于三项。');
        const snapshot = await createSequenceExport();
        const result = await exportSequenceVideo(
          view === 'performance' ? '选手比赛表现' : 'HLTV 选手属性',
          snapshot.people,
          snapshot.controller,
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
        { name: pa.name, context: context(a), color: primaryColor },
        comp && pb ? { name: pb.name, context: context(b), color: secondaryColor } : undefined,
        setVideoProgress,
      );
      setNotice(
        `动态视频已生成：${result.fileName}（${result.format}，浏览器将开始下载）`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '视频导出失败，请重试。');
    } finally {
      if (isVideo) releaseSequenceExport();
      exportLock.current = false;
      setExportingVideo(false);
      setVideoProgress(0);
    }
  }
  return { download, downloadVideo };
}
