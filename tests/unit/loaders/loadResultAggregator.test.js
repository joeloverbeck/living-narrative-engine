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
    agg.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');
    agg.aggregate({ count: 1, overrides: 0, errors: 1 }, 'events');

    expect(agg.getModResults()).toEqual({
      actions: { count: 2, overrides: 1, errors: 0, failures: [] },
      events: { count: 1, overrides: 0, errors: 1, failures: [] },
    });

    // Original totals object should remain unchanged (immutable behavior)
    expect(totals).toEqual({});

    // Updated totals should be accessible via getTotalCounts()
    expect(agg.getTotalCounts()).toEqual({
      actions: { count: 2, overrides: 1, errors: 0, failures: [] },
      events: { count: 1, overrides: 0, errors: 1, failures: [] },
    });
  });

  it('accumulates failures from multiple aggregations', () => {
    const failure1 = { file: 'test1.json', error: new Error('error 1') };
    const failure2 = { file: 'test2.json', error: new Error('error 2') };

    agg.aggregate(
      { count: 0, overrides: 0, errors: 1, failures: [failure1] },
      'items'
    );
    agg.aggregate(
      { count: 0, overrides: 0, errors: 1, failures: [failure2] },
      'items'
    );

    const totals = agg.getTotalCounts();
    expect(totals.items.failures).toHaveLength(2);
    expect(totals.items.failures[0].file).toBe('test1.json');
    expect(totals.items.failures[1].file).toBe('test2.json');
  });

  it('recordFailure increments error counts in both summaries', () => {
    agg.aggregate({ count: 1, overrides: 0, errors: 0 }, 'rules');
    agg.recordFailure('rules');
    agg.recordFailure('missing');

    expect(agg.getModResults().rules.errors).toBe(1);
    expect(agg.getModResults().missing.errors).toBe(1);
    expect(agg.getModResults().rules.failures).toEqual([]);
    expect(agg.getModResults().missing.failures).toEqual([]);

    // Original totals object should remain unchanged (immutable behavior)
    expect(totals).toEqual({});

    // Updated totals should be accessible via getTotalCounts()
    const updatedTotals = agg.getTotalCounts();
    expect(updatedTotals.rules.errors).toBe(1);
    expect(updatedTotals.missing.errors).toBe(1);
    expect(updatedTotals.rules.failures).toEqual([]);
    expect(updatedTotals.missing.failures).toEqual([]);
  });
});
