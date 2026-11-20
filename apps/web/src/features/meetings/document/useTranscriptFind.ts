import type { TranscriptLine } from '@debrief/shared';
import { useMemo, useState } from 'react';

// "Find in transcript": plain, instant text search over the transcript (no AI). Lives on the
// meeting page so the field (in the top bar) and the highlights (in the transcript) share it.

export type FindMatch = { line: number; start: number; end: number };

export type TranscriptFind = {
  query: string;
  setQuery: (query: string) => void;
  matches: FindMatch[];
  /** Index into `matches` of the highlighted "current" match (0 when there are none). */
  current: number;
  next: () => void;
  previous: () => void;
  clear: () => void;
};

/** Shorter queries ("a", "i") match almost everything, which helps nobody. */
export const MIN_FIND_LENGTH = 2;

/** Every occurrence of `query` in the lines' text, in reading order. Ignores capitals. */
export function findMatches(lines: TranscriptLine[], query: string): FindMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < MIN_FIND_LENGTH) return [];
  const matches: FindMatch[] = [];
  for (const line of lines) {
    // Lowercasing keeps string length for the text in our transcripts, so the positions
    // found in the lowercased copy line up with the original text.
    const haystack = line.text.toLowerCase();
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) {
      matches.push({ line: line.n, start: at, end: at + needle.length });
    }
  }
  return matches;
}

export function useTranscriptFind(lines: TranscriptLine[]): TranscriptFind {
  const [query, setQueryState] = useState('');
  const [current, setCurrent] = useState(0);
  const matches = useMemo(() => findMatches(lines, query), [lines, query]);

  const setQuery = (next: string) => {
    setQueryState(next);
    setCurrent(0); // a new search starts at its first match
  };
  // Wraps around at either end, like a browser's find bar.
  const step = (by: number) =>
    setCurrent((at) => (matches.length ? (at + by + matches.length) % matches.length : 0));

  return {
    query,
    setQuery,
    matches,
    current: Math.min(current, Math.max(matches.length - 1, 0)),
    next: () => step(1),
    previous: () => step(-1),
    clear: () => setQuery(''),
  };
}
