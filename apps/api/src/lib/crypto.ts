import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

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

// ---------------------------------------------------------------------------------------------
// Encryption at rest (AES-256-GCM) for secrets we must be able to read back, like Google's
// refresh token. Unlike a password hash, we need the original value later to call Google.
//
// GCM both encrypts and authenticates: if anyone changes a single byte of the stored value, the
// decryption fails loudly instead of returning garbage. Each value gets its own random IV, so
// the same token encrypted twice looks completely different.
// ---------------------------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1'; // lets us change the format later without breaking stored values

/** The key must be exactly 32 bytes, given base64-encoded (ENCRYPTION_KEY in .env). */
export function parseEncryptionKey(base64: string): Buffer {
  const key = Buffer.from(base64, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes, base64-encoded');
  return key;
}

/** Returns "v1.<iv>.<auth tag>.<ciphertext>", all base64url. Safe to store in a text column. */
export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12); // 96-bit IV: the recommended size for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** Throws if the value was tampered with, encrypted with another key, or isn't ours. */
export function decryptSecret(stored: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unrecognised encrypted value');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(), // ← this is where a wrong key or tampering is detected
  ]).toString('utf8');
}
