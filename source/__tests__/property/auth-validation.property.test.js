'use strict';

const fc = require('fast-check');
const { isValidEmail, isValidPassword } = require('../../modules/auth/AuthService');

/**
 * Property 1: Email and Password Validation
 * **Validates: Requirements 1.3**
 *
 * For any string pair (email, password), the registration validation function
 * SHALL accept the input if and only if the email matches a well-formed email
 * pattern (contains exactly one @ with a non-empty local part and a domain with
 * at least one dot) and the password is at least 8 characters long. All other
 * inputs SHALL be rejected.
 */
describe('Property 1: Email and Password Validation', () => {
  // --- Generators ---

  // Generator for well-formed emails: non-empty local part, exactly one @,
  // domain with at least one dot, dot not first or last in domain
  const validEmailArb = fc
    .tuple(
      fc.stringOf(
        fc
          .char()
          .filter((c) => c !== '@' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126),
        { minLength: 1, maxLength: 20 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      )
    )
    .map(([local, domainLabel, tld]) => `${local}@${domainLabel}.${tld}`);

  // Generator for valid passwords (>= 8 characters)
  const validPasswordArb = fc.string({ minLength: 8, maxLength: 50 });

  // Generator for short passwords (< 8 characters)
  const shortPasswordArb = fc.string({ minLength: 0, maxLength: 7 });

  // Generator for emails missing @ entirely
  const noAtEmailArb = fc.stringOf(
    fc.char().filter((c) => c !== '@'),
    { minLength: 1, maxLength: 30 }
  );

  // Generator for emails with empty local part (starts with @)
  const emptyLocalEmailArb = fc
    .tuple(
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      )
    )
    .map(([label, tld]) => `@${label}.${tld}`);

  // Generator for emails with multiple @ signs
  const multipleAtEmailArb = fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.string({ minLength: 1, maxLength: 10 })
    )
    .map(([a, b, c]) => `${a}@${b}@${c}`);

  // Generator for emails with no dot in domain
  const noDotDomainEmailArb = fc
    .tuple(
      fc.stringOf(
        fc
          .char()
          .filter((c) => c !== '@' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      )
    )
    .map(([local, domain]) => `${local}@${domain}`);

  // Generator for emails where domain starts with dot
  const dotStartDomainEmailArb = fc
    .tuple(
      fc.stringOf(
        fc
          .char()
          .filter((c) => c !== '@' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      )
    )
    .map(([local, domain]) => `${local}@.${domain}`);

  // Generator for emails where domain ends with dot
  const dotEndDomainEmailArb = fc
    .tuple(
      fc.stringOf(
        fc
          .char()
          .filter((c) => c !== '@' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126),
        { minLength: 1, maxLength: 10 }
      ),
      fc.stringOf(
        fc
          .char()
          .filter(
            (c) =>
              c !== '@' && c !== '.' && c !== ' ' && c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126
          ),
        { minLength: 1, maxLength: 10 }
      )
    )
    .map(([local, domain]) => `${local}@${domain}.`);

  // --- Property Tests ---

  it('accepts valid email and valid password pairs', () => {
    fc.assert(
      fc.property(validEmailArb, validPasswordArb, (email, password) => {
        expect(isValidEmail(email)).toBe(true);
        expect(isValidPassword(password)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email missing the @ character', () => {
    fc.assert(
      fc.property(noAtEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email with an empty local part', () => {
    fc.assert(
      fc.property(emptyLocalEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email with multiple @ characters', () => {
    fc.assert(
      fc.property(multipleAtEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email with no dot in the domain', () => {
    fc.assert(
      fc.property(noDotDomainEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email where domain starts with a dot', () => {
    fc.assert(
      fc.property(dotStartDomainEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any email where domain ends with a dot', () => {
    fc.assert(
      fc.property(dotEndDomainEmailArb, (email) => {
        expect(isValidEmail(email)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects non-string email inputs', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => typeof v !== 'string'),
        (email) => {
          expect(isValidEmail(email)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts any password with 8 or more characters', () => {
    fc.assert(
      fc.property(validPasswordArb, (password) => {
        expect(isValidPassword(password)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects any password shorter than 8 characters', () => {
    fc.assert(
      fc.property(shortPasswordArb, (password) => {
        expect(isValidPassword(password)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it('rejects non-string password inputs', () => {
    fc.assert(
      fc.property(
        fc.anything().filter((v) => typeof v !== 'string'),
        (password) => {
          expect(isValidPassword(password)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('registration validation accepts if and only if email is well-formed AND password >= 8 chars', () => {
    // Combined property: for arbitrary string pairs, both must pass for acceptance
    const arbitraryStringArb = fc.oneof(
      validEmailArb,
      noAtEmailArb,
      emptyLocalEmailArb,
      multipleAtEmailArb,
      noDotDomainEmailArb,
      fc.string({ minLength: 0, maxLength: 30 })
    );
    const arbitraryPasswordArb = fc.oneof(
      validPasswordArb,
      shortPasswordArb,
      fc.string({ minLength: 0, maxLength: 50 })
    );

    fc.assert(
      fc.property(arbitraryStringArb, arbitraryPasswordArb, (email, password) => {
        const emailValid = isValidEmail(email);
        const passwordValid = isValidPassword(password);
        const bothAccepted = emailValid && passwordValid;

        // If both are valid, registration should be accepted
        // If either is invalid, registration should be rejected
        if (bothAccepted) {
          expect(emailValid).toBe(true);
          expect(passwordValid).toBe(true);
        } else {
          expect(emailValid && passwordValid).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });
});
