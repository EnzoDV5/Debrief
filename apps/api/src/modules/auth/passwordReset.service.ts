// Creates one-time reset links, emails them, and sets the new password.
import argon2 from 'argon2';
import { generateSessionToken, hashSessionToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { authRepository } from './auth.repository';
import { hashPassword } from './auth.service';
import type { EmailClient } from './emailClient';

export const RESET_LINK_MINUTES = 30;
export const SAME_PASSWORD_MESSAGE = "That's your current password. Choose a different one.";

const linkInvalid = () =>
  new AppError(
    400,
    'RESET_LINK_INVALID',
    'This reset link has expired or has already been used. Ask for a new one.',
  );

export function createPasswordResetService({
  email,
  webOrigin,
  showLinkInLogs,
}: {
  email: EmailClient;
  webOrigin: string;
  showLinkInLogs: boolean;
}) {
  return {
    available: email.configured || showLinkInLogs,

    async request(emailAddress: string) {
      const user = await authRepository.findActiveUserByEmail(emailAddress);
      if (!user) return;

      const token = generateSessionToken();
      await authRepository.replacePasswordReset({
        id: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000),
      });
      const link = `${webOrigin}/reset-password#token=${token}`;

      if (!email.configured) {
        if (showLinkInLogs)
          logger.warn({ link }, 'EmailJS not set up: password reset link (dev only)');
        return;
      }
      await email.sendPasswordReset({
        to: user.email,
        name: user.name,
        link,
        expiresInMinutes: RESET_LINK_MINUTES,
      });
    },

    async reset(token: string, newPassword: string) {
      const tokenHash = hashSessionToken(token);
      const current = await authRepository.findPasswordForReset(tokenHash);
      if (!current.found) throw linkInvalid();
      // Only the hash is stored, so argon2 checks whether the new password matches it. The link
      // isn't used up, so the user can pick a different password straight away.
      if (current.passwordHash && (await argon2.verify(current.passwordHash, newPassword))) {
        throw new AppError(400, 'VALIDATION_ERROR', SAME_PASSWORD_MESSAGE, {
          password: SAME_PASSWORD_MESSAGE,
        });
      }

      const user = await authRepository.usePasswordReset(
        tokenHash,
        await hashPassword(newPassword),
      );
      if (!user) throw linkInvalid();
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
