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

  it('uses provided fallback when date parsing fails', () => {
    const fallback = 'N/A';
    expect(formatTimestamp('???', fallback)).toBe(fallback);
  });

  it('handles errors thrown during Date construction', () => {
    const throwingInput = {
      toString() {
        throw new Error('boom');
      },
    };
    expect(formatTimestamp(throwingInput, 'bad')).toBe('bad');
  });

  it('returns fallback for nullish or blank input', () => {
    expect(formatTimestamp(undefined, 'missing')).toBe('missing');
    expect(formatTimestamp(null, 'missing')).toBe('missing');
    expect(formatTimestamp('   ', 'missing')).toBe('missing');
  });

  it('returns fallback for non-finite numeric timestamps', () => {
    expect(formatTimestamp(Number.POSITIVE_INFINITY, 'bad-number')).toBe(
      'bad-number'
    );
    expect(formatTimestamp(Number.NaN, 'bad-number')).toBe('bad-number');
  });

  it('supports Date instances as input', () => {
    const date = new Date('2023-05-15T08:30:00Z');
    expect(formatTimestamp(date)).toBe(date.toLocaleString());
  });
});
