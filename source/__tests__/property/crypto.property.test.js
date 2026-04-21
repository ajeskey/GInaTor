'use strict';

const crypto = require('node:crypto');
const fc = require('fast-check');
const { encrypt, decrypt } = require('../../modules/crypto');

/**
 * Property 6: AES-256-GCM Encryption Round-Trip
 * **Validates: Requirements 3.9**
 *
 * For any plaintext string and any valid 256-bit encryption key,
 * encrypting with AES-256-GCM and then decrypting with the same key
 * SHALL produce the original plaintext. Decrypting with a different
 * key SHALL throw an authentication error.
 */
describe('Property 6: AES-256-GCM Encryption Round-Trip', () => {
  // Generator for valid 256-bit keys as hex strings (64 hex chars = 32 bytes)
  const validKeyArb = fc.uint8Array({ minLength: 32, maxLength: 32 }).map(
    (bytes) => Buffer.from(bytes).toString('hex')
  );

  // Generator for a pair of distinct 256-bit keys
  const distinctKeyPairArb = fc
    .tuple(validKeyArb, validKeyArb)
    .filter(([k1, k2]) => k1 !== k2);

  it('encrypt then decrypt with the same key returns the original plaintext', () => {
    fc.assert(
      fc.property(fc.fullUnicodeString(), validKeyArb, (plaintext, key) => {
        const encrypted = encrypt(plaintext, key);
        const decrypted = decrypt(encrypted, key);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: 200 }
    );
  });

  it('decrypt with a different key throws an authentication error', () => {
    fc.assert(
      fc.property(
        fc.fullUnicodeString({ minLength: 1 }),
        distinctKeyPairArb,
        (plaintext, [encryptKey, wrongKey]) => {
          const encrypted = encrypt(plaintext, encryptKey);
          expect(() => decrypt(encrypted, wrongKey)).toThrow(/authentication error/);
        }
      ),
      { numRuns: 200 }
    );
  });
});
