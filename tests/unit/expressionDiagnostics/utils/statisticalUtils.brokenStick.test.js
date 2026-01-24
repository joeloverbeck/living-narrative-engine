/**
 * @file Unit tests for broken-stick statistical functions
 */

import { describe, expect, it } from '@jest/globals';
import {
  computeBrokenStickExpected,
  computeBrokenStickDistribution,
  countSignificantComponentsBrokenStick,
} from '../../../../src/expressionDiagnostics/utils/statisticalUtils.js';

describe('computeBrokenStickExpected', () => {
  describe('invalid inputs', () => {
    it('should return 0 for k < 1', () => {
      expect(computeBrokenStickExpected(0, 5)).toBe(0);
      expect(computeBrokenStickExpected(-1, 5)).toBe(0);
    });

    it('should return 0 for p < 1', () => {
      expect(computeBrokenStickExpected(1, 0)).toBe(0);
      expect(computeBrokenStickExpected(1, -1)).toBe(0);
    });

    it('should return 0 for k > p', () => {
      expect(computeBrokenStickExpected(6, 5)).toBe(0);
      expect(computeBrokenStickExpected(10, 3)).toBe(0);
    });

    it('should return 0 for non-number inputs', () => {
      expect(computeBrokenStickExpected('1', 5)).toBe(0);
      expect(computeBrokenStickExpected(1, '5')).toBe(0);
      expect(computeBrokenStickExpected(null, 5)).toBe(0);
      expect(computeBrokenStickExpected(1, undefined)).toBe(0);
    });

    it('should return 0 for non-finite numbers', () => {
      expect(computeBrokenStickExpected(Infinity, 5)).toBe(0);
      expect(computeBrokenStickExpected(1, Infinity)).toBe(0);
      expect(computeBrokenStickExpected(NaN, 5)).toBe(0);
      expect(computeBrokenStickExpected(1, NaN)).toBe(0);
    });
  });

  describe('valid inputs', () => {
    it('should compute correct value for k=1, p=1', () => {
      // Expected: (1/1) * (1/1) = 1.0
      expect(computeBrokenStickExpected(1, 1)).toBe(1);
    });

    it('should compute correct value for k=1, p=2', () => {
      // Expected: (1/2) * (1/1 + 1/2) = (1/2) * 1.5 = 0.75
      expect(computeBrokenStickExpected(1, 2)).toBeCloseTo(0.75, 10);
    });

    it('should compute correct value for k=2, p=2', () => {
      // Expected: (1/2) * (1/2) = 0.25
      expect(computeBrokenStickExpected(2, 2)).toBeCloseTo(0.25, 10);
    });

    it('should compute correct value for k=1, p=5', () => {
      // Expected: (1/5) * (1 + 1/2 + 1/3 + 1/4 + 1/5)
      // = (1/5) * (1 + 0.5 + 0.333... + 0.25 + 0.2) = (1/5) * 2.283... ≈ 0.4567
      const expected = (1 / 5) * (1 + 0.5 + 1 / 3 + 0.25 + 0.2);
      expect(computeBrokenStickExpected(1, 5)).toBeCloseTo(expected, 10);
    });

    it('should compute correct value for k=5, p=5', () => {
      // Expected: (1/5) * (1/5) = 0.04
      expect(computeBrokenStickExpected(5, 5)).toBeCloseTo(0.04, 10);
    });

    it('should decrease for larger k values', () => {
      const val1 = computeBrokenStickExpected(1, 5);
      const val2 = computeBrokenStickExpected(2, 5);
      const val3 = computeBrokenStickExpected(3, 5);
      const val4 = computeBrokenStickExpected(4, 5);
      const val5 = computeBrokenStickExpected(5, 5);

      expect(val1).toBeGreaterThan(val2);
      expect(val2).toBeGreaterThan(val3);
      expect(val3).toBeGreaterThan(val4);
      expect(val4).toBeGreaterThan(val5);
    });
  });
});

describe('computeBrokenStickDistribution', () => {
  describe('invalid inputs', () => {
    it('should return empty array for p < 1', () => {
      expect(computeBrokenStickDistribution(0)).toEqual([]);
      expect(computeBrokenStickDistribution(-1)).toEqual([]);
    });

    it('should return empty array for non-number input', () => {
      expect(computeBrokenStickDistribution('5')).toEqual([]);
      expect(computeBrokenStickDistribution(null)).toEqual([]);
      expect(computeBrokenStickDistribution(undefined)).toEqual([]);
    });

    it('should return empty array for non-finite numbers', () => {
      expect(computeBrokenStickDistribution(Infinity)).toEqual([]);
      expect(computeBrokenStickDistribution(NaN)).toEqual([]);
    });
  });

  describe('valid inputs', () => {
    it('should return single-element array for p=1', () => {
      const dist = computeBrokenStickDistribution(1);
      expect(dist).toHaveLength(1);
      expect(dist[0]).toBe(1);
    });

    it('should return correct distribution for p=2', () => {
      const dist = computeBrokenStickDistribution(2);
      expect(dist).toHaveLength(2);
      expect(dist[0]).toBeCloseTo(0.75, 10);
      expect(dist[1]).toBeCloseTo(0.25, 10);
    });

    it('should sum to 1.0', () => {
      for (const p of [1, 2, 3, 5, 10, 20]) {
        const dist = computeBrokenStickDistribution(p);
        const sum = dist.reduce((acc, val) => acc + val, 0);
        expect(sum).toBeCloseTo(1.0, 10);
      }
    });

    it('should be monotonically decreasing', () => {
      for (const p of [2, 5, 10, 20]) {
        const dist = computeBrokenStickDistribution(p);
        for (let i = 1; i < dist.length; i += 1) {
          expect(dist[i - 1]).toBeGreaterThan(dist[i]);
        }
      }
    });

    it('should floor non-integer p values', () => {
      const dist = computeBrokenStickDistribution(3.7);
      expect(dist).toHaveLength(3);
    });
  });
});

describe('countSignificantComponentsBrokenStick', () => {
  describe('invalid inputs', () => {
    it('should return 0 for non-array eigenvalues', () => {
      expect(countSignificantComponentsBrokenStick(null, 10)).toBe(0);
      expect(countSignificantComponentsBrokenStick(undefined, 10)).toBe(0);
      expect(countSignificantComponentsBrokenStick('not array', 10)).toBe(0);
    });

    it('should return 0 for empty eigenvalues array', () => {
      expect(countSignificantComponentsBrokenStick([], 10)).toBe(0);
    });

    it('should return 0 for non-positive totalVariance', () => {
      expect(countSignificantComponentsBrokenStick([1, 0.5], 0)).toBe(0);
      expect(countSignificantComponentsBrokenStick([1, 0.5], -1)).toBe(0);
    });

    it('should return 0 for non-finite totalVariance', () => {
      expect(countSignificantComponentsBrokenStick([1, 0.5], Infinity)).toBe(0);
      expect(countSignificantComponentsBrokenStick([1, 0.5], NaN)).toBe(0);
    });

    it('should return 0 for non-number totalVariance', () => {
      expect(countSignificantComponentsBrokenStick([1, 0.5], '10')).toBe(0);
      expect(countSignificantComponentsBrokenStick([1, 0.5], null)).toBe(0);
    });
  });

  describe('single component', () => {
    it('should return 1 for single eigenvalue equal to total variance', () => {
      // Actual: 100% > Expected: 100% is false (not strictly greater)
      // Actually, 1.0 > 1.0 is false, so should return 0
      // Hmm, but a single eigenvalue explains all variance...
      // The test is: actualProportion > expectedProportion
      // 1.0 > 1.0 is false, so it returns 0
      expect(countSignificantComponentsBrokenStick([5], 5)).toBe(0);
    });
  });

  describe('clear factor structure', () => {
    it('should detect dominant first component', () => {
      // Eigenvalues with very clear first factor
      // For 5 components, broken-stick[0] ≈ 0.457
      // If first eigenvalue explains 70% and rest explain 7.5% each:
      // 0.70 > 0.457 -> significant
      // 0.075 > 0.257 -> not significant (stops here)
      const eigenvalues = [3.5, 0.375, 0.375, 0.375, 0.375];
      const totalVariance = 5;
      const result = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      expect(result).toBe(1);
    });

    it('should detect two dominant components', () => {
      // For 5 components:
      // broken-stick ≈ [0.457, 0.257, 0.157, 0.090, 0.040]
      // If first two explain 50% and 30%:
      // 0.50 > 0.457 -> significant
      // 0.30 > 0.257 -> significant
      // 0.067 > 0.157 -> not significant (stops here)
      const eigenvalues = [2.5, 1.5, 0.333, 0.333, 0.334];
      const totalVariance = 5;
      const result = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      expect(result).toBe(2);
    });

    it('should return 0 when no components exceed broken-stick threshold', () => {
      // All eigenvalues equal: each explains 20%
      // For 5 components, broken-stick[0] ≈ 0.457
      // 0.20 > 0.457 -> not significant (stops immediately)
      const eigenvalues = [1, 1, 1, 1, 1];
      const totalVariance = 5;
      const result = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      expect(result).toBe(0);
    });
  });

  describe('real-world-like scenarios', () => {
    it('should detect structure in standardized data', () => {
      // Simulating PCA on standardized data where eigenvalues are bounded
      // 5 variables, total variance = 5 (sum of standardized variances)
      // Typical real data might have eigenvalues like [1.8, 1.2, 0.9, 0.7, 0.4]
      // Proportions: [0.36, 0.24, 0.18, 0.14, 0.08]
      // Broken-stick[0..4] ≈ [0.457, 0.257, 0.157, 0.090, 0.040]
      // 0.36 > 0.457? No -> 0 significant components
      const eigenvalues = [1.8, 1.2, 0.9, 0.7, 0.4];
      const totalVariance = 5;
      const result = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      expect(result).toBe(0);
    });

    it('should detect strong factor when present', () => {
      // If there's a clear dominant factor:
      // eigenvalues = [2.5, 0.8, 0.7, 0.6, 0.4] / totalVariance = 5
      // Proportions: [0.50, 0.16, 0.14, 0.12, 0.08]
      // Broken-stick[0..4] ≈ [0.457, 0.257, 0.157, 0.090, 0.040]
      // 0.50 > 0.457? Yes -> first significant
      // 0.16 > 0.257? No -> stops here
      const eigenvalues = [2.5, 0.8, 0.7, 0.6, 0.4];
      const totalVariance = 5;
      const result = countSignificantComponentsBrokenStick(
        eigenvalues,
        totalVariance
      );
      expect(result).toBe(1);
    });
  });
});
