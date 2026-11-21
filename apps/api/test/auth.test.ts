// Accounts: register, log in, log out, delete, sessions and rate limits.
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { pool } from '../src/db/client';
import {
  closeDatabase,
  PASSWORD,
  resetDatabase,
  sessionCookieHeader,
  sessionCookiePair,
  WEB_ORIGIN,
  testAppDeps,
} from './helpers';

let app: ReturnType<typeof createApp>;
beforeEach(async () => {
  await resetDatabase();
  app = createApp(testAppDeps);
});
afterAll(closeDatabase);

const alice = { name: 'Alice', email: 'alice@debrief.test', password: PASSWORD };

function register(body: object = alice) {
  return request(app).post('/api/auth/register').set('Origin', WEB_ORIGIN).send(body);
}
function login(body: object = { email: alice.email, password: PASSWORD }) {
  return request(app).post('/api/auth/login').set('Origin', WEB_ORIGIN).send(body);
}
function me(cookie?: string) {
  const req = request(app).get('/api/auth/me');
  return cookie ? req.set('Cookie', cookie) : req;
}

describe('POST /api/auth/register', () => {
  it('creates the account, logs the user in and never returns the password hash', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Alice', email: 'alice@debrief.test' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect((await me(sessionCookiePair(res))).status).toBe(200);
  });

  it('sets a hardened session cookie', async () => {
    const cookie = sessionCookieHeader(await register());

    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=604800/);
  });

  it('stores an argon2id hash, not the password, and only a hash of the session token', async () => {
    const res = await register();
    const token = sessionCookiePair(res).split('=')[1];

    const user = await pool.query('SELECT password_hash FROM users');
    expect(user.rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(user.rows[0].password_hash).not.toContain(PASSWORD);

    const session = await pool.query('SELECT id FROM sessions');
    expect(session.rows[0].id).toMatch(/^[0-9a-f]{64}$/);
    expect(session.rows[0].id).not.toBe(token);
  });

  it('normalises the email (trim + lowercase)', async () => {
    const res = await register({ ...alice, email: '  Alice@Debrief.TEST ' });
    expect(res.body.user.email).toBe('alice@debrief.test');
  });

  it('returns a message per invalid field', async () => {
    const res = await register({ name: '', email: 'not-an-email', password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual({
      name: 'Enter your name',
      email: 'Enter a valid email address',
      password: 'Add 7 more characters, a number and a symbol',
    });
  });

  it.each([
    ['letters only', 'onlylettersherexyz', 'Add a number and a symbol'],
    ['missing a symbol', 'lantern orbit 42', 'Add a symbol'],
    ['missing a letter', '1234-5678-9012', 'Add a letter'],
    ['one character short', 'lantern-o-4', 'Add 1 more character'],
  ])('rejects a password that is %s', async (_label, password, message) => {
    const res = await register({ ...alice, password });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ password: message });
  });

  it('rejects passwords over 128 characters', async () => {
    const res = await register({ ...alice, password: 'x'.repeat(129) });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.password).toBeDefined();
  });

  it('rejects a body that is not an object', async () => {
    const res = await register(['not', 'an', 'object']);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate email, ignoring case', async () => {
    await register();
    const res = await register({ ...alice, email: 'ALICE@debrief.test' });

    expect(res.status).toBe(409);
    expect(res.body.error.fields.email).toBe('An account with this email already exists');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in with the right password', async () => {
    const res = await login();
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(alice.email);
    expect(sessionCookieHeader(res)).toBeDefined();
  });

  it('gives the same generic error for a wrong password and an unknown email', async () => {
    const wrongPassword = await login({ email: alice.email, password: 'wrong-password-123' });
    const unknownEmail = await login({ email: 'nobody@debrief.test', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.message).toBe('Invalid email or password');
  });

  it('issues a new session and ends the one the browser already had', async () => {
    const before = sessionCookiePair(await login());
    const res = await request(app)
      .post('/api/auth/login')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', before)
      .send({ email: alice.email, password: PASSWORD });
    const after = sessionCookiePair(res);

    expect(after).not.toBe(before);
    expect((await me(before)).status).toBe(401);
    expect((await me(after)).status).toBe(200);
  });

  it('validates the input', async () => {
    const res = await login({ email: '', password: '' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(['email', 'password']);
  });
});

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  it('returns 401 without a session, with a made-up token, or with an expired session', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('debrief_session=made-up-token')).status).toBe(401);

    const cookie = sessionCookiePair(await register());
    await pool.query("UPDATE sessions SET expires_at = now() - interval '1 minute'");
    expect((await me(cookie)).status).toBe(401);
  });

  it('logs out: deletes the session server-side and clears the cookie', async () => {
    const cookie = sessionCookiePair(await register());
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', WEB_ORIGIN)
      .set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(sessionCookieHeader(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect((await pool.query('SELECT 1 FROM sessions')).rowCount).toBe(0);
    expect((await me(cookie)).status).toBe(401);
  });
});

describe('DELETE /api/auth/account', () => {
  function deleteAccount(cookie: string | undefined, body: object) {
    const req = request(app).delete('/api/auth/account').set('Origin', WEB_ORIGIN);
    return (cookie ? req.set('Cookie', cookie) : req).send(body);
  }

  it('requires a session', async () => {
    expect((await deleteAccount(undefined, { password: PASSWORD })).status).toBe(401);
  });

  it('requires the correct password and leaves the account alone otherwise', async () => {
    const cookie = sessionCookiePair(await register());
    const res = await deleteAccount(cookie, { password: 'wrong-password-123' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ password: 'Password is incorrect' });
    expect((await me(cookie)).status).toBe(200);
  });

  it('soft-deletes: keeps the row, ends every session and blocks login', async () => {
    const laptop = sessionCookiePair(await register());
    const phone = sessionCookiePair(await login());

    const res = await deleteAccount(laptop, { password: PASSWORD });
    expect(res.status).toBe(204);

    const rows = await pool.query('SELECT deleted_at FROM users');
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].deleted_at).not.toBeNull();

    expect((await me(laptop)).status).toBe(401);
    expect((await me(phone)).status).toBe(401);
    const again = await login();
    expect(again.status).toBe(401);
    expect(again.body.error.message).toBe('Invalid email or password');
  });

  it('lets the same email register again after deletion', async () => {
    const cookie = sessionCookiePair(await register());
    await deleteAccount(cookie, { password: PASSWORD });

    expect((await register()).status).toBe(201);
  });
});

describe('security middleware', () => {
  it('blocks state-changing requests from another website (CSRF)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .send(alice);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ORIGIN');
    expect((await pool.query('SELECT 1 FROM users')).rowCount).toBe(0);
  });

  it('allows non-browser clients that send no Origin header', async () => {
    const res = await request(app).post('/api/auth/register').send(alice);
    expect(res.status).toBe(201);
  });

  it('rate-limits failed logins: the 11th attempt in 15 minutes gets 429', async () => {
    await register();
    for (let i = 0; i < 10; i++) {
      expect((await login({ email: alice.email, password: 'wrong-password-123' })).status).toBe(
        401,
      );
    }
    const blocked = await login();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not count successful logins toward the limit', async () => {
    await register();
    for (let i = 0; i < 12; i++) {
      expect((await login()).status).toBe(200);
    }
  });

  it('rate-limits registration', async () => {
    for (let i = 0; i < 10; i++) {
      await register({ ...alice, email: `user${i}@debrief.test` });
    }
    expect((await register({ ...alice, email: 'one-more@debrief.test' })).status).toBe(429);
  });

  it('tells browsers not to cache api responses', async () => {
    const res = await me();
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
