/**
 * @file Unit tests for BehavioralOverlapEvaluator passRates output
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator - passRates', () => {
  let mockLogger;
  let mockIntensityCalculator;
  let mockRandomStateGenerator;
  let mockContextBuilder;
  let mockConfig;
  let mockGateConstraintExtractor;
  let mockGateImplicationEvaluator;

  /**
   * Creates a basic state generator mock with deterministic output.
   *
   * @returns {object} Mock state generator with generate method
   */
  function createMockStateGenerator() {
    return {
      generate: jest.fn(() => ({
        current: { mood: { happiness: 50 }, sexual: { sex_excitation: 30 } },
        previous: { mood: { happiness: 40 }, sexual: { sex_excitation: 20 } },
        affectTraits: {
          affective_empathy: 50,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
      })),
    };
  }

  /**
   * Creates a basic context builder mock.
   *
   * @returns {object} Mock context builder with buildContext method
   */
  function createMockContextBuilder() {
    return {
      buildContext: jest.fn((current, previous, traits) => ({
        moodAxes: current.mood,
        sexualAxes: current.sexual,
        affectTraits: traits,
        emotions: {},
        sexualStates: {},
      })),
    };
  }

  /**
   * Creates an intensity calculator mock.
   *
   * @returns {object} Mock intensity calculator with computeIntensity method
   */
  function createMockIntensityCalculator() {
    return {
      computeIntensity: jest.fn(() => 0.5),
    };
  }

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockConfig = {
      sampleCountPerPair: 100,
      divergenceExamplesK: 5,
      dominanceDelta: 0.05,
      minPassSamplesForConditional: 1,
    };

    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();
    mockIntensityCalculator = createMockIntensityCalculator();

    mockGateConstraintExtractor = {
      extract: jest.fn(() => ({
        parseStatus: 'complete',
        intervals: {},
      })),
    };

    mockGateImplicationEvaluator = {
      evaluate: jest.fn(() => ({
        A_implies_B: false,
        B_implies_A: false,
        counterExampleAxes: [],
        evidence: [],
        relation: 'overlapping',
      })),
    };
  });

  // ==========================================================================
  // Presence tests
  // ==========================================================================
  describe('passRates object presence', () => {
    it('evaluate() returns object with passRates field', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result).toHaveProperty('passRates');
      expect(result.passRates).toHaveProperty('passARate');
      expect(result.passRates).toHaveProperty('passBRate');
      expect(result.passRates).toHaveProperty('pA_given_B');
      expect(result.passRates).toHaveProperty('pB_given_A');
    });

    it('passRates values are numbers', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(typeof result.passRates.passARate).toBe('number');
      expect(typeof result.passRates.passBRate).toBe('number');
      expect(typeof result.passRates.pA_given_B).toBe('number');
      expect(typeof result.passRates.pB_given_A).toBe('number');
    });
  });

  // ==========================================================================
  // Count arithmetic invariant tests
  // ==========================================================================
  describe('count arithmetic invariants', () => {
    it('passARate equals (onBothRate + pOnlyRate)', async () => {
      // Use random pass behavior to get varied counts
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => Math.random() > 0.3),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      // passARate = (onBothCount + pOnlyCount) / sampleCount
      // which equals onBothRate + pOnlyRate
      const expectedPassARate =
        result.gateOverlap.onBothRate + result.gateOverlap.pOnlyRate;
      expect(result.passRates.passARate).toBeCloseTo(expectedPassARate, 10);
    });

    it('passBRate equals (onBothRate + qOnlyRate)', async () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => Math.random() > 0.3),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      const expectedPassBRate =
        result.gateOverlap.onBothRate + result.gateOverlap.qOnlyRate;
      expect(result.passRates.passBRate).toBeCloseTo(expectedPassBRate, 10);
    });
  });

  // ==========================================================================
  // Rate bounds tests
  // ==========================================================================
  describe('rate bounds', () => {
    it('passARate is in [0, 1]', async () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => Math.random() > 0.5),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      expect(result.passRates.passARate).toBeGreaterThanOrEqual(0);
      expect(result.passRates.passARate).toBeLessThanOrEqual(1);
    });

    it('passBRate is in [0, 1]', async () => {
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => Math.random() > 0.5),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 100);

      expect(result.passRates.passBRate).toBeGreaterThanOrEqual(0);
      expect(result.passRates.passBRate).toBeLessThanOrEqual(1);
    });

    it('passARate is 1 when A always passes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.passARate).toBe(1);
    });

    it('passARate is 0 when A never passes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => false) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.passARate).toBe(0);
    });
  });

  // ==========================================================================
  // Conditional probability bounds tests
  // ==========================================================================
  describe('conditional probability bounds', () => {
    it('pA_given_B is in [0, 1] when passBCount > 0', async () => {
      // Ensure B passes sometimes
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.pA_given_B).toBeGreaterThanOrEqual(0);
      expect(result.passRates.pA_given_B).toBeLessThanOrEqual(1);
    });

    it('pB_given_A is in [0, 1] when passACount > 0', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.pB_given_A).toBeGreaterThanOrEqual(0);
      expect(result.passRates.pB_given_A).toBeLessThanOrEqual(1);
    });

    it('pA_given_B is 1 when both always pass', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // If both always pass, P(A|B) = onBothCount / passBCount = 1
      expect(result.passRates.pA_given_B).toBe(1);
      expect(result.passRates.pB_given_A).toBe(1);
    });
  });

  // ==========================================================================
  // NaN edge case tests
  // ==========================================================================
  describe('NaN edge cases', () => {
    it('pA_given_B is NaN when passBCount is 0', async () => {
      // B never passes
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          // Only A passes
          return gates.includes('A_ONLY');
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A_ONLY'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_ONLY'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // B never passes, so passBCount = 0, pA_given_B should be NaN
      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(true);
    });

    it('pB_given_A is NaN when passACount is 0', async () => {
      // A never passes
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          // Only B passes
          return gates.includes('B_ONLY');
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A_ONLY'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_ONLY'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // A never passes, so passACount = 0, pB_given_A should be NaN
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(true);
    });

    it('both conditional probabilities are NaN when neither passes', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => false) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(true);
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(true);
    });
  });

  // ==========================================================================
  // Deterministic test with injected contexts
  // ==========================================================================
  describe('deterministic test with injected contexts', () => {
    it('computes correct passRates for 10 controlled samples', async () => {
      // We'll inject 10 deterministic gate pass results:
      // Sample 0: A=true,  B=true  → onBoth
      // Sample 1: A=true,  B=false → pOnly
      // Sample 2: A=false, B=true  → qOnly
      // Sample 3: A=true,  B=true  → onBoth
      // Sample 4: A=false, B=false → neither
      // Sample 5: A=true,  B=true  → onBoth
      // Sample 6: A=true,  B=false → pOnly
      // Sample 7: A=false, B=true  → qOnly
      // Sample 8: A=true,  B=true  → onBoth
      // Sample 9: A=true,  B=false → pOnly

      // Expected counts:
      // onBothCount = 4 (samples 0, 3, 5, 8)
      // pOnlyCount = 3 (samples 1, 6, 9)
      // qOnlyCount = 2 (samples 2, 7)
      // neitherCount = 1 (sample 4)

      // passACount = onBothCount + pOnlyCount = 4 + 3 = 7
      // passBCount = onBothCount + qOnlyCount = 4 + 2 = 6
      // passARate = 7/10 = 0.7
      // passBRate = 6/10 = 0.6
      // pA_given_B = onBothCount / passBCount = 4/6 = 0.6667
      // pB_given_A = onBothCount / passACount = 4/7 = 0.5714

      const passPattern = [
        [true, true], // 0
        [true, false], // 1
        [false, true], // 2
        [true, true], // 3
        [false, false], // 4
        [true, true], // 5
        [true, false], // 6
        [false, true], // 7
        [true, true], // 8
        [true, false], // 9
      ];

      let sampleIdx = 0;
      let callInSample = 0;

      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          const currentSample = Math.floor(sampleIdx / 2);
          const isCheckForA = callInSample % 2 === 0;
          callInSample++;

          if (callInSample % 2 === 0) {
            sampleIdx += 2;
          }

          if (currentSample >= passPattern.length) {
            return false;
          }

          return isCheckForA
            ? passPattern[currentSample][0]
            : passPattern[currentSample][1];
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: ['A'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // Verify passRates
      expect(result.passRates.passARate).toBeCloseTo(0.7, 10);
      expect(result.passRates.passBRate).toBeCloseTo(0.6, 10);
      expect(result.passRates.pA_given_B).toBeCloseTo(4 / 6, 5);
      expect(result.passRates.pB_given_A).toBeCloseTo(4 / 7, 5);

      // Verify gateOverlap is consistent
      expect(result.gateOverlap.onBothRate).toBeCloseTo(0.4, 10);
      expect(result.gateOverlap.pOnlyRate).toBeCloseTo(0.3, 10);
      expect(result.gateOverlap.qOnlyRate).toBeCloseTo(0.2, 10);
    });
  });

  // ==========================================================================
  // Backward compatibility tests
  // ==========================================================================
  describe('backward compatibility', () => {
    it('existing output fields are preserved', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 10);

      // Existing fields should still be present
      expect(result).toHaveProperty('gateOverlap');
      expect(result).toHaveProperty('intensity');
      expect(result).toHaveProperty('divergenceExamples');

      // gateOverlap structure unchanged
      expect(result.gateOverlap).toHaveProperty('onEitherRate');
      expect(result.gateOverlap).toHaveProperty('onBothRate');
      expect(result.gateOverlap).toHaveProperty('pOnlyRate');
      expect(result.gateOverlap).toHaveProperty('qOnlyRate');

      // intensity structure unchanged
      expect(result.intensity).toHaveProperty('pearsonCorrelation');
      expect(result.intensity).toHaveProperty('meanAbsDiff');
      expect(result.intensity).toHaveProperty('dominanceP');
      expect(result.intensity).toHaveProperty('dominanceQ');

      // divergenceExamples is an array
      expect(Array.isArray(result.divergenceExamples)).toBe(true);
    });
  });
});
