// Finds phrases (an action item's quote, its date words) inside a transcript line, so they can be
// highlighted like comment anchors in Google Docs. Pure functions: no React, easy to test.

export type MarkKind = 'action' | 'date' | 'decision';

export type Mark = {
  start: number;
  end: number;
  kind: MarkKind;
  /** Which item this mark belongs to, so hovering the bubble can light up its words. */
  itemId: string;
};

export type Segment = { text: string; marks: Mark[] };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Where `phrase` appears in `text`, or null. Forgiving in the ways a model's quote differs from
 * the transcript: capitals, punctuation and spacing between words, and ' vs ’ apostrophes.
 * The words themselves must match, in order, so a highlight is never placed on the wrong text.
 */
export function findPhrase(text: string, phrase: string): { start: number; end: number } | null {
  const words = phrase.split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words
    .map((word) => escape(word).replace(/['’]/g, "['’]"))
    .join("[^\\p{L}\\p{N}'’]+");
  const match = new RegExp(pattern, 'iu').exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

/**
 * Cuts a line into pieces at every mark boundary, so overlapping marks (a date inside a quote)
 * both apply to the overlapping part. Unmarked text comes back as segments with no marks.
 */
export function segment(text: string, marks: Mark[]): Segment[] {
  const valid = marks.filter((m) => m.start >= 0 && m.end <= text.length && m.start < m.end);
  const cuts = [...new Set([0, text.length, ...valid.flatMap((m) => [m.start, m.end])])].sort(
    (a, b) => a - b,
  );
  const pieces: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i]!;
    const end = cuts[i + 1]!;
    pieces.push({
      text: text.slice(start, end),
      marks: valid.filter((m) => m.start <= start && m.end >= end),
    });
  }
  return pieces;
}
