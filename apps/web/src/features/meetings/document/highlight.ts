// Finds the quotes and date words inside a transcript line so they can be highlighted.
export type MarkKind = 'action' | 'date' | 'decision';

export type Mark = {
  start: number;
  end: number;
  kind: MarkKind;
  itemId: string;
  edited?: boolean;
};

export type Segment = { text: string; marks: Mark[] };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function findPhrase(text: string, phrase: string): { start: number; end: number } | null {
  const words = phrase.split(/[^\p{L}\p{N}'’]+/u).filter(Boolean);
  if (words.length === 0) return null;
  const pattern = words
    .map((word) => escape(word).replace(/['’]/g, "['’]"))
    .join("[^\\p{L}\\p{N}'’]+");
  const match = new RegExp(pattern, 'iu').exec(text);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

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
