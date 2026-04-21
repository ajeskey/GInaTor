'use strict';

const fc = require('fast-check');
const { sanitizeString, sanitizeValue } = require('../../modules/middleware/sanitize');

/**
 * Property 5: Input Sanitization
 * **Validates: Requirements 3.6**
 *
 * For any user-supplied string containing HTML tags, JavaScript event handlers,
 * or NoSQL operator patterns ($gt, $ne, $where, etc.), the sanitization function
 * SHALL produce an output string that does not contain any executable script
 * content or NoSQL operators.
 */
describe('Property 5: Input Sanitization', () => {
  // --- Generators ---

  // Arbitrary HTML tag wrapping arbitrary content
  const htmlTagArb = fc
    .tuple(
      fc.constantFrom(
        'script',
        'img',
        'div',
        'iframe',
        'object',
        'embed',
        'link',
        'style',
        'svg',
        'a',
        'b',
        'span'
      ),
      fc.string({ minLength: 0, maxLength: 30 })
    )
    .map(([tag, content]) => `<${tag}>${content}</${tag}>`);

  // Self-closing HTML tags with attributes
  const selfClosingTagArb = fc
    .tuple(
      fc.constantFrom('img', 'br', 'hr', 'input', 'meta', 'link'),
      fc.string({ minLength: 0, maxLength: 20 })
    )
    .map(([tag, attr]) => `<${tag} ${attr}>`);

  // JavaScript event handler patterns
  const eventHandlerArb = fc
    .tuple(
      fc.constantFrom(
        'onclick',
        'onload',
        'onerror',
        'onmouseover',
        'onfocus',
        'onblur',
        'onsubmit',
        'onchange',
        'onkeydown',
        'onkeyup'
      ),
      fc.string({ minLength: 1, maxLength: 20 })
    )
    .map(([handler, value]) => `${handler}=${value}`);

  // javascript: protocol URIs
  const jsProtocolArb = fc
    .tuple(
      fc.constantFrom('javascript:', 'JavaScript:', 'JAVASCRIPT:', 'jAvAsCrIpT:'),
      fc.string({ minLength: 0, maxLength: 20 })
    )
    .map(([proto, code]) => `${proto}${code}`);

  // NoSQL operator patterns
  const nosqlOperators = [
    '$gt',
    '$gte',
    '$lt',
    '$lte',
    '$ne',
    '$eq',
    '$in',
    '$nin',
    '$regex',
    '$exists',
    '$where',
    '$or',
    '$and',
    '$not',
    '$nor'
  ];
  const nosqlOperatorArb = fc.constantFrom(...nosqlOperators);

  // String containing a NoSQL operator embedded in surrounding text
  const nosqlStringArb = fc
    .tuple(
      fc.string({ minLength: 0, maxLength: 15 }),
      nosqlOperatorArb,
      fc.string({ minLength: 0, maxLength: 15 })
    )
    .map(([prefix, op, suffix]) => `${prefix}${op}${suffix}`);

  // Mixed malicious input combining multiple attack vectors
  const mixedMaliciousArb = fc
    .tuple(htmlTagArb, eventHandlerArb, nosqlStringArb)
    .map(([html, handler, nosql]) => `${html} ${handler} ${nosql}`);

  // Regex to detect HTML tags in output
  const htmlTagRegex = /<[^>]*>/;

  // Regex to detect JS event handlers in output
  const eventHandlerRegex = /\bon\w+\s*=/i;

  // Regex to detect javascript: protocol in output
  const jsProtocolRegex = /javascript\s*:/i;

  // Regex to detect NoSQL operators in output
  const nosqlOperatorRegex =
    /\$(?:gt|gte|lt|lte|ne|eq|in|nin|regex|exists|where|or|and|not|nor)\b/i;

  // --- Property Tests ---

  it('sanitizeString removes all HTML tags from any input containing tags', () => {
    fc.assert(
      fc.property(htmlTagArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(htmlTagRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeString removes all self-closing HTML tags', () => {
    fc.assert(
      fc.property(selfClosingTagArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(htmlTagRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeString removes all JavaScript event handlers from any input', () => {
    fc.assert(
      fc.property(eventHandlerArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(eventHandlerRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeString removes javascript: protocol from any input', () => {
    fc.assert(
      fc.property(jsProtocolArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(jsProtocolRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeString removes all NoSQL operators from any input containing them', () => {
    fc.assert(
      fc.property(nosqlStringArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(nosqlOperatorRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeString removes all attack vectors from mixed malicious input', () => {
    fc.assert(
      fc.property(mixedMaliciousArb, (input) => {
        const result = sanitizeString(input);
        expect(result).not.toMatch(htmlTagRegex);
        expect(result).not.toMatch(eventHandlerRegex);
        expect(result).not.toMatch(jsProtocolRegex);
        expect(result).not.toMatch(nosqlOperatorRegex);
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeValue recursively sanitizes all strings in nested objects', () => {
    // Generate objects with malicious string values
    const maliciousObjArb = fc.record({
      a: htmlTagArb,
      b: nosqlStringArb,
      nested: fc.record({
        c: eventHandlerArb,
        d: jsProtocolArb
      })
    });

    fc.assert(
      fc.property(maliciousObjArb, (input) => {
        const result = sanitizeValue(input);
        // Check all leaf string values are clean
        const allValues = [result.a, result.b, result.nested.c, result.nested.d];
        for (const val of allValues) {
          expect(val).not.toMatch(htmlTagRegex);
          expect(val).not.toMatch(eventHandlerRegex);
          expect(val).not.toMatch(jsProtocolRegex);
          expect(val).not.toMatch(nosqlOperatorRegex);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('sanitizeValue strips object keys starting with $ (NoSQL operator keys)', () => {
    fc.assert(
      fc.property(
        nosqlOperatorArb,
        fc.anything(),
        fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.startsWith('$')),
        fc.string({ minLength: 0, maxLength: 20 }),
        (opKey, opValue, safeKey, safeValue) => {
          const input = { [opKey]: opValue, [safeKey]: safeValue };
          const result = sanitizeValue(input);
          // The $-prefixed key should be stripped
          expect(Object.keys(result).some((k) => k.startsWith('$'))).toBe(false);
          // The safe key should remain
          expect(safeKey in result).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
