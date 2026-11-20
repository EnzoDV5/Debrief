import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page pull the shell's rounded page panel in from the right (desktop), to make room for
 * something beside it on the dark frame. The meeting page does this for its notes column (Ask,
 * action items, decisions), like comments beside a Google Docs page.
 */
export const ShellFrameContext = createContext<(panelClassName: string | null) => void>(() => {});

/**
 * Narrows the panel while the calling page is shown, e.g. 'xl:right-[calc(24rem+1.5rem)]'.
 * The panel slides back to full width when the page unmounts (another page is opened).
 */
export function useShellPanelInset(panelClassName: string) {
  const setPanelInset = useContext(ShellFrameContext);
  useEffect(() => {
    setPanelInset(panelClassName);
    return () => setPanelInset(null);
  }, [setPanelInset, panelClassName]);
}
