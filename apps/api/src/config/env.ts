// Reads the .env settings and checks them up front, so the app won't start with a bad config.
import { z } from 'zod';

const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const stringWithDefault = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => value?.trim() || fallback);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),

    SUPABASE_DATABASE_URL: z
      .union([
        z.literal(''),
        z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
      ])
      .optional()
      .transform((value) => value || undefined),

    WEB_ORIGIN: z.url().default('http://localhost:5173'),

    TRUST_PROXY: z.coerce.number().int().min(0).default(0),

    OPENROUTER_API_KEY: optionalString,
    AI_MODEL_PRIMARY: stringWithDefault('particle-ai/particle-1:free'),
    AI_MODEL_FALLBACK: stringWithDefault('baidu/ernie-5.5-flash-preview:free,openrouter/free'),
    AI_MODEL_PAID_FALLBACK: optionalString,
    AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    APP_URL: optionalString.pipe(z.url().optional()),

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    // Both default to WEB_ORIGIN + the callback path, so a deploy only needs WEB_ORIGIN set. Whatever
    // they end up as must be listed under the Google OAuth client's "Authorized redirect URIs".
    GOOGLE_REDIRECT_URI: optionalString.pipe(z.url().optional()),
    GOOGLE_AUTH_REDIRECT_URI: optionalString.pipe(z.url().optional()),
    EMAILJS_SERVICE_ID: optionalString,
    EMAILJS_TEMPLATE_ID: optionalString,
    EMAILJS_PUBLIC_KEY: optionalString,
    EMAILJS_PRIVATE_KEY: optionalString,
    EMAILJS_WELCOME_TEMPLATE_ID: optionalString,

    ENCRYPTION_KEY: optionalString.refine(
      (value) => value === undefined || Buffer.from(value, 'base64').length === 32,
      'must be 32 bytes, base64-encoded',
    ),
  })
  .transform((e) => {
    const origin = e.WEB_ORIGIN.replace(/\/+$/, '');
    return {
      ...e,
      WEB_ORIGIN: origin,
      APP_URL: e.APP_URL ?? origin,
      GOOGLE_REDIRECT_URI: e.GOOGLE_REDIRECT_URI ?? `${origin}/api/integrations/google/callback`,
      GOOGLE_AUTH_REDIRECT_URI: e.GOOGLE_AUTH_REDIRECT_URI ?? `${origin}/api/auth/google/callback`,
    };
  });

export function aiModelChain(
  e: Pick<Env, 'AI_MODEL_PRIMARY' | 'AI_MODEL_FALLBACK' | 'AI_MODEL_PAID_FALLBACK'>,
) {
  const all = [e.AI_MODEL_PRIMARY, e.AI_MODEL_FALLBACK, e.AI_MODEL_PAID_FALLBACK]
    .flatMap((value) => (value ?? '').split(','))
    .map((model) => model.trim())
    .filter(Boolean);
  return [...new Set(all)];
}

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
