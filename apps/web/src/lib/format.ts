// One date style across the app, e.g. "19 Nov 2026". Fixed locale so it reads the same for
// everyone (and in tests), regardless of browser settings.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** For timestamps (ISO date-time), e.g. "Member since". */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const calendarDateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * For calendar dates ('YYYY-MM-DD'), e.g. a meeting date → "Tue, 24 Nov 2026".
 * Formatted in UTC on purpose: `new Date('2026-11-24')` is midnight UTC, which in a time zone
 * behind UTC would otherwise display as the day before.
 */
export function formatCalendarDate(ymd: string): string {
  return calendarDateFormat.format(new Date(`${ymd}T00:00:00Z`));
}

/** Today's date in the user's own time zone, as 'YYYY-MM-DD' (toISOString() would use UTC). */
export function todayDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function plural(count: number, word: string): string {
  return `${count.toLocaleString('en-GB')} ${word}${count === 1 ? '' : 's'}`;
}
