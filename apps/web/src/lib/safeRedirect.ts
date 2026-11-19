export const DEFAULT_APP_PATH = '/meetings';

/**
 * Where to go after login, from the `?next=` query param. Only internal paths are allowed:
 * otherwise a link like /login?next=https://evil.example would bounce a freshly logged-in user
 * to another site (an "open redirect"). "//evil.example" is a protocol-relative URL, so it's
 * rejected too, as is "/\evil.example", which some browsers treat the same way.
 */
export function safeRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_APP_PATH;
  }
  return next;
}
