import { z } from 'zod';

// An optional string where an empty value in .env ("KEY=") counts as not set.
const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

// Same, but falls back to a default. (Zod's .default() only covers a *missing* key, not
// "KEY=" with an empty value, which is how .env.example ships.)
const stringWithDefault = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value) => value?.trim() || fallback);

// Every env var the api reads is declared here, so a missing or malformed value stops the app
// at startup instead of failing later in a request. New variables are added in the phase that
// first uses them (see .env.example).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Required: there is no sensible default, and guessing could point at the wrong database.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),

  // Optional: only `npm run db:migrate:supabase` uses it. Empty in .env counts as "not set".
  SUPABASE_DATABASE_URL: z
    .union([
      z.literal(''),
      z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),
    ])
    .optional()
    .transform((value) => value || undefined),

  // The one browser origin allowed to make state-changing requests (CSRF Origin check).
  WEB_ORIGIN: z.url().default('http://localhost:5173'),

  // How many proxies sit in front of the api (nginx in Docker, Render in production).
  // Express then reads the real client IP from X-Forwarded-For, which the rate limiter needs.
  // 0 = no proxy: trust nothing, so clients can't spoof their IP with that header.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // ---- AI (OpenRouter) ----
  // Optional so the app (and CI) runs without it: analysis then fails with a clear message
  // instead of the whole server refusing to start.
  OPENROUTER_API_KEY: optionalString,
  // Tried in this order. The fallback may be a comma-separated list. Defaults are the free models
  // that passed our trial on the fixture transcripts (2026-11-19).
  AI_MODEL_PRIMARY: stringWithDefault('particle-ai/particle-1:free'),
  AI_MODEL_FALLBACK: stringWithDefault('baidu/ernie-5.5-flash-preview:free,openrouter/free'),
  AI_MODEL_PAID_FALLBACK: optionalString,
  // Per-call timeout. 60s is generous: free models usually answer in 2–5s.
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // Sent to OpenRouter as HTTP-Referer, identifying the app.
  APP_URL: z.url().default('http://localhost:5173'),

  // ---- Google Calendar (Phase 5) ----
  // Optional: without them the integration reports "not available" and the rest of the app works.
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  // Where Google sends the user back. Goes through the web origin (Vite proxy / Vercel rewrite)
  // so the session cookie is first-party. Must match the client's "Authorized redirect URIs".
  GOOGLE_REDIRECT_URI: stringWithDefault('http://localhost:5173/api/integrations/google/callback'),
  // Sign in with Google uses the same OAuth client, with its own redirect URI (also listed in the
  // client's "Authorized redirect URIs"). Needs only GOOGLE_CLIENT_ID/SECRET, no ENCRYPTION_KEY:
  // nothing from Google is stored except the account's id.
  GOOGLE_AUTH_REDIRECT_URI: stringWithDefault('http://localhost:5173/api/auth/google/callback'),
  // ---- Email (EmailJS), for "Forgot password" links ----
  // Optional: without all four, the "Forgot password?" link isn't offered. Sent from the server
  // with the private key (EmailJS: Account → Security → "Allow EmailJS API for non-browser
  // applications"), never from the browser, which must never see a reset link.
  EMAILJS_SERVICE_ID: optionalString,
  EMAILJS_TEMPLATE_ID: optionalString,
  EMAILJS_PUBLIC_KEY: optionalString,
  EMAILJS_PRIVATE_KEY: optionalString,
  // Optional second template: the welcome letter sent to a new account (to them only).
  EMAILJS_WELCOME_TEMPLATE_ID: optionalString,

  // 32 random bytes, base64: the AES-256-GCM key for stored Google tokens.
  ENCRYPTION_KEY: optionalString.refine(
    (value) => value === undefined || Buffer.from(value, 'base64').length === 32,
    'must be 32 bytes, base64-encoded',
  ),
});

/** The models to try, in order, without blanks or duplicates. */
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
    // Report only the variable name and what's wrong. Never include the value: it may be a secret.
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
