/**
 * Property 25: View State URL Round-Trip
 *
 * For any valid view state (visualization type from the 17 supported types,
 * a date range with from ≤ to, and a repository ID), encoding the state into
 * URL query parameters and then decoding those parameters back SHALL produce
 * a view state identical to the original.
 *
 * Validates: Requirements 36.1, 36.2
 */
const fc = require('fast-check');

// Pure encode/decode functions extracted from UrlState for Node.js testing
const VALID_VIZ_TYPES = [
  'timebloom',
  'heatmap',
  'treemap',
  'sunburst',
  'branches',
  'pulse',
  'impact',
  'collaboration',
  'filetypes',
  'activity-matrix',
  'bubblemap',
  'complexity',
  'pr-flow',
  'bus-factor',
  'stale-files',
  'city-block',
  'genome'
];

/**
 * Encode view state into URL query parameters string.
 * @param {object} viewState
 * @returns {string} query string (without leading '?')
 */
function encode(viewState) {
  if (!viewState) return '';
  var params = [];
  if (viewState.visualization && VALID_VIZ_TYPES.indexOf(viewState.visualization) !== -1) {
    params.push('viz=' + encodeURIComponent(viewState.visualization));
  }
  if (viewState.from) {
    params.push('from=' + encodeURIComponent(viewState.from));
  }
  if (viewState.to) {
    params.push('to=' + encodeURIComponent(viewState.to));
  }
  if (viewState.repoId) {
    params.push('repo=' + encodeURIComponent(viewState.repoId));
  }
  return params.join('&');
}

/**
 * Decode URL query parameters string into view state.
 * @param {string} queryString
 * @returns {object} viewState
 */
function decode(queryString) {
  var result = {
    visualization: null,
    from: null,
    to: null,
    repoId: null
  };
  if (!queryString) return result;

  var qs = queryString.charAt(0) === '?' ? queryString.substring(1) : queryString;
  if (!qs) return result;

  var pairs = qs.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var eqIdx = pairs[i].indexOf('=');
    if (eqIdx === -1) continue;
    var key = decodeURIComponent(pairs[i].substring(0, eqIdx));
    var value = decodeURIComponent(pairs[i].substring(eqIdx + 1));

    if (key === 'viz' && VALID_VIZ_TYPES.indexOf(value) !== -1) {
      result.visualization = value;
    } else if (key === 'from' && value) {
      result.from = value;
    } else if (key === 'to' && value) {
      result.to = value;
    } else if (key === 'repo' && value) {
      result.repoId = value;
    }
  }
  return result;
}

// Arbitrary: generate a valid date range where from <= to
const dateRangeArb = fc
  .tuple(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') }),
    fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
  )
  .map(([a, b]) => {
    const sorted = a <= b ? [a, b] : [b, a];
    return {
      from: sorted[0].toISOString(),
      to: sorted[1].toISOString()
    };
  });

// Arbitrary: generate a valid repo ID (non-empty, no special URL chars that break encoding)
const repoIdArb = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')),
  { minLength: 1, maxLength: 40 }
);

// Arbitrary: generate a valid visualization type
const vizTypeArb = fc.constantFrom(...VALID_VIZ_TYPES);

// Arbitrary: generate a full valid view state
const viewStateArb = fc
  .record({
    visualization: vizTypeArb,
    from: dateRangeArb.map((dr) => dr.from),
    to: dateRangeArb.map((dr) => dr.to),
    repoId: repoIdArb
  })
  .filter((vs) => {
    // Ensure from <= to
    return new Date(vs.from) <= new Date(vs.to);
  });

// Feature: ginator, Property 25: View State URL Round-Trip
describe('Property 25: View State URL Round-Trip', () => {
  /**
   * **Validates: Requirements 36.1, 36.2**
   */
  it('encoding then decoding a valid view state produces the original state', () => {
    fc.assert(
      fc.property(viewStateArb, (viewState) => {
        const encoded = encode(viewState);
        const decoded = decode(encoded);

        expect(decoded.visualization).toBe(viewState.visualization);
        expect(decoded.from).toBe(viewState.from);
        expect(decoded.to).toBe(viewState.to);
        expect(decoded.repoId).toBe(viewState.repoId);
      }),
      { numRuns: 200 }
    );
  });

  it('decoding an encoded state with leading ? also round-trips', () => {
    fc.assert(
      fc.property(viewStateArb, (viewState) => {
        const encoded = '?' + encode(viewState);
        const decoded = decode(encoded);

        expect(decoded.visualization).toBe(viewState.visualization);
        expect(decoded.from).toBe(viewState.from);
        expect(decoded.to).toBe(viewState.to);
        expect(decoded.repoId).toBe(viewState.repoId);
      }),
      { numRuns: 100 }
    );
  });

  it('empty/null input decodes to null fields', () => {
    const empty = decode('');
    expect(empty.visualization).toBeNull();
    expect(empty.from).toBeNull();
    expect(empty.to).toBeNull();
    expect(empty.repoId).toBeNull();

    const nullResult = decode(null);
    expect(nullResult.visualization).toBeNull();
  });

  it('invalid visualization type is not decoded', () => {
    const decoded = decode('viz=invalid-type&repo=test');
    expect(decoded.visualization).toBeNull();
    expect(decoded.repoId).toBe('test');
  });
});
