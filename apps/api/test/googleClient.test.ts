import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  CALENDAR_SCOPE,
  createGoogleClient,
  createPkcePair,
  GoogleError,
} from '../src/modules/integrations/googleClient';

function setup(responses: Response[]) {
  const fetchImpl = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('no scripted response');
    return next;
  });
  const google = createGoogleClient({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:5173/api/integrations/google/callback',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  const call = (i: number) => fetchImpl.mock.calls[i] as unknown as [string, RequestInit];
  return { google, fetchImpl, call };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('Google client', () => {
  it('builds a consent URL asking only for calendar events, offline, with state and PKCE', () => {
    const url = new URL(setup([]).google.authUrl('the-state', 'the-challenge'));

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-id',
      scope: CALENDAR_SCOPE,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      state: 'the-state',
      code_challenge: 'the-challenge',
      code_challenge_method: 'S256',
    });
  });

  it('makes a PKCE pair whose challenge is the SHA-256 of the verifier', () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).toBe(createHash('sha256').update(verifier).digest('base64url'));
  });

  it('swaps the code (with the PKCE verifier) for a refresh token', async () => {
    const { google, call } = setup([
      json(200, { refresh_token: 'refresh', scope: CALENDAR_SCOPE, access_token: 'a' }),
    ]);
    expect(await google.exchangeCode('the-code', 'the-verifier')).toEqual({
      refreshToken: 'refresh',
      scope: CALENDAR_SCOPE,
    });
    const body = new URLSearchParams(String(call(0)[1].body));
    expect(Object.fromEntries(body)).toMatchObject({
      grant_type: 'authorization_code',
      code: 'the-code',
      code_verifier: 'the-verifier',
    });
  });

  it('reports a revoked refresh token so the user can reconnect', async () => {
    const { google } = setup([json(400, { error: 'invalid_grant' })]);
    await expect(google.accessToken('dead')).rejects.toMatchObject({ kind: 'revoked' });
  });

  it('creates an all-day event (Google’s end date is the next day)', async () => {
    const { google, call } = setup([json(200, { id: 'evt1', htmlLink: 'https://cal/evt1' })]);
    const event = await google.upsertEvent('access', {
      eventId: null,
      summary: 'Send files',
      description: 'd',
      date: '2026-11-30',
    });

    expect(event).toEqual({ id: 'evt1', htmlLink: 'https://cal/evt1' });
    const [url, init] = call(0);
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({
      start: { date: '2026-11-30' },
      end: { date: '2026-12-01' },
    });
  });

  it('updates the existing event instead of duplicating it', async () => {
    const { google, call } = setup([json(200, { id: 'evt1', htmlLink: 'https://cal/evt1' })]);
    await google.upsertEvent('access', {
      eventId: 'evt1',
      summary: 's',
      description: 'd',
      date: '2026-12-31',
    });
    expect(call(0)[0]).toMatch(/\/events\/evt1$/);
    expect(call(0)[1].method).toBe('PUT');
  });

  it('creates a new event if the old one was deleted in Google', async () => {
    const { google, call } = setup([
      json(410, {}),
      json(200, { id: 'evt2', htmlLink: 'https://cal/evt2' }),
    ]);
    const event = await google.upsertEvent('access', {
      eventId: 'gone',
      summary: 's',
      description: 'd',
      date: '2026-12-01',
    });
    expect(event.id).toBe('evt2');
    expect(call(1)[1].method).toBe('POST');
  });

  it('turns a Google error into a GoogleError', async () => {
    const { google } = setup([json(500, {})]);
    await expect(
      google.upsertEvent('a', {
        eventId: null,
        summary: 's',
        description: 'd',
        date: '2026-12-01',
      }),
    ).rejects.toBeInstanceOf(GoogleError);
  });
});
