import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page switch off the shell's rounded page panel (desktop) and draw its own. The meeting
 * page does this: its transcript is a narrower "sheet" with the notes column beside it, on the
 * dark frame colour, like comments beside a Google Docs page.
 */
export const ShellFrameContext = createContext<(bare: boolean) => void>(() => {});

/** Call in a page that draws its own panel. The shell's panel comes back when the page unmounts. */
export function useBareShellFrame() {
  const setBare = useContext(ShellFrameContext);
  useEffect(() => {
    setBare(true);
    return () => setBare(false);
  }, [setBare]);
}
