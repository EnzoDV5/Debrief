// Forgot password: links, expiry and setting a new password.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import {
  createEmailJsClient,
  type EmailClient,
  type PasswordResetEmail,
} from '../src/modules/auth/emailClient';
import {
  closeDatabase,
  PASSWORD,
  resetDatabase,
  sessionCookiePair,
  signUp,
  testAppDeps,
  WEB_ORIGIN,
} from './helpers';

const NEW_PASSWORD = 'Lantern-orbit-Velvet-42';

function fakeEmail() {
  const sent: PasswordResetEmail[] = [];
  const client: EmailClient = {
    configured: true,
    welcomeConfigured: false,
    sendPasswordReset: async (email) => {
      sent.push(email);
    },
    sendWelcome: async () => {},
  };
  return { client, sent };
}

let app: ReturnType<typeof createApp>;
let email: ReturnType<typeof fakeEmail>;
beforeEach(async () => {
  await resetDatabase();
  email = fakeEmail();
  app = createApp({ ...testAppDeps, email: email.client });
});
afterAll(closeDatabase);

const forgot = (address: string) =>
  request(app).post('/api/auth/forgot-password').set('Origin', WEB_ORIGIN).send({ email: address });
const reset = (token: string, password = NEW_PASSWORD) =>
  request(app).post('/api/auth/reset-password').set('Origin', WEB_ORIGIN).send({ token, password });
const login = (password: string) =>
  request(app)
    .post('/api/auth/login')
    .set('Origin', WEB_ORIGIN)
    .send({ email: 'alice@debrief.test', password });

async function tokenFromEmail(address = 'alice@debrief.test') {
  const before = email.sent.length;
  await forgot(address).expect(202);
  await vi.waitFor(() => expect(email.sent.length).toBe(before + 1));
  const link = new URL(email.sent.at(-1)!.link);
  return new URLSearchParams(link.hash.slice(1)).get('token')!;
}

describe('asking for a reset link', () => {
  it('emails a one-time link to the reset page, with the token after the #', async () => {
    await signUp(app, 'Alice');
    await tokenFromEmail();

    const [sent] = email.sent;
    expect(sent).toMatchObject({ to: 'alice@debrief.test', name: 'Alice', expiresInMinutes: 30 });
    expect(sent!.link).toMatch(new RegExp(`^${WEB_ORIGIN}/reset-password#token=[\\w-]{40,}$`));
  });

  it('answers the same for an unknown email, and sends nothing', async () => {
    const res = await forgot('nobody@debrief.test');

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(email.sent).toHaveLength(0);
  });

  it('stores only a hash of the token', async () => {
    await signUp(app, 'Alice');
    const token = await tokenFromEmail();

    const { rows } = await pool.query('SELECT id FROM password_resets');
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token);
    expect(rows[0].id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates the email', async () => {
    const res = await forgot('not-an-email');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ email: 'Enter a valid email address' });
  });

  it('is rate-limited, so nobody can flood an inbox', async () => {
    for (let i = 0; i < 10; i++) await forgot('nobody@debrief.test').expect(202);
    expect((await forgot('nobody@debrief.test')).status).toBe(429);
  });

  it('still answers 202 when sending the email fails (and logs it)', async () => {
    await signUp(app, 'Alice');
    app = createApp({
      ...testAppDeps,
      email: {
        configured: true,
        welcomeConfigured: false,
        sendPasswordReset: async () => {
          throw new Error('EmailJS is down');
        },
        sendWelcome: async () => {},
      },
    });
    expect((await forgot('alice@debrief.test')).status).toBe(202);
  });
});

describe('using the link', () => {
  it('sets the new password, logs out every session, and the old password stops working', async () => {
    const session = await signUp(app, 'Alice');
    const token = await tokenFromEmail();

    expect((await reset(token)).status).toBe(204);

    expect((await request(app).get('/api/auth/me').set('Cookie', session)).status).toBe(401);
    expect((await login(PASSWORD)).status).toBe(401);
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it('works only once', async () => {
    await signUp(app, 'Alice');
    const token = await tokenFromEmail();

    await reset(token).expect(204);
    const again = await reset(token, 'Another-strong-pass-77');

    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('RESET_LINK_INVALID');
    expect((await login(NEW_PASSWORD)).status).toBe(200);
  });

  it('stops working after 30 minutes', async () => {
    await signUp(app, 'Alice');
    const token = await tokenFromEmail();
    await pool.query(`UPDATE password_resets SET expires_at = now() - interval '1 second'`);

    expect((await reset(token)).body.error.code).toBe('RESET_LINK_INVALID');
  });

  it('only the newest link works when asked twice', async () => {
    await signUp(app, 'Alice');
    const first = await tokenFromEmail();
    const second = await tokenFromEmail();

    expect((await reset(first)).status).toBe(400);
    expect((await reset(second)).status).toBe(204);
  });

  it('rejects a made-up token', async () => {
    const res = await reset('made-up-token');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe(
      'This reset link has expired or has already been used. Ask for a new one.',
    );
  });

  it('holds the new password to the same rules as sign-up', async () => {
    await signUp(app, 'Alice');
    const token = await tokenFromEmail();

    const res = await reset(token, 'short');
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({
      password: 'Add 7 more characters, a number and a symbol',
    });
    expect((await reset(token)).status).toBe(204);
  });

  it('does nothing for a deleted account', async () => {
    const session = await signUp(app, 'Alice');
    const token = await tokenFromEmail();
    await request(app)
      .delete('/api/auth/account')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', session)
      .send({ password: PASSWORD })
      .expect(204);

    expect((await reset(token)).status).toBe(400);
  });

  it('gives an account made with Google a password it can log in with', async () => {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, google_sub) VALUES ('alice@debrief.test', 'Alice', NULL, 'g-1')`,
    );
    const token = await tokenFromEmail();

    await reset(token).expect(204);
    const res = await login(NEW_PASSWORD);
    expect(res.status).toBe(200);
    expect(sessionCookiePair(res)).toBeTruthy();
  });
});

describe('offering the link', () => {
  it('is only offered when email is set up', async () => {
    expect((await request(app).get('/api/auth/providers')).body.passwordReset).toBe(true);
    app = createApp(testAppDeps);
    expect((await request(app).get('/api/auth/providers')).body.passwordReset).toBe(false);
  });
});

describe('the EmailJS client', () => {
  it('sends the template values with the private key, from the server', async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const client = createEmailJsClient({
      serviceId: 'service_1',
      templateId: 'template_1',
      publicKey: 'public',
      privateKey: 'private',
      fetchImpl: (async (url: string, init: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return new Response('OK', { status: 200 });
      }) as unknown as typeof fetch,
    });

    await client.sendPasswordReset({
      to: 'alice@debrief.test',
      name: 'Alice',
      link: 'https://debrief.example/reset-password#token=abc',
      expiresInMinutes: 30,
    });

    expect(calls[0]?.url).toBe('https://api.emailjs.com/api/v1.0/email/send');
    expect(calls[0]?.body).toEqual({
      service_id: 'service_1',
      template_id: 'template_1',
      user_id: 'public',
      accessToken: 'private',
      template_params: {
        to_email: 'alice@debrief.test',
        to_name: 'Alice',
        reset_link: 'https://debrief.example/reset-password#token=abc',
        expires_minutes: '30',
      },
    });
  });

  it('fails clearly when EmailJS refuses', async () => {
    const client = createEmailJsClient({
      serviceId: 's',
      templateId: 't',
      publicKey: 'p',
      privateKey: 'k',
      fetchImpl: (async () =>
        new Response('API calls are disabled for non-browser applications', {
          status: 403,
        })) as unknown as typeof fetch,
    });
    await expect(
      client.sendPasswordReset({ to: 'a@b.c', name: 'A', link: 'x', expiresInMinutes: 30 }),
    ).rejects.toThrow('EmailJS refused the email (403)');
  });
});
