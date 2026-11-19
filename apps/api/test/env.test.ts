import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env';

describe('parseEnv', () => {
  it('applies defaults when optional variables are missing', () => {
    expect(parseEnv({})).toEqual({ NODE_ENV: 'development', PORT: 3000, LOG_LEVEL: 'info' });
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('refuses to start with an invalid value and names the variable', () => {
    expect(() => parseEnv({ PORT: 'not-a-port' })).toThrow(/PORT/);
  });

  it('never includes the offending value in the error (it could be a secret)', () => {
    const secretLooking = 'sk-or-v1-should-never-be-printed';
    try {
      parseEnv({ NODE_ENV: secretLooking });
      expect.unreachable('parseEnv should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('NODE_ENV');
      expect((err as Error).message).not.toContain(secretLooking);
    }
  });
});
