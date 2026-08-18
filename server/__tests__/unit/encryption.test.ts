import { describe, it, expect, beforeAll } from 'vitest';

// Set required env var before importing the module
process.env.ENCRYPTION_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

const { encrypt, decrypt, mask } = require('../../services/encryption');

describe('encryption service', () => {
  it('encrypt → decrypt round-trip preserves plaintext', () => {
    const plaintext = 'ABCD1234EFGH5678';
    const encrypted = encrypt(plaintext);
    const result = decrypt(encrypted);
    expect(result).toBe(plaintext);
  });

  it('encrypt produces unique ciphertext for same input', () => {
    const plaintext = 'same-value';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    // Different IVs → different ciphertext
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('decrypt fails with tampered ciphertext', () => {
    const encrypted = encrypt('secret');
    encrypted.ciphertext = Buffer.from('tampered').toString('base64');
    expect(() => decrypt(encrypted)).toThrow();
  });

  it('mask shows only last 4 characters', () => {
    expect(mask('ABCD1234EFGH')).toBe('****EFGH');
  });

  it('mask returns **** for short values', () => {
    expect(mask('ab')).toBe('****');
    expect(mask('')).toBe('****');
    expect(mask(null)).toBe('****');
  });
});
