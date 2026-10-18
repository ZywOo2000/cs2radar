import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio/slim';
import { createCarouselStore } from '../lib/carousel-store.ts';
import { focusGroupControl } from '../lib/input-group-focus.ts';

test('carousel snapshots are stable primitives and follow both selection and reinitialization', () => {
  const listeners = new Map();
  let prev = false,
    next = true,
    notifications = 0;
  const api = {
    on: (event, fn) => listeners.set(event, fn),
    off: (event, fn) => {
      assert.equal(listeners.get(event), fn);
      listeners.delete(event);
    },
    canScrollPrev: () => prev,
    canScrollNext: () => next,
  };
  const store = createCarouselStore(api);
  const unsubscribe = store.subscribe(() => notifications++);
  assert.equal(store.getServerSnapshot(), 0);
  assert.equal(store.getSnapshot(), 2);
  assert.equal(store.getSnapshot(), store.getSnapshot());
  prev = true;
  listeners.get('select')();
  assert.equal(store.getSnapshot(), 3);
  next = false;
  listeners.get('reInit')();
  assert.equal(store.getSnapshot(), 1);
  assert.equal(notifications, 2);
  unsubscribe();
  assert.equal(listeners.size, 0, 'both event listeners must be removed');
});

test('carousel before initialization has a safe snapshot and cleanup', () => {
  const store = createCarouselStore();
  assert.equal(store.getSnapshot(), 0);
  store.subscribe(() => assert.fail('uninitialized source notified'))();
});

function focusFixture(html) {
  const $ = load(html);
  let focused;
  return {
    group: {
      querySelector: (selector) => {
        const element = $(selector).first();
        return element.length
          ? {
              focus: () => {
                focused = element.attr('id');
              },
            }
          : null;
      },
    },
    target: (selector) => ({
      closest: (interactive) =>
        $(selector).closest(interactive).length ? {} : null,
    }),
    focused: () => focused,
  };
}

test('input adornments focus input or textarea, skipping disabled and hidden controls', () => {
  for (const control of ['input', 'textarea']) {
    const f = focusFixture(
      `<input disabled><input type="hidden"><${control} id="editable"></${control}><span id="addon">prefix</span>`,
    );
    focusGroupControl(f.group, f.target('#addon'));
    assert.equal(f.focused(), 'editable');
  }
  focusGroupControl(null, null);
  const disabled = focusFixture(
    '<input disabled><textarea disabled></textarea>',
  );
  focusGroupControl(disabled.group, null);
  assert.equal(disabled.focused(), undefined);
});

test('adornment clicks do not steal focus from nested interactive controls', () => {
  for (const wrapper of [
    'button',
    'a href="#"',
    'label',
    'span role="button"',
    'span tabindex="0"',
    'span contenteditable="true"',
  ]) {
    const tag = wrapper.split(' ')[0];
    const f = focusFixture(
      `<input id="editable"><${wrapper}><span id="target">action</span></${tag}>`,
    );
    focusGroupControl(f.group, f.target('#target'));
    assert.equal(f.focused(), undefined, wrapper);
  }
});

await build({
  stdin: {
    contents:
      "export { Label } from './components/ui/label'; export { PaginationLink } from './components/ui/pagination'; export { BreadcrumbPage } from './components/ui/breadcrumb';",
    resolveDir: resolve('.'),
    loader: 'tsx',
  },
  outfile: '.checks/ui-primitives.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  jsx: 'automatic',
  alias: { '@': resolve('.') },
});
const { Label, PaginationLink, BreadcrumbPage } =
  await import('../.checks/ui-primitives.mjs');

test('label preserves the explicit control association and visible text', () => {
  const $ = load(
    renderToStaticMarkup(createElement(Label, { htmlFor: 'rating' }, 'Rating')),
  );
  assert.equal($('label').attr('for'), 'rating');
  assert.equal($('label').text(), 'Rating');
});

test('pagination preserves link content, destination and current-page state', () => {
  const $ = load(
    renderToStaticMarkup(
      createElement(PaginationLink, { href: '?page=2', isActive: true }, '2'),
    ),
  );
  assert.equal($('a').text(), '2');
  assert.equal($('a').attr('href'), '?page=2');
  assert.equal($('a').attr('aria-current'), 'page');
});

test('current breadcrumb is current-page text, not a nonfunctional link', () => {
  const $ = load(
    renderToStaticMarkup(createElement(BreadcrumbPage, null, 'Current')),
  );
  assert.equal($('[aria-current="page"]').text(), 'Current');
  assert.equal($('[role="link"]').length, 0);
});
