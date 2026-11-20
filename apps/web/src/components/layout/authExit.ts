import { createContext, useContext } from 'react';

/**
 * Leaving the sign-in page for the app, with a short exit first: AuthLayout fades the form away
 * (the panel stays, it turns into the app's panel), then calls `then` to navigate. AppShell plays
 * the rest (the panel growing, the sidebar sliding in).
 * Outside AuthLayout (e.g. in a test rendering just a form) it navigates straight away.
 */
export const AuthExitContext = createContext<(then: () => void) => void>((then) => then());

export function useLeaveAuth() {
  return useContext(AuthExitContext);
}

/** How long the exit takes before the app opens. Matches the transitions in AuthLayout. */
export const AUTH_EXIT_MS = 450;

/** Navigation state that tells AppShell to play its entrance (and the meetings page to welcome). */
export type EntranceState = { entrance: true; welcome?: boolean };

/**
 * Where the sign-in page's light panel starts: its form column is 1fr of a 1fr + 1.25fr grid
 * (AuthLayout), so 1 / 2.25 = 44.44% of the window. AppShell's entrance starts its panel at the
 * same place, so the panel looks like it simply grows to the left.
 */
export const AUTH_PANEL_LEFT = '44.444vw';
