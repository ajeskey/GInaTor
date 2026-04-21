'use strict';

const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param {string} plaintext - The text to encrypt.
 * @param {Buffer|string} key - A 256-bit (32-byte) encryption key. If string, must be 32 bytes of hex (64 chars) or raw bytes.
 * @returns {{ iv: string, ciphertext: string, authTag: string }} Hex-encoded iv, ciphertext, and authTag.
 * @throws {Error} If the key is not 32 bytes.
 */
function encrypt(plaintext, key) {
  const keyBuffer = toKeyBuffer(key);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH
  });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    ciphertext,
    authTag
  };
}

/**
 * Decrypts AES-256-GCM encrypted data.
 * @param {{ iv: string, ciphertext: string, authTag: string }} encrypted - Hex-encoded encrypted components.
 * @param {Buffer|string} key - The same 256-bit key used for encryption.
 * @returns {string} The decrypted plaintext.
 * @throws {Error} If authentication fails (wrong key or tampered data).
 */
function decrypt(encrypted, key) {
  const keyBuffer = toKeyBuffer(key);
  const { iv, ciphertext, authTag } = encrypted;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyBuffer,
    Buffer.from(iv, 'hex'),
    { authTagLength: AUTH_TAG_LENGTH }
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  try {
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  } catch (err) {
    throw new Error('Decryption failed: authentication error', { cause: err });
  }
}

/**
 * Converts a key to a 32-byte Buffer, validating its length.
 * @param {Buffer|string} key
 * @returns {Buffer}
 */
function toKeyBuffer(key) {
  if (Buffer.isBuffer(key)) {
    if (key.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes, got ${key.length}`);
    }
    return key;
  }
  if (typeof key === 'string') {
    // Treat as hex-encoded key
    const buf = Buffer.from(key, 'hex');
    if (buf.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (64 hex chars), got ${buf.length} bytes`);
    }
    return buf;
  }
  throw new Error('Encryption key must be a Buffer or hex string');
}

module.exports = { encrypt, decrypt };
