/**
 * @file Unit tests for BehavioralOverlapEvaluator global output metrics
 * Tests globalMeanAbsDiff, globalL2Distance, and globalOutputCorrelation
 * These metrics address selection bias by computing over ALL samples (not just co-pass)
 * @see src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

describe('BehavioralOverlapEvaluator - global output metrics', () => {
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
    it('globalMeanAbsDiff field is present in intensity object', async () => {
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

      expect(result.intensity).toHaveProperty('globalMeanAbsDiff');
      expect(typeof result.intensity.globalMeanAbsDiff).toBe('number');
    });

    it('globalL2Distance field is present in intensity object', async () => {
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

      expect(result.intensity).toHaveProperty('globalL2Distance');
      expect(typeof result.intensity.globalL2Distance).toBe('number');
    });

    it('globalOutputCorrelation field is present in intensity object', async () => {
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

      expect(result.intensity).toHaveProperty('globalOutputCorrelation');
      expect(typeof result.intensity.globalOutputCorrelation).toBe('number');
    });
  });

  // ==========================================================================
  // 100% co-pass scenario: global metrics should equal co-pass metrics
  // ==========================================================================
  describe('100% co-pass scenario', () => {
    it('globalMeanAbsDiff equals meanAbsDiff when 100% co-pass', async () => {
      // Both prototypes always pass gates
      const gateChecker = { checkAllGatesPass: jest.fn(() => true) };

      // Return same intensity for both
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

      // When 100% co-pass and same intensities, both should be 0
      expect(result.intensity.globalMeanAbsDiff).toBeCloseTo(
        result.intensity.meanAbsDiff,
        5
      );
    });

    it('globalL2Distance equals rmse when 100% co-pass', async () => {
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

      // When 100% co-pass, globalL2Distance should equal rmse
      expect(result.intensity.globalL2Distance).toBeCloseTo(
        result.intensity.rmse,
        5
      );
    });
  });

  // ==========================================================================
  // 0% co-pass (exclusive firing): global metrics capture divergence
  // ==========================================================================
  describe('0% co-pass (exclusive firing) scenario', () => {
    it('captures divergence when prototypes fire exclusively', async () => {
      // Alternate which prototype passes - never both
      let callCount = 0;
      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          // First call for A, second for B per sample
          const isA = callCount % 2 === 0;
          const sampleIndex = Math.floor(callCount / 2);
          callCount++;
          // Odd samples: A passes, B fails; Even samples: A fails, B passes
          return isA ? sampleIndex % 2 === 0 : sampleIndex % 2 !== 0;
        }),
      };

      // Return constant intensity when gate passes
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.8) };

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

      // With exclusive firing:
      // - co-pass meanAbsDiff should be NaN (no co-pass samples)
      // - globalMeanAbsDiff should be ~0.8 (one fires at 0.8, other at 0)
      expect(result.intensity.meanAbsDiff).toBeNaN();
      expect(result.intensity.globalMeanAbsDiff).toBeGreaterThan(0);
      // Should be approximately 0.8 since each sample has one at 0.8 and one at 0
      expect(result.intensity.globalMeanAbsDiff).toBeCloseTo(0.8, 1);
    });
  });

  // ==========================================================================
  // CRITICAL: Low co-pass with high correlation should show high globalMeanAbsDiff
  // This is the key test case that validates the selection bias fix
  // ==========================================================================
  describe('selection bias detection', () => {
    it('low co-pass with high correlation shows high globalMeanAbsDiff', async () => {
      // Scenario: 10% of samples are co-pass, and when both pass, they have
      // identical intensities (correlation = 1.0). But 90% of the time,
      // they fire exclusively, which the co-pass correlation misses.

      let sampleIndex = 0;

      const gateChecker = {
        checkAllGatesPass: jest.fn(() => {
          const currentSample = Math.floor(sampleIndex / 2);
          const isCurrentA = sampleIndex % 2 === 0;
          sampleIndex++;

          // 10% co-pass (samples 0, 10, 20, etc.)
          const isCoPassSample = currentSample % 10 === 0;

          if (isCoPassSample) {
            return true; // Both pass
          }

          // Exclusive firing for other samples
          // Odd samples: A passes, even samples: B passes
          if (isCurrentA) {
            return currentSample % 2 === 1;
          } else {
            return currentSample % 2 === 0;
          }
        }),
      };

      // Return same intensity when gate passes (high correlation on co-pass)
      const mockIntensityCalculator = { computeIntensity: jest.fn(() => 0.7) };

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

      const result = await evaluator.evaluate(protoA, protoB, 100);

      // Co-pass metrics should show high similarity (low diff, high correlation)
      // because when both pass, they have identical intensities
      if (!Number.isNaN(result.intensity.meanAbsDiff)) {
        // eslint-disable-next-line jest/no-conditional-expect
        expect(result.intensity.meanAbsDiff).toBeLessThan(0.1);
      }

      // But globalMeanAbsDiff should be HIGH because 90% of the time
      // one fires (0.7) while the other doesn't fire (0)
      // Average diff should be approximately 0.7 * 0.9 = 0.63
      expect(result.intensity.globalMeanAbsDiff).toBeGreaterThan(0.3);
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================
  describe('edge cases', () => {
    it('handles zero samples gracefully', async () => {
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

      const protoA = { gates: [], weights: {} };
      const protoB = { gates: [], weights: {} };

      // Pass 0 as sample count (should use config default)
      const result = await evaluator.evaluate(protoA, protoB, 0);

      // Should not throw and return valid metrics
      expect(result.intensity).toHaveProperty('globalMeanAbsDiff');
      expect(result.intensity).toHaveProperty('globalL2Distance');
      expect(result.intensity).toHaveProperty('globalOutputCorrelation');
    });

    it('globalOutputCorrelation is NaN when all outputs are identical', async () => {
      // When all outputs are the same, correlation is undefined (NaN)
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

      // When all outputs are constant, correlation is NaN (variance = 0)
      expect(Number.isNaN(result.intensity.globalOutputCorrelation)).toBe(true);
    });
  });
});
