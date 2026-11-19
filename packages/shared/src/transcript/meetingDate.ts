import type { TranscriptLine } from '../schemas/meetings';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** A real calendar date as YYYY-MM-DD, or null (rejects things like 31 February). */
function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

const monthNumber = (name: string) => {
  const index = MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)));
  return index === -1 ? null : index + 1;
};

/** Finds one full date (with a year) in a piece of text. */
function parseFullDate(text: string): string | null {
  // 2026-11-16
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m) return toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  // 16 November 2026 / Monday 16 Nov 2026 / 16th November, 2026
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const month = monthNumber(m[2]!);
    if (month) return toIsoDate(Number(m[3]), month, Number(m[1]));
  }
  // November 16, 2026
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const month = monthNumber(m[1]!);
    if (month) return toIsoDate(Number(m[3]), month, Number(m[2]));
  }
  // 16/11/2026 (day first, as written in South Africa and the UK)
  m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text);
  if (m) return toIsoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

/**
 * Many transcripts start with a header like "Date: Monday 16 November 2026". The review step uses
 * this to pre-fill the meeting date (instead of today), because relative deadlines like
 * "Wednesday the 18th" are worked out from it. Only the first lines are checked, and only a full
 * date with a year counts, so a date mentioned later in the discussion is never mistaken for it.
 */
export function detectMeetingDate(lines: TranscriptLine[]): string | null {
  const header = lines.slice(0, 8);
  // Prefer an explicit "Date:" label; otherwise any full date in the first few lines.
  const labelled = header.find((l) => /\b(meeting date|date|when)\s*[:\-–]/i.test(l.text));
  if (labelled) {
    const found = parseFullDate(labelled.text);
    if (found) return found;
  }
  for (const line of header.slice(0, 3)) {
    const found = parseFullDate(line.text);
    if (found) return found;
  }
  return null;
}
