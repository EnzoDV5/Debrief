import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { pool } from '../src/db/client';
import type { AppDeps } from '../src/app';

export const PASSWORD = 'correct-horse-battery';
export const WEB_ORIGIN = 'http://localhost:5173'; // the default in env.ts

export const testAppDeps: AppDeps = { analysisQueue: { enqueue: async () => {} } };

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase() {
  await pool.query(
    'TRUNCATE TABLE calendar_connections, analysis_runs, action_items, decisions, meetings, sessions, users RESTART IDENTITY CASCADE',
  );
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

/** Registers a user and returns their session cookie, ready for `.set('Cookie', ...)`. */
export async function signUp(app: Express, name: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ name, email: `${name.toLowerCase()}@debrief.test`, password: PASSWORD });
  if (res.status !== 201) throw new Error(`signUp failed: ${res.status}`);
  return sessionCookiePair(res);
}
