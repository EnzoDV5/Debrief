// Swaps what's shown in one place with a little animation: the old content leaves first, then
// the new content arrives. Used for the drop box ↔ paste box and upload ↔ check steps.
//
//   const box = useSwap('drop');
//   <div key={box.shown} inert={box.leaving} className={box.animation}>…</div>
//   box.swapTo('paste');
//
// `key` makes React mount fresh content, so the arrive animation plays. Nothing animates on first
// load, and people who ask for reduced motion get an instant swap.
import { useCallback, useEffect, useState } from 'react';

// How long the old content takes to leave: matches swap-out in styles/tokens.css.
export const SWAP_OUT_MS = 180;

export function useSwap<T>(initial: T) {
  const [shown, setShown] = useState(initial);
  // Wrapped in an object so that swapping *to* null (or any falsy value) still counts.
  const [next, setNext] = useState<{ value: T } | null>(null);
  const [swapped, setSwapped] = useState(false);

  useEffect(() => {
    if (!next) return;
    const timer = window.setTimeout(() => {
      setShown(next.value);
      setNext(null);
    }, SWAP_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [next]);

  const swapTo = useCallback((value: T) => {
    setSwapped(true);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setShown(value);
    else setNext({ value });
  }, []);

  const leaving = next !== null;
  const animation = leaving
    ? 'motion-safe:animate-swap-out'
    : swapped
      ? 'motion-safe:animate-swap-in'
      : undefined;
  // What's about to be shown: lets things around the swap start moving straight away.
  const upcoming = next ? next.value : shown;
  return { shown, upcoming, leaving, swapTo, animation };
}
