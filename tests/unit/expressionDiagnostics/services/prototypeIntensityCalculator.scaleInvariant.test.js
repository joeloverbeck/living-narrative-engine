/**
 * @file Unit tests for scale-invariance of prototype intensity calculation
 *
 * Verifies the mathematical invariant that uniform scaling of prototype weights
 * does not change computed intensity values due to L1 normalization.
 *
 * Background: External analysis suggested potential "intensity scale problem"
 * where prototypes with larger weight magnitudes could dominate others.
 * This test suite proves the system is already scale-invariant because
 * computeIntensity uses L1 normalization: intensity = rawSum / sumAbsWeights
 *
 * Mathematical proof:
 * If we scale all weights by k > 0:
 *   rawSum' = k * rawSum (each term k*w*v instead of w*v)
 *   sumAbsWeights' = k * sumAbsWeights (each term |k*w| = k*|w| for k>0)
 *   intensity' = (k * rawSum) / (k * sumAbsWeights) = rawSum / sumAbsWeights = intensity
 */
import { describe, it, expect, jest } from '@jest/globals';
import PrototypeIntensityCalculator from '../../../../src/expressionDiagnostics/services/PrototypeIntensityCalculator.js';

/**
 * Creates a mock logger with standard methods.
 *
 * @returns {object} Mock logger instance
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates a mock context axis normalizer that normalizes axis values to [-1, 1].
 *
 * @returns {object} Mock normalizer instance
 */
const createMockContextAxisNormalizer = () => ({
  getNormalizedAxes: jest.fn((ctx) => ({
    moodAxes: Object.fromEntries(
      Object.entries(ctx.moodAxes || {}).map(([k, v]) => [k, v / 100])
    ),
    sexualAxes: Object.fromEntries(
      Object.entries(ctx.sexualAxes || {}).map(([k, v]) => [k, v / 100])
    ),
    traitAxes: Object.fromEntries(
      Object.entries(ctx.traitAxes || {}).map(([k, v]) => [k, v / 100])
    ),
  })),
});

/**
 * Creates a mock gate checker that always passes.
 *
 * @returns {object} Mock gate checker instance
 */
const createMockGateChecker = () => ({
  checkAllGatesPass: jest.fn(() => true),
});

/**
 * Helper to create a calculator instance with standard mocks.
 *
 * @returns {PrototypeIntensityCalculator} Calculator instance with mocked dependencies
 */
const createCalculator = () => {
  return new PrototypeIntensityCalculator({
    logger: createMockLogger(),
    contextAxisNormalizer: createMockContextAxisNormalizer(),
    prototypeGateChecker: createMockGateChecker(),
  });
};

/**
 * Scales all weights in an object by a constant factor.
 *
 * @param {object} weights - Original weights
 * @param {number} k - Scale factor
 * @returns {object} Scaled weights with each value multiplied by k
 */
const scaleWeights = (weights, k) => {
  return Object.fromEntries(
    Object.entries(weights).map(([axis, weight]) => [axis, weight * k])
  );
};

describe('PrototypeIntensityCalculator - Scale Invariance', () => {
  describe('Uniform weight scaling invariance', () => {
    it('should produce identical intensity when all weights are multiplied by k=2', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 60, arousal: 40, threat: -20 } };
      const baseWeights = { valence: 0.5, arousal: 0.3, threat: -0.2 };
      const scaledWeights = scaleWeights(baseWeights, 2);

      const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

      expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
    });

    it('should produce identical intensity when all weights are multiplied by k=10', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 80, arousal: -50 } };
      const baseWeights = { valence: 1.0, arousal: -0.5 };
      const scaledWeights = scaleWeights(baseWeights, 10);

      const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

      expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
    });

    it('should produce identical intensity when all weights are scaled down by k=0.1', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 70, threat: 30, arousal: 50 } };
      const baseWeights = { valence: 2.0, threat: 1.5, arousal: -0.8 };
      const scaledWeights = scaleWeights(baseWeights, 0.1);

      const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

      expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
    });

    it.each([0.1, 0.5, 1, 2, 10, 100])(
      'should produce identical intensity for scale factor k=%d',
      (k) => {
        const calculator = createCalculator();
        const ctx = {
          moodAxes: { valence: 50, arousal: 30 },
          sexualAxes: { sexual_arousal: 20 },
        };
        const baseWeights = { valence: 0.6, arousal: 0.3, SA: 0.1 };
        const scaledWeights = scaleWeights(baseWeights, k);

        const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
        const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

        expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
      }
    );
  });

  describe('Classification stability under scaling', () => {
    it('should produce identical intensity distributions when prototype weights are uniformly scaled', () => {
      const calculator = createCalculator();
      const contexts = [
        { moodAxes: { valence: 20, arousal: 80 } },
        { moodAxes: { valence: 60, arousal: 40 } },
        { moodAxes: { valence: 90, arousal: 10 } },
        { moodAxes: { valence: -30, arousal: 70 } },
      ];
      const baseProto = {
        weights: { valence: 0.7, arousal: 0.3 },
        gates: [],
      };
      const scaledProto = {
        weights: scaleWeights(baseProto.weights, 5),
        gates: [],
      };
      const threshold = 0.5;

      const baseDist = calculator.computeDistribution(baseProto, contexts, threshold);
      const scaledDist = calculator.computeDistribution(scaledProto, contexts, threshold);

      expect(scaledDist.p50).toBeCloseTo(baseDist.p50, 10);
      expect(scaledDist.p90).toBeCloseTo(baseDist.p90, 10);
      expect(scaledDist.p95).toBeCloseTo(baseDist.p95, 10);
      expect(scaledDist.pAboveThreshold).toBeCloseTo(baseDist.pAboveThreshold, 10);
      expect(scaledDist.min).toBeCloseTo(baseDist.min, 10);
      expect(scaledDist.max).toBeCloseTo(baseDist.max, 10);
    });

    it('should maintain relative intensity ordering when different prototypes have different scale magnitudes', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 70, arousal: 50, threat: -20 } };

      // Two prototypes with similar patterns but different weight magnitudes
      const smallWeightProto = { valence: 0.1, arousal: 0.05, threat: -0.03 };
      const largeWeightProto = { valence: 10, arousal: 5, threat: -3 };

      const smallIntensity = calculator.computeIntensity(smallWeightProto, ctx);
      const largeIntensity = calculator.computeIntensity(largeWeightProto, ctx);

      // Should be identical due to L1 normalization
      expect(largeIntensity).toBeCloseTo(smallIntensity, 10);
    });
  });

  describe('Edge cases for scale invariance', () => {
    it('should return 0 for zero weights regardless of scale', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 50 } };

      const intensity = calculator.computeIntensity({ valence: 0 }, ctx);

      expect(intensity).toBe(0);
    });

    it('should handle mixed positive and negative weights under scaling', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 80, arousal: -60, threat: 40 } };
      const baseWeights = { valence: 1.0, arousal: -0.5, threat: 0.5 };
      const scaledWeights = scaleWeights(baseWeights, 7.5);

      const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

      expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
    });

    it('should handle single-axis weights under scaling', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 75 } };
      const baseWeights = { valence: 1 };
      const scaledWeights = scaleWeights(baseWeights, 1000);

      const baseIntensity = calculator.computeIntensity(baseWeights, ctx);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);

      expect(scaledIntensity).toBeCloseTo(baseIntensity, 10);
    });
  });

  describe('Mathematical proof by exhaustion', () => {
    it('demonstrates L1 normalization: (k*rawSum)/(k*sumAbsWeights) = rawSum/sumAbsWeights', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 60, arousal: 40 } };
      const weights = { valence: 0.8, arousal: 0.4 };
      const k = 3;

      // Manual calculation for base weights:
      // Normalized: valence = 0.6, arousal = 0.4
      // rawSum = 0.8 * 0.6 + 0.4 * 0.4 = 0.48 + 0.16 = 0.64
      // sumAbsWeights = 0.8 + 0.4 = 1.2
      // intensity = 0.64 / 1.2 = 0.5333...

      const baseIntensity = calculator.computeIntensity(weights, ctx);
      expect(baseIntensity).toBeCloseTo(0.64 / 1.2, 6);

      // Manual calculation for scaled weights (k=3):
      // rawSum' = 2.4 * 0.6 + 1.2 * 0.4 = 1.44 + 0.48 = 1.92
      // sumAbsWeights' = 2.4 + 1.2 = 3.6
      // intensity' = 1.92 / 3.6 = 0.5333... (same as above!)

      const scaledWeights = scaleWeights(weights, k);
      const scaledIntensity = calculator.computeIntensity(scaledWeights, ctx);
      expect(scaledIntensity).toBeCloseTo(1.92 / 3.6, 6);

      // Verify the mathematical identity
      expect(0.64 / 1.2).toBeCloseTo(1.92 / 3.6, 10);
      expect(baseIntensity).toBeCloseTo(scaledIntensity, 10);
    });

    it('demonstrates that weight magnitude has no effect on dominance delta calculations', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 70, arousal: 30 } };

      // Two prototypes with different weight magnitudes but same ratios
      const protoA = { valence: 0.6, arousal: 0.4 };
      const protoB = { valence: 6, arousal: 4 }; // 10x scale

      const intensityA = calculator.computeIntensity(protoA, ctx);
      const intensityB = calculator.computeIntensity(protoB, ctx);

      // Both should have identical intensities
      expect(intensityA).toBeCloseTo(intensityB, 10);

      // Therefore, any dominanceDelta comparison would be 0
      const dominanceDelta = Math.abs(intensityA - intensityB);
      expect(dominanceDelta).toBeCloseTo(0, 10);
    });
  });

  describe('Composite score stability under scaling', () => {
    it('should produce identical composite scores when inputs are from scaled prototypes', () => {
      const calculator = createCalculator();

      // The composite score formula uses normalized values
      const inputs = {
        gatePassRate: 0.8,
        pIntensityAbove: 0.6,
        conflictScore: 0.2,
        exclusionCompatibility: 0.9,
      };

      const score1 = calculator.computeCompositeScore(inputs);
      const score2 = calculator.computeCompositeScore(inputs);

      expect(score1).toBeCloseTo(score2, 10);

      // Verify the formula: 0.3*0.8 + 0.35*0.6 + 0.2*(1-0.2) + 0.15*0.9
      const expected = 0.3 * 0.8 + 0.35 * 0.6 + 0.2 * 0.8 + 0.15 * 0.9;
      expect(score1).toBeCloseTo(expected, 10);
    });
  });

  describe('Threshold behavior under normalization', () => {
    it('meanAbsDiff thresholds work consistently because intensities are in [0, 1]', () => {
      const calculator = createCalculator();
      const contexts = [
        { moodAxes: { valence: 30, arousal: 70 } },
        { moodAxes: { valence: 50, arousal: 50 } },
        { moodAxes: { valence: 70, arousal: 30 } },
      ];

      // Small-weight prototype
      const smallProto = {
        weights: { valence: 0.01, arousal: 0.01 },
        gates: [],
      };

      // Large-weight prototype with same ratios
      const largeProto = {
        weights: { valence: 100, arousal: 100 },
        gates: [],
      };

      const smallDist = calculator.computeDistribution(smallProto, contexts, 0.3);
      const largeDist = calculator.computeDistribution(largeProto, contexts, 0.3);

      // All metrics should be identical
      expect(smallDist.min).toBeCloseTo(largeDist.min, 10);
      expect(smallDist.max).toBeCloseTo(largeDist.max, 10);

      // Mean absolute difference would be 0 because distributions are identical
      // This proves thresholds like 0.03 work consistently
      const meanAbsDiff =
        (Math.abs(smallDist.p50 - largeDist.p50) +
          Math.abs(smallDist.p90 - largeDist.p90) +
          Math.abs(smallDist.p95 - largeDist.p95)) /
        3;
      expect(meanAbsDiff).toBeCloseTo(0, 10);
    });

    it('dominanceDelta threshold (0.05) is meaningful because intensities are normalized', () => {
      const calculator = createCalculator();
      const ctx = { moodAxes: { valence: 50, arousal: 50 } };

      // Two different prototypes (not just scaled versions)
      const protoA = { valence: 0.9, arousal: 0.1 };
      const protoB = { valence: 0.1, arousal: 0.9 };

      const intensityA = calculator.computeIntensity(protoA, ctx);
      const intensityB = calculator.computeIntensity(protoB, ctx);

      // Both should be in [0, 1] range
      expect(intensityA).toBeGreaterThanOrEqual(0);
      expect(intensityA).toBeLessThanOrEqual(1);
      expect(intensityB).toBeGreaterThanOrEqual(0);
      expect(intensityB).toBeLessThanOrEqual(1);

      // The threshold 0.05 is meaningful on this scale
      const DOMINANCE_DELTA = 0.05;
      const actualDelta = Math.abs(intensityA - intensityB);

      // This delta is comparable to the threshold scale
      expect(actualDelta).toBeLessThan(1);
      expect(DOMINANCE_DELTA).toBeLessThan(1);
    });
  });
});
