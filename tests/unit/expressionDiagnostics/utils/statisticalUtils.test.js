/**
 * @file Unit tests for statisticalUtils.js
 */

import { describe, expect, it } from '@jest/globals';
import {
  computeMedian,
  computeMedianAndIQR,
  computePercentile,
} from '../../../../src/expressionDiagnostics/utils/statisticalUtils.js';

describe('statisticalUtils', () => {
  describe('computeMedian', () => {
    it('should return 0 for empty array', () => {
      expect(computeMedian([])).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(computeMedian(null)).toBe(0);
      expect(computeMedian(undefined)).toBe(0);
    });

    it('should return the single element for single-element array', () => {
      expect(computeMedian([5])).toBe(5);
      expect(computeMedian([0])).toBe(0);
      expect(computeMedian([-3])).toBe(-3);
    });

    it('should compute median for odd-length sorted array', () => {
      expect(computeMedian([1, 2, 3])).toBe(2);
      expect(computeMedian([1, 2, 3, 4, 5])).toBe(3);
      expect(computeMedian([10, 20, 30, 40, 50, 60, 70])).toBe(40);
    });

    it('should compute median for even-length sorted array', () => {
      expect(computeMedian([1, 2])).toBe(1.5);
      expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
      expect(computeMedian([10, 20, 30, 40])).toBe(25);
    });

    it('should handle arrays with duplicate values', () => {
      expect(computeMedian([1, 1, 1])).toBe(1);
      expect(computeMedian([1, 1, 2, 2])).toBe(1.5);
      expect(computeMedian([5, 5, 5, 5, 5])).toBe(5);
    });

    it('should handle arrays with negative values', () => {
      expect(computeMedian([-5, -3, -1])).toBe(-3);
      expect(computeMedian([-4, -2, 0, 2])).toBe(-1);
    });

    it('should handle arrays with decimal values', () => {
      expect(computeMedian([0.1, 0.2, 0.3])).toBeCloseTo(0.2);
      expect(computeMedian([0.5, 1.5])).toBe(1);
    });
  });

  describe('computeMedianAndIQR', () => {
    it('should return zeros for empty array', () => {
      const result = computeMedianAndIQR([]);
      expect(result.median).toBe(0);
      expect(result.iqr).toBe(0);
      expect(result.q1).toBe(0);
      expect(result.q3).toBe(0);
    });

    it('should return zeros for null/undefined', () => {
      expect(computeMedianAndIQR(null)).toEqual({
        median: 0,
        iqr: 0,
        q1: 0,
        q3: 0,
      });
      expect(computeMedianAndIQR(undefined)).toEqual({
        median: 0,
        iqr: 0,
        q1: 0,
        q3: 0,
      });
    });

    it('should return zeros for array with only non-finite values', () => {
      expect(computeMedianAndIQR([NaN, Infinity, -Infinity])).toEqual({
        median: 0,
        iqr: 0,
        q1: 0,
        q3: 0,
      });
    });

    it('should filter out non-finite values', () => {
      const result = computeMedianAndIQR([1, NaN, 2, Infinity, 3]);
      expect(result.median).toBe(2);
    });

    it('should compute median and IQR for single element', () => {
      const result = computeMedianAndIQR([5]);
      expect(result.median).toBe(5);
      expect(result.iqr).toBe(0);
    });

    it('should compute median and IQR for two elements', () => {
      const result = computeMedianAndIQR([2, 4]);
      expect(result.median).toBe(3);
      expect(result.iqr).toBe(2);
    });

    it('should compute median, IQR, q1, and q3 for odd-length array', () => {
      // [1, 2, 3, 4, 5] - median=3, Q1=1.5, Q3=4.5, IQR=3
      const result = computeMedianAndIQR([3, 1, 5, 2, 4]);
      expect(result.median).toBe(3);
      expect(result.iqr).toBe(3);
      expect(result.q1).toBe(1.5);
      expect(result.q3).toBe(4.5);
    });

    it('should compute median, IQR, q1, and q3 for even-length array', () => {
      // [1, 2, 3, 4] - median=2.5, Q1=1.5, Q3=3.5, IQR=2
      const result = computeMedianAndIQR([3, 1, 4, 2]);
      expect(result.median).toBe(2.5);
      expect(result.iqr).toBe(2);
      expect(result.q1).toBe(1.5);
      expect(result.q3).toBe(3.5);
    });

    it('should handle uniform distribution (IQR = 0) with correct q1 and q3', () => {
      const result = computeMedianAndIQR([5, 5, 5, 5]);
      expect(result.median).toBe(5);
      expect(result.iqr).toBe(0);
      expect(result.q1).toBe(5);
      expect(result.q3).toBe(5);
    });

    it('should handle negative values', () => {
      const result = computeMedianAndIQR([-4, -2, 0, 2, 4]);
      expect(result.median).toBe(0);
      expect(result.iqr).toBe(6);
    });

    it('should not mutate the input array', () => {
      const input = [3, 1, 4, 1, 5];
      const original = [...input];
      computeMedianAndIQR(input);
      expect(input).toEqual(original);
    });

    it('should handle large arrays', () => {
      const input = Array.from({ length: 100 }, (_, i) => i + 1);
      const result = computeMedianAndIQR(input);
      expect(result.median).toBe(50.5);
      expect(result.iqr).toBe(50);
    });

    it('should return non-negative IQR', () => {
      // Edge case where Q1 might be greater than Q3 in unusual distributions
      const result = computeMedianAndIQR([1, 2, 3]);
      expect(result.iqr).toBeGreaterThanOrEqual(0);
    });
  });

  describe('computePercentile', () => {
    it('should return 0 for empty array', () => {
      expect(computePercentile([], 50)).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(computePercentile(null, 50)).toBe(0);
      expect(computePercentile(undefined, 50)).toBe(0);
    });

    it('should return the single element for any percentile', () => {
      expect(computePercentile([5], 0)).toBe(5);
      expect(computePercentile([5], 50)).toBe(5);
      expect(computePercentile([5], 100)).toBe(5);
    });

    it('should return first element for 0th percentile', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 0)).toBe(1);
    });

    it('should return last element for 100th percentile', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 100)).toBe(5);
    });

    it('should compute 50th percentile (median-like)', () => {
      expect(computePercentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('should compute 25th percentile', () => {
      expect(computePercentile([1, 2, 3, 4, 5, 6, 7, 8], 25)).toBe(3);
    });

    it('should compute 75th percentile', () => {
      expect(computePercentile([1, 2, 3, 4, 5, 6, 7, 8], 75)).toBe(7);
    });

    it('should clamp percentile below 0', () => {
      expect(computePercentile([1, 2, 3], -10)).toBe(1);
    });

    it('should clamp percentile above 100', () => {
      expect(computePercentile([1, 2, 3], 150)).toBe(3);
    });

    it('should handle decimal percentiles', () => {
      const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(computePercentile(sorted, 33.3)).toBe(4);
      expect(computePercentile(sorted, 66.6)).toBe(7);
    });

    it('should handle arrays with duplicate values', () => {
      expect(computePercentile([1, 1, 1, 1, 5], 50)).toBe(1);
    });

    it('should handle negative values', () => {
      expect(computePercentile([-5, -3, -1, 1, 3], 50)).toBe(-1);
    });

    it('should handle decimal values in array', () => {
      expect(computePercentile([0.1, 0.2, 0.3, 0.4, 0.5], 50)).toBeCloseTo(0.3);
    });
  });
});
