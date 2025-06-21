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
    const result1 = agg.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');
    const agg2 = new LoadResultAggregator(result1);
    const result2 = agg2.aggregate({ count: 1, overrides: 0, errors: 1 }, 'events');

    expect(agg.modResults).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
    });
    expect(agg2.modResults).toEqual({
      events: { count: 1, overrides: 0, errors: 1 },
    });
    expect(result2).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
      events: { count: 1, overrides: 0, errors: 1 },
    });
  });

  it('recordFailure increments error counts in both summaries', () => {
    agg.aggregate({ count: 1, overrides: 0, errors: 0 }, 'rules');
    const result1 = agg.recordFailure('rules');
    const result2 = agg.recordFailure('missing');

    expect(agg.modResults.rules.errors).toBe(1);
    expect(agg.modResults.missing.errors).toBe(1);
    expect(result1.rules.errors).toBe(1);
    expect(result2.missing.errors).toBe(1);
  });
});
