/**
 * One-off messages for the next page to show ("flash" messages), e.g. "Your account has been
 * deleted." on the login page.
 *
 * Why not navigation state: signing out clears the current user, which makes the logged-in pages
 * redirect to /login by themselves. That redirect can win the race against our own navigate()
 * and drop its state. A message waiting here survives whichever navigation gets there first.
 * Kept in memory (not localStorage): it only has to last until the next page renders.
 */

export type FlashMessage = 'account-deleted' | 'password-reset';

let pending: FlashMessage | null = null;

export function setFlash(message: FlashMessage) {
  pending = message;
}

/**
 * The waiting message, if any. Read it once when the page first renders (useState(peekFlash)),
 * then clearFlash() in an effect. (Clearing while reading breaks in development: React's
 * StrictMode runs useState initialisers twice, and the second read would find nothing.)
 */
export function peekFlash(): FlashMessage | null {
  return pending;
}

export function clearFlash() {
  pending = null;
}
