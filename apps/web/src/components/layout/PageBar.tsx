// Lets a page put its own top bar (and overlays) into the shell.
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const PageBarSlot = createContext<HTMLElement | null>(null);

export function PageBar({ children }: { children: ReactNode }) {
  const slot = useContext(PageBarSlot);
  return slot ? createPortal(children, slot) : null;
}

export const PanelOverlaySlot = createContext<HTMLElement | null>(null);

export function PanelOverlay({ children }: { children: ReactNode }) {
  const slot = useContext(PanelOverlaySlot);
  return slot ? createPortal(children, slot) : null;
}
