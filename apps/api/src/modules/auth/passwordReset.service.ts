import { generateSessionToken, hashSessionToken } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { authRepository } from './auth.repository';
import { hashPassword } from './auth.service';
import type { EmailClient } from './emailClient';

// Business rules for "Forgot password". No req/res, no SQL (that's the repository).

/** How long an emailed link works. Short, since the link alone is enough to take the account. */
export const RESET_LINK_MINUTES = 30;

export function createPasswordResetService({
  email,
  webOrigin,
  showLinkInLogs,
}: {
  email: EmailClient;
  webOrigin: string;
  /**
   * Local development without EmailJS keys: write the link to the api's log instead of
   * emailing it, so the flow can still be tried. Never in production (a link is as good as
   * the account).
   */
  showLinkInLogs: boolean;
}) {
  return {
    /** Whether the web app should offer "Forgot password?". */
    available: email.configured || showLinkInLogs,

    /**
     * Emails a reset link if there's an active account for this email, and silently does
     * nothing otherwise. The controller answers the request before this even runs, the same
     * way for both, so nobody can use this form to find out who has an account.
     */
    async request(emailAddress: string) {
      const user = await authRepository.findActiveUserByEmail(emailAddress);
      if (!user) return;

      // Same kind of token as a session: random, and only its hash is stored.
      const token = generateSessionToken();
      await authRepository.replacePasswordReset({
        id: hashSessionToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000),
      });
      // The token goes after "#": browsers never send that part to a server, so it can't end up
      // in server logs or Referer headers. The reset page reads it from the address bar.
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

    /**
     * Sets a new password with the token from the link. The link then stops working, every
     * session ends (log in again with the new password), and nothing else changes.
     */
    async reset(token: string, newPassword: string) {
      // Hashed first, valid link or not: so a wrong link doesn't answer faster than a right one.
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
