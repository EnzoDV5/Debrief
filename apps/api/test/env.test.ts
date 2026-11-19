import { describe, expect, it } from 'vitest';
import { aiModelChain, parseEnv } from '../src/config/env';

const required = { DATABASE_URL: 'postgres://user:pass@localhost:5432/db' };

describe('parseEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    const env = parseEnv(required);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: required.DATABASE_URL,
      WEB_ORIGIN: 'http://localhost:5173',
      TRUST_PROXY: 0,
      AI_MODEL_PRIMARY: 'particle-ai/particle-1:free',
      AI_TIMEOUT_MS: 60_000,
    });
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
  });

  it('treats an empty value ("KEY=" in .env) as not set, and still applies defaults', () => {
    const env = parseEnv({
      ...required,
      OPENROUTER_API_KEY: '',
      AI_MODEL_PRIMARY: '',
      SUPABASE_DATABASE_URL: '',
    });
    expect(env.OPENROUTER_API_KEY).toBeUndefined();
    expect(env.SUPABASE_DATABASE_URL).toBeUndefined();
    expect(env.AI_MODEL_PRIMARY).toBe('particle-ai/particle-1:free');
  });

  it('coerces numbers from strings', () => {
    const env = parseEnv({ ...required, PORT: '8080', TRUST_PROXY: '1' });
    expect(env.PORT).toBe(8080);
    expect(env.TRUST_PROXY).toBe(1);
  });

  it('refuses to start without DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('rejects a DATABASE_URL that is not postgres', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('refuses to start with an invalid value and names the variable', () => {
    expect(() => parseEnv({ ...required, PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('never includes the offending value in the error (it could be a secret)', () => {
    const secretLooking = 'postgres-password-should-never-be-printed';
    try {
      parseEnv({ DATABASE_URL: secretLooking });
      expect.unreachable('parseEnv should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('DATABASE_URL');
      expect((err as Error).message).not.toContain(secretLooking);
    }
  });
});

describe('aiModelChain', () => {
  it('lists primary, then each fallback, then paid, without blanks or duplicates', () => {
    expect(
      aiModelChain({
        AI_MODEL_PRIMARY: 'a:free',
        AI_MODEL_FALLBACK: ' b:free , a:free ,, c ',
        AI_MODEL_PAID_FALLBACK: 'openai/gpt-x',
      }),
    ).toEqual(['a:free', 'b:free', 'c', 'openai/gpt-x']);
  });

  it('works with only a primary', () => {
    expect(
      aiModelChain({
        AI_MODEL_PRIMARY: 'a:free',
        AI_MODEL_FALLBACK: '',
        AI_MODEL_PAID_FALLBACK: undefined,
      }),
    ).toEqual(['a:free']);
  });
});
