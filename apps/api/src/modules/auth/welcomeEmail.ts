// Sends the welcome email to a new user in the background, so it never slows sign-up down.
import { logger } from '../../lib/logger';
import type { EmailClient } from './emailClient';

export function createWelcomeMailer({
  email,
  webOrigin,
}: {
  email: EmailClient;
  webOrigin: string;
}) {
  return {
    send(user: { email: string; name: string }) {
      if (!email.welcomeConfigured) return;
      email
        .sendWelcome({ to: user.email, name: user.name, appLink: `${webOrigin}/meetings` })
        .catch((err: unknown) => logger.warn({ err }, 'Sending the welcome email failed'));
    },
  };
}

export type WelcomeMailer = ReturnType<typeof createWelcomeMailer>;
