'use strict';

const crypto = require('node:crypto');
const fc = require('fast-check');
const {
  validateGitHubSignature,
  validateGitLabSignature
} = require('../../modules/webhooks/webhookHandler');

/**
 * Property 10: Webhook Signature Validation
 * **Validates: Requirements 6.3**
 *
 * For any webhook payload and secret, computing the HMAC-SHA256 signature
 * of the payload with the secret and then validating the payload against
 * that signature SHALL succeed. Validating the same payload against a
 * signature computed with any different secret SHALL fail.
 */
describe('Property 10: Webhook Signature Validation', () => {
  // Generator for non-empty secrets (webhook secrets are always non-empty)
  const secretArb = fc.string({ minLength: 1, maxLength: 128 });

  // Generator for a pair of distinct non-empty secrets
  const distinctSecretPairArb = fc
    .tuple(secretArb, secretArb)
    .filter(([s1, s2]) => s1 !== s2);

  // Generator for webhook payloads (non-empty strings)
  const payloadArb = fc.string({ minLength: 1, maxLength: 2048 });

  describe('GitHub HMAC-SHA256 signature', () => {
    it('validates successfully when signature is computed with the same secret', () => {
      fc.assert(
        fc.property(payloadArb, secretArb, (payload, secret) => {
          const signature =
            'sha256=' +
            crypto.createHmac('sha256', secret).update(payload).digest('hex');
          expect(validateGitHubSignature(payload, secret, signature)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('fails validation when signature is computed with a different secret', () => {
      fc.assert(
        fc.property(
          payloadArb,
          distinctSecretPairArb,
          (payload, [correctSecret, wrongSecret]) => {
            const signature =
              'sha256=' +
              crypto
                .createHmac('sha256', wrongSecret)
                .update(payload)
                .digest('hex');
            expect(validateGitHubSignature(payload, correctSecret, signature)).toBe(
              false
            );
          }
        ),
        { numRuns: 200 }
      );
    });
  });

  describe('GitLab token validation', () => {
    it('validates successfully when token matches the secret', () => {
      fc.assert(
        fc.property(secretArb, (secret) => {
          expect(validateGitLabSignature(secret, secret)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it('fails validation when token does not match the secret', () => {
      fc.assert(
        fc.property(distinctSecretPairArb, ([secret, wrongToken]) => {
          expect(validateGitLabSignature(secret, wrongToken)).toBe(false);
        }),
        { numRuns: 200 }
      );
    });
  });
});
