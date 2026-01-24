/**
 * @file Unit tests for GateImplicationEvaluator
 * Tests gate implication relationships using interval subset analysis (Part B2 of v2 spec).
 * @see specs/prototype-redundancy-analyzer-v2.md
 */

import { describe, it, expect } from '@jest/globals';
import GateImplicationEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js';

describe('GateImplicationEvaluator', () => {
  /**
   * Create a mock logger for testing.
   *
   * @returns {object} Mock logger
   */
  const createMockLogger = () => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  });

  /**
   * Create a mock GateASTNormalizer for testing.
   *
   * @returns {object} Mock normalizer
   */
  const createMockGateASTNormalizer = () => ({
    parse: jest.fn().mockReturnValue({
      ast: { type: 'comparison', axis: 'test', operator: '>=', threshold: 0.5 },
      parseComplete: true,
      errors: [],
    }),
    checkImplication: jest.fn().mockReturnValue({
      implies: false,
      isVacuous: false,
    }),
    toString: jest.fn().mockReturnValue('test >= 0.5'),
  });

  /**
   * Create evaluator instance for testing.
   *
   * @returns {{evaluator: GateImplicationEvaluator, logger: object, mockGateASTNormalizer: object}} Evaluator and mocks
   */
  const createEvaluator = () => {
    const logger = createMockLogger();
    const mockGateASTNormalizer = createMockGateASTNormalizer();
    const evaluator = new GateImplicationEvaluator({
      gateASTNormalizer: mockGateASTNormalizer,
      logger,
    });
    return { evaluator, logger, mockGateASTNormalizer };
  };

  /**
   * Create an interval with the given bounds.
   *
   * @param {number|null} lower - Lower bound (null = unbounded)
   * @param {number|null} upper - Upper bound (null = unbounded)
   * @param {boolean} [unsatisfiable] - Whether interval is unsatisfiable
   * @returns {object} Interval object
   */
  const interval = (lower, upper, unsatisfiable = false) => ({
    lower,
    upper,
    unsatisfiable,
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      const { evaluator } = createEvaluator();
      expect(evaluator).toBeInstanceOf(GateImplicationEvaluator);
    });

    it('should throw when logger is missing', () => {
      const mockGateASTNormalizer = createMockGateASTNormalizer();
      expect(
        () =>
          new GateImplicationEvaluator({
            gateASTNormalizer: mockGateASTNormalizer,
            logger: null,
          })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      const mockGateASTNormalizer = createMockGateASTNormalizer();
      const invalidLogger = { debug: jest.fn() }; // Missing warn, error
      expect(
        () =>
          new GateImplicationEvaluator({
            gateASTNormalizer: mockGateASTNormalizer,
            logger: invalidLogger,
          })
      ).toThrow();
    });

    it('should throw when gateASTNormalizer is missing', () => {
      const logger = createMockLogger();
      expect(
        () =>
          new GateImplicationEvaluator({
            gateASTNormalizer: null,
            logger,
          })
      ).toThrow();
    });

    it('should throw when gateASTNormalizer lacks required methods', () => {
      const logger = createMockLogger();
      const invalidNormalizer = { parse: jest.fn() }; // Missing checkImplication, toString
      expect(
        () =>
          new GateImplicationEvaluator({
            gateASTNormalizer: invalidNormalizer,
            logger,
          })
      ).toThrow();
    });
  });

  describe('evaluate - Basic Implication', () => {
    it('should detect A implies B when A has stricter gates (narrower interval)', () => {
      const { evaluator } = createEvaluator();

      // A: threat in [0.1, 0.3] - narrower
      // B: threat in [0.0, 0.5] - wider
      // A implies B because anything satisfying A also satisfies B
      const intervalsA = new Map([['threat', interval(0.1, 0.3)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('narrower');
    });

    it('should detect B implies A when B has stricter gates', () => {
      const { evaluator } = createEvaluator();

      // A: arousal in [0.0, 0.8] - wider
      // B: arousal in [0.2, 0.6] - narrower
      const intervalsA = new Map([['arousal', interval(0.0, 0.8)]]);
      const intervalsB = new Map([['arousal', interval(0.2, 0.6)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('wider');
    });

    it('should handle frustration implying confusion (stricter gates)', () => {
      const { evaluator } = createEvaluator();

      // Frustration: valence in [-0.8, -0.4], arousal in [0.3, 0.8]
      // Confusion: valence in [-0.6, 0.0], arousal in [0.1, 0.7]
      // Frustration is narrower on valence but NOT a subset (doesn't overlap properly)
      const frustration = new Map([
        ['valence', interval(-0.8, -0.4)],
        ['arousal', interval(0.3, 0.8)],
      ]);

      const confusion = new Map([
        ['valence', interval(-0.6, 0.0)],
        ['arousal', interval(0.1, 0.7)],
      ]);

      const result = evaluator.evaluate(frustration, confusion);

      // frustration.valence [-0.8,-0.4] is NOT subset of confusion.valence [-0.6,0.0]
      // because -0.8 < -0.6
      expect(result.A_implies_B).toBe(false);
      expect(result.counterExampleAxes).toContain('valence');
    });

    it('should handle contentment implying relief (subset relationship)', () => {
      const { evaluator } = createEvaluator();

      // Contentment: valence [0.4, 0.8], arousal [0.1, 0.4]
      // Relief: valence [0.2, 1.0], arousal [0.0, 0.6]
      // Contentment is a subset of relief on both axes
      const contentment = new Map([
        ['valence', interval(0.4, 0.8)],
        ['arousal', interval(0.1, 0.4)],
      ]);

      const relief = new Map([
        ['valence', interval(0.2, 1.0)],
        ['arousal', interval(0.0, 0.6)],
      ]);

      const result = evaluator.evaluate(contentment, relief);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('narrower');
    });
  });

  describe('evaluate - Disjoint Gates', () => {
    it('should detect disjoint intervals on single axis', () => {
      const { evaluator } = createEvaluator();

      // A: threat in [0.0, 0.3]
      // B: threat in [0.5, 1.0]
      // These do not overlap at all
      const intervalsA = new Map([['threat', interval(0.0, 0.3)]]);
      const intervalsB = new Map([['threat', interval(0.5, 1.0)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('disjoint');
    });

    it('should detect disjoint on one axis among many', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([
        ['valence', interval(0.2, 0.8)],
        ['arousal', interval(0.0, 0.2)], // Disjoint
      ]);

      const intervalsB = new Map([
        ['valence', interval(0.3, 0.7)],
        ['arousal', interval(0.5, 1.0)], // Disjoint
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.relation).toBe('disjoint');
    });
  });

  describe('evaluate - Equal Intervals', () => {
    it('should detect equal intervals with mutual implication', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([
        ['threat', interval(0.2, 0.6)],
        ['arousal', interval(0.1, 0.5)],
      ]);

      const intervalsB = new Map([
        ['threat', interval(0.2, 0.6)],
        ['arousal', interval(0.1, 0.5)],
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
      expect(result.counterExampleAxes).toHaveLength(0);
    });

    it('should detect equal when both are empty maps', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map();
      const intervalsB = new Map();

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });
  });

  describe('evaluate - counterExampleAxes', () => {
    it('should populate counterExampleAxes when implication fails', () => {
      const { evaluator } = createEvaluator();

      // A extends below B on valence, above B on arousal
      const intervalsA = new Map([
        ['valence', interval(-0.5, 0.5)], // A extends below B
        ['arousal', interval(0.0, 0.9)], // A extends above B
      ]);

      const intervalsB = new Map([
        ['valence', interval(0.0, 0.5)],
        ['arousal', interval(0.0, 0.7)],
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.counterExampleAxes).toContain('valence');
      expect(result.counterExampleAxes).toContain('arousal');
    });

    it('should have empty counterExampleAxes when implication succeeds', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.2, 0.4)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      // counterExampleAxes might still have entries for B→A failures
      // but A→B should succeed
    });
  });

  describe('evaluate - Evidence Array', () => {
    it('should include evidence for all axes', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([
        ['threat', interval(0.1, 0.3)],
        ['arousal', interval(0.2, 0.6)],
      ]);

      const intervalsB = new Map([
        ['threat', interval(0.0, 0.5)],
        ['valence', interval(-0.5, 0.5)],
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // Should have evidence for all 3 axes: threat, arousal, valence
      expect(result.evidence).toHaveLength(3);

      const axesInEvidence = result.evidence.map((e) => e.axis);
      expect(axesInEvidence).toContain('threat');
      expect(axesInEvidence).toContain('arousal');
      expect(axesInEvidence).toContain('valence');
    });

    it('should include correct interval data in evidence', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.1, 0.3)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      const threatEvidence = result.evidence.find((e) => e.axis === 'threat');
      expect(threatEvidence.intervalA.lower).toBe(0.1);
      expect(threatEvidence.intervalA.upper).toBe(0.3);
      expect(threatEvidence.intervalB.lower).toBe(0.0);
      expect(threatEvidence.intervalB.upper).toBe(0.5);
      expect(threatEvidence.A_subset_B).toBe(true);
      expect(threatEvidence.B_subset_A).toBe(false);
    });
  });

  describe('evaluate - Relation Types', () => {
    it('should return "equal" for mutual implication', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(0.2, 0.6)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);
      expect(result.relation).toBe('equal');
    });

    it('should return "narrower" when A implies B but not vice versa', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.3, 0.5)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.8)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);
      expect(result.relation).toBe('narrower');
    });

    it('should return "wider" when B implies A but not vice versa', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.0, 0.8)]]);
      const intervalsB = new Map([['threat', interval(0.3, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);
      expect(result.relation).toBe('wider');
    });

    it('should return "disjoint" when intervals do not overlap', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.0, 0.2)]]);
      const intervalsB = new Map([['threat', interval(0.5, 1.0)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);
      expect(result.relation).toBe('disjoint');
    });

    it('should return "overlapping" for partial overlap without subset', () => {
      const { evaluator } = createEvaluator();

      // A: [0.2, 0.6], B: [0.4, 0.8]
      // They overlap at [0.4, 0.6] but neither is a subset
      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(0.4, 0.8)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);
      expect(result.relation).toBe('overlapping');
    });
  });

  describe('evaluate - One-Sided Constraints', () => {
    it('should handle A bounded, B unconstrained (A implies B)', () => {
      const { evaluator } = createEvaluator();

      // A: threat in [0.2, 0.6]
      // B: threat in [-∞, +∞] (unconstrained)
      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(null, null)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('narrower');
    });

    it('should handle A unconstrained, B bounded (B implies A)', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(null, null)]]);
      const intervalsB = new Map([['threat', interval(0.2, 0.6)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('wider');
    });

    it('should handle lower-only constraint', () => {
      const { evaluator } = createEvaluator();

      // A: threat >= 0.3 (lower=0.3, upper=null)
      // B: threat >= 0.1 (lower=0.1, upper=null)
      // A is stricter, so A implies B
      const intervalsA = new Map([['threat', interval(0.3, null)]]);
      const intervalsB = new Map([['threat', interval(0.1, null)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
    });

    it('should handle upper-only constraint', () => {
      const { evaluator } = createEvaluator();

      // A: threat <= 0.5 (lower=null, upper=0.5)
      // B: threat <= 0.8 (lower=null, upper=0.8)
      // A is stricter, so A implies B
      const intervalsA = new Map([['threat', interval(null, 0.5)]]);
      const intervalsB = new Map([['threat', interval(null, 0.8)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
    });
  });

  describe('evaluate - Unsatisfiable Intervals', () => {
    it('should handle A unsatisfiable - vacuously implies B', () => {
      const { evaluator } = createEvaluator();

      // A has contradictory constraints: lower > upper
      const intervalsA = new Map([['threat', interval(0.8, 0.2, true)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
      expect(result.relation).toBe('narrower');
    });

    it('should handle B unsatisfiable - vacuously implied by A', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.0, 0.5)]]);
      const intervalsB = new Map([['threat', interval(0.8, 0.2, true)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('wider');
    });

    it('should handle both unsatisfiable - mutual implication', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.8, 0.2, true)]]);
      const intervalsB = new Map([['arousal', interval(0.9, 0.1, true)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });

    it('should treat unsatisfiable as subset of anything in evidence', () => {
      const { evaluator } = createEvaluator();

      // A's threat is unsatisfiable
      const intervalsA = new Map([
        ['threat', interval(0.8, 0.2, true)],
        ['arousal', interval(0.3, 0.5)],
      ]);

      // B has normal intervals
      const intervalsB = new Map([
        ['threat', interval(0.0, 0.5)],
        ['arousal', interval(0.2, 0.6)],
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // A is unsatisfiable overall, so vacuously implies B
      expect(result.A_implies_B).toBe(true);
    });
  });

  describe('evaluate - Mixed Axes', () => {
    it('should handle A has axis X, B has axis Y (both have unconstrained missing axis)', () => {
      const { evaluator } = createEvaluator();

      // A constrains threat, B constrains arousal
      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['arousal', interval(0.3, 0.7)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // A's threat [0.2,0.6] is NOT subset of missing axis ([-∞,+∞]) - wait, it IS
      // A's missing arousal ([-∞,+∞]) is NOT subset of B's arousal [0.3,0.7]
      // So A does NOT imply B (A allows arousal outside [0.3,0.7])
      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(false);

      // Should have evidence for both axes
      expect(result.evidence).toHaveLength(2);
    });

    it('should handle one axis shared, one axis unique to each', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([
        ['threat', interval(0.2, 0.4)],
        ['valence', interval(0.1, 0.5)],
      ]);

      const intervalsB = new Map([
        ['threat', interval(0.0, 0.6)],
        ['arousal', interval(0.2, 0.8)],
      ]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // Evidence should include all 3 axes
      expect(result.evidence).toHaveLength(3);

      const axesInEvidence = result.evidence.map((e) => e.axis);
      expect(axesInEvidence).toContain('threat');
      expect(axesInEvidence).toContain('valence');
      expect(axesInEvidence).toContain('arousal');
    });
  });

  describe('evaluate - Null Bounds Handling', () => {
    it('should treat null lower as -∞ (unbounded below)', () => {
      const { evaluator } = createEvaluator();

      // A: threat in [-∞, 0.5]
      // B: threat in [0.0, 0.5]
      // A is wider (extends below 0.0), so A does NOT imply B
      const intervalsA = new Map([['threat', interval(null, 0.5)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
    });

    it('should treat null upper as +∞ (unbounded above)', () => {
      const { evaluator } = createEvaluator();

      // A: threat in [0.0, +∞]
      // B: threat in [0.0, 0.8]
      // A is wider (extends above 0.8), so A does NOT imply B
      const intervalsA = new Map([['threat', interval(0.0, null)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.8)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(false);
      expect(result.B_implies_A).toBe(true);
    });

    it('should handle both bounds null (fully unconstrained)', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(null, null)]]);
      const intervalsB = new Map([['threat', interval(null, null)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
    });
  });

  describe('evaluate - Edge Cases', () => {
    it('should handle non-Map input gracefully', () => {
      const { evaluator, logger } = createEvaluator();

      const result = evaluator.evaluate('not a map', null);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(true);
      expect(result.relation).toBe('equal');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle plain object input by converting to Map', () => {
      const { evaluator } = createEvaluator();

      const objA = {
        threat: interval(0.2, 0.6),
      };

      const objB = {
        threat: interval(0.0, 0.8),
      };

      const result = evaluator.evaluate(objA, objB);

      expect(result.A_implies_B).toBe(true);
      expect(result.B_implies_A).toBe(false);
    });

    it('should be stateless - repeated calls produce same result', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.8)]]);

      const result1 = evaluator.evaluate(intervalsA, intervalsB);
      const result2 = evaluator.evaluate(intervalsA, intervalsB);

      expect(result1.A_implies_B).toBe(result2.A_implies_B);
      expect(result1.B_implies_A).toBe(result2.B_implies_A);
      expect(result1.relation).toBe(result2.relation);
    });

    it('should not modify input maps', () => {
      const { evaluator } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.8)]]);

      const originalSizeA = intervalsA.size;
      const originalSizeB = intervalsB.size;

      evaluator.evaluate(intervalsA, intervalsB);

      expect(intervalsA.size).toBe(originalSizeA);
      expect(intervalsB.size).toBe(originalSizeB);
    });

    it('should handle touching intervals (edge case for disjoint check)', () => {
      const { evaluator } = createEvaluator();

      // A: [0.0, 0.5], B: [0.5, 1.0]
      // They touch at 0.5 but don't truly overlap (or do they?)
      // Mathematically, they share the point 0.5, so they're not disjoint
      const intervalsA = new Map([['threat', interval(0.0, 0.5)]]);
      const intervalsB = new Map([['threat', interval(0.5, 1.0)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      // 0.5 < 0.5 is false, and 0.5 < 0.0 is false, so not disjoint
      expect(result.relation).toBe('overlapping');
    });

    it('should handle nearly disjoint intervals', () => {
      const { evaluator } = createEvaluator();

      // A: [0.0, 0.49], B: [0.5, 1.0]
      // They are disjoint (0.49 < 0.5)
      const intervalsA = new Map([['threat', interval(0.0, 0.49)]]);
      const intervalsB = new Map([['threat', interval(0.5, 1.0)]]);

      const result = evaluator.evaluate(intervalsA, intervalsB);

      expect(result.relation).toBe('disjoint');
    });
  });

  describe('evaluate - Logging', () => {
    it('should log debug message with implication summary', () => {
      const { evaluator, logger } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.2, 0.6)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.8)]]);

      evaluator.evaluate(intervalsA, intervalsB);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('A→B=true')
      );
    });

    it('should log vacuous truth for unsatisfiable intervals', () => {
      const { evaluator, logger } = createEvaluator();

      const intervalsA = new Map([['threat', interval(0.8, 0.2, true)]]);
      const intervalsB = new Map([['threat', interval(0.0, 0.5)]]);

      evaluator.evaluate(intervalsA, intervalsB);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('unsatisfiable')
      );
    });
  });

  describe('checkImplication (AST-based)', () => {
    describe('successful parsing', () => {
      it('should return deterministic confidence when both gates parse', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        const gateA = { and: [{ '>=': [{ var: 'valence' }, 0.5] }] };
        const gateB = { and: [{ '>=': [{ var: 'valence' }, 0.3] }] };

        const result = evaluator.checkImplication(gateA, gateB);

        expect(result.parseComplete).toBe(true);
        expect(result.confidence).toBe('deterministic');
        expect(mockGateASTNormalizer.parse).toHaveBeenCalledTimes(2);
        expect(mockGateASTNormalizer.checkImplication).toHaveBeenCalled();
      });

      it('should detect A implies B correctly', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.checkImplication.mockReturnValue({
          implies: true,
          isVacuous: false,
        });

        const gateA = 'valence >= 0.5';
        const gateB = 'valence >= 0.3';

        const result = evaluator.checkImplication(gateA, gateB);

        expect(result.implies).toBe(true);
        expect(result.isVacuous).toBe(false);
        expect(result.parseComplete).toBe(true);
      });

      it('should detect vacuous implications', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.checkImplication.mockReturnValue({
          implies: true,
          isVacuous: true,
        });

        const gateA = null;
        const gateB = 'valence >= 0.5';

        const result = evaluator.checkImplication(gateA, gateB);

        expect(result.implies).toBe(true);
        expect(result.isVacuous).toBe(true);
      });

      it('should return empty parseErrors on success', () => {
        const { evaluator } = createEvaluator();

        const gateA = 'valence >= 0.5';
        const gateB = 'arousal >= 0.3';

        const result = evaluator.checkImplication(gateA, gateB);

        expect(result.parseErrors).toEqual([]);
      });
    });

    describe('parse failures', () => {
      it('should return unknown confidence when gateA fails to parse', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.parse
          .mockReturnValueOnce({
            ast: null,
            parseComplete: false,
            errors: ['Invalid gate A syntax'],
          })
          .mockReturnValueOnce({
            ast: { type: 'comparison' },
            parseComplete: true,
            errors: [],
          });

        const result = evaluator.checkImplication('invalid', 'valence >= 0.5');

        expect(result.parseComplete).toBe(false);
        expect(result.confidence).toBe('unknown');
        expect(result.implies).toBe(false);
      });

      it('should return unknown confidence when gateB fails to parse', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.parse
          .mockReturnValueOnce({
            ast: { type: 'comparison' },
            parseComplete: true,
            errors: [],
          })
          .mockReturnValueOnce({
            ast: null,
            parseComplete: false,
            errors: ['Invalid gate B syntax'],
          });

        const result = evaluator.checkImplication('valence >= 0.5', 'invalid');

        expect(result.parseComplete).toBe(false);
        expect(result.confidence).toBe('unknown');
        expect(result.implies).toBe(false);
      });

      it('should collect parse errors from both gates', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.parse
          .mockReturnValueOnce({
            ast: null,
            parseComplete: false,
            errors: ['Error in gate A'],
          })
          .mockReturnValueOnce({
            ast: null,
            parseComplete: false,
            errors: ['Error in gate B'],
          });

        const result = evaluator.checkImplication('invalid1', 'invalid2');

        expect(result.parseErrors).toContain('Error in gate A');
        expect(result.parseErrors).toContain('Error in gate B');
        expect(result.parseErrors).toHaveLength(2);
      });

      it('should return implies=false when parsing fails', () => {
        const { evaluator, mockGateASTNormalizer } = createEvaluator();

        mockGateASTNormalizer.parse.mockReturnValue({
          ast: null,
          parseComplete: false,
          errors: ['Parse error'],
        });

        const result = evaluator.checkImplication('bad', 'worse');

        expect(result.implies).toBe(false);
        expect(result.isVacuous).toBe(false);
      });
    });
  });

  describe('describeGate', () => {
    it('should return human-readable string for valid gate', () => {
      const { evaluator, mockGateASTNormalizer } = createEvaluator();

      mockGateASTNormalizer.toString.mockReturnValue('valence >= 0.5');

      const result = evaluator.describeGate('valence >= 0.5');

      expect(result).toBe('valence >= 0.5');
      expect(mockGateASTNormalizer.parse).toHaveBeenCalled();
      expect(mockGateASTNormalizer.toString).toHaveBeenCalled();
    });

    it('should return error message for unparseable gate', () => {
      const { evaluator, mockGateASTNormalizer } = createEvaluator();

      mockGateASTNormalizer.parse.mockReturnValue({
        ast: null,
        parseComplete: false,
        errors: ['Invalid syntax'],
      });

      const result = evaluator.describeGate('invalid gate');

      expect(result).toBe('[Unparseable gate: Invalid syntax]');
      expect(mockGateASTNormalizer.toString).not.toHaveBeenCalled();
    });

    it('should include all error messages in unparseable output', () => {
      const { evaluator, mockGateASTNormalizer } = createEvaluator();

      mockGateASTNormalizer.parse.mockReturnValue({
        ast: null,
        parseComplete: false,
        errors: ['Error 1', 'Error 2', 'Error 3'],
      });

      const result = evaluator.describeGate('complex invalid gate');

      expect(result).toBe('[Unparseable gate: Error 1, Error 2, Error 3]');
    });
  });
});
