import * as chrono from 'chrono-node';

// Turns the AI's due-date *words* ("by Friday 27 November", "next Friday") into a calendar date,
// relative to the meeting date. The AI never picks the date itself: this code does, and it says
// so when it can't be sure. That's how "no invented dates" is enforced.

export type DueDateResult =
  | { date: string; review?: string } // resolved (maybe with a note to double-check)
  | { date: null; review: string }; // couldn't resolve: explain why

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
// Noon UTC on the meeting day: the same calendar day in every time zone.
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

/** "the 12th" / "on the 3rd": the next such day of the month, on or after the meeting. */
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
    // Skip months without that day (e.g. the 31st in November rolls over to December).
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
  // "by March": a month but no day. Don't turn that into a made-up "1 March".
  if (!start.isCertain('day') && !start.isCertain('weekday')) {
    return { date: null, review: `“${text}” doesn't give an exact day` };
  }

  const date = ymd(start.get('year') ?? 0, start.get('month') ?? 0, start.get('day') ?? 0);

  // "next Friday" said on a Tuesday: this week's Friday or next week's? People mean both.
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
