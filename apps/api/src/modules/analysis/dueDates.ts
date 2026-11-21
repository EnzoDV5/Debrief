// Turns due-date words like "next Friday" into a real date, counted from the meeting date.
import * as chrono from 'chrono-node';

export type DueDateResult = { date: string; review?: string } | { date: null; review: string };

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const referenceFor = (meetingDate: string) => new Date(`${meetingDate}T12:00:00Z`);

function addDays(meetingDate: string, days: number): string {
  const d = referenceFor(meetingDate);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

const MONTHS = 'jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec';

function explicitDayOfMonth(text: string): number | null {
  const match =
    /\b(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text) ??
    new RegExp(`\\b(\\d{1,2})\\s+(?:${MONTHS})[a-z]*\\b`, 'i').exec(text) ??
    new RegExp(`\\b(?:${MONTHS})[a-z]*\\s+(\\d{1,2})\\b`, 'i').exec(text);
  return match ? Number(match[1]) : null;
}

function resolveDayOfMonth(text: string, meetingDate: string): string | null {
  const match = /\bthe\s+(\d{1,2})(?:st|nd|rd|th)\b/i.exec(text);
  if (!match) return null;
  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;
  const ref = referenceFor(meetingDate);
  for (let monthsAhead = 0; monthsAhead < 12; monthsAhead++) {
    const candidate = new Date(
      Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + monthsAhead, day),
    );
    if (candidate.getUTCDate() !== day) continue;
    const iso = candidate.toISOString().slice(0, 10);
    if (iso >= meetingDate) return iso;
  }
  return null;
}

export function resolveDueDate(text: string, meetingDate: string): DueDateResult {
  const unclear = { date: null, review: `Couldn't work out a date from “${text}”` } as const;

  const parsed = chrono.en.GB.parse(text, referenceFor(meetingDate), { forwardDate: true })[0];
  if (!parsed) {
    const dayOfMonth = resolveDayOfMonth(text, meetingDate);
    return dayOfMonth ? { date: dayOfMonth } : unclear;
  }

  const start = parsed.start;
  if (!start.isCertain('day') && !start.isCertain('weekday')) {
    return { date: null, review: `“${text}” doesn't give an exact day` };
  }

  const date = ymd(start.get('year') ?? 0, start.get('month') ?? 0, start.get('day') ?? 0);

  const statedDay = explicitDayOfMonth(text);
  if (statedDay !== null && statedDay !== start.get('day')) {
    const nextStatedDay = resolveDayOfMonth(text, meetingDate);
    if (
      nextStatedDay &&
      start.isCertain('weekday') &&
      referenceFor(nextStatedDay).getUTCDay() === start.get('weekday')
    ) {
      return { date: nextStatedDay };
    }
    return {
      date,
      review: `“${text}” doesn't match a single date after the meeting (check the meeting date)`,
    };
  }

  const nextWeekday = /\bnext\s+(sun|mon|tue|wed|thu|fri|sat)[a-z]*/i.exec(text);
  if (nextWeekday?.[1]) {
    const target = WEEKDAYS.findIndex((day) => day.startsWith(nextWeekday[1]!.toLowerCase()));
    const meetingWeekday = referenceFor(meetingDate).getUTCDay();
    const thisWeek = addDays(meetingDate, (target - meetingWeekday + 7) % 7 || 7);
    if (thisWeek !== date) {
      return {
        date,
        review: `“${text}” could mean ${shortDate(thisWeek)} or ${shortDate(date)}`,
      };
    }
  }
  return { date };
}
