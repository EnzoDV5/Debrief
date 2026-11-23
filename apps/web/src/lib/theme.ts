// Dark or light mode. Dark is the default; light swaps the surround and the frame (see the
// [data-theme='light'] block in styles/tokens.css). The choice is a per-device display setting,
// so it lives in this browser, not the database. index.html applies it before the first paint.
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'dark' | 'light';

// Where a switch was started from (e.g. the middle of the button), in viewport pixels.
export type ThemeOrigin = { x: number; y: number };

// index.html reads the same key.
const STORAGE_KEY = 'debrief-theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#171923', light: '#ffffff' };
const REVEAL_MS = 650;
// Same curve as --ease-panel in tokens.css: quick to start, long soft landing.
const REVEAL_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const listeners = new Set<() => void>();

const readPage = (): Theme =>
  document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';

// The chosen theme. It changes the moment you choose, even while the page is still animating
// towards it, so the toggle never shows the old value.
let current: Theme = readPage();

export function getTheme(): Theme {
  return current;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  // The browser's own bars (address bar on phones) match the surround.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

function notify() {
  for (const listener of listeners) listener();
}

// The new look grows out of `origin` as a circle until it covers the screen.
function reveal(origin: ThemeOrigin | undefined) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  document.documentElement.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { duration: REVEAL_MS, easing: REVEAL_EASING, pseudoElement: '::view-transition-new(root)' },
  );
}

export function setTheme(theme: Theme, origin?: ThemeOrigin) {
  if (theme === current && theme === readPage()) return;
  current = theme;
  try {
    if (theme === 'light') localStorage.setItem(STORAGE_KEY, 'light');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the theme still changes, it just isn't remembered.
  }

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) {
    apply(theme);
    notify();
    return;
  }

  // The browser photographs the page, we switch the theme (and let React redraw the toggle in the
  // same step, hence flushSync), then the new page is revealed over the photo of the old one.
  const transition = document.startViewTransition(() => {
    apply(theme);
    flushSync(notify);
  });
  transition.ready.then(() => reveal(origin)).catch(() => {});
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark');
}
