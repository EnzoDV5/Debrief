// Google Calendar: connecting, adding items and isolation.
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import { decryptSecret } from '../src/lib/crypto';
import {
  CALENDAR_SCOPE,
  GoogleError,
  type CalendarEvent,
  type GoogleClient,
} from '../src/modules/integrations/googleClient';
import { createIntegrationsService } from '../src/modules/integrations/integrations.service';
import { closeDatabase, PASSWORD, resetDatabase, signUp, testAppDeps, WEB_ORIGIN } from './helpers';

const REFRESH_TOKEN = '1//refresh-token-from-google';
const key = randomBytes(32);

function fakeGoogle(overrides: Partial<GoogleClient> = {}) {
  const calls = { events: [] as CalendarEvent[], revoked: [] as string[], codes: [] as string[] };
  const google: GoogleClient = {
    configured: true,
    authUrl: (state, challenge) =>
      `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&code_challenge=${challenge}`,
    exchangeCode: async (code) => {
      calls.codes.push(code);
      return { refreshToken: REFRESH_TOKEN, scope: CALENDAR_SCOPE };
    },
    accessToken: async () => 'access-token',
    upsertEvent: async (_token, event) => {
      calls.events.push(event);
      return {
        id: event.eventId ?? `evt${calls.events.length}`,
        htmlLink: 'https://calendar.google.com/event?eid=1',
      };
    },
    revoke: async (token) => {
      calls.revoked.push(token);
    },
    ...overrides,
  };
  return { google, calls };
}

let app: ReturnType<typeof createApp>;
let google: ReturnType<typeof fakeGoogle>;
let alice: string;
let bob: string;

function buildApp(googleClient = fakeGoogle()) {
  google = googleClient;
  app = createApp({
    ...testAppDeps,
    integrations: createIntegrationsService({
      google: googleClient.google,
      encryptionKey: key,
      webOrigin: 'http://localhost:5173',
    }),
  });
}

beforeEach(async () => {
  await resetDatabase();
  buildApp();
  alice = await signUp(app, 'Alice');
  bob = await signUp(app, 'Bob');
});
afterAll(closeDatabase);

async function connect(cookie: string, tamper?: (state: string) => string) {
  const start = await request(app).get('/api/integrations/google/connect').set('Cookie', cookie);
  const state = new URL(start.headers.location as string).searchParams.get('state') ?? '';
  const oauthCookie = (start.headers['set-cookie'] as unknown as string[])
    .find((c) => c.startsWith('debrief_google_oauth='))!
    .split(';')[0];
  return request(app)
    .get(`/api/integrations/google/callback?code=auth-code&state=${tamper ? tamper(state) : state}`)
    .set('Cookie', `${cookie}; ${oauthCookie}`);
}

async function itemFor(cookie: string, dueDate: string | null = '2026-11-30') {
  const meeting = await request(app)
    .post('/api/meetings')
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie)
    .send({ title: 'Plan', meetingDate: '2026-11-24', transcript: 'Ann: hi' });
  const item = await request(app)
    .post(`/api/meetings/${meeting.body.meeting.id}/action-items`)
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie)
    .send({ text: 'Send the files', owner: 'Ann', dueDate });
  return item.body.actionItem.id as string;
}

const addToCalendar = (cookie: string, id: string) =>
  request(app)
    .post(`/api/action-items/${id}/calendar`)
    .set('Origin', WEB_ORIGIN)
    .set('Cookie', cookie);

describe('connecting Google Calendar', () => {
  it('reports the feature as unavailable when the server has no Google keys', async () => {
    const plain = createApp(testAppDeps);
    const cookie = await signUp(plain, 'Carol');
    const res = await request(plain).get('/api/integrations/google').set('Cookie', cookie);
    expect(res.body).toEqual({ available: false, connected: false, connectedAt: null });
  });

  it('sends the user to Google with state + PKCE, remembered in an httpOnly cookie', async () => {
    const res = await request(app).get('/api/integrations/google/connect').set('Cookie', alice);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(
      /^https:\/\/accounts\.google\.com\/.*state=.+&code_challenge=.+/,
    );
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('debrief_google_oauth='),
    );
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\/api\/integrations\/google/);
  });

  it('connects and stores the refresh token encrypted, never in plain text', async () => {
    const res = await connect(alice);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:5173/account?calendar=connected');
    const { rows } = await pool.query(
      'SELECT refresh_token_encrypted, scope FROM calendar_connections',
    );
    expect(rows[0].refresh_token_encrypted).not.toContain(REFRESH_TOKEN);
    expect(decryptSecret(rows[0].refresh_token_encrypted, key)).toBe(REFRESH_TOKEN);
    expect(rows[0].scope).toBe(CALENDAR_SCOPE);

    const status = await request(app).get('/api/integrations/google').set('Cookie', alice);
    expect(status.body).toMatchObject({ available: true, connected: true });
  });

  it('rejects a callback whose state does not match (CSRF) and saves nothing', async () => {
    const res = await connect(alice, (state) => `${state}x`);
    expect(res.headers.location).toBe('http://localhost:5173/account?calendar=error');
    expect(google.calls.codes).toEqual([]);
    expect((await pool.query('SELECT 1 FROM calendar_connections')).rowCount).toBe(0);
  });

  it('rejects a callback that did not start in this browser (no state cookie)', async () => {
    const res = await request(app)
      .get('/api/integrations/google/callback?code=c&state=anything')
      .set('Cookie', alice);
    expect(res.headers.location).toBe('http://localhost:5173/account?calendar=error');
  });

  it('handles the user saying no on Google’s screen', async () => {
    const res = await request(app)
      .get('/api/integrations/google/callback?error=access_denied')
      .set('Cookie', alice);
    expect(res.headers.location).toBe('http://localhost:5173/account?calendar=denied');
  });

  it('refuses a connection without calendar permission, and revokes it', async () => {
    buildApp(
      fakeGoogle({ exchangeCode: async () => ({ refreshToken: REFRESH_TOKEN, scope: 'openid' }) }),
    );
    const res = await connect(alice);
    expect(res.headers.location).toBe('http://localhost:5173/account?calendar=error');
    expect(google.calls.revoked).toEqual([REFRESH_TOKEN]);
    expect((await pool.query('SELECT 1 FROM calendar_connections')).rowCount).toBe(0);
  });

  it('disconnects: revokes the token at Google and deletes our copy', async () => {
    await connect(alice);
    const res = await request(app)
      .delete('/api/integrations/google')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', alice);

    expect(res.status).toBe(204);
    expect(google.calls.revoked).toEqual([REFRESH_TOKEN]);
    expect((await pool.query('SELECT 1 FROM calendar_connections')).rowCount).toBe(0);
  });

  it('forgets the connection when the account is deleted', async () => {
    await connect(alice);
    await request(app)
      .delete('/api/auth/account')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', alice)
      .send({ password: PASSWORD });
    expect((await pool.query('SELECT 1 FROM calendar_connections')).rowCount).toBe(0);
  });
});

describe('adding an action item to the calendar', () => {
  it('creates an all-day event on the due date with a link back to the meeting', async () => {
    await connect(alice);
    const id = await itemFor(alice);
    const res = await addToCalendar(alice, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      actionItem: { id, inCalendar: true },
      eventUrl: 'https://calendar.google.com/event?eid=1',
    });
    expect(google.calls.events[0]).toMatchObject({
      eventId: null,
      summary: 'Send the files',
      date: '2026-11-30',
    });
    expect(google.calls.events[0]?.description).toMatch(
      /Owner: Ann[\s\S]*http:\/\/localhost:5173\/meetings\//,
    );
  });

  it('updates the same event when added again (no duplicates)', async () => {
    await connect(alice);
    const id = await itemFor(alice);
    await addToCalendar(alice, id);
    await addToCalendar(alice, id);
    expect(google.calls.events.map((e) => e.eventId)).toEqual([null, 'evt1']);
  });

  it('needs a due date and a connection first', async () => {
    const noDate = await itemFor(alice, null);
    const withDate = await itemFor(alice);

    const notConnected = await addToCalendar(alice, withDate);
    expect(notConnected.status).toBe(409);
    expect(notConnected.body.error.code).toBe('CALENDAR_NOT_CONNECTED');

    await connect(alice);
    const missingDate = await addToCalendar(alice, noDate);
    expect(missingDate.status).toBe(400);
    expect(missingDate.body.error.code).toBe('NO_DUE_DATE');
  });

  it('asks to reconnect if access was revoked in Google, and drops the dead token', async () => {
    await connect(alice);
    buildApp(
      fakeGoogle({
        accessToken: async () => {
          throw new GoogleError('revoked', 'gone');
        },
      }),
    );
    const id = await itemFor(alice);
    const res = await addToCalendar(alice, id);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CALENDAR_RECONNECT');
    expect((await pool.query('SELECT 1 FROM calendar_connections')).rowCount).toBe(0);
  });

  it('gives a clear, retryable error when Google is down', async () => {
    await connect(alice);
    buildApp(
      fakeGoogle({
        upsertEvent: async () => {
          throw new GoogleError('failed', '500');
        },
      }),
    );
    const res = await addToCalendar(alice, await itemFor(alice));
    expect(res.status).toBe(502);
    expect(res.body.error.message).toMatch(/try again/);
  });

  it('isolation: Bob cannot put Alice’s item in any calendar', async () => {
    await connect(alice);
    await connect(bob);
    const alicesItem = await itemFor(alice);

    const res = await addToCalendar(bob, alicesItem);
    expect(res.status).toBe(404);
    expect(google.calls.events).toEqual([]);
  });
});
