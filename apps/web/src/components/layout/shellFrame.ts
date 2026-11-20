import { createContext, useContext, useLayoutEffect } from 'react';

/** Classes a page adds to the shell: on the rounded panel, and on the scrolling area over it. */
export type ShellFrameClasses = { panel: string; scroller?: string };

/**
 * Lets a page adjust the shell's rounded page panel (desktop): pull it in from the right to make
 * room for something beside it on the dark frame, and style the scrolling area. The meeting page
 * does this for its notes column (Ask, action items, decisions), like comments beside a Google
 * Docs page, and to fade the transcript at the frame's edges.
 */
export const ShellFrameContext = createContext<(classes: ShellFrameClasses | null) => void>(
  () => {},
);

/**
 * Applies the classes while the calling page is shown, e.g. panel 'xl:right-[calc(24rem+1.5rem)]'.
 * The panel slides back to full width when the page unmounts (another page is opened).
 */
export function useShellPanelInset(panel: string, scroller?: string) {
  const setClasses = useContext(ShellFrameContext);
  // Layout effect: the panel starts moving in the same frame the page first paints, instead of
  // one frame later at the wrong width.
  useLayoutEffect(() => {
    setClasses({ panel, scroller });
    return () => setClasses(null);
  }, [setClasses, panel, scroller]);
}
