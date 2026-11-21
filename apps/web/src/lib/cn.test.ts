// cn(): later Tailwind classes win.
import { describe, expect, it } from 'vitest';
import { cn } from './cn';

// prettier-ignore
describe('cn', () => {
  it('skips falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('lets the last conflicting class win', () => {
    expect(cn('px-4 bg-accent', 'bg-danger')).toBe('px-4 bg-danger');
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
  });

  it('understands our own tokens', () => {
    expect(cn('bg-surface', 'bg-surface-2')).toBe('bg-surface-2');
    expect(cn('rounded-md', 'rounded-card')).toBe('rounded-card');
    expect(cn('shadow-card', 'shadow-raised')).toBe('shadow-raised');
    expect(cn('border-line', 'border-white/70')).toBe('border-white/70');
    expect(cn('w-64', 'w-sidebar')).toBe('w-sidebar');
    expect(cn('max-w-md', 'max-w-content')).toBe('max-w-content');
  });

  it('keeps a text size and a text colour together (different properties)', () => {
    expect(cn('text-sm text-muted', 'text-fg')).toBe('text-sm text-fg');
    expect(cn('text-muted text-sm', 'text-base')).toBe('text-muted text-base');
  });

  it('never drops our custom utilities', () => {
    expect(cn('glass rounded-card', 'shadow-card')).toBe('glass rounded-card shadow-card');
  });
});
