import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The sign-in pages' message area: a fixed space above the page heading (AuthLayout) where
 * banners appear (wrong password, Google cancelled, "password changed", server errors). Banners
 * grow upwards into empty space, so the heading and form below never move when one appears.
 */
export const AuthMessageSlot = createContext<HTMLElement | null>(null);

/**
 * Shows its children in the message area. Outside AuthLayout (no area), it simply renders them
 * where it is, with a gap below.
 */
export function AuthMessage({ children }: { children: ReactNode }) {
  const slot = useContext(AuthMessageSlot);
  if (!slot) return <div className="mb-6">{children}</div>;
  return createPortal(<div className="animate-page-in">{children}</div>, slot);
}
