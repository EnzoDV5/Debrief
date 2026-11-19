import { createHash, randomBytes } from 'node:crypto';

// Talks to Google with plain HTTPS calls (no SDK): build the consent URL, swap the returned code
// for tokens, refresh an access token, create/update a calendar event, and revoke access.
// Tests replace `fetchImpl`, so they never call Google.

/** The only permission we ask for: create and edit calendar events. Nothing else. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export class GoogleError extends Error {
  constructor(
    /** 'revoked': the user removed our access in their Google account; reconnect needed. */
    readonly kind: 'revoked' | 'failed' | 'no_refresh_token',
    message: string,
  ) {
    super(message);
    this.name = 'GoogleError';
  }
}

export type CalendarEvent = {
  /** Our previous event for this item, to update instead of duplicating. */
  eventId: string | null;
  summary: string;
  description: string;
  /** All-day event on this date (YYYY-MM-DD). */
  date: string;
};

export interface GoogleClient {
  /** False when the server has no Google credentials: the feature is simply unavailable. */
  readonly configured: boolean;
  authUrl(state: string, codeChallenge: string): string;
  exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<{ refreshToken: string; scope: string }>;
  accessToken(refreshToken: string): Promise<string>;
  upsertEvent(accessToken: string, event: CalendarEvent): Promise<{ id: string; htmlLink: string }>;
  revoke(token: string): Promise<void>;
}

/**
 * PKCE (Proof Key for Code Exchange): we keep a random secret (the verifier) and send Google only
 * its hash (the challenge). When the code comes back, only someone holding the verifier can swap
 * it for tokens, so an intercepted code is useless on its own.
 */
export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function nextDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function createGoogleClient({
  clientId,
  clientSecret,
  redirectUri,
  fetchImpl = fetch,
}: {
  clientId: string | undefined;
  clientSecret: string | undefined;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): GoogleClient {
  async function tokenRequest(params: Record<string, string>) {
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        ...params,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { res, body };
  }

  return {
    configured: Boolean(clientId && clientSecret),

    authUrl(state, codeChallenge) {
      const params = new URLSearchParams({
        client_id: clientId ?? '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: CALENDAR_SCOPE,
        // "offline" + "consent" = Google returns a refresh token, so we can add events later
        // without sending the user through Google again each time.
        access_type: 'offline',
        prompt: 'consent',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      return `${AUTH_URL}?${params}`;
    },

    async exchangeCode(code, codeVerifier) {
      const { res, body } = await tokenRequest({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      });
      if (!res.ok) throw new GoogleError('failed', 'Google rejected the authorization code');
      if (typeof body.refresh_token !== 'string') {
        throw new GoogleError('no_refresh_token', 'Google did not return a refresh token');
      }
      return { refreshToken: body.refresh_token, scope: String(body.scope ?? '') };
    },

    async accessToken(refreshToken) {
      const { res, body } = await tokenRequest({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      // invalid_grant = the user revoked access (or the token expired): they must reconnect.
      if (res.status === 400 && body.error === 'invalid_grant') {
        throw new GoogleError('revoked', 'Google access was revoked');
      }
      if (!res.ok || typeof body.access_token !== 'string') {
        throw new GoogleError('failed', 'Could not get a Google access token');
      }
      return body.access_token;
    },

    async upsertEvent(accessToken, event) {
      const payload = JSON.stringify({
        summary: event.summary,
        description: event.description,
        // All-day event: Google's end date is exclusive, so it's the next day.
        start: { date: event.date },
        end: { date: nextDay(event.date) },
      });
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      // Update our existing event if there is one; if the user deleted it in Google, make a new one.
      if (event.eventId) {
        const res = await fetchImpl(`${EVENTS_URL}/${encodeURIComponent(event.eventId)}`, {
          method: 'PUT',
          headers,
          body: payload,
        });
        if (res.ok) return (await res.json()) as { id: string; htmlLink: string };
        if (res.status !== 404 && res.status !== 410) {
          throw new GoogleError('failed', `Google Calendar error ${res.status}`);
        }
      }

      const res = await fetchImpl(EVENTS_URL, { method: 'POST', headers, body: payload });
      if (!res.ok) throw new GoogleError('failed', `Google Calendar error ${res.status}`);
      return (await res.json()) as { id: string; htmlLink: string };
    },

    async revoke(token) {
      await fetchImpl(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    },
  };
}
