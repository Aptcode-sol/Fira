'use strict';

const crypto = require('crypto');

// Validate ENCRYPTION_KEY at module load — refuse to start if missing/malformed
const keyHex = process.env.ENCRYPTION_KEY;
if (!keyHex || keyHex.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
    (keyHex ? `Got ${keyHex.length} characters.` : 'Variable is missing.')
  );
}

const ENCRYPTION_KEY = Buffer.from(keyHex, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for GCM

/**
 * Encrypt plaintext using AES-256-GCM with a unique random IV.
 * Returns base64-encoded ciphertext, iv, and auth tag for DB storage.
 * @param {string} plaintext
 * @returns {{ ciphertext: string, iv: string, tag: string }}
 */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

/**
 * Decrypt a previously encrypted value.
 * @param {{ ciphertext: string, iv: string, tag: string }} encrypted
 * @returns {string} plaintext
 */
function decrypt(encrypted) {
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(encrypted.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * Mask a value, showing only the last 4 characters.
 * For values shorter than 4 chars, mask everything.
 * @param {string} value
 * @returns {string} e.g. "****1234"
 */
function mask(value) {
  if (!value || value.length <= 4) {
    return '****';
  }
  return '****' + value.slice(-4);
}

module.exports = { encrypt, decrypt, mask };
