// Animates the sidebar meeting lists when something changes (pin, archive, restore, a new meeting):
// a row that moves glides from where it was, even into another list, and a new row slides in.
// It records where each row sat after every render and, on the next one, animates any row whose
// place in the layout changed ("FLIP"). Positions ignore scrolling, so scrolling a list never
// triggers an animation.
import { useLayoutEffect, useRef } from 'react';

type Spot = { layout: number; scroller: Element | null };

// One record per sidebar (desktop and the mobile drawer each have their own).
const spots = new WeakMap<Element, Map<string, Spot>>();
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

// Distance from the top of the sidebar, ignoring how far any list is scrolled.
function layoutTop(el: HTMLElement, root: Element) {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== root) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return top;
}

function scrollerOf(el: HTMLElement, root: Element) {
  for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

export function useListMotion() {
  const rows = useRef(new Map<string, HTMLElement>());
  const ready = useRef(false);

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    for (const [id, el] of rows.current) {
      const root = el.closest('[data-sidebar-root]');
      if (!root) continue;
      let map = spots.get(root);
      if (!map) spots.set(root, (map = new Map()));
      const next = { layout: layoutTop(el, root), scroller: scrollerOf(el, root) };
      const previous = map.get(id);
      map.set(id, next);
      if (reduce || el.offsetParent === null) continue;

      if (previous) {
        const before = previous.layout - (previous.scroller?.scrollTop ?? 0);
        const after = next.layout - (next.scroller?.scrollTop ?? 0);
        const dy = before - after;
        if (previous.layout !== next.layout && Math.abs(dy) > 1) {
          el.animate?.([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], {
            duration: 420,
            easing: EASE,
          });
        }
      } else if (ready.current) {
        el.animate?.(
          [
            { opacity: 0, transform: 'translateX(-10px) scale(0.98)' },
            { opacity: 1, transform: 'none' },
          ],
          { duration: 320, easing: EASE },
        );
      }
    }
    ready.current = true;
  });

  return (id: string) => (el: HTMLElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };
}
