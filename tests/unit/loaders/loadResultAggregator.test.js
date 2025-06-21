import { describe, it, expect, beforeEach } from '@jest/globals';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';

describe('LoadResultAggregator', () => {
  /** @type {import('../../../src/loaders/LoadResultAggregator.js').TotalResultsSummary} */
  let totals;
  /** @type {LoadResultAggregator} */
  let agg;

  beforeEach(() => {
    totals = {};
    agg = new LoadResultAggregator(totals);
  });

  it('aggregates multiple results and updates totals', () => {
    const updatedTotals1 = agg.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');
    const updatedTotals2 = agg.aggregate({ count: 1, overrides: 0, errors: 1 }, 'events');

    expect(agg.modResults).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
      events: { count: 1, overrides: 0, errors: 1 },
    });
    expect(updatedTotals2).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
      events: { count: 1, overrides: 0, errors: 1 },
    });
    // Verify that the original totals object is not mutated
    expect(totals).toEqual({});
  });

  it('recordFailure increments error counts in both summaries', () => {
    agg.aggregate({ count: 1, overrides: 0, errors: 0 }, 'rules');
    const updatedTotals1 = agg.recordFailure('rules');
    const updatedTotals2 = agg.recordFailure('missing');

    expect(agg.modResults.rules.errors).toBe(1);
    expect(agg.modResults.missing.errors).toBe(1);
    expect(updatedTotals2.rules.errors).toBe(1);
    expect(updatedTotals2.missing.errors).toBe(1);
    // Verify that the original totals object is not mutated
    expect(totals).toEqual({});
  });
});
