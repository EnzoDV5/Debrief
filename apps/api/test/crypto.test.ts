// Session token hashing and secret encryption.
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, parseEncryptionKey } from '../src/lib/crypto';

const key = randomBytes(32);
const secret = '1//0g-refresh-token-from-google';

describe('encryptSecret / decryptSecret (AES-256-GCM)', () => {
  it('round-trips a value without ever storing it in plain text', () => {
    const stored = encryptSecret(secret, key);
    expect(stored).not.toContain(secret);
    expect(stored.startsWith('v1.')).toBe(true);
    expect(decryptSecret(stored, key)).toBe(secret);
  });

  it('uses a fresh IV each time, so equal secrets look different', () => {
    expect(encryptSecret(secret, key)).not.toBe(encryptSecret(secret, key));
  });

  it('detects tampering with the stored value', () => {
    const [version, iv, tag, ciphertext] = encryptSecret(secret, key).split('.');
    const flipped = Buffer.from(ciphertext!, 'base64url');
    flipped[0] = flipped[0]! ^ 1;
    const tampered = [version, iv, tag, flipped.toString('base64url')].join('.');
    expect(() => decryptSecret(tampered, key)).toThrow();
  });

  it('refuses to decrypt with the wrong key', () => {
    expect(() => decryptSecret(encryptSecret(secret, key), randomBytes(32))).toThrow();
  });

  it('rejects values that are not in our format', () => {
    expect(() => decryptSecret('plain-text-token', key)).toThrow('Unrecognised');
  });

  it('only accepts a 32-byte key', () => {
    expect(parseEncryptionKey(randomBytes(32).toString('base64'))).toHaveLength(32);
    expect(() => parseEncryptionKey(randomBytes(16).toString('base64'))).toThrow('32 bytes');
  });
});
