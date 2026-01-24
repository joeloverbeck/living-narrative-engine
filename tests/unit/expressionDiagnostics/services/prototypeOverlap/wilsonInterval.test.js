/**
 * @file Unit tests for WilsonInterval utility
 *
 * @see tickets/PROANAOVEV3-003-wilson-interval-utility.md
 */

import { describe, expect, it } from '@jest/globals';
import { wilsonInterval } from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/WilsonInterval.js';

describe('wilsonInterval', () => {
  it('returns [0, 1] when trials are zero', () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
  });

  it('handles 0% success rate', () => {
    const result = wilsonInterval(0, 100);

    expect(result.lower).toBe(0);
    expect(result.upper).toBeCloseTo(0.0369948, 6);
  });

  it('handles 100% success rate', () => {
    const result = wilsonInterval(100, 100);

    expect(result.upper).toBeCloseTo(1, 12);
    expect(result.lower).toBeCloseTo(0.9630052, 6);
  });

  it('matches expected bounds for a 50% rate', () => {
    const result = wilsonInterval(50, 100);

    expect(result.lower).toBeCloseTo(0.4038298, 6);
    expect(result.upper).toBeCloseTo(0.5961702, 6);
  });

  it('narrows the interval with more samples', () => {
    const small = wilsonInterval(5, 10);
    const large = wilsonInterval(500, 1000);

    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });

  it('widens the interval at higher confidence levels', () => {
    const z90 = wilsonInterval(50, 100, 1.645);
    const z99 = wilsonInterval(50, 100, 2.576);

    expect(z99.upper - z99.lower).toBeGreaterThan(z90.upper - z90.lower);
  });
});
