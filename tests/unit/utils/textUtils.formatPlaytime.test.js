import { describe, it, expect } from '@jest/globals';
import { formatPlaytime } from '../../../src/utils/textUtils.js';

// Cover edge cases and typical scenarios for formatPlaytime

describe('formatPlaytime', () => {
  it('returns "N/A" for non-number input', () => {
    // @ts-ignore testing invalid type
    expect(formatPlaytime('abc')).toBe('N/A');
  });

  it('returns "N/A" for NaN or negative numbers', () => {
    expect(formatPlaytime(NaN)).toBe('N/A');
    expect(formatPlaytime(-5)).toBe('N/A');
  });

  it('formats zero seconds correctly', () => {
    expect(formatPlaytime(0)).toBe('00:00:00');
  });

  it('formats hours, minutes and seconds', () => {
    // 1 hour, 1 minute, 1 second = 3661 seconds
    expect(formatPlaytime(3661)).toBe('01:01:01');
  });
});
