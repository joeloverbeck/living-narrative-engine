/**
 * @file Unit tests for BehavioralOverlapEvaluator rmse and pctWithinEps intensity metrics
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator - rmse and pctWithinEps intensity metrics', () => {
  let mockLogger;
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

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRandomStateGenerator = createMockStateGenerator();
    mockContextBuilder = createMockContextBuilder();

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
  // Field presence tests
  // ==========================================================================
  describe('field presence', () => {
    it('rmse field is present in intensity object', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity).toHaveProperty('rmse');
      expect(typeof result.intensity.rmse).toBe('number');
    });

    it('pctWithinEps field is present in intensity object', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity).toHaveProperty('pctWithinEps');
      expect(typeof result.intensity.pctWithinEps).toBe('number');
    });
  });

  // ==========================================================================
  // RMSE calculation tests
  // ==========================================================================
  describe('rmse calculation', () => {
    it('computes rmse as sqrt(mean(sqDiff)) with known values', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Create intensity calculator that returns controlled sequences
      // For prototype A: 0.5, 0.5, 0.5, 0.5 (4 samples)
      // For prototype B: 0.6, 0.4, 0.7, 0.3 (4 samples)
      // Differences: -0.1, 0.1, -0.2, 0.2
      // Squared diffs: 0.01, 0.01, 0.04, 0.04 = 0.10 total
      // Mean sq diff: 0.10 / 4 = 0.025
      // RMSE: sqrt(0.025) ≈ 0.1581
      let callCount = 0;
      const valuesA = [0.5, 0.5, 0.5, 0.5];
      const valuesB = [0.6, 0.4, 0.7, 0.3];
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          // Each sample calls computeIntensity twice: once for A, once for B
          const sampleIndex = Math.floor(callCount / 2);
          const isA = callCount % 2 === 0;
          callCount++;
          return isA ? valuesA[sampleIndex] : valuesB[sampleIndex];
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      const result = await evaluator.evaluate(protoA, protoB, 4);

      // RMSE = sqrt(0.025) ≈ 0.1581
      expect(result.intensity.rmse).toBeCloseTo(Math.sqrt(0.025), 4);
    });

    it('rmse is 0 when intensities are identical', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity.rmse).toBe(0);
    });

    it('rmse bounds: rmse >= 0 when coPassCount >= minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Random varying intensities
      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity.rmse).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // pctWithinEps calculation tests
  // ==========================================================================
  describe('pctWithinEps calculation', () => {
    it('computes pctWithinEps as fraction of samples within eps', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Create intensity calculator that returns controlled sequences
      // For prototype A: 0.5, 0.5, 0.5, 0.5 (4 samples)
      // For prototype B: 0.52, 0.6, 0.48, 0.7 (4 samples)
      // With eps=0.05:
      // |0.5-0.52| = 0.02 <= 0.05 ✓
      // |0.5-0.6| = 0.1 > 0.05 ✗
      // |0.5-0.48| = 0.02 <= 0.05 ✓
      // |0.5-0.7| = 0.2 > 0.05 ✗
      // pctWithinEps = 2/4 = 0.5
      let callCount = 0;
      const valuesA = [0.5, 0.5, 0.5, 0.5];
      const valuesB = [0.52, 0.6, 0.48, 0.7];
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          const sampleIndex = Math.floor(callCount / 2);
          const isA = callCount % 2 === 0;
          callCount++;
          return isA ? valuesA[sampleIndex] : valuesB[sampleIndex];
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      const result = await evaluator.evaluate(protoA, protoB, 4);

      expect(result.intensity.pctWithinEps).toBe(0.5);
    });

    it('pctWithinEps is 1 when all differences are within eps', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      // Both prototypes return same value - all differences are 0
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity.pctWithinEps).toBe(1);
    });

    it('pctWithinEps is 0 when no differences are within eps', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // All differences > eps (0.05)
      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          // Alternate between 0.1 and 0.9 - difference is always 0.8
          return callCount % 2 === 0 ? 0.9 : 0.1;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity.pctWithinEps).toBe(0);
    });

    it('pctWithinEps bounds: 0 <= pctWithinEps <= 1', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      expect(result.intensity.pctWithinEps).toBeGreaterThanOrEqual(0);
      expect(result.intensity.pctWithinEps).toBeLessThanOrEqual(1);
    });

    it('respects different intensityEps config values', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // All differences are exactly 0.1
      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          // A returns 0.5, B returns 0.6 - diff is always 0.1
          return callCount % 2 === 1 ? 0.5 : 0.6;
        }),
      };

      // With eps=0.05, all diffs (0.1) > eps => pctWithinEps = 0
      const mockConfig1 = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
      };

      const evaluator1 = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig1,
        logger: mockLogger,
      });

      const protoA = { gates: [], weights: { axis1: 1.0 } };
      const protoB = { gates: [], weights: { axis1: 1.0 } };

      const result1 = await evaluator1.evaluate(protoA, protoB, 10);
      expect(result1.intensity.pctWithinEps).toBe(0);

      // Reset call count
      callCount = 0;

      // With eps=0.15, all diffs (0.1) <= eps => pctWithinEps = 1
      const mockConfig2 = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.15,
      };

      const evaluator2 = new BehavioralOverlapEvaluator({
        prototypeIntensityCalculator: mockIntensityCalculator,
        randomStateGenerator: mockRandomStateGenerator,
        contextBuilder: mockContextBuilder,
        prototypeGateChecker: gateChecker,
        gateConstraintExtractor: mockGateConstraintExtractor,
        gateImplicationEvaluator: mockGateImplicationEvaluator,
        config: mockConfig2,
        logger: mockLogger,
      });

      const result2 = await evaluator2.evaluate(protoA, protoB, 10);
      expect(result2.intensity.pctWithinEps).toBe(1);
    });
  });

  // ==========================================================================
  // Guardrail tests
  // ==========================================================================
  describe('guardrail application', () => {
    it('rmse is NaN when coPassCount < minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200, // Require 200 co-pass samples
        intensityEps: 0.05,
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

      // Run only 50 samples - below minCoPassSamples of 200
      const result = await evaluator.evaluate(protoA, protoB, 50);

      expect(result.passRates.coPassCount).toBe(50);
      expect(Number.isNaN(result.intensity.rmse)).toBe(true);
    });

    it('pctWithinEps is NaN when coPassCount < minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 200,
        intensityEps: 0.05,
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

      expect(Number.isNaN(result.intensity.pctWithinEps)).toBe(true);
    });

    it('rmse and pctWithinEps computed normally when coPassCount >= minCoPassSamples', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 10, // Low threshold
        intensityEps: 0.05,
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

      expect(result.passRates.coPassCount).toBe(50);
      expect(Number.isNaN(result.intensity.rmse)).toBe(false);
      expect(Number.isNaN(result.intensity.pctWithinEps)).toBe(false);
    });
  });

  // ==========================================================================
  // Perfect similarity tests
  // ==========================================================================
  describe('perfect similarity', () => {
    it('rmse=0 and pctWithinEps=1 when intensities are identical', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.5) };
      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      const result = await evaluator.evaluate(protoA, protoB, 20);

      expect(result.intensity.rmse).toBe(0);
      expect(result.intensity.pctWithinEps).toBe(1);
    });
  });

  // ==========================================================================
  // Backward compatibility tests
  // ==========================================================================
  describe('backward compatibility', () => {
    it('existing intensity fields unchanged', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          return 0.3 + (callCount % 10) * 0.05;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        intensityEps: 0.05,
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

      // Original fields still present and computed
      expect(result.intensity).toHaveProperty('pearsonCorrelation');
      expect(result.intensity).toHaveProperty('meanAbsDiff');
      expect(result.intensity).toHaveProperty('dominanceP');
      expect(result.intensity).toHaveProperty('dominanceQ');

      // New fields also present
      expect(result.intensity).toHaveProperty('rmse');
      expect(result.intensity).toHaveProperty('pctWithinEps');

      // All fields are numbers (not undefined)
      expect(typeof result.intensity.pearsonCorrelation).toBe('number');
      expect(typeof result.intensity.meanAbsDiff).toBe('number');
      expect(typeof result.intensity.dominanceP).toBe('number');
      expect(typeof result.intensity.dominanceQ).toBe('number');
      expect(typeof result.intensity.rmse).toBe('number');
      expect(typeof result.intensity.pctWithinEps).toBe('number');
    });
  });

  // ==========================================================================
  // Config fallback tests
  // ==========================================================================
  describe('config fallback behavior', () => {
    it('uses fallback of 0.05 when intensityEps not in config', async () => {
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // All differences are exactly 0.04
      let callCount = 0;
      const mockIntensityCalculator = {
        computeIntensity: jest.fn(() => {
          callCount++;
          // A returns 0.5, B returns 0.54 - diff is 0.04
          return callCount % 2 === 1 ? 0.5 : 0.54;
        }),
      };

      const mockConfig = {
        sampleCountPerPair: 100,
        divergenceExamplesK: 5,
        dominanceDelta: 0.05,
        minCoPassSamples: 1,
        // intensityEps intentionally omitted - should default to 0.05
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

      // With default eps=0.05, diff of 0.04 should be within eps
      // All samples should be within eps, so pctWithinEps = 1
      expect(result.intensity.pctWithinEps).toBe(1);
    });
  });
});
