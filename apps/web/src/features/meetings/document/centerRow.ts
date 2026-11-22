// Scrolls a transcript row (a line plus its cards) to the middle of the free space on screen:
// between the bottom of the Ask card and the bottom of the transcript panel.

type Span = { top: number; bottom: number };

/** How many pixels to scroll so `box` sits in the middle of `space`. Positive means down. */
export function centerOffset(box: Span, space: Span): number {
  // Too tall to fit: put its top at the top of the space, so the line itself is in view.
  if (box.bottom - box.top >= space.bottom - space.top) return box.top - space.top;
  return (box.top + box.bottom) / 2 - (space.top + space.bottom) / 2;
}

/**
 * Centres `row` in one scroll. `askCard` is the Ask panel: it only stays on screen beside the
 * transcript on wide screens (where it's sticky), so only then does it shrink the free space.
 */
export function scrollRowToCenter(
  row: HTMLElement,
  askCard: HTMLElement | null,
  behavior: ScrollBehavior,
) {
  const panel = row.closest<HTMLElement>('[data-scroller]');
  // On smaller screens the page itself scrolls, not the panel.
  const panelScrolls = panel !== null && panel.scrollHeight > panel.clientHeight;
  const view = panelScrolls
    ? panel.getBoundingClientRect()
    : { top: 0, bottom: window.innerHeight };

  const askStuck = askCard?.parentElement
    ? getComputedStyle(askCard.parentElement).position === 'sticky'
    : false;
  const top = askStuck ? Math.max(view.top, askCard!.getBoundingClientRect().bottom) : view.top;

  const offset = centerOffset(row.getBoundingClientRect(), { top, bottom: view.bottom });
  if (Math.abs(offset) < 1) return;
  (panelScrolls ? panel : window).scrollBy?.({ top: offset, behavior });
}

const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/**
 * Centres `row` now, then keeps it centred for a moment while the page settles: lines get their
 * real height once drawn and cards slide in, which would otherwise push the row off centre.
 * Stops early as soon as the user scrolls, clicks or types, so it never fights them.
 * Returns a function that stops it (for effect cleanup).
 */
export function keepRowCentered(
  row: HTMLElement,
  askCard: HTMLElement | null,
  watch: HTMLElement,
  ms = 1500,
): () => void {
  const recenter = () => scrollRowToCenter(row, askCard, 'auto');
  recenter();

  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(recenter);
  resize?.observe(watch);
  // Entrance animations nudge things a few pixels with transforms, which ResizeObserver can't see.
  document.addEventListener('animationend', recenter);

  const stop = () => {
    window.clearTimeout(timer);
    resize?.disconnect();
    document.removeEventListener('animationend', recenter);
    for (const type of USER_INPUT) window.removeEventListener(type, stop);
  };
  const timer = window.setTimeout(stop, ms);
  for (const type of USER_INPUT) window.addEventListener(type, stop, { passive: true });
  return stop;
}
