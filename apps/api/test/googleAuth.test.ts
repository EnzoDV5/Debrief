// Sign in with Google, end to end with a fake Google.
import request, { type Response } from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { GoogleIdentity, GoogleSignInClient } from '../src/modules/auth/googleSignIn';
import {
  closeDatabase,
  PASSWORD,
  resetDatabase,
  sessionCookiePair,
  signUp,
  testAppDeps,
  WEB_ORIGIN,
} from './helpers';

const SUB = '108234567890123456789';

function fakeGoogle(identity: Partial<GoogleIdentity> = {}): GoogleSignInClient {
  let lastNonce = '';
  return {
    configured: true,
    authUrl: ({ state, codeChallenge, nonce }) => {
      lastNonce = nonce;
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&code_challenge=${codeChallenge}&nonce=${nonce}`;
    },
    exchangeCode: async () => ({
      sub: SUB,
      email: 'thandi@example.com',
      emailVerified: true,
      name: 'Thandi Nkosi',
      picture: 'https://lh3.googleusercontent.com/a/thandi-1',
      nonce: lastNonce,
      ...identity,
    }),
  };
}

let app: ReturnType<typeof createApp>;
function buildApp(google: GoogleSignInClient | null = fakeGoogle()) {
  app = createApp({ ...testAppDeps, googleSignIn: google ?? undefined });
}

beforeEach(async () => {
  await resetDatabase();
  buildApp();
});
afterAll(closeDatabase);

function setCookies(res: Response): string[] {
  const raw: unknown = res.headers['set-cookie'];
  return Array.isArray(raw) ? (raw as string[]) : [];
}

async function signInWithGoogle({
  next,
  cookie,
  state: tamperState,
  query,
}: {
  next?: string;
  cookie?: string;
  state?: string;
  query?: string;
} = {}) {
  const start = await request(app)
    .get(`/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`)
    .set('Cookie', cookie ?? '');
  expect(start.status).toBe(302);
  const state = new URL(start.headers.location as string).searchParams.get('state') ?? '';
  const signInCookie = setCookies(start)
    .find((c) => c.startsWith('debrief_google_signin='))
    ?.split(';')[0];
  return request(app)
    .get(`/api/auth/google/callback?${query ?? `code=auth-code&state=${tamperState ?? state}`}`)
    .set('Cookie', [cookie, signInCookie].filter(Boolean).join('; '));
}

const me = (cookie: string) => request(app).get('/api/auth/me').set('Cookie', cookie);

describe('sign-in options', () => {
  it('offers Google only when the server has it set up', async () => {
    expect((await request(app).get('/api/auth/providers')).body).toEqual({
      google: true,
      passwordReset: false,
    });
    buildApp(null);
    expect((await request(app).get('/api/auth/providers')).body).toEqual({
      google: false,
      passwordReset: false,
    });
  });

  it('sends the user back with a message when Google is not set up', async () => {
    buildApp(null);
    const res = await request(app).get('/api/auth/google/start');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=unavailable`);
  });
});

describe('starting a Google sign-in', () => {
  it('redirects to Google with state, nonce and PKCE, and remembers them in a short-lived cookie', async () => {
    const res = await request(app).get('/api/auth/google/start');

    const url = new URL(res.headers.location as string);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('state')).toMatch(/^[\w-]{40,}$/);
    expect(url.searchParams.get('nonce')).toMatch(/^[\w-]{40,}$/);
    expect(url.searchParams.get('code_challenge')).toBeTruthy();

    const cookie = setCookies(res).find((c) => c.startsWith('debrief_google_signin='))!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
    expect(cookie).toMatch(/Max-Age=600/);
  });
});

describe('finishing a Google sign-in', () => {
  it('creates an account the first time, without a password, and logs the user in', async () => {
    const res = await signInWithGoogle();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/meetings?signed_in=new`);
    const session = sessionCookiePair(res);
    const { body } = await me(session);
    expect(body.user).toMatchObject({
      email: 'thandi@example.com',
      name: 'Thandi Nkosi',
      hasPassword: false,
      avatarUrl: 'https://lh3.googleusercontent.com/a/thandi-1',
    });
    expect(setCookies(res).some((c) => /^debrief_google_signin=;/.test(c))).toBe(true);
  });

  it('finds the same account next time, by Google id, even if the email changed', async () => {
    const first = await signInWithGoogle();
    const firstUser = (await me(sessionCookiePair(first))).body.user;

    buildApp(fakeGoogle({ email: 'thandi.new@example.com' }));
    const second = await signInWithGoogle();
    const secondUser = (await me(sessionCookiePair(second))).body.user;

    expect(secondUser.id).toBe(firstUser.id);
    expect(second.headers.location).toBe(`${WEB_ORIGIN}/meetings?signed_in=back`);
  });

  it('keeps the profile photo in step with Google on each sign-in', async () => {
    await signInWithGoogle();

    buildApp(fakeGoogle({ picture: 'https://lh3.googleusercontent.com/a/thandi-2' }));
    const changed = await signInWithGoogle();
    expect((await me(sessionCookiePair(changed))).body.user.avatarUrl).toBe(
      'https://lh3.googleusercontent.com/a/thandi-2',
    );

    buildApp(fakeGoogle({ picture: null }));
    const removed = await signInWithGoogle();
    expect((await me(sessionCookiePair(removed))).body.user.avatarUrl).toBeNull();
  });

  it('links Google to an existing password account with the same verified email', async () => {
    const passwordCookie = await signUp(app, 'Alice');
    const passwordUser = (await me(passwordCookie)).body.user;
    buildApp(fakeGoogle({ email: 'alice@debrief.test', sub: 'alice-google' }));

    const res = await signInWithGoogle();
    const googleUser = (await me(sessionCookiePair(res))).body.user;

    expect(googleUser.id).toBe(passwordUser.id);
    expect(googleUser.hasPassword).toBe(true);
    expect(passwordUser.avatarUrl).toBeNull();
    expect(googleUser.avatarUrl).toBe('https://lh3.googleusercontent.com/a/thandi-1');
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: 'alice@debrief.test', password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('refuses an email Google has not verified, so it cannot take over an account', async () => {
    await signUp(app, 'Alice');
    buildApp(fakeGoogle({ email: 'alice@debrief.test', emailVerified: false }));

    const res = await signInWithGoogle();

    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=unverified`);
    expect(sessionCookieOf(res)).toBeUndefined();
  });

  it('continues to the page the user originally asked for', async () => {
    const res = await signInWithGoogle({ next: '/meetings/abc?tab=items' });
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/meetings/abc?tab=items&signed_in=new`);
  });

  it('never redirects to another site (open redirect)', async () => {
    for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
      const res = await signInWithGoogle({ next });
      expect(new URL(res.headers.location as string).origin).toBe(WEB_ORIGIN);
      expect(new URL(res.headers.location as string).pathname).toBe('/meetings');
    }
  });

  it('ends the session the browser already had and starts a fresh one', async () => {
    const old = await signUp(app, 'Bob');
    const res = await signInWithGoogle({ cookie: old });

    expect(sessionCookiePair(res)).not.toBe(old);
    expect((await me(old)).status).toBe(401);
  });
});

describe('Google sign-in that must not succeed', () => {
  it('rejects a state that does not match this browser (CSRF)', async () => {
    const res = await signInWithGoogle({ state: 'attacker-state' });
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=error`);
    expect(sessionCookieOf(res)).toBeUndefined();
  });

  it('rejects a callback without the sign-in cookie (expired, or started elsewhere)', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=auth-code&state=anything');
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=error`);
    expect(sessionCookieOf(res)).toBeUndefined();
  });

  it('rejects an ID token from another sign-in attempt (nonce mismatch)', async () => {
    buildApp(fakeGoogle({ nonce: 'replayed-nonce' }));
    const res = await signInWithGoogle();
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=error`);
    expect(sessionCookieOf(res)).toBeUndefined();
  });

  it('treats Cancel on Google’s screen as a choice, not an error', async () => {
    const res = await signInWithGoogle({ query: 'error=access_denied' });
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=denied`);
  });

  it('sends the user back with a message when Google fails', async () => {
    buildApp({
      ...fakeGoogle(),
      exchangeCode: async () => {
        throw new Error('Google is down');
      },
    });
    const res = await signInWithGoogle({ next: '/account' });
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?google=error&next=%2Faccount`);
  });

  it('never lets a deleted account back in: a new, empty account is made instead', async () => {
    const first = await signInWithGoogle();
    const session = sessionCookiePair(first);
    const deletedId = (await me(session)).body.user.id;
    await request(app)
      .delete('/api/auth/account')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({ email: 'thandi@example.com' })
      .expect(204);

    const again = await signInWithGoogle();
    const user = (await me(sessionCookiePair(again))).body.user;
    expect(user.id).not.toBe(deletedId);
  });
});

describe('Google-only accounts', () => {
  async function googleAccount() {
    return sessionCookiePair(await signInWithGoogle());
  }

  it('cannot be logged into with a password (same generic error as a wrong password)', async () => {
    await googleAccount();
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: 'thandi@example.com', password: 'any-password-at-all' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('confirms account deletion with the account email, not a password', async () => {
    const session = await googleAccount();
    const del = (body: object) =>
      request(app)
        .delete('/api/auth/account')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', session)
        .send(body);

    const wrong = await del({ email: 'someone@else.com' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields).toEqual({ email: 'That isn’t the email for this account' });

    expect((await del({ password: 'guessing' })).status).toBe(400);
    expect((await del({ email: ' Thandi@Example.com ' })).status).toBe(204);
    expect((await me(session)).status).toBe(401);
  });
});

function sessionCookieOf(res: Response) {
  return setCookies(res).find(
    (c) => c.startsWith('debrief_session=') && !/^debrief_session=;/.test(c),
  );
}
