'use strict';

const crypto = require('node:crypto');
const { encrypt, decrypt } = require('../../modules/crypto');

describe('Crypto Service (AES-256-GCM)', () => {
  const validKey = crypto.randomBytes(32);
  const validHexKey = validKey.toString('hex');

  describe('encrypt', () => {
    test('returns object with iv, ciphertext, and authTag', () => {
      const result = encrypt('hello world', validKey);
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('ciphertext');
      expect(result).toHaveProperty('authTag');
    });

    test('returns hex-encoded strings', () => {
      const result = encrypt('test', validKey);
      expect(result.iv).toMatch(/^[0-9a-f]+$/);
      expect(result.ciphertext).toMatch(/^[0-9a-f]+$/);
      expect(result.authTag).toMatch(/^[0-9a-f]+$/);
    });

    test('generates unique IV for each call', () => {
      const r1 = encrypt('same text', validKey);
      const r2 = encrypt('same text', validKey);
      expect(r1.iv).not.toBe(r2.iv);
    });

    test('IV is 12 bytes (24 hex chars)', () => {
      const result = encrypt('test', validKey);
      expect(result.iv).toHaveLength(24);
    });

    test('authTag is 16 bytes (32 hex chars)', () => {
      const result = encrypt('test', validKey);
      expect(result.authTag).toHaveLength(32);
    });

    test('accepts hex string key', () => {
      const result = encrypt('test', validHexKey);
      expect(result).toHaveProperty('ciphertext');
    });

    test('throws on invalid key length (Buffer)', () => {
      const shortKey = crypto.randomBytes(16);
      expect(() => encrypt('test', shortKey)).toThrow(/32 bytes/);
    });

    test('throws on invalid key length (hex string)', () => {
      const shortHex = crypto.randomBytes(16).toString('hex');
      expect(() => encrypt('test', shortHex)).toThrow(/32 bytes/);
    });

    test('throws on non-Buffer non-string key', () => {
      expect(() => encrypt('test', 12345)).toThrow(/Buffer or hex string/);
    });
  });

  describe('decrypt', () => {
    test('round-trip: decrypt returns original plaintext', () => {
      const plaintext = 'my secret PAT token abc123';
      const encrypted = encrypt(plaintext, validKey);
      const result = decrypt(encrypted, validKey);
      expect(result).toBe(plaintext);
    });

    test('round-trip with hex string key', () => {
      const plaintext = 'arn:aws:codecommit:us-east-1:123456789:my-repo';
      const encrypted = encrypt(plaintext, validHexKey);
      const result = decrypt(encrypted, validHexKey);
      expect(result).toBe(plaintext);
    });

    test('round-trip with empty string', () => {
      const encrypted = encrypt('', validKey);
      const result = decrypt(encrypted, validKey);
      expect(result).toBe('');
    });

    test('round-trip with unicode content', () => {
      const plaintext = '🔑 API key: こんにちは 你好';
      const encrypted = encrypt(plaintext, validKey);
      const result = decrypt(encrypted, validKey);
      expect(result).toBe(plaintext);
    });

    test('throws authentication error on wrong key', () => {
      const encrypted = encrypt('secret', validKey);
      const wrongKey = crypto.randomBytes(32);
      expect(() => decrypt(encrypted, wrongKey)).toThrow(/authentication error/);
    });

    test('throws authentication error on tampered ciphertext', () => {
      const encrypted = encrypt('secret', validKey);
      encrypted.ciphertext = 'ff' + encrypted.ciphertext.slice(2);
      expect(() => decrypt(encrypted, validKey)).toThrow(/authentication error/);
    });

    test('throws authentication error on tampered authTag', () => {
      const encrypted = encrypt('secret', validKey);
      encrypted.authTag = 'ff' + encrypted.authTag.slice(2);
      expect(() => decrypt(encrypted, validKey)).toThrow(/authentication error/);
    });

    test('throws authentication error on tampered IV', () => {
      const encrypted = encrypt('secret', validKey);
      encrypted.iv = 'ff' + encrypted.iv.slice(2);
      expect(() => decrypt(encrypted, validKey)).toThrow(/authentication error/);
    });
  });
});
