import { afterEach, describe, it, expect, jest } from '@jest/globals';
import { formatTimestamp } from '../../../src/utils/textUtils.js';

const OriginalDate = globalThis.Date;

const installThrowingDate = (predicate) => {
  class ThrowingDate extends OriginalDate {
    constructor(value) {
      if (predicate(value)) {
        throw new Error('Date explosion');
      }
      super(value);
    }
  }

  ThrowingDate.now = OriginalDate.now;
  ThrowingDate.parse = OriginalDate.parse;
  ThrowingDate.UTC = OriginalDate.UTC;

  return ThrowingDate;
};

afterEach(() => {
  globalThis.Date = OriginalDate;
  jest.restoreAllMocks();
});

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

  it('falls back when a finite numeric timestamp produces an invalid date', () => {
    const invalidRangeTimestamp = 8640000000000001;
    expect(formatTimestamp(invalidRangeTimestamp, 'range-error')).toBe(
      'range-error'
    );
  });

  it('returns fallback when Date construction throws for strings', () => {
    globalThis.Date = installThrowingDate(
      (value) => value === 'force-string-throw'
    );
    expect(formatTimestamp('force-string-throw', 'string-fallback')).toBe(
      'string-fallback'
    );
  });

  it('returns fallback when Date instances report non-finite time values', () => {
    const date = new Date('2023-05-15T08:30:00Z');
    jest.spyOn(date, 'getTime').mockReturnValue(Number.NaN);
    expect(formatTimestamp(date, 'bad-date')).toBe('bad-date');
  });

  it('returns fallback when Date construction throws for numbers', () => {
    globalThis.Date = installThrowingDate((value) => typeof value === 'number');
    expect(formatTimestamp(42, 'number-fallback')).toBe('number-fallback');
  });

  it('returns fallback when fallback parameter is not a string', () => {
    // @ts-expect-error - intentionally passing a non-string fallback to validate coercion
    expect(formatTimestamp(null, { not: 'a string' })).toBe('Invalid Date');
  });

  it('supports objects coercible to valid timestamps', () => {
    const coercible = {
      [Symbol.toPrimitive]: () => '2024-03-20T10:15:30Z',
    };

    const expected = new Date('2024-03-20T10:15:30Z').toLocaleString();
    expect(formatTimestamp(coercible)).toBe(expected);
  });

  it('returns fallback for objects that cannot be converted into a valid date', () => {
    expect(formatTimestamp({})).toBe('Invalid Date');
  });
});
