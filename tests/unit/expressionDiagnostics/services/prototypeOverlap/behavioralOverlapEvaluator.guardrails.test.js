/**
 * @file Unit tests for BehavioralOverlapEvaluator coPassCount guardrail
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator - coPassCount guardrail', () => {
  let mockLogger;
  let mockIntensityCalculator;
  let mockRandomStateGenerator;
  let mockContextBuilder;
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

    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();
    mockIntensityCalculator = createMockIntensityCalculator();

    // Gate constraint and implication mocks (required for PROREDANAV2)
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
  // coPassCount presence tests
  // ==========================================================================
  describe('coPassCount field presence', () => {
    it('coPassCount field is present in passRates', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
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

      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.passRates).toHaveProperty('coPassCount');
      expect(typeof result.passRates.coPassCount).toBe('number');
    });

    it('coPassCount equals onBothCount', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
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
      const sampleCount = 20;

      const result = await evaluator.evaluate(protoA, protoB, sampleCount);

      // When both always pass, coPassCount should equal sampleCount
      expect(result.passRates.coPassCount).toBe(sampleCount);
      // onBothRate = onBothCount / sampleCount, so onBothCount = onBothRate * sampleCount
      const expectedOnBothCount = result.gateOverlap.onBothRate * sampleCount;
      expect(result.passRates.coPassCount).toBe(expectedOnBothCount);
    });
  });

  // ==========================================================================
  // Guardrail activation tests
  // ==========================================================================
  describe('guardrail activation', () => {
    it('pearsonCorrelation is NaN when coPassCount < minCoPassSamples', async () => {
      // Both prototypes always pass, but we'll run fewer samples than minCoPassSamples
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200, // Require 200 co-pass samples
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

      // Run only 50 samples - far below minCoPassSamples of 200
      const result = await evaluator.evaluate(protoA, protoB, 50);

      // coPassCount should be 50 (all pass)
      expect(result.passRates.coPassCount).toBe(50);
      // pearsonCorrelation should be NaN due to guardrail
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(true);
    });

    it('meanAbsDiff is NaN when coPassCount < minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200,
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

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(true);
    });

    it('intensity metrics computed normally when coPassCount >= minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 10, // Low threshold
      };

      // Use intensity calculator that returns varying values
      let callCount = 0;
      const varyingIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05; // Values from 0.3 to 0.75
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: varyingIntensityCalculator,
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

      // coPassCount should be 50 >= 10
      expect(result.passRates.coPassCount).toBe(50);
      // Metrics should be computed (not NaN)
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(false);
      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(false);
    });
  });

  // ==========================================================================
  // Boundary condition tests
  // ==========================================================================
  describe('guardrail boundary conditions', () => {
    it('guardrail active at coPassCount=199 with minCoPassSamples=200', async () => {
      // Make exactly 199 samples pass both gates
      let sampleIndex = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          // First 199 samples: both pass
          // Sample 200: neither passes (to keep coPassCount at 199)
          const currentSample = Math.floor(sampleIndex / 2);
          sampleIndex++;
          return currentSample < 199;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200,
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

      const result = await evaluator.evaluate(protoA, protoB, 200);

      // Exactly 199 co-pass samples
      expect(result.passRates.coPassCount).toBe(199);
      // Guardrail should be active (199 < 200)
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(true);
      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(true);
    });

    it('guardrail inactive at coPassCount=200 with minCoPassSamples=200', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200,
      };

      // Varying intensity for meaningful correlation
      let callCount = 0;
      const varyingIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: varyingIntensityCalculator,
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

      const result = await evaluator.evaluate(protoA, protoB, 200);

      // Exactly 200 co-pass samples
      expect(result.passRates.coPassCount).toBe(200);
      // Guardrail should be inactive (200 >= 200)
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(false);
      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(false);
    });
  });

  // ==========================================================================
  // Invariant tests - metrics unaffected by guardrail
  // ==========================================================================
  describe('invariants - unaffected metrics', () => {
    it('gateOverlap metrics unaffected by guardrail', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200, // Guardrail will be active
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

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // gateOverlap should be computed regardless of guardrail
      expect(result.gateOverlap.onEitherRate).toBe(1);
      expect(result.gateOverlap.onBothRate).toBe(1);
      expect(result.gateOverlap.pOnlyRate).toBe(0);
      expect(result.gateOverlap.qOnlyRate).toBe(0);
    });

    it('divergenceExamples still collected when guardrail active', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200, // Guardrail will be active
      };

      // Use varying intensities to create divergence examples
      let callCount = 0;
      const varyingIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          // Alternate between high and low values
          return callCount % 2 === 0 ? 0.9 : 0.1;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: varyingIntensityCalculator,
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

      // Guardrail is active
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(true);
      // But divergenceExamples should still be collected
      expect(Array.isArray(result.divergenceExamples)).toBe(true);
      expect(result.divergenceExamples.length).toBeGreaterThan(0);
      expect(result.divergenceExamples.length).toBeLessThanOrEqual(5);
    });

    it('dominanceP and dominanceQ still return 0 when jointCount is 0', async () => {
      // Neither prototype passes
      const gateChecker = { checkAllGatesPass: jest.fn(() => false) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
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

      const result = await evaluator.evaluate(protoA, protoB, 50);

      // coPassCount should be 0
      expect(result.passRates.coPassCount).toBe(0);
      // dominanceP and dominanceQ should return 0 (not NaN)
      expect(result.intensity.dominanceP).toBe(0);
      expect(result.intensity.dominanceQ).toBe(0);
    });
  });

  // ==========================================================================
  // Config fallback tests
  // ==========================================================================
  describe('config fallback behavior', () => {
    it('uses fallback of 1 when minCoPassSamples not in config', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        // minCoPassSamples intentionally omitted
      };

      // Varying intensity for meaningful correlation
      let callCount = 0;
      const varyingIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const evaluator = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: varyingIntensityCalculator,
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

      // With fallback of 1, even 2 samples should be enough for metrics
      const result = await evaluator.evaluate(protoA, protoB, 10);

      expect(result.passRates.coPassCount).toBe(10);
      // With 10 >= 1, metrics should be computed
      expect(Number.isNaN(result.intensity.pearsonCorrelation)).toBe(false);
      expect(Number.isNaN(result.intensity.meanAbsDiff)).toBe(false);
    });
  });

  // ==========================================================================
  // Conditional probability guardrail tests (minPassSamplesForConditional)
  // ==========================================================================
  describe('conditional probability guardrail', () => {
    it('pB_given_A is NaN when passACount < minPassSamplesForConditional', async () => {
      // Set up gate checker so A passes only 30 times, B always passes
      let sampleIndex = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          // A passes for first 30 samples, B always passes
          const isA = gates.includes('A_GATE');
          const isB = gates.includes('B_GATE');
          if (isA) {
            // A passes only for first 30 samples
            const currentSample = Math.floor(sampleIndex / 2);
            sampleIndex++;
            return currentSample < 30;
          }
          if (isB) {
            sampleIndex++;
            return true; // B always passes
          }
          return true;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 8000,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        minPassSamplesForConditional: 200, // Require 200 pass samples
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

      const protoA = { gates: ['A_GATE'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_GATE'], weights: { axis1: 1.0 } };

      // Need 300 samples: first 30 A passes + 270 where B still passes = passBCount of 300
      const result = await evaluator.evaluate(protoA, protoB, 300);

      // passACount should be 30 (only first 30 samples)
      expect(result.passRates.passACount).toBe(30);
      // pB_given_A should be NaN because passACount (30) < minPassSamplesForConditional (200)
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(true);
      // passBCount should be 300, so pA_given_B should NOT be NaN
      expect(result.passRates.passBCount).toBe(300);
      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(false);
    });

    it('pA_given_B is NaN when passBCount < minPassSamplesForConditional', async () => {
      // Set up gate checker so B passes only 30 times, A always passes
      let sampleIndex = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          const isA = gates.includes('A_GATE');
          const isB = gates.includes('B_GATE');
          if (isA) {
            sampleIndex++;
            return true; // A always passes
          }
          if (isB) {
            // B passes only for first 30 samples
            const currentSample = Math.floor(sampleIndex / 2);
            sampleIndex++;
            return currentSample < 30;
          }
          return true;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 8000,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        minPassSamplesForConditional: 200,
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

      const protoA = { gates: ['A_GATE'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_GATE'], weights: { axis1: 1.0 } };

      // Need 300 samples: A passes all 300, B passes only first 30
      const result = await evaluator.evaluate(protoA, protoB, 300);

      // passBCount should be 30
      expect(result.passRates.passBCount).toBe(30);
      // pA_given_B should be NaN because passBCount (30) < minPassSamplesForConditional (200)
      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(true);
      // passACount should be 300, so pB_given_A should NOT be NaN
      expect(result.passRates.passACount).toBe(300);
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(false);
    });

    it('conditional probabilities computed normally when pass counts >= threshold', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 8000,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        minPassSamplesForConditional: 200, // Both should exceed this
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

      // Both always pass, 300 samples > 200 threshold
      const result = await evaluator.evaluate(protoA, protoB, 300);

      expect(result.passRates.passACount).toBe(300);
      expect(result.passRates.passBCount).toBe(300);
      // Both conditional probabilities should be computed (not NaN)
      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(false);
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(false);
      // Both should be 1 when both always pass
      expect(result.passRates.pA_given_B).toBe(1);
      expect(result.passRates.pB_given_A).toBe(1);
    });

    it('boundary: passACount = 199 -> pB_given_A is NaN', async () => {
      // Set up gate checker so A passes exactly 199 times
      let sampleIndex = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          const isA = gates.includes('A_GATE');
          if (isA) {
            const currentSample = Math.floor(sampleIndex / 2);
            sampleIndex++;
            return currentSample < 199; // Exactly 199 passes
          }
          sampleIndex++;
          return true; // B always passes
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 8000,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        minPassSamplesForConditional: 200,
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

      const protoA = { gates: ['A_GATE'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_GATE'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 250);

      // passACount should be 199
      expect(result.passRates.passACount).toBe(199);
      // pB_given_A should be NaN (199 < 200)
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(true);
    });

    it('boundary: passACount = 200 -> pB_given_A is computed', async () => {
      // Set up gate checker so A passes exactly 200 times
      let sampleIndex = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn((gates) => {
          const isA = gates.includes('A_GATE');
          if (isA) {
            const currentSample = Math.floor(sampleIndex / 2);
            sampleIndex++;
            return currentSample < 200; // Exactly 200 passes
          }
          sampleIndex++;
          return true; // B always passes
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 8000,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        minPassSamplesForConditional: 200,
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

      const protoA = { gates: ['A_GATE'], weights: { axis1: 1.0 } };
      const protoB = { gates: ['B_GATE'], weights: { axis1: 1.0 } };

      const result = await evaluator.evaluate(protoA, protoB, 250);

      // passACount should be 200
      expect(result.passRates.passACount).toBe(200);
      // pB_given_A should be computed (200 >= 200)
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(false);
    });

    it('passACount and passBCount fields are present in passRates', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
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

      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates).toHaveProperty('passACount');
      expect(result.passRates).toHaveProperty('passBCount');
      expect(typeof result.passRates.passACount).toBe('number');
      expect(typeof result.passRates.passBCount).toBe('number');
      // Both should be 50 when both always pass
      expect(result.passRates.passACount).toBe(50);
      expect(result.passRates.passBCount).toBe(50);
    });

    it('uses fallback of 200 when minPassSamplesForConditional not in config', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        // minPassSamplesForConditional intentionally omitted
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

      // Only 50 samples, less than default 200 threshold
      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.passACount).toBe(50);
      expect(result.passRates.passBCount).toBe(50);
      // Both conditional probabilities should be NaN (50 < default 200)
      expect(Number.isNaN(result.passRates.pA_given_B)).toBe(true);
      expect(Number.isNaN(result.passRates.pB_given_A)).toBe(true);
    });
  });
});
