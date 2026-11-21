// Where banners show up on the sign-in pages, without pushing the form around.
import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const AuthMessageSlot = createContext<HTMLElement | null>(null);

export function AuthMessage({ children }: { children: ReactNode }) {
  const slot = useContext(AuthMessageSlot);
  if (!slot) return <div className="mb-6">{children}</div>;
  return createPortal(<div className="animate-page-in">{children}</div>, slot);
}
