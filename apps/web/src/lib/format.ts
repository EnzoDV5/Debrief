// Date, size and plural formatting, the same for everyone.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

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

export function formatCalendarDate(ymd: string): string {
  return calendarDateFormat.format(new Date(`${ymd}T00:00:00Z`));
}

const shortCalendarDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

// "25 Nov": for tight spaces like a decision's task list.
export function formatShortCalendarDate(ymd: string): string {
  return shortCalendarDateFormat.format(new Date(`${ymd}T00:00:00Z`));
}

const longCalendarDateFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// "Wednesday, 25 November 2026": spelled out, so it can't be misread like 2026/11/25 can.
export function formatLongCalendarDate(ymd: string): string {
  return longCalendarDateFormat.format(new Date(`${ymd}T00:00:00Z`));
}

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
