import { describe, it, expect, beforeEach } from '@jest/globals';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';

describe('LoadResultAggregator utility', () => {
  let aggregator;
  let initialTotals;

  beforeEach(() => {
    initialTotals = {};
    aggregator = new LoadResultAggregator(initialTotals);
  });

  it('aggregate updates mod and total counts', () => {
    aggregator.aggregate({ count: 2, overrides: 1, errors: 0 }, 'actions');

    expect(aggregator.modResults).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
    });

    // Original totals object should remain unchanged (immutable behavior)
    expect(initialTotals).toEqual({});

    // Updated totals should be accessible via getTotalCounts()
    expect(aggregator.getTotalCounts()).toEqual({
      actions: { count: 2, overrides: 1, errors: 0 },
    });
  });

  it('aggregate handles invalid results', () => {
    aggregator.aggregate(null, 'rules');

    expect(aggregator.modResults).toEqual({
      rules: { count: 0, overrides: 0, errors: 0 },
    });

    // Original totals object should remain unchanged (immutable behavior)
    expect(initialTotals).toEqual({});

    // Updated totals should be accessible via getTotalCounts()
    expect(aggregator.getTotalCounts()).toEqual({
      rules: { count: 0, overrides: 0, errors: 0 },
    });
  });

  it('recordFailure increments error counts', () => {
    aggregator.modResults = { events: { count: 5, overrides: 0, errors: 0 } };
    aggregator.recordFailure('events');
    aggregator.recordFailure('events');

    expect(aggregator.modResults.events.errors).toBe(2);

    // Original totals object should remain unchanged (immutable behavior)
    expect(initialTotals).toEqual({});

    // Updated totals should be accessible via getTotalCounts()
    const updatedTotals = aggregator.getTotalCounts();
    expect(updatedTotals.events.errors).toBe(2);
  });
});
