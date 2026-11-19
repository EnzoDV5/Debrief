import { useEffect } from 'react';

/** Sets the browser tab title. It's also the first thing a screen reader announces per page. */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Debrief`;
  }, [title]);
}
