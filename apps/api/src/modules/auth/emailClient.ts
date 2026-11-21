// Sends our two emails (password reset and welcome) through EmailJS's REST API.
const SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

export type PasswordResetEmail = {
  to: string;
  name: string;
  link: string;
  expiresInMinutes: number;
};

export type WelcomeEmail = {
  to: string;
  name: string;
  appLink: string;
};

export interface EmailClient {
  readonly configured: boolean;
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

  async function send(template: string | undefined, params: Record<string, string>) {
    const res = await fetchImpl(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: template,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: params,
      }),
      signal: AbortSignal.timeout(10_000),
    });
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
