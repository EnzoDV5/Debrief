// safeRedirect(): only our own pages are allowed.
import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_PATH, safeRedirect } from './safeRedirect';

describe('safeRedirect', () => {
  it('allows internal paths, including query strings', () => {
    expect(safeRedirect('/account')).toBe('/account');
    expect(safeRedirect('/items?status=todo')).toBe('/items?status=todo');
  });

  it.each([
    ['missing', null],
    ['empty', ''],
    ['absolute URL', 'https://evil.example'],
    ['protocol-relative URL', '//evil.example'],
    ['backslash trick', '/\\evil.example'],
    ['javascript: URL', 'javascript:alert(1)'],
  ])('falls back to the app for %s', (_label, next) => {
    expect(safeRedirect(next)).toBe(DEFAULT_APP_PATH);
  });
});
