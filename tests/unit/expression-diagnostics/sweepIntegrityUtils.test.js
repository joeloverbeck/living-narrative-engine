/**
 * @file Unit tests for sweep integrity utilities.
 */

import { describe, it, expect } from '@jest/globals';
import {
  evaluateSweepMonotonicity,
  findBaselineGridPoint,
} from '../../../src/expressionDiagnostics/utils/sweepIntegrityUtils.js';

describe('sweepIntegrityUtils', () => {
  it('treats >= sweeps as non-increasing and recognizes monotonic data', () => {
    const grid = [
      { threshold: 0.1, passRate: 0.9 },
      { threshold: 0.2, passRate: 0.8 },
      { threshold: 0.3, passRate: 0.7 },
    ];

    const result = evaluateSweepMonotonicity({
      grid,
      rateKey: 'passRate',
      operator: '>=',
    });

    expect(result.isMonotonic).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('flags non-monotonic sweeps for >= operators', () => {
    const grid = [
      { threshold: 0.1, passRate: 0.6 },
      { threshold: 0.2, passRate: 0.7 },
      { threshold: 0.3, passRate: 0.5 },
    ];

    const result = evaluateSweepMonotonicity({
      grid,
      rateKey: 'passRate',
      operator: '>=',
    });

    expect(result.isMonotonic).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it('treats <= sweeps as non-decreasing', () => {
    const grid = [
      { threshold: 0.1, passRate: 0.2 },
      { threshold: 0.2, passRate: 0.4 },
      { threshold: 0.3, passRate: 0.6 },
    ];

    const result = evaluateSweepMonotonicity({
      grid,
      rateKey: 'passRate',
      operator: '<=',
    });

    expect(result.isMonotonic).toBe(true);
  });

  it('finds the baseline grid point by threshold within epsilon', () => {
    const grid = [
      { threshold: 0.1, passRate: 0.9 },
      { threshold: 0.2, passRate: 0.8 },
      { threshold: 0.3, passRate: 0.7 },
    ];

    const baseline = findBaselineGridPoint(grid, 0.2004);

    expect(baseline).not.toBeNull();
    expect(baseline.threshold).toBe(0.2);
  });
});
