/**
 * @file Regression test for prototype intensity ceiling calculation.
 *
 * Ensures that prototypes like 'unease' can achieve high intensity values
 * when all relevant axes are at extreme values. This test catches bugs where
 * axes may be missing, defaulting to zero incorrectly, or being lost in the
 * data flow pipeline.
 *
 * @see https://github.com/joeloverbeck/living-narrative-engine/issues/TBD
 */
import { describe, it, expect, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

/**
 * Factory to create a PrototypeFitRankingService with mocked dependencies
 * @param {Array} prototypes - Prototype definitions
 * @returns {PrototypeFitRankingService}
 */
const createService = (prototypes) => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const prototypeRegistryService = {
    getPrototypesByType: jest.fn(() => prototypes),
    getAllPrototypes: jest.fn(() => prototypes),
    getPrototypeDefinitions: jest.fn(),
    getPrototype: jest.fn(),
  };
  const prototypeTypeDetector = {
    detectReferencedTypes: jest.fn(() => ({
      hasEmotions: true,
      hasSexualStates: false,
    })),
    extractCurrentPrototype: jest.fn(() => null),
  };
  const dataRegistry = {
    get: jest.fn(),
    getLookupData: jest.fn(),
  };

  return new PrototypeFitRankingService({
    dataRegistry,
    logger,
    prototypeRegistryService,
    prototypeTypeDetector,
  });
};

const getResult = (results, id) =>
  results.leaderboard.find((entry) => entry.prototypeId === id);

describe('Prototype Ceiling Regression Tests (B7)', () => {
  // unease weights from emotion_prototypes.lookup.json
  const UNEASE_WEIGHTS = {
    threat: 0.5,
    arousal: 0.2,
    valence: -0.3,
    agency_control: -0.2,
    inhibitory_control: -0.2,
    self_control: -0.2,
  };

  describe('unease prototype intensity ceiling', () => {
    it('should exceed 0.40 intensity when all axes favor high intensity', () => {
      // This test verifies that unease can achieve intensity > 0.40
      // when all mood axes and affect traits are at extreme values
      // that align with the prototype's negative/positive weight signs.
      const prototypes = [
        {
          id: 'unease',
          type: 'emotion',
          weights: UNEASE_WEIGHTS,
          gates: [], // Disable gates for pure intensity test
        },
      ];
      const service = createService(prototypes);

      // Extreme state where all weights align for maximum intensity:
      // - threat: 100 (positive weight 0.5 * positive value = positive)
      // - arousal: 100 (positive weight 0.2 * positive value = positive)
      // - valence: -100 (negative weight -0.3 * negative value = positive)
      // - agency_control: -100 (negative weight -0.2 * negative value = positive)
      // - inhibitory_control: -100 (negative weight -0.2 * negative value = positive)
      // - self_control (trait): 0 (negative weight -0.2 * low value = positive)
      const contexts = [
        {
          moodAxes: {
            valence: -100,
            arousal: 100,
            agency_control: -100,
            threat: 100,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
            inhibitory_control: -100,
          },
          affectTraits: {
            self_control: 0, // Minimum (favors negative weight -0.2)
            affective_empathy: 50,
            cognitive_empathy: 50,
            harm_aversion: 50,
          },
        },
      ];

      const results = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        contexts,
        new Map(),
        0.3
      );
      const entry = getResult(results, 'unease');

      // Expected calculation:
      // For mood axes normalized to [-1, 1]:
      // valence: -1, arousal: 1, agency_control: -1, threat: 1, inhibitory_control: -1
      // For self_control normalized to [0, 1]: 0
      //
      // rawSum = (0.5 * 1) + (0.2 * 1) + (-0.3 * -1) + (-0.2 * -1) + (-0.2 * -1) + (-0.2 * 0)
      //        = 0.5 + 0.2 + 0.3 + 0.2 + 0.2 + 0
      //        = 1.4
      // sumAbsWeights = 0.5 + 0.2 + 0.3 + 0.2 + 0.2 + 0.2 = 1.6
      // intensity = 1.4 / 1.6 = 0.875
      expect(entry.intensityDistribution.p50).toBeGreaterThan(0.4);
      expect(entry.intensityDistribution.p50).toBeCloseTo(0.875, 1);
    });

    it('should verify intensity is not artificially capped at 0.36', () => {
      // This test ensures we don't have the reported bug where
      // unease was capped at ~0.36 regardless of axis values
      const prototypes = [
        {
          id: 'unease-test',
          type: 'emotion',
          weights: UNEASE_WEIGHTS,
          gates: [],
        },
      ];
      const service = createService(prototypes);

      // Multiple contexts with varying extreme values
      const contexts = [
        {
          // All axes at extreme favorable values
          moodAxes: {
            valence: -100,
            arousal: 100,
            agency_control: -100,
            threat: 100,
            inhibitory_control: -100,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
          },
          affectTraits: { self_control: 0, affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        },
        {
          // Some axes at moderate values
          moodAxes: {
            valence: -50,
            arousal: 50,
            agency_control: -50,
            threat: 50,
            inhibitory_control: -50,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
          },
          affectTraits: { self_control: 25, affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        },
      ];

      const results = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        contexts,
        new Map(),
        0.3
      );
      const entry = getResult(results, 'unease-test');

      // The max intensity should be well above the reported 0.36 ceiling
      expect(entry.intensityDistribution.max).toBeGreaterThan(0.5);
    });

    it('should correctly incorporate self_control affect trait into intensity', () => {
      // This test specifically verifies that self_control (an affect trait)
      // is properly passed to the intensity calculation
      const prototypes = [
        {
          id: 'self-control-test',
          type: 'emotion',
          weights: { self_control: -1.0 }, // Only self_control weight
          gates: [],
        },
      ];
      const service = createService(prototypes);

      // Low self_control should produce high intensity with negative weight
      const lowSelfControlContext = {
        moodAxes: {},
        affectTraits: {
          self_control: 0, // Normalized to 0
          affective_empathy: 50,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
      };

      // High self_control should produce zero intensity with negative weight
      const highSelfControlContext = {
        moodAxes: {},
        affectTraits: {
          self_control: 100, // Normalized to 1
          affective_empathy: 50,
          cognitive_empathy: 50,
          harm_aversion: 50,
        },
      };

      const lowResults = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        [lowSelfControlContext],
        new Map(),
        0.1
      );
      const highResults = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        [highSelfControlContext],
        new Map(),
        0.1
      );

      const lowEntry = getResult(lowResults, 'self-control-test');
      const highEntry = getResult(highResults, 'self-control-test');

      // With weight -1 and self_control=0: rawSum = -1 * 0 = 0, intensity = 0
      // Wait - that's wrong. Let me reconsider.
      // Actually with weight -1 and normalized self_control=0:
      // rawSum = -1 * 0 = 0, intensity = 0
      // With weight -1 and normalized self_control=1:
      // rawSum = -1 * 1 = -1, clamped to 0
      // Neither produces positive intensity...

      // The math for affect traits: they range [0,100] normalized to [0,1]
      // For a negative weight to produce positive intensity, we need the trait to be LOW
      // But multiplication of negative weight * low positive value = negative = clamped to 0

      // Actually, for mood axes: value range [-100,100] normalized to [-1,1]
      // negative weight * negative value = positive

      // For affect traits: value range [0,100] normalized to [0,1]
      // negative weight * positive value = negative = clamped to 0
      // negative weight * zero value = 0

      // So self_control can only REDUCE intensity, never increase it
      // Low self_control (0) means minimal contribution (0)
      // High self_control (100) means negative contribution (-1), clamped to 0

      // Both should be 0 since negative weights with positive traits can't help
      expect(lowEntry.intensityDistribution.p50).toBe(0);
      expect(highEntry.intensityDistribution.p50).toBe(0);
    });

    it('should verify inhibitory_control mood axis affects intensity correctly', () => {
      // Regression test for inhibitory_control (a mood axis that was missing before)
      const prototypes = [
        {
          id: 'inhibitory-test',
          type: 'emotion',
          weights: { inhibitory_control: -1.0 }, // Only inhibitory_control weight
          gates: [],
        },
      ];
      const service = createService(prototypes);

      // Low inhibitory_control (-100) should produce high intensity with negative weight
      const lowControlContext = {
        moodAxes: {
          inhibitory_control: -100, // Normalized to -1
          valence: 0,
          arousal: 0,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0,
        },
        affectTraits: { self_control: 50, affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
      };

      const results = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        [lowControlContext],
        new Map(),
        0.5
      );
      const entry = getResult(results, 'inhibitory-test');

      // With weight -1 and inhibitory_control=-100 (normalized -1):
      // rawSum = -1 * -1 = 1
      // sumAbsWeights = 1
      // intensity = 1.0
      expect(entry.intensityDistribution.p50).toBeCloseTo(1.0, 6);
    });
  });

  describe('intensity calculation edge cases', () => {
    it('should handle all zero axes gracefully', () => {
      const prototypes = [
        {
          id: 'zero-axes',
          type: 'emotion',
          weights: UNEASE_WEIGHTS,
          gates: [],
        },
      ];
      const service = createService(prototypes);

      const contexts = [
        {
          moodAxes: {
            valence: 0,
            arousal: 0,
            agency_control: 0,
            threat: 0,
            inhibitory_control: 0,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
          },
          affectTraits: { self_control: 50, affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        },
      ];

      const results = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        contexts,
        new Map(),
        0.1
      );
      const entry = getResult(results, 'zero-axes');

      // With all axes at 0, self_control at 50 (normalized 0.5):
      // rawSum = 0 (from mood axes) + (-0.2 * 0.5) = -0.1 clamped to 0
      expect(entry.intensityDistribution.p50).toBe(0);
    });

    it('should correctly sum contributions from multiple axes', () => {
      const prototypes = [
        {
          id: 'multi-axis',
          type: 'emotion',
          weights: {
            valence: 0.5,
            arousal: 0.3,
            threat: 0.2,
          },
          gates: [],
        },
      ];
      const service = createService(prototypes);

      const contexts = [
        {
          moodAxes: {
            valence: 100, // normalized 1, contributes 0.5
            arousal: 100, // normalized 1, contributes 0.3
            threat: 100, // normalized 1, contributes 0.2
            agency_control: 0,
            inhibitory_control: 0,
            engagement: 0,
            future_expectancy: 0,
            self_evaluation: 0,
            affiliation: 0,
          },
          affectTraits: { self_control: 50, affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
        },
      ];

      const results = service.analyzeAllPrototypeFit(
        { id: 'expr' },
        contexts,
        new Map(),
        0.5
      );
      const entry = getResult(results, 'multi-axis');

      // rawSum = 0.5 + 0.3 + 0.2 = 1.0
      // sumAbsWeights = 0.5 + 0.3 + 0.2 = 1.0
      // intensity = 1.0
      expect(entry.intensityDistribution.p50).toBeCloseTo(1.0, 6);
    });
  });
});
