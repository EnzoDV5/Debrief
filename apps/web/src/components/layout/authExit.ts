// The short animation from the sign-in page into the app.
import { createContext, useContext } from 'react';

export const AuthExitContext = createContext<(then: () => void) => void>((then) => then());

export function useLeaveAuth() {
  return useContext(AuthExitContext);
}

export const AUTH_EXIT_MS = 450;

export type EntranceState = { entrance: true; welcome?: boolean };

export const AUTH_PANEL_LEFT = '44.444vw';
