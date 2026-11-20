import { describe, expect, it } from 'vitest';
import { findMatches } from './useTranscriptFind';

const lines = [
  { n: 1, speaker: 'Ann', text: 'The deck is ready. Send the deck today.' },
  { n: 2, speaker: 'Ben', text: 'Nothing here.' },
  { n: 3, text: 'DECK review on Friday.' },
];

describe('findMatches', () => {
  it('finds every occurrence in reading order, ignoring capitals', () => {
    expect(findMatches(lines, 'deck')).toEqual([
      { line: 1, start: 4, end: 8 },
      { line: 1, start: 28, end: 32 },
      { line: 3, start: 0, end: 4 },
    ]);
  });

  it('ignores surrounding spaces and very short queries', () => {
    expect(findMatches(lines, '  friday ')).toEqual([{ line: 3, start: 15, end: 21 }]);
    expect(findMatches(lines, 'e')).toEqual([]);
    expect(findMatches(lines, '')).toEqual([]);
  });

  it('treats the query as plain text, not a pattern', () => {
    expect(findMatches([{ n: 1, text: 'Costs (est.) rose' }], '(est.)')).toEqual([
      { line: 1, start: 6, end: 12 },
    ]);
    expect(findMatches(lines, 'd..k')).toEqual([]);
  });
});
