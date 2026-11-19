import { describe, expect, it } from 'vitest';
import { findPhrase, segment, type Mark } from './highlight';

const line = 'Yes. I’ll deploy the onboarding release to production on Thursday 26 November.';

describe('findPhrase', () => {
  it('finds a quote ignoring case, punctuation and the kind of apostrophe', () => {
    const found = findPhrase(line, "I'll deploy the ONBOARDING release");
    expect(found).not.toBeNull();
    expect(line.slice(found!.start, found!.end)).toBe('I’ll deploy the onboarding release');
  });

  it('matches across different punctuation between words', () => {
    const found = findPhrase(line, 'production, on Thursday 26 November');
    expect(line.slice(found!.start, found!.end)).toBe('production on Thursday 26 November');
  });

  it('does not match when the words differ', () => {
    expect(findPhrase(line, 'deploy the payments release')).toBeNull();
    expect(findPhrase(line, '...')).toBeNull();
  });
});

describe('segment', () => {
  const mark = (start: number, end: number, kind: Mark['kind']): Mark => ({
    start,
    end,
    kind,
    itemId: kind,
  });

  it('splits overlapping marks so both apply where they overlap', () => {
    const text = 'send it by Friday please';
    // quote "send it by Friday" (0–17) and date "by Friday" (8–17)
    const pieces = segment(text, [mark(0, 17, 'action'), mark(8, 17, 'date')]);
    expect(pieces.map((p) => [p.text, p.marks.map((m) => m.kind)])).toEqual([
      ['send it ', ['action']],
      ['by Friday', ['action', 'date']],
      [' please', []],
    ]);
  });

  it('returns the whole text unmarked when there are no marks', () => {
    expect(segment('hello', [])).toEqual([{ text: 'hello', marks: [] }]);
  });

  it('ignores marks outside the text', () => {
    expect(segment('hi', [mark(5, 9, 'action')])).toEqual([{ text: 'hi', marks: [] }]);
  });
});
