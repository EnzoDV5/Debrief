// The Google sign-in client against fake HTTP responses.
import { describe, expect, it } from 'vitest';
import {
  createGoogleSignInClient,
  GoogleSignInError,
  readIdToken,
} from '../src/modules/auth/googleSignIn';

const CLIENT_ID = 'debrief-test.apps.googleusercontent.com';
const NOW = Date.parse('2026-11-20T10:00:00Z');

function idToken(claims: Record<string, unknown>) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(claims)}.signature`;
}

const validClaims = {
  iss: 'https://accounts.google.com',
  aud: CLIENT_ID,
  exp: NOW / 1000 + 3600,
  sub: '1234567890',
  email: 'Thandi@Example.com',
  email_verified: true,
  name: 'Thandi Nkosi',
  picture: 'https://lh3.googleusercontent.com/a/photo-1',
  nonce: 'nonce-1',
};

describe('readIdToken', () => {
  it('reads who signed in, with the email lowercased', () => {
    expect(readIdToken(idToken(validClaims), CLIENT_ID, NOW)).toEqual({
      sub: '1234567890',
      email: 'thandi@example.com',
      emailVerified: true,
      name: 'Thandi Nkosi',
      picture: 'https://lh3.googleusercontent.com/a/photo-1',
      nonce: 'nonce-1',
    });
  });

  it('drops a picture that is missing or not an https URL', () => {
    const { picture: _, ...noPicture } = validClaims;
    expect(readIdToken(idToken(noPicture), CLIENT_ID, NOW).picture).toBeNull();
    for (const picture of ['http://example.com/p.png', 'javascript:alert(1)', 'not a url']) {
      expect(readIdToken(idToken({ ...validClaims, picture }), CLIENT_ID, NOW).picture).toBeNull();
    }
  });

  it('treats a missing email_verified as not verified', () => {
    const { email_verified: _, ...claims } = validClaims;
    expect(readIdToken(idToken(claims), CLIENT_ID, NOW).emailVerified).toBe(false);
  });

  it.each([
    ['another issuer', { iss: 'https://evil.example' }],
    ['another app', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['an expired token', { exp: NOW / 1000 - 1 }],
    ['no subject', { sub: '' }],
  ])('rejects %s', (_label, change) => {
    expect(() => readIdToken(idToken({ ...validClaims, ...change }), CLIENT_ID, NOW)).toThrow(
      GoogleSignInError,
    );
  });

  it('rejects something that is not a JWT', () => {
    expect(() => readIdToken('not-a-token', CLIENT_ID, NOW)).toThrow(GoogleSignInError);
    expect(() => readIdToken('a.%%%.c', CLIENT_ID, NOW)).toThrow(GoogleSignInError);
  });
});

describe('createGoogleSignInClient', () => {
  function client(response: { status: number; body: unknown }) {
    const calls: { url: string; body: URLSearchParams }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body as URLSearchParams });
      return new Response(JSON.stringify(response.body), { status: response.status });
    }) as unknown as typeof fetch;
    const google = createGoogleSignInClient({
      clientId: CLIENT_ID,
      clientSecret: 'secret',
      redirectUri: 'http://localhost:5173/api/auth/google/callback',
      fetchImpl,
    });
    return { google, calls };
  }

  it('asks only for identity, shows the account chooser, and uses PKCE and a nonce', () => {
    const url = new URL(
      client({ status: 200, body: {} }).google.authUrl({
        state: 's',
        codeChallenge: 'c',
        nonce: 'n',
      }),
    );
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('nonce')).toBe('n');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/auth/google/callback',
    );
  });

  it('swaps the code (with the PKCE verifier) for the identity in the ID token', async () => {
    const { google, calls } = client({
      status: 200,
      body: { id_token: idToken({ ...validClaims, exp: Date.now() / 1000 + 3600 }) },
    });
    const identity = await google.exchangeCode('the-code', 'the-verifier');
    expect(identity.sub).toBe('1234567890');
    expect(calls[0]?.body.get('code')).toBe('the-code');
    expect(calls[0]?.body.get('code_verifier')).toBe('the-verifier');
  });

  it('fails clearly when Google rejects the code or sends no ID token', async () => {
    await expect(
      client({ status: 400, body: { error: 'invalid_grant' } }).google.exchangeCode('x', 'y'),
    ).rejects.toThrow(GoogleSignInError);
    await expect(client({ status: 200, body: {} }).google.exchangeCode('x', 'y')).rejects.toThrow(
      'Google did not return an ID token',
    );
  });
});
