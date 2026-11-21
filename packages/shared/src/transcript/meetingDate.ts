// Spots the meeting date written inside a transcript, if there is one.
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

function parseFullDate(text: string): string | null {
  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (m) return toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const month = monthNumber(m[2]!);
    if (month) return toIsoDate(Number(m[3]), month, Number(m[1]));
  }
  m = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/.exec(text);
  if (m) {
    const month = monthNumber(m[1]!);
    if (month) return toIsoDate(Number(m[3]), month, Number(m[2]));
  }
  m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(text);
  if (m) return toIsoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  return null;
}

export function detectMeetingDate(lines: TranscriptLine[]): string | null {
  const header = lines.slice(0, 8);
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
