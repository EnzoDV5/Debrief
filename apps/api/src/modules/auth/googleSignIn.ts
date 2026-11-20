import { z } from 'zod';

// Sign in with Google (OpenID Connect), with plain HTTPS calls like the Calendar client: build
// the consent URL, then swap the returned code for the person's Google identity.
// Tests replace `fetchImpl`, so they never call Google.

/** Only who the person is: their Google id, email and name. No access to anything else. */
export const SIGN_IN_SCOPES = 'openid email profile';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Who signed in, as Google vouches for it. */
export type GoogleIdentity = {
  /** Google's permanent id for the person. */
  sub: string;
  email: string;
  /** Google has confirmed the person owns this email address. */
  emailVerified: boolean;
  name: string | null;
  /** The one-time value we sent in the consent URL; must match the one in our cookie. */
  nonce: string | null;
};

export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

export interface GoogleSignInClient {
  /** False when the server has no Google credentials: the button isn't offered. */
  readonly configured: boolean;
  authUrl(params: { state: string; codeChallenge: string; nonce: string }): string;
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

// The ID token's claims we rely on. Anything else in it is ignored.
const idTokenClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  nonce: z.string().optional(),
});

/**
 * Reads and checks the ID token (a JWT) Google returned. We don't verify its signature: it came
 * straight from Google's token endpoint over HTTPS, in answer to a request made with our client
 * secret, and the OpenID Connect spec (Core 3.1.3.7) allows TLS to stand in for the signature in
 * exactly that case. We still check who issued it, that it's for our app, and that it's fresh.
 */
export function readIdToken(idToken: string, clientId: string, now = Date.now()): GoogleIdentity {
  const payload = idToken.split('.')[1];
  if (!payload) throw new GoogleSignInError('Malformed ID token');
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new GoogleSignInError('Malformed ID token');
  }
  const parsed = idTokenClaims.safeParse(json);
  if (!parsed.success) throw new GoogleSignInError('ID token is missing claims');
  const claims = parsed.data;

  if (!ISSUERS.includes(claims.iss)) throw new GoogleSignInError('ID token not issued by Google');
  if (claims.aud !== clientId) throw new GoogleSignInError('ID token is for another app');
  if (claims.exp * 1000 < now) throw new GoogleSignInError('ID token has expired');

  return {
    sub: claims.sub,
    email: claims.email.trim().toLowerCase(),
    emailVerified: claims.email_verified === true,
    name: claims.name?.trim() || null,
    nonce: claims.nonce ?? null,
  };
}

export function createGoogleSignInClient({
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): GoogleSignInClient {
  return {
    configured: Boolean(clientId && clientSecret),

    authUrl({ state, codeChallenge, nonce }) {
      const params = new URLSearchParams({
        client_id: clientId ?? '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SIGN_IN_SCOPES,
        // Always show Google's account chooser, so someone with several Google accounts (or on
        // a shared computer) picks the right one instead of being signed in silently.
        prompt: 'select_account',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      return `${AUTH_URL}?${params}`;
    },

    async exchangeCode(code, codeVerifier) {
      const res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId ?? '',
          client_secret: clientSecret ?? '',
          grant_type: 'authorization_code',
          code,
          code_verifier: codeVerifier,
          redirect_uri: redirectUri,
        }),
        // Don't leave the user staring at a blank tab if Google is slow.
        signal: AbortSignal.timeout(10_000),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) throw new GoogleSignInError('Google rejected the authorization code');
      if (typeof body.id_token !== 'string') {
        throw new GoogleSignInError('Google did not return an ID token');
      }
      return readIdToken(body.id_token, clientId ?? '');
    },
  };
}
