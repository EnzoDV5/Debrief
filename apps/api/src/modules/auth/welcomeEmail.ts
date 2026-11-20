import { logger } from '../../lib/logger';
import type { EmailClient } from './emailClient';

/**
 * The welcome letter for a brand-new account (email sign-up or first Google sign-in). It goes
 * to the new user only: nobody else is told about sign-ups.
 */
export function createWelcomeMailer({
  email,
  webOrigin,
}: {
  email: EmailClient;
  webOrigin: string;
}) {
  return {
    /**
     * Fire and forget: called after the sign-up has already been answered, so a slow or failed
     * email never delays or breaks signing up. A failure is only logged.
     */
    send(user: { email: string; name: string }) {
      if (!email.welcomeConfigured) return;
      email
        .sendWelcome({ to: user.email, name: user.name, appLink: `${webOrigin}/meetings` })
        .catch((err: unknown) => logger.warn({ err }, 'Sending the welcome email failed'));
    },
  };
}

export type WelcomeMailer = ReturnType<typeof createWelcomeMailer>;
