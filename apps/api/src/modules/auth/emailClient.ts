// Sends email through EmailJS's REST API, called from the server with a plain HTTPS request
// (no SDK). EmailJS fills one of our templates with the values we pass and sends it.
// Tests replace `fetchImpl` (or the whole client), so they never send real email.

const SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export type PasswordResetEmail = {
  to: string;
  name: string;
  /** The one-time link to the reset page. */
  link: string;
  expiresInMinutes: number;
};

export type WelcomeEmail = {
  to: string;
  name: string;
  /** Where the "Open Debrief" button goes. */
  appLink: string;
};

export interface EmailClient {
  /** False when the EmailJS keys aren't set: "Forgot password" isn't offered. */
  readonly configured: boolean;
  /** False when there's no welcome template (EMAILJS_WELCOME_TEMPLATE_ID): no welcome email. */
  readonly welcomeConfigured: boolean;
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
  sendWelcome(email: WelcomeEmail): Promise<void>;
}

export class EmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailError';
  }
}

/**
 * Two EmailJS templates (HTML in docs/email-templates/). Both use {{to_email}} as their "To Email"
 * and {{to_name}}; the reset one also {{reset_link}} and {{expires_minutes}}, the welcome one
 * {{app_link}}. Emails only ever go to the person themselves, never to us.
 */
export function createEmailJsClient({
  serviceId,
  templateId,
  publicKey,
  privateKey,
  welcomeTemplateId,
  fetchImpl = fetch,
}: {
  serviceId: string | undefined;
  templateId: string | undefined;
  welcomeTemplateId?: string | undefined;
  publicKey: string | undefined;
  privateKey: string | undefined;
  fetchImpl?: typeof fetch;
}): EmailClient {
  const keysSet = Boolean(serviceId && publicKey && privateKey);

  /** Fills one of our EmailJS templates and sends it. */
  async function send(template: string | undefined, params: Record<string, string>) {
    const res = await fetchImpl(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: template,
        user_id: publicKey,
        // The private key ("access token") is what allows sending from a server.
        accessToken: privateKey,
        template_params: params,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // EmailJS answers 200 "OK", or an error status with a short plain-text reason.
    if (!res.ok) {
      const reason = await res.text().catch(() => '');
      throw new EmailError(`EmailJS refused the email (${res.status}): ${reason.slice(0, 200)}`);
    }
  }

  return {
    configured: keysSet && Boolean(templateId),
    welcomeConfigured: keysSet && Boolean(welcomeTemplateId),

    sendPasswordReset({ to, name, link, expiresInMinutes }) {
      return send(templateId, {
        to_email: to,
        to_name: name,
        reset_link: link,
        expires_minutes: String(expiresInMinutes),
      });
    },

    sendWelcome({ to, name, appLink }) {
      return send(welcomeTemplateId, { to_email: to, to_name: name, app_link: appLink });
    },
  };
}
