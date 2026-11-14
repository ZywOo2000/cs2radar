'use client';
import {
  forwardRef,
  useCallback,
  useMemo,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { collectSequenceMeasurements } from '@/lib/sequence-preparation';
import { flushSync } from 'react-dom';
import type {RadarBackground} from '@/lib/radar-background';
import {applyRadarAmbient} from '@/lib/radar-ambient';
import { Radar } from './radar';
import { pickRadarMotion, type RadarMotionKind } from '@/lib/radar-motion';
import { radarViewBox, type RadarViewBox } from '@/lib/radar-bounds';
import { unionRadarBoxes } from '@/lib/sequence-export-frame';
import {
  sequenceArrivalTime,
  sequenceDuration,
  sequenceFrameAt,
  type SequenceFrame,
  type SequenceParticipant,
} from '@/lib/video-sequence';
import { performance as performanceMetrics, type Metric } from '@/lib/stats';

export type SequenceRadarHandle = {
  play: () => void;
  stop: () => void;
  renderAt: (
    elapsed: number,
    motion: RadarMotionKind,
  ) => Promise<SequenceFrame>;
  getSvg: () => SVGSVGElement | null;
  isPrepared?: () => boolean;
};

export const SequenceRadar = forwardRef<
  SequenceRadarHandle,
  {
    background?: RadarBackground;
    people: SequenceParticipant[];
    metrics: Metric[];
    onPlaying?: (value: boolean) => void;
    hideMissingExtras?: boolean;
    drawKeys?: string[];
  }
>(function SequenceRadar({ background, people, metrics, onPlaying, hideMissingExtras = false, drawKeys }, ref) {
  const timelineMetrics = useMemo(() => {
    const extras = metrics.some((m) => m.key === 'multiKillPct')
      ? performanceMetrics.filter(
          (m) =>
            ['firepower', 'swing'].includes(m.key) &&
            people.some((p) => Number.isFinite(p.stats[m.key])),
        )
      : [];
    return [...metrics.filter(m => !drawKeys || drawKeys.includes(m.key)), ...extras];
  }, [metrics, people, drawKeys]);
  const initial = useMemo(
    () =>
      sequenceFrameAt(
        people,
        timelineMetrics,
        sequenceDuration(people.length, 'rings'),
        'rings',
      ),
    [people, timelineMetrics],
  );
  const [frame, setFrame] = useState(initial),
    [previewBox, setPreviewBox] = useState<RadarViewBox>({
      x: 0,
      y: 0,
      width: 600,
      height: 500,
    }),
    [prepared, setPrepared] = useState(false),
    raf = useRef(0),
    run = useRef(0),
    host = useRef<HTMLDivElement>(null);
  const ambientTime = useRef(0);
  const renderAt = async (elapsed: number, motion: RadarMotionKind) => {
    const next = sequenceFrameAt(people, timelineMetrics, elapsed, motion);
    ambientTime.current=elapsed;
    flushSync(() => setFrame(next));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    return next;
  };
  const stop = useCallback(() => {
    run.current++;
    cancelAnimationFrame(raf.current);
    onPlaying?.(false);
  }, [onPlaying]);
  const play = () => {
    stop();
    if (people.length < 2) return;
    const id = ++run.current,
      motion = pickRadarMotion(),
      duration = sequenceDuration(people.length, motion),
      started = performance.now();
    onPlaying?.(true);
    const tick = () => {
      if (run.current !== id) return;
      const elapsed = performance.now() - started;
      ambientTime.current=Math.min(elapsed,sequenceArrivalTime(people.length-1,motion));
      setFrame(sequenceFrameAt(people, timelineMetrics, elapsed, motion));
      if (elapsed < duration) raf.current = requestAnimationFrame(tick);
      else onPlaying?.(false);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const [preparationError, setPreparationError] = useState('');
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const boxes = await collectSequenceMeasurements(
        people.length,
        (i) => {
          setPrepared(false);
          flushSync(() =>
            setFrame(
              sequenceFrameAt(
                people,
                timelineMetrics,
                sequenceArrivalTime(i, 'rings'),
                'rings',
              ),
            ),
          );
        },
        () => {
          const svg =
            host.current?.querySelector<SVGSVGElement>('#performance-radar');
          return svg ? radarViewBox(svg) : undefined;
        },
        () => active,
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          ),
      );
      if (!active || boxes === null) return;
      setPreviewBox(unionRadarBoxes(boxes));
      ambientTime.current=0;
      setFrame(initial);
      setPrepared(true);
      setPreparationError('');
    };
    void prepare().catch((error) => {
      if (active)
        setPreparationError(
          error instanceof Error ? error.message : '视频预览初始化失败。',
        );
    });
    return () => {
      active = false;
      stop();
    };
  }, [people, timelineMetrics, initial, stop]);
  useLayoutEffect(() => {
    if (!prepared) return;
    const svg =
      host.current?.querySelector<SVGSVGElement>('#performance-radar');
    if (svg) {
      applyRadarAmbient(svg,matchMedia('(prefers-reduced-motion: reduce)').matches?0:ambientTime.current);
      svg.setAttribute(
        'viewBox',
        `${previewBox.x} ${previewBox.y} ${previewBox.width} ${previewBox.height}`,
      );
    }
  }, [frame, previewBox, prepared, background]);
  useImperativeHandle(ref, () => ({
    play,
    stop,
    renderAt,
    getSvg: () =>
      host.current?.querySelector<SVGSVGElement>('#performance-radar') || null,
    isPrepared: () => host.current?.getAttribute('data-prepared') === 'true',
  }));
  const from = people[frame.fromIndex] || people[0],
    to = people[frame.toIndex] || from;
  return (
    <div
      ref={host}
      id="sequence-radar-host"
      className="sequence-radar-host"
      data-prepared={prepared || undefined}
    >
      {preparationError && (
        <output className="error-box">{preparationError}</output>
      )}
      <div className="sequence-stage-title">
        <span>
          {people.length
            ? `${Math.max(frame.fromIndex, frame.toIndex) + 1} / ${people.length}`
            : '0 / 0'}
        </span>
        <div className="sequence-name-stack">
          <div style={{ opacity: frame.nameFromOpacity }}>
            <strong>{from?.name || '等待数据'}</strong>
            <small>{from?.context}</small>
          </div>
          {frame.toIndex !== frame.fromIndex && (
            <div style={{ opacity: frame.nameToOpacity }}>
              <strong>{to?.name}</strong>
              <small>{to?.context}</small>
            </div>
          )}
        </div>
      </div>
      <div className="sequence-export-frame">
        <Radar
          background={background}
          metrics={metrics}
          a={frame.stats}
          nameA={to?.name || from?.name || '视频序列'}
          drawKeys={drawKeys || metrics.map((m) => m.key)}
          bestA={frame.bestKeys}
          colorA={frame.color}
          dataKey="sequence-controlled-static"
          showControls={false}
          hideMissingExtras={hideMissingExtras || timelineMetrics.some(m => m.key === 'swing' || m.key === 'firepower')}
          bestOpacity={frame.bestOpacity}
          metricOpacity={frame.metricOpacity}
        />
      </div>
    </div>
  );
});
