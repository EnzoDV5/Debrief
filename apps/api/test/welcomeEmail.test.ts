// The welcome email goes out once, and never breaks sign-up.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import type { EmailClient, WelcomeEmail } from '../src/modules/auth/emailClient';
import type { GoogleSignInClient } from '../src/modules/auth/googleSignIn';
import { closeDatabase, PASSWORD, resetDatabase, testAppDeps, WEB_ORIGIN } from './helpers';

function fakeEmail({ fail = false } = {}) {
  const welcomed: WelcomeEmail[] = [];
  const client: EmailClient = {
    configured: true,
    welcomeConfigured: true,
    sendPasswordReset: async () => {},
    sendWelcome: async (email) => {
      if (fail) throw new Error('EmailJS is down');
      welcomed.push(email);
    },
  };
  return { client, welcomed };
}

function fakeGoogle(): GoogleSignInClient {
  let nonce = '';
  return {
    configured: true,
    authUrl: (params) => {
      nonce = params.nonce;
      return `https://accounts.google.com/o/oauth2/v2/auth?state=${params.state}`;
    },
    exchangeCode: async () => ({
      sub: 'google-1',
      email: 'thandi@example.com',
      emailVerified: true,
      name: 'Thandi Nkosi',
      picture: null,
      nonce,
    }),
  };
}

let app: ReturnType<typeof createApp>;
let email: ReturnType<typeof fakeEmail>;
beforeEach(async () => {
  await resetDatabase();
  email = fakeEmail();
  app = createApp({ ...testAppDeps, email: email.client, googleSignIn: fakeGoogle() });
});
afterAll(closeDatabase);

const register = () =>
  request(app)
    .post('/api/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ name: 'Alice', email: 'alice@debrief.test', password: PASSWORD });

async function signInWithGoogle() {
  const start = await request(app).get('/api/auth/google/start');
  const state = new URL(start.headers.location as string).searchParams.get('state');
  const raw: unknown = start.headers['set-cookie'];
  const cookie = (raw as string[]).find((c) => c.startsWith('debrief_google_signin='))!;
  return request(app)
    .get(`/api/auth/google/callback?code=c&state=${state}`)
    .set('Cookie', cookie.split(';')[0]!);
}

describe('the welcome email', () => {
  it('goes to the person who just signed up, with a link into the app', async () => {
    await register().expect(201);

    await vi.waitFor(() => expect(email.welcomed).toHaveLength(1));
    expect(email.welcomed[0]).toEqual({
      to: 'alice@debrief.test',
      name: 'Alice',
      appLink: `${WEB_ORIGIN}/meetings`,
    });
  });

  it('never gets in the way of signing up, even when sending fails', async () => {
    email = fakeEmail({ fail: true });
    app = createApp({ ...testAppDeps, email: email.client });

    expect((await register()).status).toBe(201);
  });

  it('isn’t sent for a sign-up that was refused', async () => {
    await register().expect(201);
    await vi.waitFor(() => expect(email.welcomed).toHaveLength(1));

    expect((await register()).status).toBe(409);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(email.welcomed).toHaveLength(1);
  });

  it('greets a new Google account once, not on every Google sign-in', async () => {
    await signInWithGoogle();
    await vi.waitFor(() => expect(email.welcomed).toHaveLength(1));
    expect(email.welcomed[0]?.to).toBe('thandi@example.com');

    await signInWithGoogle();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(email.welcomed).toHaveLength(1);
  });

  it('is skipped when there is no welcome template', async () => {
    const quiet = fakeEmail();
    app = createApp({ ...testAppDeps, email: { ...quiet.client, welcomeConfigured: false } });

    await register().expect(201);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(quiet.welcomed).toHaveLength(0);
  });
});
