import type { SequenceRadarHandle } from '@/components/sequence-radar';
import { radarViewBox, type RadarViewBox } from './radar-bounds';
import { assertFiniteRadarGeometry } from './radar-snapshot';
import { createVideoRecorder, supportedVideoMime } from './export-video-utils';
import { pickRadarMotion, type RadarMotionKind } from './radar-motion';
import {
  SEQUENCE_VIDEO_FRAME,
  sequenceExportFrameMarkup,
  unionRadarBoxes,
} from './sequence-export-frame';
import {
  sequenceArrivalTime,
  sequenceDuration,
  sequenceVideoFileName,
  type SequenceParticipant,
} from './video-sequence';

export type SequenceVideoResult = {
  format: 'MP4' | 'WebM';
  fileName: string;
  motion: RadarMotionKind;
};
import { freezeVideoFrame, holdFinalVideoFrame } from './video-final-hold';
const waitFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));
async function drawSvg(
  ctx: CanvasRenderingContext2D,
  svg: string,
  w: number,
  h: number,
) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }),
    url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    await new Promise<void>((ok, bad) => {
      image.onload = () => ok();
      image.onerror = () => bad(new Error('视频画面生成失败。'));
      image.src = url;
    });
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function clean(live: SVGSVGElement, box: RadarViewBox) {
  assertFiniteRadarGeometry(live);
  const clone = live.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('animate,title,desc').forEach((n) => n.remove());
  clone
    .querySelectorAll(
      '.radar-motion-center,.radar-motion-rings,.radar-motion-bar,.radar-best-motion',
    )
    .forEach((n) => n.removeAttribute('class'));
  clone.removeAttribute('aria-label');
  clone.removeAttribute('role');
  clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  clone.setAttribute('width', String(box.width));
  clone.setAttribute('height', String(box.height));
  const bg = Array.from(clone.children).find(
    (n) => n.tagName.toLowerCase() === 'rect',
  );
  if (bg) {
    bg.setAttribute('x', String(box.x));
    bg.setAttribute('y', String(box.y));
    bg.setAttribute('width', String(box.width));
    bg.setAttribute('height', String(box.height));
    bg.setAttribute('rx', '0');
  }
  return clone;
}
function compose(clone: SVGSVGElement, box: RadarViewBox) {
  return sequenceExportFrameMarkup(
    new XMLSerializer().serializeToString(clone),
    box,
  );
}

export async function exportSequenceVideo(
  _title: string,
  people: SequenceParticipant[],
  controller: SequenceRadarHandle,
  onProgress: (n: number) => void = () => {},
): Promise<SequenceVideoResult> {
  if (people.length < 2) throw new Error('视频模式至少需要两位选手。');
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof HTMLCanvasElement.prototype.captureStream !== 'function'
  )
    throw new Error('当前浏览器不支持视频导出，请使用最新版 Chrome 或 Edge。');
  let mime = supportedVideoMime((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error('当前浏览器没有可用的视频编码器。');
  const prepareStarted = performance.now();
  while (controller.isPrepared && !controller.isPrepared()) {
    if (performance.now() - prepareStarted > 10000) throw new Error('视频画面初始化超时，请重试。');
    await waitFrame();
  }
  controller.stop();
  const motion = pickRadarMotion(),
    boxes: RadarViewBox[] = [];
  for (let i = 0; i < people.length; i++) {
    await controller.renderAt(sequenceArrivalTime(i, motion), motion);
    const svg = controller.getSvg();
    if (!svg) throw new Error('雷达图尚未就绪。');
    boxes.push(radarViewBox(svg));
  }
  const box = unionRadarBoxes(boxes),
    duration = sequenceDuration(people.length, motion),
    animationMs = sequenceArrivalTime(people.length - 1, motion);
  await controller.renderAt(0, motion);
  let live = controller.getSvg();
  if (!live) throw new Error('雷达图尚未就绪。');
  let frame = compose(clean(live, box), box);
  const canvas = document.createElement('canvas');
  canvas.width = SEQUENCE_VIDEO_FRAME.width;
  canvas.height = SEQUENCE_VIDEO_FRAME.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('浏览器无法创建视频画布。');
  await drawSvg(ctx, frame, canvas.width, canvas.height);
  const stream = canvas.captureStream(30),
    chunks: Blob[] = [];
  let recorder: MediaRecorder;
  try {
    ({recorder, mime} = createVideoRecorder(stream));
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('视频编码器启动失败。');
  }
  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error('录制视频时发生错误。'));
    recorder.onstop = () =>
      chunks.length
        ? resolve(new Blob(chunks, { type: recorder.mimeType || mime }))
        : reject(new Error('浏览器没有生成视频数据。'));
  });
  try {
    recorder.start(100);
    const start = performance.now();
    let elapsed = 0;
    while (elapsed < animationMs) {
      elapsed = performance.now() - start;
      await controller.renderAt(Math.min(elapsed, animationMs), motion);
      live = controller.getSvg();
      if (!live) throw new Error('雷达图渲染中断。');
      frame = compose(clean(live, box), box);
      await drawSvg(ctx, frame, canvas.width, canvas.height);
      onProgress(
        Math.min(
          96,
          Math.round((Math.min(elapsed, animationMs) / duration) * 96),
        ),
      );
      await waitFrame();
    }
    await controller.renderAt(animationMs, motion);
    live = controller.getSvg();
    if (!live) throw new Error('雷达图渲染中断。');
    const finalFrame = compose(clean(live, box), box),
      track = stream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;
    await drawSvg(ctx, finalFrame, canvas.width, canvas.height);
    await holdFinalVideoFrame({
      drawFrame: freezeVideoFrame(ctx),
      requestFrame: () => track?.requestFrame?.(),
      onProgress: (fraction) =>
        onProgress(
          Math.min(
            96,
            Math.round(
              ((animationMs + fraction * (duration - animationMs)) / duration) *
                96,
            ),
          ),
        ),
    });
    recorder.stop();
    const blob = await recording,
      actual = (recorder.mimeType || mime).toLowerCase(),
      mp4 = actual.startsWith('video/mp4'),
      ext = mp4 ? 'mp4' : 'webm',
      fileName = sequenceVideoFileName(people.length, new Date(), ext),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onProgress(100);
    return { format: mp4 ? 'MP4' : 'WebM', fileName, motion };
  } finally {
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    canvas.width = 1;
    canvas.height = 1;
  }
}
