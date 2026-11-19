import { randomBytes } from 'node:crypto';
import type { ActionItem, CalendarStatus } from '@debrief/shared';
import { decryptSecret, encryptSecret, parseEncryptionKey } from '../../lib/crypto';
import { AppError, notFound } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { toActionItem } from '../meetings/meetings.mappers';
import {
  CALENDAR_SCOPE,
  createGoogleClient,
  createPkcePair,
  GoogleError,
  type GoogleClient,
} from './googleClient';
import { integrationsRepository } from './integrations.repository';

// Business rules for the Google Calendar integration. No req/res, no SQL.

export type IntegrationsDeps = {
  google: GoogleClient;
  /** AES-256-GCM key for stored refresh tokens. Without it the feature stays off. */
  encryptionKey: Buffer | undefined;
  /** Used to put a link back to the meeting in the calendar event. */
  webOrigin: string;
};

/** Google is down or refused: a clear, retryable message instead of a generic 500. */
function googleUnavailable(err: unknown): AppError {
  logger.warn({ err }, 'Google Calendar request failed');
  return new AppError(
    502,
    'CALENDAR_ERROR',
    'Google Calendar didn’t accept the event right now. Please try again.',
  );
}

const notConnected = () =>
  new AppError(409, 'CALENDAR_NOT_CONNECTED', 'Connect Google Calendar on your Account page first');

export function createIntegrationsService({ google, encryptionKey, webOrigin }: IntegrationsDeps) {
  const available = google.configured && encryptionKey !== undefined;

  function requireKey(): Buffer {
    if (!available || !encryptionKey) {
      throw new AppError(
        503,
        'CALENDAR_UNAVAILABLE',
        'Google Calendar isn’t set up on this server',
      );
    }
    return encryptionKey;
  }

  return {
    available,

    async status(userId: string): Promise<CalendarStatus> {
      const connection = available ? await integrationsRepository.findConnection(userId) : null;
      return {
        available,
        connected: connection !== null,
        connectedAt: connection?.createdAt.toISOString() ?? null,
      };
    },

    /**
     * Step 1 of connecting: where to send the user, plus two secrets the browser must keep until
     * Google sends them back. `state` stops another site attaching ITS Google account to this
     * user (CSRF); the PKCE verifier makes a stolen authorization code useless.
     */
    startConnect() {
      requireKey();
      const state = randomBytes(32).toString('base64url');
      const pkce = createPkcePair();
      return { url: google.authUrl(state, pkce.challenge), state, verifier: pkce.verifier };
    },

    /** Step 2, after Google sends the user back: swap the code for a refresh token, store it encrypted. */
    async finishConnect(userId: string, code: string, codeVerifier: string) {
      const key = requireKey();
      const { refreshToken, scope } = await google.exchangeCode(code, codeVerifier);
      // The user can untick permissions on Google's screen; without events access we can't work.
      if (!scope.split(' ').includes(CALENDAR_SCOPE)) {
        await google.revoke(refreshToken).catch(() => {});
        throw new GoogleError('failed', 'Calendar permission was not granted');
      }
      await integrationsRepository.saveConnection(userId, encryptSecret(refreshToken, key), scope);
    },

    /** Forget the token here AND revoke it at Google, so it's useless even if it leaked. */
    async disconnect(userId: string) {
      const connection = await integrationsRepository.findConnection(userId);
      if (!connection) return;
      if (encryptionKey) {
        try {
          await google.revoke(decryptSecret(connection.refreshTokenEncrypted, encryptionKey));
        } catch (err) {
          // Still delete our copy: the user asked to disconnect.
          logger.warn({ err }, 'Revoking the Google token failed');
        }
      }
      await integrationsRepository.deleteConnection(userId);
    },

    async addToCalendar(
      userId: string,
      itemId: string,
    ): Promise<{ actionItem: ActionItem; eventUrl: string }> {
      const key = requireKey();
      const found = await integrationsRepository.findItemWithMeeting(userId, itemId);
      if (!found) throw notFound('Action item');
      const { item, meetingTitle, meetingDate } = found;
      if (!item.dueDate) {
        throw new AppError(
          400,
          'NO_DUE_DATE',
          'Give this item a due date before adding it to your calendar',
        );
      }

      const connection = await integrationsRepository.findConnection(userId);
      if (!connection) throw notConnected();

      let accessToken: string;
      try {
        accessToken = await google.accessToken(
          decryptSecret(connection.refreshTokenEncrypted, key),
        );
      } catch (err) {
        if (err instanceof GoogleError && err.kind === 'revoked') {
          // Access was removed in Google: drop the dead token so the UI offers "Connect" again.
          await integrationsRepository.deleteConnection(userId);
          throw new AppError(
            409,
            'CALENDAR_RECONNECT',
            'Google Calendar access was removed. Please connect it again on your Account page.',
          );
        }
        throw googleUnavailable(err);
      }

      const event = await google
        .upsertEvent(accessToken, {
          eventId: item.calendarEventId,
          summary: item.text,
          description: [
            item.owner ? `Owner: ${item.owner}` : 'No owner named',
            `From the meeting “${meetingTitle}” (${meetingDate})`,
            `${webOrigin}/meetings/${item.meetingId}${item.sourceLine ? `#L${item.sourceLine}` : ''}`,
            '',
            'Added by Debrief',
          ].join('\n'),
          date: item.dueDate,
        })
        .catch((err: unknown) => {
          throw googleUnavailable(err);
        });

      const updated = await integrationsRepository.setCalendarEventId(userId, itemId, event.id);
      if (!updated) throw notFound('Action item');
      return { actionItem: toActionItem(updated), eventUrl: event.htmlLink };
    },
  };
}

export type IntegrationsService = ReturnType<typeof createIntegrationsService>;

/** The real wiring, from env. Used by server.ts; tests build their own with a fake Google. */
export function createIntegrationsFromEnv(env: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI: string;
  ENCRYPTION_KEY?: string;
  WEB_ORIGIN: string;
}) {
  return createIntegrationsService({
    google: createGoogleClient({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    }),
    encryptionKey: env.ENCRYPTION_KEY ? parseEncryptionKey(env.ENCRYPTION_KEY) : undefined,
    webOrigin: env.WEB_ORIGIN,
  });
}
