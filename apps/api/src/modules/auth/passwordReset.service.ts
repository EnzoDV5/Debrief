// Creates one-time reset links, emails them, and sets the new password.
import { generateSessionToken, hashSessionToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { authRepository } from './auth.repository';
import { hashPassword } from './auth.service';
import type { EmailClient } from './emailClient';

export const RESET_LINK_MINUTES = 30;

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
      const passwordHash = await hashPassword(newPassword);
      const user = await authRepository.usePasswordReset(hashSessionToken(token), passwordHash);
      if (!user) {
        throw new AppError(
          400,
          'RESET_LINK_INVALID',
          'This reset link has expired or has already been used. Ask for a new one.',
        );
      }
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
