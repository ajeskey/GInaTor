'use strict';

const bcrypt = require('bcrypt');
const fc = require('fast-check');

/**
 * Property 2: Password Hashing Round-Trip
 * **Validates: Requirements 1.4, 3.5**
 *
 * For any valid password string, hashing it with bcrypt (cost factor >= 10)
 * and then verifying the original password against the resulting hash SHALL
 * return true. Verifying any different password against the same hash SHALL
 * return false.
 */
describe('Property 2: Password Hashing Round-Trip', () => {
  const COST_FACTOR = 10;

  // Generator for valid password strings (>= 8 chars, printable ASCII)
  const validPasswordArb = fc.string({ minLength: 8, maxLength: 64 });

  // Generator for a pair of distinct passwords
  const distinctPasswordPairArb = fc
    .tuple(validPasswordArb, validPasswordArb)
    .filter(([p1, p2]) => p1 !== p2);

  it('hashing then verifying the same password returns true', async () => {
    await fc.assert(
      fc.asyncProperty(validPasswordArb, async (password) => {
        const hash = await bcrypt.hash(password, COST_FACTOR);
        const match = await bcrypt.compare(password, hash);
        expect(match).toBe(true);
      }),
      { numRuns: 10 }
    );
  });

  it('verifying a different password against the hash returns false', async () => {
    await fc.assert(
      fc.asyncProperty(distinctPasswordPairArb, async ([original, different]) => {
        const hash = await bcrypt.hash(original, COST_FACTOR);
        const match = await bcrypt.compare(different, hash);
        expect(match).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it('bcrypt cost factor is at least 10', async () => {
    await fc.assert(
      fc.asyncProperty(validPasswordArb, async (password) => {
        const hash = await bcrypt.hash(password, COST_FACTOR);
        // bcrypt hash format: $2b$XX$... where XX is the cost factor
        const rounds = bcrypt.getRounds(hash);
        expect(rounds).toBeGreaterThanOrEqual(10);
      }),
      { numRuns: 10 }
    );
  });
});
