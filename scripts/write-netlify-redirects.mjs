import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const rawOrigin = process.env.DEBRIEF_API_ORIGIN?.trim();

// Netlify serves the Vite build; the Express API and its background worker run elsewhere.
// A proxy keeps the browser's /api calls and session cookie on the site's own origin.
let apiRule = '';
if (rawOrigin) {
  let url;
  try {
    url = new URL(rawOrigin);
  } catch {
    throw new Error('DEBRIEF_API_ORIGIN must be a full URL, such as https://api.example.com');
  }
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('DEBRIEF_API_ORIGIN must be an origin without a path, query, or credentials');
  }
  if (process.env.NETLIFY && url.protocol !== 'https:') {
    throw new Error('DEBRIEF_API_ORIGIN must use HTTPS for a Netlify deploy');
  }
  apiRule = `/api/* ${url.origin}/api/:splat 200\n`;
} else if (process.env.NETLIFY) {
  throw new Error('Set DEBRIEF_API_ORIGIN to your deployed API origin in Netlify build settings');
}

// Order matters: the API proxy must be checked before React Router's page fallback.
await writeFile(
  new URL('../apps/web/dist/_redirects', import.meta.url),
  `${apiRule}/* /index.html 200\n`,
);
