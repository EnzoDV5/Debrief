// Only lets ?next= send people to our own pages, never to another site.
export const DEFAULT_APP_PATH = '/meetings';

export function safeRedirect(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return DEFAULT_APP_PATH;
  }
  return next;
}
