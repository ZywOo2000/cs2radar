export const VIDEO_FINAL_HOLD_MS = 1000;

type FinalHoldOptions = {
  drawFrame: () => void | Promise<void>;
  requestFrame?: () => void;
  onProgress?: (fraction: number) => void;
  now?: () => number;
  nextFrame?: () => Promise<unknown>;
};

/** Freeze the rasterized pixels once instead of decoding SVG again during the hold. */
export function freezeVideoFrame(context: CanvasRenderingContext2D) {
  const source = context.canvas;
  const snapshot = source.ownerDocument.createElement('canvas');
  snapshot.width = source.width;
  snapshot.height = source.height;
  const snapshotContext = snapshot.getContext('2d', { alpha: false });
  if (!snapshotContext) throw new Error('浏览器无法保存视频最终画面。');
  snapshotContext.drawImage(source, 0, 0);
  return () => context.drawImage(snapshot, 0, 0);
}

/** Keep submitting the same complete frame, not just waiting while the canvas is idle. */
export async function holdFinalVideoFrame({
  drawFrame,
  requestFrame = () => {},
  onProgress = () => {},
  now = () => performance.now(),
  nextFrame = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
}: FinalHoldOptions) {
  await drawFrame();
  requestFrame();
  // SVG decoding/drawing time must not consume the final hold.
  const started = now();
  onProgress(0);
  let elapsed = 0;
  while (elapsed < VIDEO_FINAL_HOLD_MS) {
    await nextFrame();
    await drawFrame();
    requestFrame();
    elapsed = now() - started;
    onProgress(Math.min(1, elapsed / VIDEO_FINAL_HOLD_MS));
  }
  // requestFrame captures on paint. Cross a paint boundary before the caller
  // stops MediaRecorder, including browsers that only capture automatically.
  await nextFrame();
  await nextFrame();
}
