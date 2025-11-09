import { describe, it, expect } from '@jest/globals';
import { mergeTotals } from '../../../../src/loaders/helpers/mergeTotals.js';

describe('mergeTotals', () => {
  it('merges updated totals without mutating original', () => {
    const main = { items: { count: 1, overrides: 0, errors: 0 } };
    const updated = {
      items: { overrides: 2 },
      actions: { count: 3 },
    };

    const result = mergeTotals(main, updated);

    expect(result).toEqual({
      items: { count: 0, overrides: 2, errors: 0, failures: [] },
      actions: { count: 3, overrides: 0, errors: 0, failures: [] },
    });
    expect(main).toEqual({ items: { count: 1, overrides: 0, errors: 0 } });
  });

  it('preserves failures array when present', () => {
    const main = { items: { count: 1, overrides: 0, errors: 0, failures: [] } };
    const updated = {
      items: {
        count: 2,
        overrides: 0,
        errors: 1,
        failures: [{ file: 'test.json', error: new Error('test error') }],
      },
    };

    const result = mergeTotals(main, updated);

    expect(result.items.failures).toHaveLength(1);
    expect(result.items.failures[0].file).toBe('test.json');
  });

  it('defaults to empty failures array when not provided', () => {
    const main = { items: { count: 1, overrides: 0, errors: 0 } };
    const updated = {
      items: { count: 2, overrides: 0, errors: 0 },
    };

    const result = mergeTotals(main, updated);

    expect(result.items.failures).toEqual([]);
  });
});
