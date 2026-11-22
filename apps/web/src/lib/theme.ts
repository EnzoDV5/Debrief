// Dark or light mode. Dark is the default; light swaps the surround and the frame (see the
// [data-theme='light'] block in styles/tokens.css). The choice is a per-device display setting,
// so it lives in this browser, not the database. index.html applies it before the first paint.
import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

// index.html reads the same key.
const STORAGE_KEY = 'debrief-theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#171923', light: '#ffffff' };
const listeners = new Set<() => void>();

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  // The browser's own bars (address bar on phones) match the surround.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'light') localStorage.setItem(STORAGE_KEY, 'light');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage: the theme still changes, it just isn't remembered.
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // A soft cross-fade between the two looks where the browser supports it; instant otherwise.
  if (document.startViewTransition && !reduce) document.startViewTransition(() => apply(theme));
  else apply(theme);
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => 'dark');
}
