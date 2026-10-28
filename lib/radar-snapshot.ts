import { copyRadarTextBounds } from './radar-bounds';

/** Reject geometry that has overflowed JavaScript's finite numeric range. */
export function assertFiniteRadarGeometry(svg: Element) {
  const selector = '[data-series="A"] polygon,[data-series="B"] polygon,' +
    '[data-series="A"] line,[data-series="B"] line,' +
    '[data-series="A"] circle,[data-series="B"] circle,[data-swing] rect';
  const attributes = ['points', 'x', 'y', 'width', 'height', 'cx', 'cy', 'x1', 'y1', 'x2', 'y2'];
  svg.querySelectorAll(selector).forEach(node => {
    for (const name of attributes) {
      for (const attr of [name, `data-final-${name}`]) {
        const value = node.getAttribute(attr);
        if (value && /(?:NaN|Infinity)/i.test(value))
          throw new Error('数据范围过大，无法生成完整画布，请调整输入后重试。');
      }
    }
  });
}

/** Clone the live chart and commit its final geometry, independent of SMIL/CSS playback. */
export function finalRadarSnapshot(source: Element): SVGSVGElement {
  assertFiniteRadarGeometry(source);
  const clone = source.cloneNode(true) as SVGSVGElement;
  copyRadarTextBounds(source, clone);
  clone.querySelectorAll<SVGAnimateElement>('animate').forEach((animation) => {
    const attribute = animation.getAttribute('attributeName');
    const target = animation.getAttribute('to');
    if (attribute && target !== null) animation.parentElement?.setAttribute(attribute, target);
    animation.remove();
  });
  for (const name of ['points', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy']) {
    clone.querySelectorAll(`[data-final-${name}]`).forEach((node) => {
      const value = node.getAttribute(`data-final-${name}`);
      if (value !== null) node.setAttribute(name, value);
    });
  }
  clone.querySelectorAll('.radar-motion-center,.radar-motion-rings,.radar-motion-bar,.radar-best-motion').forEach((node) => {
    node.classList.remove('radar-motion-center', 'radar-motion-rings', 'radar-motion-bar',
      'radar-motion-bar-rings', 'radar-motion-bar-center', 'radar-best-motion',
      'radar-best-center', 'radar-best-rings');
  });
  clone.removeAttribute('class');
  clone.removeAttribute('data-display-mode');
  clone.removeAttribute('data-motion-kind');
  clone.removeAttribute('data-motion-run');
  return clone;
}
