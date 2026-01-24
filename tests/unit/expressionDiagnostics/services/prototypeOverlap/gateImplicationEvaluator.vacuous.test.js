/**
 * @file Unit tests for GateImplicationEvaluator vacuous truth handling
 * Tests the isVacuous flag and vacuousReason for unsatisfiable intervals.
 * @see src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GateImplicationEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';

describe('GateImplicationEvaluator - vacuous truth handling', () => {
  let mockLogger;
  let mockGateASTNormalizer;
  let evaluator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockGateASTNormalizer = {
      parse: jest.fn(() => ({ ast: {}, errors: [], parseComplete: true })),
      checkImplication: jest.fn(() => ({ implies: false, isVacuous: false })),
      toString: jest.fn(() => '[gate]'),
    };

    evaluator = new GateImplicationEvaluator({
      logger: mockLogger,
      gateASTNormalizer: mockGateASTNormalizer,
    });
  });

  // ==========================================================================
  // Helper functions
  // ==========================================================================

  /**
   * Creates an interval Map with the specified axis intervals.
   * @param {object} intervalDefs - Object mapping axis names to interval definitions
   * @returns {Map<string, object>} Interval map
   */
  function createIntervalMap(intervalDefs) {
    const map = new Map();
    for (const [axis, def] of Object.entries(intervalDefs)) {
      map.set(axis, {
        lower: def.lower ?? null,
        upper: def.upper ?? null,
        unsatisfiable: def.unsatisfiable ?? false,
      });
    }
    return map;
  }

  // ==========================================================================
  // isVacuous flag tests
  // ==========================================================================
  describe('isVacuous flag', () => {
    it('should return isVacuous: true when A has unsatisfiable interval', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.8, upper: 0.2, unsatisfiable: true }, // lower > upper
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.A_implies_B).toBe(true); // Empty set implies anything
      expect(result.B_implies_A).toBe(false);
    });

    it('should return isVacuous: true when B has unsatisfiable interval', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.9, upper: 0.1, unsatisfiable: true }, // lower > upper
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true); // Empty set implies anything
    });

    it('should return isVacuous: true when both have unsatisfiable intervals', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.8, upper: 0.2, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.9, upper: 0.1, unsatisfiable: true },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.A_implies_B).toBe(true); // Both empty → mutual implication
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });

    it('should return isVacuous: false when neither has unsatisfiable intervals', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 0.3, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(false);
    });

    it('should return isVacuous: false for normal overlapping intervals', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.2, upper: 0.6, unsatisfiable: false },
        engagement: { lower: 0.3, upper: null, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.1, upper: 0.5, unsatisfiable: false },
        engagement: { lower: 0.4, upper: 0.8, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(false);
    });
  });

  // ==========================================================================
  // vacuousReason tests
  // ==========================================================================
  describe('vacuousReason field', () => {
    it("should set vacuousReason to 'a_unsatisfiable' when only A is empty", () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 1.0, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.vacuousReason).toBe('a_unsatisfiable');
    });

    it("should set vacuousReason to 'b_unsatisfiable' when only B is empty", () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 1.0, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.vacuousReason).toBe('b_unsatisfiable');
    });

    it("should set vacuousReason to 'both_unsatisfiable' when both are empty", () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        engagement: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.vacuousReason).toBe('both_unsatisfiable');
    });

    it('should NOT have vacuousReason when isVacuous is false', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(false);
      expect(result.vacuousReason).toBeUndefined();
    });
  });

  // ==========================================================================
  // Relation type with vacuous truth
  // ==========================================================================
  describe('relation with vacuous truth', () => {
    it("should return relation 'narrower' when A is unsatisfiable (A ⊆ B vacuously)", () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.9, upper: 0.1, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 1.0, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.relation).toBe('narrower');
      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
    });

    it("should return relation 'wider' when B is unsatisfiable (B ⊆ A vacuously)", () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 1.0, unsatisfiable: false },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.9, upper: 0.1, unsatisfiable: true },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.relation).toBe('wider');
      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
    });

    it("should return relation 'equal' when both are unsatisfiable", () => {
      const intervalsA = createIntervalMap({
        axis1: { lower: 0.9, upper: 0.1, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        axis2: { lower: 0.8, upper: 0.2, unsatisfiable: true },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.relation).toBe('equal');
      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('edge cases', () => {
    it('should handle empty interval maps as non-vacuous (unconstrained)', () => {
      const intervalsA = new Map();
      const intervalsB = new Map();

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(false);
      expect(result.A_implies_B).toBe(true); // Both unconstrained → mutual implication
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });

    it('should handle mixed unsatisfiable and normal axes', () => {
      // A has one unsatisfiable axis → entire A is unsatisfiable
      const intervalsA = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
        engagement: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 0.5, unsatisfiable: false },
        engagement: { lower: 0.3, upper: 0.7, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.vacuousReason).toBe('a_unsatisfiable');
    });

    it('should return empty evidence array for vacuous results', () => {
      const intervalsA = createIntervalMap({
        threat: { lower: 1.0, upper: 0.0, unsatisfiable: true },
      });
      const intervalsB = createIntervalMap({
        threat: { lower: 0.0, upper: 1.0, unsatisfiable: false },
      });

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.isVacuous).toBe(true);
      expect(result.evidence).toEqual([]);
      expect(result.counterExampleAxes).toEqual([]);
    });
  });
});
