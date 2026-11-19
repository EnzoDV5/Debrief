import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes (256 bits): impossible to guess. Goes in the cookie, never in the database. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * The database stores this hash instead of the token. A plain SHA-256 is enough here (unlike
 * passwords) because the token is already long and random, so there's nothing to brute-force.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
