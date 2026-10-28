// Prevent extreme (but valid) data values from allocating an unbounded bitmap.
// Normal-sized exports keep their exact original dimensions and aspect ratio.
export const MAX_CANVAS_DIMENSION = 8192;
export const MAX_CANVAS_PIXELS = 16_777_216;

export function boundedCanvasSize(width: number, height: number, even = false) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error('数据范围过大，无法生成完整画布，请调整输入后重试。');
  const step = even ? 2 : 1;
  const w = Math.ceil(width / step) * step;
  const h = Math.ceil(height / step) * step;
  if (!Number.isFinite(w) || !Number.isFinite(h))
    throw new Error('数据范围过大，无法生成完整画布，请调整输入后重试。');
  const scale = Math.min(1, MAX_CANVAS_DIMENSION / w, MAX_CANVAS_DIMENSION / h,
    Math.sqrt(MAX_CANVAS_PIXELS / w / h));
  if (scale === 1) return { width: w, height: h };
  const boundedWidth = Math.floor(w * scale / step) * step;
  const boundedHeight = Math.floor(h * scale / step) * step;
  if (!Number.isFinite(boundedWidth) || !Number.isFinite(boundedHeight) || boundedWidth < step || boundedHeight < step)
    throw new Error('数据范围过大，无法生成完整画布，请调整输入后重试。');
  return { width: boundedWidth, height: boundedHeight };
}
