import { describe, it, expect } from '@jest/globals';
import { formatTimestamp } from '../../../src/utils/textUtils.js';

describe('formatTimestamp', () => {
  it('returns locale string for valid ISO input', () => {
    const ts = '2023-01-01T00:00:00Z';
    const expected = new Date(ts).toLocaleString();
    expect(formatTimestamp(ts)).toBe(expected);
  });

  it('returns fallback for invalid date', () => {
    expect(formatTimestamp('not-a-date')).toBe('Invalid Date');
  });

  it('uses provided fallback on error', () => {
    const fallback = 'N/A';
    expect(formatTimestamp('???', fallback)).toBe(fallback);
  });
});
