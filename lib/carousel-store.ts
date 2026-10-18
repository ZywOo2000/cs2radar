import type { UseEmblaCarouselType } from 'embla-carousel-react';

type CarouselSource = Pick<
  NonNullable<UseEmblaCarouselType[1]>,
  'on' | 'off' | 'canScrollPrev' | 'canScrollNext'
>;

/** Primitive snapshots remain stable until the carousel's scrollability changes. */
export function createCarouselStore(api?: CarouselSource) {
  return {
    subscribe(this: void, onChange: () => void) {
      api?.on('select', onChange);
      api?.on('reInit', onChange);
      return () => {
        api?.off('select', onChange);
        api?.off('reInit', onChange);
      };
    },
    getSnapshot: () =>
      (api?.canScrollPrev() ? 1 : 0) | (api?.canScrollNext() ? 2 : 0),
    getServerSnapshot: () => 0,
  };
}
