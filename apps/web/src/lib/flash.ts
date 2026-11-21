// One-off messages for the next page, like "Your account has been deleted."
export type FlashMessage = 'account-deleted' | 'password-reset';

let pending: FlashMessage | null = null;

export function setFlash(message: FlashMessage) {
  pending = message;
}

export function peekFlash(): FlashMessage | null {
  return pending;
}

export function clearFlash() {
  pending = null;
}
