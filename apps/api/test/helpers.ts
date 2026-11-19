import type { Response } from 'supertest';
import { pool } from '../src/db/client';

export const PASSWORD = 'correct-horse-battery';
export const WEB_ORIGIN = 'http://localhost:5173'; // the default in env.ts

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase() {
  await pool.query('TRUNCATE TABLE sessions, users RESTART IDENTITY CASCADE');
}

export async function closeDatabase() {
  await pool.end();
}

/** The raw Set-Cookie header for our session cookie, if the response set one. */
export function sessionCookieHeader(res: Response): string | undefined {
  const raw: unknown = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  return cookies.find((c) => c.startsWith('debrief_session='));
}

/** Just the "debrief_session=<token>" part, for sending it back manually. */
export function sessionCookiePair(res: Response): string {
  const header = sessionCookieHeader(res);
  if (!header) throw new Error('Response did not set a session cookie');
  return header.split(';')[0] ?? '';
}
