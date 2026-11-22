// Shared test helpers: a test app, users, cookies and meetings.
import type { Express } from 'express';
import request, { type Response } from 'supertest';
import { pool } from '../src/db/client';
import type { AppDeps } from '../src/app';

export const PASSWORD = 'correct-horse-battery-42';
export const WEB_ORIGIN = 'http://localhost:5173';

export const testAppDeps: AppDeps = { analysisQueue: { enqueue: async () => {} } };

// Tests use a no-op queue, so new meetings stay "pending". This fakes a finished analysis.
export async function markAnalysed(meetingId: string) {
  await pool.query("UPDATE meetings SET analysis_status = 'done' WHERE id = $1", [meetingId]);
}

export async function resetDatabase() {
  await pool.query(
    'TRUNCATE TABLE calendar_connections, analysis_runs, action_items, decisions, meetings, projects, password_resets, sessions, users RESTART IDENTITY CASCADE',
  );
}

export async function closeDatabase() {
  await pool.end();
}

export function sessionCookieHeader(res: Response): string | undefined {
  const raw: unknown = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? (raw as string[]) : [];
  return cookies.find((c) => c.startsWith('debrief_session='));
}

export function sessionCookiePair(res: Response): string {
  const header = sessionCookieHeader(res);
  if (!header) throw new Error('Response did not set a session cookie');
  return header.split(';')[0] ?? '';
}

export async function signUp(app: Express, name: string): Promise<string> {
  const res = await request(app)
    .post('/api/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ name, email: `${name.toLowerCase()}@debrief.test`, password: PASSWORD });
  if (res.status !== 201) throw new Error(`signUp failed: ${res.status}`);
  return sessionCookiePair(res);
}
