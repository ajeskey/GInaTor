'use strict';

const fc = require('fast-check');
const { detectSpikes } = require('../../modules/api/computations');

// Feature: ginator, Property 19: Activity Spike Detection
// **Validates: Requirements 23.7**

describe('Property 19: Activity Spike Detection', () => {
  const timeSeriesArb = fc.array(
    fc.record({
      period: fc.string({ minLength: 1, maxLength: 10 }),
      count: fc.nat({ max: 1000 })
    }),
    { minLength: 3, maxLength: 100 }
  );

  it('flags exactly those data points whose value exceeds mean + 2*stddev', () => {
    fc.assert(
      fc.property(timeSeriesArb, (timeSeries) => {
        const result = detectSpikes(timeSeries);
        const counts = timeSeries.map(t => t.count);
        const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
        const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
        const stddev = Math.sqrt(variance);
        const threshold = mean + 2 * stddev;

        for (let i = 0; i < result.length; i++) {
          if (result[i].count > threshold) {
            expect(result[i].isSpike).toBe(true);
          } else {
            expect(result[i].isSpike).toBe(false);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('no data point at or below threshold is flagged', () => {
    fc.assert(
      fc.property(timeSeriesArb, (timeSeries) => {
        const result = detectSpikes(timeSeries);
        const counts = timeSeries.map(t => t.count);
        const mean = counts.reduce((s, v) => s + v, 0) / counts.length;
        const variance = counts.reduce((s, v) => s + (v - mean) ** 2, 0) / counts.length;
        const stddev = Math.sqrt(variance);
        const threshold = mean + 2 * stddev;

        for (const dp of result) {
          if (dp.count <= threshold) {
            expect(dp.isSpike).toBe(false);
          }
        }
      }),
      { numRuns: 200 }
    );
  });
});
