/**
 * @file Unit tests for StatisticalComputationService
 *
 * Tests all statistical computation methods with focus on:
 * - Mathematical correctness
 * - Edge cases (empty arrays, division by zero, single elements)
 * - Boundary conditions
 * - Gate parsing and normalization
 *
 * @see tickets/MONCARREPGENREFANA-003-extract-statistical-computation-service.md
 */

import { describe, it, expect } from '@jest/globals';
import StatisticalComputationService from '../../../../src/expressionDiagnostics/services/StatisticalComputationService.js';

describe('StatisticalComputationService', () => {
  let service;

  beforeEach(() => {
    service = new StatisticalComputationService();
  });

  // ===========================================================================
  // computeDistributionStats
  // ===========================================================================

  describe('computeDistributionStats', () => {
    it('should return null for empty array', () => {
      expect(service.computeDistributionStats([])).toBeNull();
    });

    it('should return null for null input', () => {
      expect(service.computeDistributionStats(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(service.computeDistributionStats(undefined)).toBeNull();
    });

    it('should compute stats for single element', () => {
      const result = service.computeDistributionStats([5]);

      expect(result).toEqual({
        min: 5,
        median: 5,
        p90: 5,
        p95: 5,
        max: 5,
        mean: 5,
        count: 1,
      });
    });

    it('should compute stats for two elements', () => {
      const result = service.computeDistributionStats([2, 8]);

      expect(result.min).toBe(2);
      expect(result.max).toBe(8);
      expect(result.mean).toBe(5);
      expect(result.count).toBe(2);
    });

    it('should compute correct percentiles for 10 elements', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = service.computeDistributionStats(values);

      expect(result.min).toBe(1);
      expect(result.max).toBe(10);
      expect(result.median).toBe(6); // index 5 = 6th element
      expect(result.p90).toBe(10); // index 9 = 10th element
      expect(result.p95).toBe(10); // index 9 (clamped)
      expect(result.mean).toBe(5.5);
      expect(result.count).toBe(10);
    });

    it('should handle negative values', () => {
      const result = service.computeDistributionStats([-10, -5, 0, 5, 10]);

      expect(result.min).toBe(-10);
      expect(result.max).toBe(10);
      expect(result.mean).toBe(0);
    });

    it('should handle floating point values', () => {
      const result = service.computeDistributionStats([0.1, 0.2, 0.3, 0.4, 0.5]);

      expect(result.min).toBeCloseTo(0.1);
      expect(result.max).toBeCloseTo(0.5);
      expect(result.mean).toBeCloseTo(0.3);
    });

    it('should not modify original array', () => {
      const original = [5, 1, 3, 2, 4];
      const copy = [...original];
      service.computeDistributionStats(original);

      expect(original).toEqual(copy);
    });

    it('should handle large values without overflow', () => {
      const result = service.computeDistributionStats([1e15, 2e15, 3e15]);

      expect(result.min).toBe(1e15);
      expect(result.max).toBe(3e15);
      expect(result.mean).toBe(2e15);
    });
  });

  // ===========================================================================
  // calculateWilsonInterval
  // ===========================================================================

  describe('calculateWilsonInterval', () => {
    it('should return [0, 1] for zero total', () => {
      const result = service.calculateWilsonInterval(0, 0);

      expect(result).toEqual({ low: 0, high: 1 });
    });

    it('should handle 0% success rate', () => {
      const result = service.calculateWilsonInterval(0, 100);

      expect(result.low).toBe(0);
      expect(result.high).toBeGreaterThan(0);
      expect(result.high).toBeLessThan(0.05); // Should be small
    });

    it('should handle 100% success rate', () => {
      const result = service.calculateWilsonInterval(100, 100);

      expect(result.high).toBeCloseTo(1, 10); // Allow floating point precision
      expect(result.low).toBeGreaterThan(0.95); // Should be high
      expect(result.low).toBeLessThan(1);
    });

    it('should compute 50% success rate correctly', () => {
      const result = service.calculateWilsonInterval(50, 100);

      expect(result.low).toBeGreaterThan(0.3);
      expect(result.low).toBeLessThan(0.5);
      expect(result.high).toBeGreaterThan(0.5);
      expect(result.high).toBeLessThan(0.7);
    });

    it('should narrow interval with more samples', () => {
      const small = service.calculateWilsonInterval(5, 10);
      const large = service.calculateWilsonInterval(500, 1000);

      const smallWidth = small.high - small.low;
      const largeWidth = large.high - large.low;

      expect(largeWidth).toBeLessThan(smallWidth);
    });

    it('should accept custom z-score', () => {
      const z95 = service.calculateWilsonInterval(50, 100, 1.96);
      const z99 = service.calculateWilsonInterval(50, 100, 2.576);

      const width95 = z95.high - z95.low;
      const width99 = z99.high - z99.low;

      expect(width99).toBeGreaterThan(width95);
    });

    it('should bound results between 0 and 1', () => {
      const result = service.calculateWilsonInterval(1, 1000);

      expect(result.low).toBeGreaterThanOrEqual(0);
      expect(result.high).toBeLessThanOrEqual(1);
    });
  });

  // ===========================================================================
  // computeAxisContributions
  // ===========================================================================

  describe('computeAxisContributions', () => {
    it('should return empty object for empty weights', () => {
      const result = service.computeAxisContributions([], {});

      expect(result).toEqual({});
    });

    it('should compute contributions for mood axis', () => {
      const contexts = [
        { moodAxes: { valence: 50 } },
        { moodAxes: { valence: 100 } },
      ];
      const weights = { valence: 1.0 };

      const result = service.computeAxisContributions(contexts, weights);

      expect(result.valence).toBeDefined();
      expect(result.valence.weight).toBe(1.0);
      expect(result.valence.meanAxisValue).toBe(75); // (50 + 100) / 2
      // Normalized: 50/100 = 0.5, 100/100 = 1.0, mean contribution = 0.75 * 1.0 = 0.75
      expect(result.valence.meanContribution).toBeCloseTo(0.75);
    });

    it('should compute contributions for sexual axis', () => {
      const contexts = [
        { sexualStates: { sex_excitation: 0.5 } },
        { sexualStates: { sex_excitation: 1.0 } },
      ];
      const weights = { sex_excitation: 0.8 };

      const result = service.computeAxisContributions(contexts, weights);

      expect(result.sex_excitation).toBeDefined();
      expect(result.sex_excitation.weight).toBe(0.8);
      expect(result.sex_excitation.meanAxisValue).toBe(0.75);
      // Sexual axes are not renormalized, so contribution = 0.75 * 0.8 = 0.6
      expect(result.sex_excitation.meanContribution).toBeCloseTo(0.6);
    });

    it('should handle missing axis values', () => {
      const contexts = [{ moodAxes: {} }, { moodAxes: { valence: 100 } }];
      const weights = { valence: 1.0 };

      const result = service.computeAxisContributions(contexts, weights);

      // First context has 0 (default), second has 100
      expect(result.valence.meanAxisValue).toBe(50);
    });

    it('should handle multiple axes', () => {
      const contexts = [
        { moodAxes: { valence: 100, arousal: 50 } },
        { moodAxes: { valence: 50, arousal: 100 } },
      ];
      const weights = { valence: 1.0, arousal: 0.5 };

      const result = service.computeAxisContributions(contexts, weights);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.valence).toBeDefined();
      expect(result.arousal).toBeDefined();
    });
  });

  // ===========================================================================
  // computeGateFailureRates
  // ===========================================================================

  describe('computeGateFailureRates', () => {
    it('should return empty map for empty gates', () => {
      const result = service.computeGateFailureRates([], []);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('should return empty map for null gates', () => {
      const result = service.computeGateFailureRates(null, [{}]);

      expect(result.size).toBe(0);
    });

    it('should return empty map for empty contexts', () => {
      const result = service.computeGateFailureRates(['valence >= 0.5'], []);

      expect(result.size).toBe(0);
    });

    it('should compute 0% failure rate when all pass', () => {
      const gates = ['valence >= 0.3'];
      const contexts = [
        { moodAxes: { valence: 50 } }, // 0.5 normalized >= 0.3
        { moodAxes: { valence: 80 } }, // 0.8 normalized >= 0.3
      ];

      const result = service.computeGateFailureRates(gates, contexts);

      expect(result.get('valence >= 0.3')).toBe(0);
    });

    it('should compute 100% failure rate when all fail', () => {
      const gates = ['valence >= 0.9'];
      const contexts = [
        { moodAxes: { valence: 50 } }, // 0.5 normalized < 0.9
        { moodAxes: { valence: 80 } }, // 0.8 normalized < 0.9
      ];

      const result = service.computeGateFailureRates(gates, contexts);

      expect(result.get('valence >= 0.9')).toBe(1);
    });

    it('should compute partial failure rate', () => {
      const gates = ['valence >= 0.6'];
      const contexts = [
        { moodAxes: { valence: 50 } }, // 0.5 < 0.6 -> FAIL
        { moodAxes: { valence: 80 } }, // 0.8 >= 0.6 -> PASS
      ];

      const result = service.computeGateFailureRates(gates, contexts);

      expect(result.get('valence >= 0.6')).toBe(0.5);
    });

    it('should skip invalid gate strings', () => {
      const gates = ['valence >= 0.3', 'invalid gate syntax!!!'];
      const contexts = [{ moodAxes: { valence: 50 } }];

      const result = service.computeGateFailureRates(gates, contexts);

      // Should only have the valid gate
      expect(result.size).toBe(1);
      expect(result.has('valence >= 0.3')).toBe(true);
    });
  });

  // ===========================================================================
  // computeGatePassRate
  // ===========================================================================

  describe('computeGatePassRate', () => {
    it('should return null for empty contexts', () => {
      expect(service.computeGatePassRate(['valence >= 0.5'], [])).toBeNull();
    });

    it('should return null for null contexts', () => {
      expect(service.computeGatePassRate(['valence >= 0.5'], null)).toBeNull();
    });

    it('should return 1 for empty gates', () => {
      const contexts = [{ moodAxes: { valence: 50 } }];

      expect(service.computeGatePassRate([], contexts)).toBe(1);
    });

    it('should return 1 for null gates', () => {
      const contexts = [{ moodAxes: { valence: 50 } }];

      expect(service.computeGatePassRate(null, contexts)).toBe(1);
    });

    it('should return 1 when all contexts pass all gates', () => {
      const gates = ['valence >= 0.3'];
      const contexts = [
        { moodAxes: { valence: 50 } },
        { moodAxes: { valence: 80 } },
      ];

      expect(service.computeGatePassRate(gates, contexts)).toBe(1);
    });

    it('should return 0 when no contexts pass', () => {
      const gates = ['valence >= 0.9'];
      const contexts = [
        { moodAxes: { valence: 50 } },
        { moodAxes: { valence: 80 } },
      ];

      expect(service.computeGatePassRate(gates, contexts)).toBe(0);
    });

    it('should require ALL gates to pass', () => {
      const gates = ['valence >= 0.3', 'valence >= 0.9'];
      const contexts = [
        { moodAxes: { valence: 50 } }, // passes first, fails second
        { moodAxes: { valence: 95 } }, // passes both
      ];

      expect(service.computeGatePassRate(gates, contexts)).toBe(0.5);
    });
  });

  // ===========================================================================
  // computePrototypeRegimeStats
  // ===========================================================================

  describe('computePrototypeRegimeStats', () => {
    it('should return null for empty contexts', () => {
      expect(
        service.computePrototypeRegimeStats([], 'emotions.joy', [], null)
      ).toBeNull();
    });

    it('should return null for null contexts', () => {
      expect(
        service.computePrototypeRegimeStats(null, 'emotions.joy', [], null)
      ).toBeNull();
    });

    it('should extract values from varPath when no weights', () => {
      const contexts = [
        { emotions: { joy: 0.5 } },
        { emotions: { joy: 0.8 } },
        { emotions: { joy: 0.3 } },
      ];

      const result = service.computePrototypeRegimeStats(
        contexts,
        'emotions.joy',
        [],
        null
      );

      expect(result).not.toBeNull();
      expect(result.finalDistribution).not.toBeNull();
      expect(result.finalDistribution.count).toBe(3);
      expect(result.finalDistribution.min).toBe(0.3);
      expect(result.finalDistribution.max).toBe(0.8);
    });

    it('should use gate trace signals when callbacks provided', () => {
      const contexts = [{ gateTrace: { emotions: { joy: { raw: 0.6, final: 0.5, gatePass: true } } } }];

      const callbacks = {
        resolveGateTraceTarget: (varPath) => ({
          type: 'emotion',
          prototypeId: varPath.slice('emotions.'.length),
        }),
        getGateTraceSignals: (ctx, type, id) => ctx?.gateTrace?.emotions?.[id],
      };

      const result = service.computePrototypeRegimeStats(
        contexts,
        'emotions.joy',
        [],
        null,
        callbacks
      );

      expect(result.rawDistribution).not.toBeNull();
      expect(result.rawDistribution.mean).toBe(0.6);
      expect(result.finalDistribution.mean).toBe(0.5);
      expect(result.gatePassRate).toBe(1);
    });

    it('should compute intensity signals when weights provided', () => {
      const contexts = [{ moodAxes: { valence: 50 } }];
      const weights = { valence: 1.0 };
      const gates = [];

      const result = service.computePrototypeRegimeStats(
        contexts,
        'emotions.joy',
        gates,
        weights
      );

      expect(result.rawDistribution).not.toBeNull();
      expect(result.finalDistribution).not.toBeNull();
    });
  });

  // ===========================================================================
  // computeConditionalPassRates
  // ===========================================================================

  describe('computeConditionalPassRates', () => {
    it('should return empty array for empty conditions', () => {
      const result = service.computeConditionalPassRates([{}], []);

      expect(result).toEqual([]);
    });

    it('should compute pass rate for single condition', () => {
      const contexts = [
        { emotions: { joy: 0.6 } },
        { emotions: { joy: 0.4 } },
      ];
      const conditions = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          threshold: 0.5,
          display: 'joy >= 0.5',
        },
      ];

      const result = service.computeConditionalPassRates(contexts, conditions);

      expect(result).toHaveLength(1);
      expect(result[0].condition).toBe('joy >= 0.5');
      expect(result[0].conditionalPassRate).toBe(0.5);
      expect(result[0].passes).toBe(1);
      expect(result[0].total).toBe(2);
      expect(result[0].ci).toBeDefined();
    });

    it('should sort results by pass rate ascending', () => {
      const contexts = [
        { emotions: { joy: 0.9, fear: 0.3 } },
        { emotions: { joy: 0.8, fear: 0.2 } },
      ];
      const conditions = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          threshold: 0.5,
          display: 'easy condition',
        },
        {
          varPath: 'emotions.fear',
          operator: '>=',
          threshold: 0.5,
          display: 'hard condition',
        },
      ];

      const result = service.computeConditionalPassRates(contexts, conditions);

      // Hard condition (0% pass) should come first
      expect(result[0].condition).toBe('hard condition');
      expect(result[0].conditionalPassRate).toBe(0);
      // Easy condition (100% pass) should come last
      expect(result[1].condition).toBe('easy condition');
      expect(result[1].conditionalPassRate).toBe(1);
    });

    it('should handle zero contexts', () => {
      const conditions = [
        {
          varPath: 'emotions.joy',
          operator: '>=',
          threshold: 0.5,
          display: 'joy >= 0.5',
        },
      ];

      const result = service.computeConditionalPassRates([], conditions);

      expect(result).toHaveLength(1);
      expect(result[0].conditionalPassRate).toBe(0);
      expect(result[0].passes).toBe(0);
      expect(result[0].total).toBe(0);
    });
  });

  // ===========================================================================
  // getNestedValue
  // ===========================================================================

  describe('getNestedValue', () => {
    it('should return undefined for null object', () => {
      expect(service.getNestedValue(null, 'a.b')).toBeUndefined();
    });

    it('should return undefined for undefined object', () => {
      expect(service.getNestedValue(undefined, 'a.b')).toBeUndefined();
    });

    it('should return undefined for null path', () => {
      expect(service.getNestedValue({ a: 1 }, null)).toBeUndefined();
    });

    it('should return undefined for empty path', () => {
      expect(service.getNestedValue({ a: 1 }, '')).toBeUndefined();
    });

    it('should get top-level value', () => {
      expect(service.getNestedValue({ a: 1 }, 'a')).toBe(1);
    });

    it('should get nested value', () => {
      expect(service.getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('should return undefined for missing path', () => {
      expect(service.getNestedValue({ a: 1 }, 'b.c')).toBeUndefined();
    });

    it('should handle arrays in path', () => {
      const obj = { items: [{ value: 1 }, { value: 2 }] };

      expect(service.getNestedValue(obj, 'items.0.value')).toBe(1);
      expect(service.getNestedValue(obj, 'items.1.value')).toBe(2);
    });
  });
});
