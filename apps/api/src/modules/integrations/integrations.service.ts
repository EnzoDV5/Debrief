// Rules for Google Calendar: connect, disconnect, and add or update an event for an item.
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

export type IntegrationsDeps = {
  google: GoogleClient;
  encryptionKey: Buffer | undefined;
  webOrigin: string;
};

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

    startConnect() {
      requireKey();
      const state = randomBytes(32).toString('base64url');
      const pkce = createPkcePair();
      return { url: google.authUrl(state, pkce.challenge), state, verifier: pkce.verifier };
    },

    async finishConnect(userId: string, code: string, codeVerifier: string) {
      const key = requireKey();
      const { refreshToken, scope } = await google.exchangeCode(code, codeVerifier);
      if (!scope.split(' ').includes(CALENDAR_SCOPE)) {
        await google.revoke(refreshToken).catch(() => {});
        throw new GoogleError('failed', 'Calendar permission was not granted');
      }
      await integrationsRepository.saveConnection(userId, encryptSecret(refreshToken, key), scope);
    },

    async disconnect(userId: string) {
      const connection = await integrationsRepository.findConnection(userId);
      if (!connection) return;
      if (encryptionKey) {
        try {
          await google.revoke(decryptSecret(connection.refreshTokenEncrypted, encryptionKey));
        } catch (err) {
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
