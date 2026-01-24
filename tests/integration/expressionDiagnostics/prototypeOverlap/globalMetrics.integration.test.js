/**
 * @file Lightweight integration tests for global output metrics computation
 * Tests BehavioralOverlapEvaluator service with minimal mocked dependencies.
 * Uses low sample counts for fast execution while validating structure and ranges.
 *
 * For full E2E validation with production bootstrap, see:
 * @see tests/e2e/expressions/diagnostics/globalMetrics.e2e.test.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BehavioralOverlapEvaluator from '../../../../src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js';

/**
 * Creates a mock logger with all required methods.
 *
 * @returns {object} Mock logger
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

/**
 * Creates a mock prototype intensity calculator.
 *
 * @param {number} defaultIntensity - Default intensity to return
 * @returns {object} Mock intensity calculator
 */
const createMockIntensityCalculator = (defaultIntensity = 0.5) => ({
  computeIntensity: jest.fn().mockReturnValue(defaultIntensity),
});

/**
 * Creates a mock random state generator.
 *
 * @param {object[]} states - Array of states to return in sequence
 * @returns {object} Mock state generator
 */
const createMockRandomStateGenerator = (states = []) => {
  let index = 0;
  const defaultState = {
    current: { valence: 0, arousal: 0.3, engagement: 0.2 },
    previous: { valence: 0, arousal: 0, engagement: 0 },
    affectTraits: {},
  };

  return {
    generate: jest.fn(() => {
      if (states.length > 0 && index < states.length) {
        return states[index++];
      }
      return defaultState;
    }),
  };
};

/**
 * Creates a mock context builder.
 *
 * @returns {object} Mock context builder
 */
const createMockContextBuilder = () => ({
  buildContext: jest.fn(
    (current, previous, affectTraits) => ({
      moodAxes: current || { valence: 0, arousal: 0.3 },
      previousMoodAxes: previous || { valence: 0, arousal: 0 },
      emotions: {},
      sexualStates: {},
    })
  ),
});

/**
 * Creates a mock prototype gate checker.
 *
 * @param {boolean} passA - Whether prototype A gates pass
 * @param {boolean} passB - Whether prototype B gates pass
 * @returns {object} Mock gate checker
 */
const createMockGateChecker = (passA = true, passB = true) => {
  let callCount = 0;
  return {
    checkAllGatesPass: jest.fn((gates) => {
      // Alternate between A and B based on call order
      callCount++;
      // Odd calls are for A, even for B (in each iteration)
      if (callCount % 2 === 1) {
        return passA;
      }
      return passB;
    }),
  };
};

/**
 * Creates a mock gate constraint extractor.
 *
 * @returns {object} Mock extractor
 */
const createMockGateConstraintExtractor = () => ({
  extract: jest.fn(() => ({
    parseStatus: 'complete',
    intervals: [],
    unparsedGates: [],
  })),
});

/**
 * Creates a mock gate implication evaluator.
 *
 * @returns {object} Mock evaluator
 */
const createMockGateImplicationEvaluator = () => ({
  evaluate: jest.fn(() => ({
    relation: 'independent',
    direction: null,
    confidence: 0,
  })),
});

/**
 * Creates default config for BehavioralOverlapEvaluator.
 *
 * @returns {object} Config object
 */
const createDefaultConfig = () => ({
  sampleCountPerPair: 10,
  divergenceExamplesK: 3,
  dominanceDelta: 0.05,
  intensityEps: 0.05,
  minCoPassSamples: 1,
  minPassSamplesForConditional: 5,
  highThresholds: [0.4, 0.6, 0.75],
});

/**
 * Test prototypes with overlapping gates.
 */
const OVERLAPPING_PROTOTYPES = {
  a: {
    weights: { valence: 0.5, arousal: 0.5 },
    gates: ['arousal <= 0.40'],
  },
  b: {
    weights: { valence: 0.45, arousal: 0.55 },
    gates: ['arousal <= 0.42'],
  },
};

describe('BehavioralOverlapEvaluator - Global Metrics Structure', () => {
  let evaluator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    evaluator = new BehavioralOverlapEvaluator({
      prototypeIntensityCalculator: createMockIntensityCalculator(0.5),
      randomStateGenerator: createMockRandomStateGenerator(),
      contextBuilder: createMockContextBuilder(),
      prototypeGateChecker: createMockGateChecker(true, true),
      gateConstraintExtractor: createMockGateConstraintExtractor(),
      gateImplicationEvaluator: createMockGateImplicationEvaluator(),
      config: createDefaultConfig(),
      logger: mockLogger,
    });
  });

  describe('global metrics presence', () => {
    it('returns intensity object with global metrics fields', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result).toHaveProperty('intensity');
      expect(result.intensity).toHaveProperty('globalMeanAbsDiff');
      expect(result.intensity).toHaveProperty('globalL2Distance');
      expect(result.intensity).toHaveProperty('globalOutputCorrelation');
    });

    it('globalMeanAbsDiff is a number', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(typeof result.intensity.globalMeanAbsDiff).toBe('number');
    });

    it('globalL2Distance is a number', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(typeof result.intensity.globalL2Distance).toBe('number');
    });

    it('globalOutputCorrelation is a number', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(typeof result.intensity.globalOutputCorrelation).toBe('number');
    });
  });

  describe('global metrics value ranges', () => {
    it('globalMeanAbsDiff is in range [0, 1] when not NaN', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        20
      );

      if (!Number.isNaN(result.intensity.globalMeanAbsDiff)) {
        expect(result.intensity.globalMeanAbsDiff).toBeGreaterThanOrEqual(0);
        expect(result.intensity.globalMeanAbsDiff).toBeLessThanOrEqual(1);
      }
    });

    it('globalL2Distance is non-negative when not NaN', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        20
      );

      if (!Number.isNaN(result.intensity.globalL2Distance)) {
        expect(result.intensity.globalL2Distance).toBeGreaterThanOrEqual(0);
      }
    });

    it('globalOutputCorrelation is in range [-1, 1] when not NaN', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        20
      );

      if (!Number.isNaN(result.intensity.globalOutputCorrelation)) {
        expect(result.intensity.globalOutputCorrelation).toBeGreaterThanOrEqual(-1);
        expect(result.intensity.globalOutputCorrelation).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('co-pass metrics structure', () => {
    it('returns pearsonCorrelation in intensity object', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result.intensity).toHaveProperty('pearsonCorrelation');
      expect(typeof result.intensity.pearsonCorrelation).toBe('number');
    });

    it('returns meanAbsDiff in intensity object', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result.intensity).toHaveProperty('meanAbsDiff');
    });

    it('returns rmse in intensity object', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result.intensity).toHaveProperty('rmse');
    });
  });

  describe('gateOverlap structure', () => {
    it('returns gateOverlap with required fields', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result).toHaveProperty('gateOverlap');
      expect(result.gateOverlap).toHaveProperty('onEitherRate');
      expect(result.gateOverlap).toHaveProperty('onBothRate');
      expect(result.gateOverlap).toHaveProperty('pOnlyRate');
      expect(result.gateOverlap).toHaveProperty('qOnlyRate');
    });

    it('gateOverlap rates are in range [0, 1]', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result.gateOverlap.onEitherRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.onEitherRate).toBeLessThanOrEqual(1);
      expect(result.gateOverlap.onBothRate).toBeGreaterThanOrEqual(0);
      expect(result.gateOverlap.onBothRate).toBeLessThanOrEqual(1);
    });
  });

  describe('passRates structure', () => {
    it('returns passRates with required fields', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result).toHaveProperty('passRates');
      expect(result.passRates).toHaveProperty('passARate');
      expect(result.passRates).toHaveProperty('passBRate');
      expect(result.passRates).toHaveProperty('pA_given_B');
      expect(result.passRates).toHaveProperty('pB_given_A');
      expect(result.passRates).toHaveProperty('coPassCount');
    });
  });

  describe('highCoactivation structure', () => {
    it('returns highCoactivation with thresholds array', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      expect(result).toHaveProperty('highCoactivation');
      expect(result.highCoactivation).toHaveProperty('thresholds');
      expect(Array.isArray(result.highCoactivation.thresholds)).toBe(true);
    });

    it('each threshold has required metrics', async () => {
      const result = await evaluator.evaluate(
        OVERLAPPING_PROTOTYPES.a,
        OVERLAPPING_PROTOTYPES.b,
        10
      );

      for (const threshold of result.highCoactivation.thresholds) {
        expect(threshold).toHaveProperty('t');
        expect(threshold).toHaveProperty('pHighA');
        expect(threshold).toHaveProperty('pHighB');
        expect(threshold).toHaveProperty('pHighBoth');
        expect(threshold).toHaveProperty('highJaccard');
        expect(threshold).toHaveProperty('highAgreement');
      }
    });
  });
});

describe('BehavioralOverlapEvaluator - Exclusive Gates Behavior', () => {
  it('produces low onBothRate when gates are exclusive', async () => {
    const mockLogger = createMockLogger();

    // Create gate checker that alternates: A passes, B fails, A fails, B passes
    let callCount = 0;
    const exclusiveGateChecker = {
      checkAllGatesPass: jest.fn(() => {
        callCount++;
        // Pattern: A passes (odd, return true), B fails (even, return false)
        // then A fails, B passes - simulating exclusive gates
        const sampleIndex = Math.floor((callCount - 1) / 2);
        const isCallForA = callCount % 2 === 1;
        if (sampleIndex % 2 === 0) {
          return isCallForA; // A passes, B fails
        }
        return !isCallForA; // A fails, B passes
      }),
    };

    const evaluator = new BehavioralOverlapEvaluator({
      prototypeIntensityCalculator: createMockIntensityCalculator(0.5),
      randomStateGenerator: createMockRandomStateGenerator(),
      contextBuilder: createMockContextBuilder(),
      prototypeGateChecker: exclusiveGateChecker,
      gateConstraintExtractor: createMockGateConstraintExtractor(),
      gateImplicationEvaluator: createMockGateImplicationEvaluator(),
      config: createDefaultConfig(),
      logger: mockLogger,
    });

    const result = await evaluator.evaluate(
      { weights: { arousal: 0.8 }, gates: ['arousal >= 0.70'] },
      { weights: { arousal: -0.8 }, gates: ['arousal <= 0.30'] },
      10
    );

    // With exclusive gates, onBothRate should be 0
    expect(result.gateOverlap.onBothRate).toBe(0);
  });

  it('produces high onBothRate when gates always overlap', async () => {
    const mockLogger = createMockLogger();

    // Gates always pass for both
    const alwaysPassGateChecker = {
      checkAllGatesPass: jest.fn(() => true),
    };

    const evaluator = new BehavioralOverlapEvaluator({
      prototypeIntensityCalculator: createMockIntensityCalculator(0.5),
      randomStateGenerator: createMockRandomStateGenerator(),
      contextBuilder: createMockContextBuilder(),
      prototypeGateChecker: alwaysPassGateChecker,
      gateConstraintExtractor: createMockGateConstraintExtractor(),
      gateImplicationEvaluator: createMockGateImplicationEvaluator(),
      config: createDefaultConfig(),
      logger: mockLogger,
    });

    const result = await evaluator.evaluate(
      OVERLAPPING_PROTOTYPES.a,
      OVERLAPPING_PROTOTYPES.b,
      10
    );

    // With overlapping gates, onBothRate should be 1.0
    expect(result.gateOverlap.onBothRate).toBe(1.0);
  });
});
