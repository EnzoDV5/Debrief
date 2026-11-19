// One date style across the app, e.g. "19 Nov 2026". Fixed locale so it reads the same for
// everyone (and in tests), regardless of browser settings.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}
