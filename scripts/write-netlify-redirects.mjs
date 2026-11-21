// Writes the Netlify file that forwards /api to the Render api after each build.
import { writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const rawOrigin = process.env.DEBRIEF_API_ORIGIN?.trim();

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

await writeFile(
  new URL('../apps/web/dist/_redirects', import.meta.url),
  `${apiRule}/* /index.html 200\n`,
);
