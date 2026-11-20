import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The element where a page's top bar goes. AppShell renders it inside <main> but above the framed
 * panel, so on desktop the bar sits on the dark frame colour while the page scrolls below it.
 */
export const PageBarSlot = createContext<HTMLElement | null>(null);

/**
 * Renders its children into the app shell's page bar instead of inside the page. Only the meeting
 * page uses it (title, summary and Ask stay in view above the transcript). A portal keeps the
 * bar's code next to the page that owns it, while the DOM puts it where the layout needs it.
 */
export function PageBar({ children }: { children: ReactNode }) {
  const slot = useContext(PageBarSlot);
  return slot ? createPortal(children, slot) : null;
}

/**
 * A layer over the rounded page panel (desktop): same size and position as the panel, but it
 * doesn't scroll. A page puts things here that must stay fixed on the panel while its content
 * scrolls, like the meeting page's transcript map.
 */
export const PanelOverlaySlot = createContext<HTMLElement | null>(null);

/** Renders its children into the panel overlay (nothing on mobile, where there is no panel). */
export function PanelOverlay({ children }: { children: ReactNode }) {
  const slot = useContext(PanelOverlaySlot);
  return slot ? createPortal(children, slot) : null;
}
