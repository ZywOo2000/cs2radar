import {
  pickRadarMotion,
  RADAR_RING_EXPAND_MS,
  RADAR_RING_PAUSE_MS,
  radarRingProgress,
  type RadarMotionKind,
} from './radar-motion';
import {
  bestRevealOpacity,
  interpolatePolygonPoints,
  supportedVideoMime,
  videoCanvasSize,
  videoFileName,
  videoFrameGeometry,
} from './export-video-utils';
import { applyRadarViewBox, copyRadarTextBounds } from './radar-bounds';
import { freezeVideoFrame, holdFinalVideoFrame } from './video-final-hold';

export type ExportSide = { name: string; context: string };
export type VideoExportResult = {
  format: 'MP4' | 'WebM';
  fileName: string;
  motion: RadarMotionKind;
};

const NS = 'http://www.w3.org/2000/svg';
const escape = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
const ease = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
const waitFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

async function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  width: number,
  height: number,
) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('视频画面生成失败，请重试。'));
      image.src = url;
    });
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function videoFrame(
  clone: SVGSVGElement,
  graphWidth: number,
  graphHeight: number,
  title: string,
  a: ExportSide,
  b?: ExportSide,
) {
  const {
    width: outerWidth,
    height: totalHeight,
    header,
    scale,
    graphX,
  } = videoFrameGeometry(graphWidth, graphHeight);
  const xml = new XMLSerializer().serializeToString(clone);
  const text = (
    x: number,
    y: number,
    value: string,
    size: number,
    color: string,
    weight = 400,
  ) =>
    `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Microsoft YaHei, sans-serif" font-size="${size}" font-weight="${weight}">${escape(value)}</text>`;
  const legendB = b
    ? text(
        600,
        133,
        `B · ${b.name} · ${b.context}`.slice(0, 82),
        17,
        '#61dac8',
        600,
      )
    : '';
  return {
    width: outerWidth,
    height: totalHeight,
    svg: `<svg xmlns="${NS}" width="${outerWidth}" height="${totalHeight}" viewBox="0 0 ${outerWidth} ${totalHeight}"><rect width="${outerWidth}" height="${totalHeight}" fill="#151e28"/>${text(50, 48, 'RADAR / CS2', 20, '#bddbff', 600)}${text(50, 91, title, 31, '#eef4fb', 600)}${text(50, 133, `A · ${a.name} · ${a.context}`.slice(0, 82), 17, '#bddbff', 600)}${legendB}<g transform="translate(${graphX} ${header}) scale(${scale})">${xml}</g></svg>`,
  };
}

export async function exportDynamicVideo(
  title: string,
  a: ExportSide,
  b: ExportSide | undefined,
  onProgress: (value: number) => void = () => {},
): Promise<VideoExportResult> {
  const live = document.getElementById('performance-radar');
  if (!(live instanceof SVGSVGElement)) throw new Error('雷达图尚未就绪。');
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  )
    throw new Error('当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge。');
  const mime = supportedVideoMime((type) =>
    MediaRecorder.isTypeSupported(type),
  );
  if (!mime)
    throw new Error(
      '当前浏览器没有可用的视频编码器，请使用最新版 Chrome 或 Edge。',
    );

  const clone = live.cloneNode(true) as SVGSVGElement;
  copyRadarTextBounds(live, clone);
  clone.querySelectorAll<SVGAnimateElement>('animate').forEach((animation) => {
    const attribute = animation.getAttribute('attributeName'),
      target = animation.getAttribute('to');
    if (attribute && target)
      animation.parentElement?.setAttribute(attribute, target);
    animation.remove();
  });
  clone
    .querySelectorAll(
      '.radar-motion-center,.radar-motion-rings,.radar-motion-bar,.radar-best-motion',
    )
    .forEach((node) =>
      node.classList.remove(
        'radar-motion-center',
        'radar-motion-rings',
        'radar-motion-bar',
        'radar-best-motion',
        'radar-best-center',
        'radar-best-rings',
      ),
    );
  clone.removeAttribute('class');
  clone.removeAttribute('data-display-mode');
  clone.removeAttribute('data-motion-kind');
  clone.removeAttribute('data-motion-run');
  const center = {
    x: Number(clone.getAttribute('data-radar-center-x') || 300),
    y: Number(clone.getAttribute('data-radar-center-y') || 244),
  };
  const bounds = applyRadarViewBox(clone);
  const graphWidth = bounds.width,
    graphHeight = bounds.height;
  const series = [
    ...clone.querySelectorAll<SVGGElement>(
      '[data-series="A"],[data-series="B"]',
    ),
  ];
  if (!series.length) throw new Error('当前数据图没有可导出的数据区域。');
  const original = series.map((node) => ({
    node,
    transform: node.getAttribute('transform'),
    clip: node.getAttribute('clip-path'),
  }));
  const innerPoints =
    clone
      .querySelector<SVGPolygonElement>('[data-reference-ring="20"]')
      ?.getAttribute('points') || '';
  const polygons = series
    .flatMap((node) => [...node.querySelectorAll<SVGPolygonElement>('polygon')])
    .map((node) => ({
      node,
      final:
        node.getAttribute('data-final-points') ||
        node.getAttribute('points') ||
        '',
    }));
  const lines = series
    .flatMap((node) => [...node.querySelectorAll<SVGLineElement>('line')])
    .map((node) => ({
      node,
      axisFrom: Number(node.getAttribute('data-axis-from')),
      axisTo: Number(node.getAttribute('data-axis-to')),
      final: [
        Number(node.getAttribute('data-final-x1') || node.getAttribute('x1')),
        Number(node.getAttribute('data-final-y1') || node.getAttribute('y1')),
        Number(node.getAttribute('data-final-x2') || node.getAttribute('x2')),
        Number(node.getAttribute('data-final-y2') || node.getAttribute('y2')),
      ],
    }));
  const circles = series
    .flatMap((node) => [...node.querySelectorAll<SVGCircleElement>('circle')])
    .map((node) => ({
      node,
      axis: Number(node.getAttribute('data-axis')),
      final: [
        Number(node.getAttribute('data-final-cx') || node.getAttribute('cx')),
        Number(node.getAttribute('data-final-cy') || node.getAttribute('cy')),
      ],
    }));
  const inner = innerPoints
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number));
  const bars = [
    ...clone.querySelectorAll<SVGRectElement>('[data-swing] rect'),
  ].map((node) => ({
    node,
    x: Number(node.getAttribute('x') || 500),
    width: Number(node.getAttribute('width') || 0),
  }));
  const bestNodes = [
    ...clone.querySelectorAll<SVGElement>('[data-best-motion]'),
  ].map((node) => ({ node, opacity: node.getAttribute('opacity') }));
  const motion = pickRadarMotion();
  const setProgress = (raw: number) => {
    const progress = ease(Math.max(0, Math.min(1, raw)));
    original.forEach(({ node, transform, clip: oldClip }) => {
      if (raw >= 1) {
        if (transform === null) node.removeAttribute('transform');
        else node.setAttribute('transform', transform);
        if (oldClip === null) node.removeAttribute('clip-path');
        else node.setAttribute('clip-path', oldClip);
        return;
      }
      if (motion === 'center') {
        node.setAttribute(
          'transform',
          `translate(${center.x} ${center.y}) scale(${Math.max(0.002, progress)}) translate(${-center.x} ${-center.y})`,
        );
        node.removeAttribute('clip-path');
      } else {
        if (transform === null) node.removeAttribute('transform');
        else node.setAttribute('transform', transform);
        node.removeAttribute('clip-path');
      }
    });
    if (motion === 'rings') {
      polygons.forEach(({ node, final }) =>
        node.setAttribute(
          'points',
          interpolatePolygonPoints(innerPoints, final, progress),
        ),
      );
      lines.forEach(({ node, axisFrom, axisTo, final }) => {
        const start = inner[axisFrom],
          end = inner[axisTo];
        if (!start || !end) return;
        const values = [
          start[0] + (final[0] - start[0]) * progress,
          start[1] + (final[1] - start[1]) * progress,
          end[0] + (final[2] - end[0]) * progress,
          end[1] + (final[3] - end[1]) * progress,
        ];
        ['x1', 'y1', 'x2', 'y2'].forEach((attribute, index) =>
          node.setAttribute(attribute, String(values[index])),
        );
      });
      circles.forEach(({ node, axis, final }) => {
        const start = inner[axis];
        if (!start) return;
        node.setAttribute(
          'cx',
          String(start[0] + (final[0] - start[0]) * progress),
        );
        node.setAttribute(
          'cy',
          String(start[1] + (final[1] - start[1]) * progress),
        );
      });
    } else {
      polygons.forEach(({ node, final }) => node.setAttribute('points', final));
      lines.forEach(({ node, final }) =>
        ['x1', 'y1', 'x2', 'y2'].forEach((attribute, index) =>
          node.setAttribute(attribute, String(final[index])),
        ),
      );
      circles.forEach(({ node, final }) => {
        node.setAttribute('cx', String(final[0]));
        node.setAttribute('cy', String(final[1]));
      });
    }
    bars.forEach(({ node, x, width }) => {
      const current = width * progress;
      node.setAttribute('width', String(current));
      node.setAttribute('x', String(x < 500 ? 500 - current : 500));
    });
    bestNodes.forEach(({ node, opacity }) => {
      if (raw >= 1) {
        if (opacity === null) node.removeAttribute('opacity');
        else node.setAttribute('opacity', opacity);
      } else node.setAttribute('opacity', String(bestRevealOpacity(progress)));
    });
  };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const expansionMs = reduced
    ? 450
    : motion === 'rings'
      ? RADAR_RING_EXPAND_MS
      : 1650;
  const pauseMs = motion === 'rings' ? RADAR_RING_PAUSE_MS : 0;
  const animationMs = pauseMs + expansionMs;
  setProgress(0);
  let frame = videoFrame(clone, graphWidth, graphHeight, title, a, b);
  const canvas = document.createElement('canvas');
  const canvasSize = videoCanvasSize(frame.width, frame.height);
  canvas.width = canvasSize.width;
  canvas.height = canvasSize.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('浏览器无法创建视频画布。');
  await drawSvg(ctx, frame.svg, canvas.width, canvas.height);
  const stream = canvas.captureStream(30);
  const chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
    });
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error('视频编码器启动失败，请更新浏览器后重试。');
  }
  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error('录制视频时发生错误，请重试。'));
    recorder.onstop = () =>
      chunks.length
        ? resolve(new Blob(chunks, { type: recorder.mimeType || mime }))
        : reject(new Error('浏览器没有生成视频数据，请重试。'));
  });
  try {
    onProgress(1);
    recorder.start(100);
    const start = performance.now();
    let elapsed = 0;
    while (elapsed < animationMs) {
      elapsed = performance.now() - start;
      setProgress(
        motion === 'rings'
          ? radarRingProgress(elapsed, expansionMs)
          : elapsed / animationMs,
      );
      frame = videoFrame(clone, graphWidth, graphHeight, title, a, b);
      await drawSvg(ctx, frame.svg, canvas.width, canvas.height);
      onProgress(Math.min(70, Math.round((elapsed / animationMs) * 70)));
      await waitFrame();
    }
    setProgress(1);
    frame = videoFrame(clone, graphWidth, graphHeight, title, a, b);
    const finalFrame = frame.svg,
      track = stream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;
    await drawSvg(ctx, finalFrame, canvas.width, canvas.height);
    await holdFinalVideoFrame({
      drawFrame: freezeVideoFrame(ctx),
      requestFrame: () => track?.requestFrame?.(),
      onProgress: (fraction) => onProgress(70 + Math.round(fraction * 25)),
    });
    recorder.stop();
    const blob = await recording;
    onProgress(97);
    const actual = (recorder.mimeType || mime).toLowerCase();
    const mp4 = actual.startsWith('video/mp4');
    const extension = mp4 ? 'mp4' : 'webm';
    const fileName = videoFileName(!!b, new Date(), extension);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onProgress(100);
    return { format: mp4 ? 'MP4' : 'WebM', fileName, motion };
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
    canvas.width = 1;
    canvas.height = 1;
  }
}
