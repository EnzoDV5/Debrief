// The Google OpenID Connect calls: build the consent link and swap the code for an identity.
import { z } from 'zod';

export const SIGN_IN_SCOPES = 'openid email profile';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  // The Google profile photo URL, if the account has one.
  picture: string | null;
  nonce: string | null;
};

export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

export interface GoogleSignInClient {
  readonly configured: boolean;
  authUrl(params: { state: string; codeChallenge: string; nonce: string }): string;
  exchangeCode(code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

const idTokenClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  nonce: z.string().optional(),
});

// Only keep a picture that is a plain https URL, since the browser will load it.
function safePictureUrl(value: string | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

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
    picture: safePictureUrl(claims.picture),
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
