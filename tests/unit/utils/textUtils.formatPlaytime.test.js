import { describe, it, expect } from '@jest/globals';
import { formatPlaytime } from '../../../src/utils/textUtils.js';

// Cover edge cases and typical scenarios for formatPlaytime

describe('formatPlaytime', () => {
  it('returns "N/A" for non-number input', () => {
    // @ts-ignore testing invalid type
    expect(formatPlaytime('abc')).toBe('N/A');
  });

  it('returns "N/A" for NaN, negative or non-finite numbers', () => {
    expect(formatPlaytime(NaN)).toBe('N/A');
    expect(formatPlaytime(-5)).toBe('N/A');
    expect(formatPlaytime(Infinity)).toBe('N/A');
    expect(formatPlaytime(-Infinity)).toBe('N/A');
  });

  it('formats zero seconds correctly', () => {
    expect(formatPlaytime(0)).toBe('00:00:00');
  });

  it('formats values with two-digit components without adding extra padding', () => {
    expect(formatPlaytime(37230)).toBe('10:20:30');
  });

  it('floors fractional seconds when formatting', () => {
    expect(formatPlaytime(37230.987)).toBe('10:20:30');
  });

  it('formats hours, minutes and seconds', () => {
    // 1 hour, 1 minute, 1 second = 3661 seconds
    expect(formatPlaytime(3661)).toBe('01:01:01');
  });

  it('handles short durations producing two-digit seconds correctly', () => {
    expect(formatPlaytime(12)).toBe('00:00:12');
  });
});
