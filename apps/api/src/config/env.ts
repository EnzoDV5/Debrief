import { z } from 'zod';

// Every env var the api reads is declared here, so a missing or malformed value stops the app
// at startup instead of failing later in a request. New variables are added in the phase that
// first uses them (see .env.example).
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Required: there is no sensible default, and guessing could point at the wrong database.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/, error: 'must be a postgres:// URL' }),

  // The one browser origin allowed to make state-changing requests (CSRF Origin check).
  WEB_ORIGIN: z.url().default('http://localhost:5173'),

  // How many proxies sit in front of the api (nginx in Docker, Render in production).
  // Express then reads the real client IP from X-Forwarded-For, which the rate limiter needs.
  // 0 = no proxy: trust nothing, so clients can't spoof their IP with that header.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

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
