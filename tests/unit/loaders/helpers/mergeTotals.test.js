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
      items: { count: 0, overrides: 2, errors: 0 },
      actions: { count: 3, overrides: 0, errors: 0 },
    });
    expect(main).toEqual({ items: { count: 1, overrides: 0, errors: 0 } });
  });
});
