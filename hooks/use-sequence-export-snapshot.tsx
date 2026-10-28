'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SequenceRadar, type SequenceRadarHandle } from '@/components/sequence-radar';
import type { Metric } from '@/lib/stats';
import type { SequenceParticipant } from '@/lib/video-sequence';

type Snapshot = {
  people: SequenceParticipant[];
  metrics: Metric[];
  drawKeys: string[];
  hideMissingExtras: boolean;
};
type Pending = {
  resolve: (handle: SequenceRadarHandle) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

/** Render the recording from a separate immutable snapshot, not the editable preview. */
export function useSequenceExportSnapshot(
  people: SequenceParticipant[], metrics: Metric[], drawKeys: string[], hideMissingExtras: boolean,
) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const pendingMount = useRef<Pending | null>(null);
  const attach = useCallback((handle: SequenceRadarHandle | null) => {
    const pending = pendingMount.current;
    if (!handle || !pending) return;
    clearTimeout(pending.timer);
    pendingMount.current = null;
    pending.resolve(handle);
  }, []);
  const createSequenceExport = async () => {
    const fixedPeople = people.map(p => ({ ...p, stats: { ...p.stats }, bestKeys: [...p.bestKeys] }));
    const fixedMetrics = metrics.map(m => ({ ...m }));
    const controller = await new Promise<SequenceRadarHandle>((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingMount.current = null;
        reject(new Error('视频画面初始化超时，请重试。'));
      }, 10000);
      pendingMount.current = { resolve, reject, timer };
      setSnapshot({ people: fixedPeople, metrics: fixedMetrics, drawKeys: [...drawKeys], hideMissingExtras });
    });
    return { controller, people: fixedPeople };
  };
  const releaseSequenceExport = () => {
    const pending = pendingMount.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingMount.current = null;
      pending.reject(new Error('视频画面已关闭。'));
    }
    setSnapshot(null);
  };
  useEffect(() => () => {
    const pending = pendingMount.current;
    if (pending) {
      clearTimeout(pending.timer);
      pendingMount.current = null;
      pending.reject(new Error('视频画面已关闭。'));
    }
  }, []);
  const renderer = snapshot && (
    <div aria-hidden="true" style={{ position: 'fixed', left: '-10000px', top: 0, width: '1100px', visibility: 'hidden', pointerEvents: 'none' }}>
      <SequenceRadar ref={attach} people={snapshot.people} metrics={snapshot.metrics}
        drawKeys={snapshot.drawKeys} hideMissingExtras={snapshot.hideMissingExtras} />
    </div>
  );
  return { createSequenceExport, releaseSequenceExport, renderer };
}
