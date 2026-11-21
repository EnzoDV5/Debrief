// Lets a page tweak the shell's page panel (for example, making room beside it).
import { createContext, useContext, useLayoutEffect } from 'react';

export type ShellFrameClasses = { panel: string; scroller?: string };

export const ShellFrameContext = createContext<(classes: ShellFrameClasses | null) => void>(
  () => {},
);

export function useShellPanelInset(panel: string, scroller?: string) {
  const setClasses = useContext(ShellFrameContext);
  useLayoutEffect(() => {
    setClasses({ panel, scroller });
    return () => setClasses(null);
  }, [setClasses, panel, scroller]);
}
