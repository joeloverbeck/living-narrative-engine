/**
 * @file Unit tests for StatisticalComputationService sanity box methods
 *
 * Tests calculateNaiveProbability and calculatePoissonProbability methods:
 * - Mathematical correctness for Poisson distribution
 * - Naive probability product calculation
 * - Edge cases (empty arrays, zero rates, missing data)
 * - In-regime vs global pass rate handling
 * @see replicated-riding-lerdorf.md (Expected Trigger Rate Sanity Box plan)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import StatisticalComputationService from '../../../../src/expressionDiagnostics/services/StatisticalComputationService.js';

describe('StatisticalComputationService - Sanity Box Calculations', () => {
  let service;

  beforeEach(() => {
    service = new StatisticalComputationService();
  });

  // ===========================================================================
  // calculateNaiveProbability
  // ===========================================================================

  describe('calculateNaiveProbability', () => {
    it('should return 1.0 for empty clause array', () => {
      const result = service.calculateNaiveProbability([]);

      expect(result.naiveProbability).toBe(1.0);
      expect(result.factors).toEqual([]);
      expect(result.warnings).toContain('No clause data available');
    });

    it('should return 1.0 for null input', () => {
      const result = service.calculateNaiveProbability(null);

      expect(result.naiveProbability).toBe(1.0);
      expect(result.factors).toEqual([]);
      expect(result.warnings).toContain('No clause data available');
    });

    it('should return 1.0 for undefined input', () => {
      const result = service.calculateNaiveProbability(undefined);

      expect(result.naiveProbability).toBe(1.0);
      expect(result.factors).toEqual([]);
      expect(result.warnings).toContain('No clause data available');
    });

    it('should return single clause pass rate for one clause', () => {
      const clauses = [{ clauseId: 'clause1', inRegimePassRate: 0.8 }];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBe(0.8);
      expect(result.factors).toHaveLength(1);
      expect(result.factors[0]).toEqual({ clauseId: 'clause1', rate: 0.8 });
      expect(result.warnings).toHaveLength(0);
    });

    it('should return product for multiple clauses', () => {
      const clauses = [
        { clauseId: 'clause1', inRegimePassRate: 0.5 },
        { clauseId: 'clause2', inRegimePassRate: 0.5 },
        { clauseId: 'clause3', inRegimePassRate: 0.5 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBeCloseTo(0.125); // 0.5 * 0.5 * 0.5
      expect(result.factors).toHaveLength(3);
    });

    it('should prefer inRegimePassRate when useInRegime is true (default)', () => {
      const clauses = [
        { clauseId: 'clause1', inRegimePassRate: 0.8, passRate: 0.5 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBe(0.8);
      expect(result.factors[0].rate).toBe(0.8);
    });

    it('should use passRate when inRegimePassRate is null', () => {
      const clauses = [
        { clauseId: 'clause1', inRegimePassRate: null, passRate: 0.6 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBe(0.6);
      expect(result.factors[0].rate).toBe(0.6);
    });

    it('should fall back to global passRate when useInRegime is false', () => {
      const clauses = [
        { clauseId: 'clause1', inRegimePassRate: 0.8, passRate: 0.5 },
      ];
      const result = service.calculateNaiveProbability(clauses, {
        useInRegime: false,
      });

      expect(result.naiveProbability).toBe(0.5);
      expect(result.factors[0].rate).toBe(0.5);
    });

    it('should compute from failureRate when passRate is missing', () => {
      const clauses = [{ clauseId: 'clause1', failureRate: 0.3 }];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBeCloseTo(0.7); // 1 - 0.3
      expect(result.factors[0].rate).toBeCloseTo(0.7);
    });

    it('should return 0 when any clause has 0% pass rate', () => {
      const clauses = [
        { clauseId: 'clause1', inRegimePassRate: 0.8 },
        { clauseId: 'clause2', inRegimePassRate: 0 },
        { clauseId: 'clause3', inRegimePassRate: 0.5 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBe(0);
    });

    it('should include warning for zero-rate clauses', () => {
      const clauses = [{ clauseId: 'blocking_clause', inRegimePassRate: 0 }];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.warnings).toContain(
        'Clause blocking_clause has 0% pass rate'
      );
    });

    it('should handle clauses with missing clauseId', () => {
      const clauses = [{ inRegimePassRate: 0.5 }];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.factors[0].clauseId).toBe('unknown');
    });

    it('should handle mixed clause data formats', () => {
      const clauses = [
        { clauseId: 'a', inRegimePassRate: 0.9 },
        { clauseId: 'b', passRate: 0.8 },
        { clauseId: 'c', failureRate: 0.3 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBeCloseTo(0.9 * 0.8 * 0.7);
      expect(result.factors).toHaveLength(3);
    });

    it('should handle very small probabilities without underflow', () => {
      const clauses = Array.from({ length: 50 }, (_, i) => ({
        clauseId: `clause${i}`,
        inRegimePassRate: 0.9,
      }));
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBeGreaterThan(0);
      expect(result.naiveProbability).toBeLessThan(1);
      expect(result.naiveProbability).toBeCloseTo(Math.pow(0.9, 50), 10);
    });

    it('should handle all clauses with 100% pass rate', () => {
      const clauses = [
        { clauseId: 'a', inRegimePassRate: 1.0 },
        { clauseId: 'b', inRegimePassRate: 1.0 },
      ];
      const result = service.calculateNaiveProbability(clauses);

      expect(result.naiveProbability).toBe(1.0);
    });
  });

  // ===========================================================================
  // calculatePoissonProbability
  // ===========================================================================

  describe('calculatePoissonProbability', () => {
    it('should return 1.0 for k=0, lambda=0', () => {
      expect(service.calculatePoissonProbability(0, 0)).toBe(1.0);
    });

    it('should return 0.0 for k>0, lambda=0', () => {
      expect(service.calculatePoissonProbability(1, 0)).toBe(0.0);
      expect(service.calculatePoissonProbability(5, 0)).toBe(0.0);
    });

    it('should return e^(-1) for k=0, lambda=1', () => {
      const result = service.calculatePoissonProbability(0, 1);
      expect(result).toBeCloseTo(Math.exp(-1), 10);
    });

    it('should return e^(-10) for k=0, lambda=10', () => {
      const result = service.calculatePoissonProbability(0, 10);
      expect(result).toBeCloseTo(Math.exp(-10), 10);
    });

    it('should return e^(-0.1) for k=0, lambda=0.1', () => {
      const result = service.calculatePoissonProbability(0, 0.1);
      expect(result).toBeCloseTo(Math.exp(-0.1), 10);
    });

    it('should handle k=1, lambda=1 correctly', () => {
      // P(1|1) = 1 * e^(-1) / 1! = e^(-1)
      const result = service.calculatePoissonProbability(1, 1);
      expect(result).toBeCloseTo(Math.exp(-1), 10);
    });

    it('should handle k=2, lambda=1 correctly', () => {
      // P(2|1) = 1^2 * e^(-1) / 2! = e^(-1) / 2
      const result = service.calculatePoissonProbability(2, 1);
      expect(result).toBeCloseTo(Math.exp(-1) / 2, 10);
    });

    it('should handle k=5, lambda=5 correctly', () => {
      // P(5|5) = 5^5 * e^(-5) / 5! = 3125 * e^(-5) / 120
      const expected = (Math.pow(5, 5) * Math.exp(-5)) / 120;
      const result = service.calculatePoissonProbability(5, 5);
      expect(result).toBeCloseTo(expected, 10);
    });

    it('should handle large lambda without overflow', () => {
      // For large lambda, P(0|lambda) = e^(-lambda) should be very small but not 0
      const result = service.calculatePoissonProbability(0, 100);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1e-40);
    });

    it('should handle k values larger than lambda', () => {
      // P(10|2) should be very small but computable
      const result = service.calculatePoissonProbability(10, 2);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(0.01);
    });

    it('should return 1.0 for k=0, negative lambda (treated as 0)', () => {
      expect(service.calculatePoissonProbability(0, -1)).toBe(1.0);
    });

    it('should return 0.0 for k>0, negative lambda (treated as 0)', () => {
      expect(service.calculatePoissonProbability(1, -1)).toBe(0.0);
    });

    it('should handle fractional lambda values', () => {
      // P(0|0.5) = e^(-0.5) ≈ 0.6065
      const result = service.calculatePoissonProbability(0, 0.5);
      expect(result).toBeCloseTo(Math.exp(-0.5), 10);
    });

    it('should return probabilities that sum to approximately 1', () => {
      const lambda = 5;
      let sum = 0;
      for (let k = 0; k <= 30; k++) {
        sum += service.calculatePoissonProbability(k, lambda);
      }
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });
});
