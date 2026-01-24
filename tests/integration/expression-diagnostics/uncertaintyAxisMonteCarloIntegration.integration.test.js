/**
 * @file Integration tests proving Monte Carlo correctly incorporates uncertainty axis
 * Verifies uncertainty weights, gates, and statistical impact across the simulation pipeline.
 * @see UNCMOOAXI-007
 * @see specs/uncertainty-mood-axis.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

// =============================================================================
// TEST FIXTURES - Controlled Uncertainty Prototypes
// =============================================================================

/**
 * Simplified prototypes isolating uncertainty for precise testing.
 * These mirror real emotion structures but minimize confounding variables.
 */
const uncertaintyTestPrototypes = {
  emotions: {
    // Pure uncertainty: weight=1.0, gate=uncertainty>=0.30
    confusion: {
      weights: { uncertainty: 1.0, engagement: 0.4, arousal: 0.2 },
      gates: ['uncertainty >= 0.30'],
    },
    // Negative uncertainty: weight=-0.8, gate=uncertainty<=0.20
    confidence: {
      weights: {
        agency_control: 0.5,
        threat: -0.8,
        uncertainty: -0.8,
      },
      gates: ['agency_control >= 0.10', 'uncertainty <= 0.20'],
    },
    // Strict low uncertainty gate: uncertainty<=0.10
    flow: {
      weights: {
        engagement: 1.0,
        uncertainty: -0.5,
      },
      gates: ['engagement >= 0.40', 'uncertainty <= 0.10'],
    },
    // No uncertainty (control)
    joy: {
      weights: { valence: 1.0 },
      gates: ['valence >= 0.35'],
    },
    // Multi-gate including uncertainty
    anxiety: {
      weights: {
        threat: 0.9,
        uncertainty: 0.8,
      },
      gates: ['threat >= 0.20', 'uncertainty >= 0.15'],
    },
    // Curiosity with positive uncertainty weight, no uncertainty gate
    curiosity: {
      weights: {
        uncertainty: 0.7,
        engagement: 0.9,
        valence: 0.3,
      },
      gates: ['engagement >= 0.20'],
    },
  },
  sexualStates: {},
};

// =============================================================================
// TEST EXPRESSIONS
// =============================================================================

const highUncertaintyExpression = {
  id: 'test:high_uncertainty_req',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.confusion' }, 0.5] } }],
};

const lowUncertaintyExpression = {
  id: 'test:low_uncertainty_req',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.confidence' }, 0.5] } }],
};

const veryLowUncertaintyExpression = {
  id: 'test:very_low_uncertainty_req',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.flow' }, 0.4] } }],
};

// Note: moodAxes uses raw values (-100 to 100), not normalized (-1 to 1)
const directUncertaintyAxisExpression = {
  id: 'test:direct_uncertainty_axis',
  prerequisites: [{ logic: { '>=': [{ var: 'moodAxes.uncertainty' }, 25] } }],
};

const controlNoUncertaintyExpression = {
  id: 'test:control_no_uncertainty',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } }],
};

const multiGateUncertaintyExpression = {
  id: 'test:multi_gate_uncertainty',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.anxiety' }, 0.4] } }],
};

const pureWeightNoGateExpression = {
  id: 'test:pure_weight_no_gate',
  prerequisites: [{ logic: { '>=': [{ var: 'emotions.curiosity' }, 0.4] } }],
};

const temporalUncertaintyExpression = {
  id: 'test:temporal_uncertainty',
  prerequisites: [
    {
      logic: {
        '>': [
          { var: 'moodAxes.uncertainty' },
          { var: 'previousMoodAxes.uncertainty' },
        ],
      },
    },
  ],
};

// =============================================================================
// TEST SETUP UTILITIES
// =============================================================================

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDataRegistry = (logger, prototypes = uncertaintyTestPrototypes) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: prototypes.emotions,
  });
  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: prototypes.sexualStates,
  });
  return registry;
};

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

const buildRandomStateGenerator = (samples) => {
  let index = 0;
  return {
    generate: jest.fn(() => {
      const sample = samples[Math.min(index, samples.length - 1)];
      index += 1;
      return sample;
    }),
  };
};

const buildSimulator = ({ samples, prototypes = uncertaintyTestPrototypes }) => {
  const logger = createLogger();
  const dataRegistry = createDataRegistry(logger, prototypes);
  const emotionCalculatorAdapter = buildEmotionCalculatorAdapter(
    dataRegistry,
    logger
  );
  const randomStateGenerator = buildRandomStateGenerator(samples);

  const simulator = new MonteCarloSimulator({
    dataRegistry,
    logger,
    emotionCalculatorAdapter,
    randomStateGenerator,
  });

  return { simulator, logger };
};

// Base mood state with all 10 axes including uncertainty
const BASE_MOOD = {
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
  uncertainty: 0,
};

const BASE_SEXUAL = {
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
};

const BASE_TRAITS = {
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
};

const buildSample = ({
  mood = {},
  sexual = {},
  previousMood = {},
  previousSexual = {},
  affectTraits = {},
} = {}) => ({
  current: {
    mood: { ...BASE_MOOD, ...mood },
    sexual: { ...BASE_SEXUAL, ...sexual },
  },
  previous: {
    mood: { ...BASE_MOOD, ...previousMood },
    sexual: { ...BASE_SEXUAL, ...previousSexual },
  },
  affectTraits: { ...BASE_TRAITS, ...affectTraits },
});

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Uncertainty Axis Monte Carlo Integration', () => {
  describe('Stored Context Verification', () => {
    it('should include uncertainty in storedContexts[].moodAxes', async () => {
      const sample = buildSample({ mood: { uncertainty: 50 } });
      const { simulator } = buildSimulator({ samples: [sample] });

      const result = await simulator.simulate(directUncertaintyAxisExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      expect(result.storedContexts).toHaveLength(1);
      expect(result.storedContexts[0].moodAxes).toHaveProperty('uncertainty');
      // Note: moodAxes stores raw values (not normalized), so 50 not 0.5
      expect(result.storedContexts[0].moodAxes.uncertainty).toBe(50);
    });

    it('should include uncertainty in both current and previous moodAxes', async () => {
      const sample = buildSample({
        mood: { uncertainty: 60 },
        previousMood: { uncertainty: 30 },
      });
      const { simulator } = buildSimulator({ samples: [sample] });

      const result = await simulator.simulate(temporalUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      // moodAxes stores raw values (not normalized)
      expect(result.storedContexts[0].moodAxes.uncertainty).toBe(60);
      expect(result.storedContexts[0].previousMoodAxes.uncertainty).toBe(30);
    });

    it('should include uncertainty gate evaluations in gateTrace when enabled', async () => {
      const sample = buildSample({
        mood: { uncertainty: 50, engagement: 50, arousal: 50 },
      });
      const { simulator } = buildSimulator({ samples: [sample] });

      const result = await simulator.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      // Stored context should have gateTrace with emotion calculations
      const context = result.storedContexts[0];
      expect(context).toBeDefined();
      expect(context.gateTrace).toBeDefined();
      expect(context.gateTrace.emotions).toBeDefined();
    });
  });

  describe('Uncertainty Weight Effects', () => {
    it('should calculate higher confusion score with high uncertainty (positive weight)', async () => {
      const highUncertaintySample = buildSample({
        mood: { uncertainty: 80, engagement: 50, arousal: 30 },
      });
      const lowUncertaintySample = buildSample({
        mood: { uncertainty: 0, engagement: 50, arousal: 30 },
      });
      const { simulator: highSim } = buildSimulator({
        samples: [highUncertaintySample],
      });
      const { simulator: lowSim } = buildSimulator({
        samples: [lowUncertaintySample],
      });

      const highResult = await highSim.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const lowResult = await lowSim.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const highConfusion = highResult.storedContexts[0].emotions.confusion ?? 0;
      const lowConfusion = lowResult.storedContexts[0].emotions.confusion ?? 0;

      // High uncertainty should produce higher confusion
      expect(highConfusion).toBeGreaterThan(lowConfusion);
    });

    it('should calculate higher confidence score with low uncertainty (negative weight)', async () => {
      const lowUncertaintySample = buildSample({
        mood: { uncertainty: -50, agency_control: 50, threat: -50 },
      });
      const highUncertaintySample = buildSample({
        mood: { uncertainty: 50, agency_control: 50, threat: -50 },
      });
      const { simulator: lowSim } = buildSimulator({
        samples: [lowUncertaintySample],
      });
      const { simulator: highSim } = buildSimulator({
        samples: [highUncertaintySample],
      });

      const lowResult = await lowSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const highResult = await highSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const lowUncertaintyConfidence =
        lowResult.storedContexts[0].emotions.confidence ?? 0;
      const highUncertaintyConfidence =
        highResult.storedContexts[0].emotions.confidence ?? 0;

      // Low uncertainty should produce higher confidence (negative weight)
      expect(lowUncertaintyConfidence).toBeGreaterThan(highUncertaintyConfidence);
    });

    it('should include uncertainty weight contribution in curiosity (no gate)', async () => {
      // Curiosity has positive uncertainty weight but no uncertainty gate
      const highUncertaintySample = buildSample({
        mood: { uncertainty: 80, engagement: 60, valence: 30 },
      });
      const zeroUncertaintySample = buildSample({
        mood: { uncertainty: 0, engagement: 60, valence: 30 },
      });
      const { simulator: highSim } = buildSimulator({
        samples: [highUncertaintySample],
      });
      const { simulator: zeroSim } = buildSimulator({
        samples: [zeroUncertaintySample],
      });

      const highResult = await highSim.simulate(pureWeightNoGateExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const zeroResult = await zeroSim.simulate(pureWeightNoGateExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const highCuriosity =
        highResult.storedContexts[0].emotions.curiosity ?? 0;
      const zeroCuriosity =
        zeroResult.storedContexts[0].emotions.curiosity ?? 0;

      // Higher uncertainty should boost curiosity via weight contribution
      expect(highCuriosity).toBeGreaterThan(zeroCuriosity);
    });
  });

  describe('Uncertainty Gate Constraints', () => {
    it('should gate confusion when uncertainty < 0.30', async () => {
      // Gate: uncertainty >= 0.30 (normalized) = uncertainty >= 30 (raw)
      const belowGateSample = buildSample({
        mood: { uncertainty: 20, engagement: 50, arousal: 30 },
      });
      const aboveGateSample = buildSample({
        mood: { uncertainty: 50, engagement: 50, arousal: 30 },
      });
      const { simulator: belowSim } = buildSimulator({
        samples: [belowGateSample],
      });
      const { simulator: aboveSim } = buildSimulator({
        samples: [aboveGateSample],
      });

      const belowResult = await belowSim.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const aboveResult = await aboveSim.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const belowConfusion =
        belowResult.storedContexts[0].emotions.confusion ?? 0;
      const aboveConfusion =
        aboveResult.storedContexts[0].emotions.confusion ?? 0;

      // Below gate should be 0 (gated), above should have positive value
      expect(belowConfusion).toBe(0);
      expect(aboveConfusion).toBeGreaterThan(0);
    });

    it('should gate confidence when uncertainty > 0.20', async () => {
      // Gate: uncertainty <= 0.20 (normalized) = uncertainty <= 20 (raw)
      const passGateSample = buildSample({
        mood: { uncertainty: 10, agency_control: 50, threat: -50 },
      });
      const failGateSample = buildSample({
        mood: { uncertainty: 40, agency_control: 50, threat: -50 },
      });
      const { simulator: passSim } = buildSimulator({
        samples: [passGateSample],
      });
      const { simulator: failSim } = buildSimulator({
        samples: [failGateSample],
      });

      const passResult = await passSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const failResult = await failSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const passConfidence =
        passResult.storedContexts[0].emotions.confidence ?? 0;
      const failConfidence =
        failResult.storedContexts[0].emotions.confidence ?? 0;

      // Pass gate should have value, fail gate should be 0
      expect(passConfidence).toBeGreaterThan(0);
      expect(failConfidence).toBe(0);
    });

    it('should gate flow with strict uncertainty <= 0.10', async () => {
      // Flow: uncertainty <= 0.10 (very strict)
      const strictPassSample = buildSample({
        mood: { uncertainty: 5, engagement: 60 },
      });
      const strictFailSample = buildSample({
        mood: { uncertainty: 20, engagement: 60 },
      });
      const { simulator: passSim } = buildSimulator({
        samples: [strictPassSample],
      });
      const { simulator: failSim } = buildSimulator({
        samples: [strictFailSample],
      });

      const passResult = await passSim.simulate(veryLowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const failResult = await failSim.simulate(veryLowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const passFlow = passResult.storedContexts[0].emotions.flow ?? 0;
      const failFlow = failResult.storedContexts[0].emotions.flow ?? 0;

      expect(passFlow).toBeGreaterThan(0);
      expect(failFlow).toBe(0);
    });

    it('should require both uncertainty AND threat gates for anxiety', async () => {
      // Anxiety: threat >= 0.20 AND uncertainty >= 0.15
      const bothPassSample = buildSample({
        mood: { uncertainty: 30, threat: 40 },
      });
      const onlyUncertaintySample = buildSample({
        mood: { uncertainty: 30, threat: 10 },
      });
      const onlyThreatSample = buildSample({
        mood: { uncertainty: 5, threat: 40 },
      });
      const { simulator: bothSim } = buildSimulator({
        samples: [bothPassSample],
      });
      const { simulator: onlyUncSim } = buildSimulator({
        samples: [onlyUncertaintySample],
      });
      const { simulator: onlyThreatSim } = buildSimulator({
        samples: [onlyThreatSample],
      });

      const bothResult = await bothSim.simulate(multiGateUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const onlyUncResult = await onlyUncSim.simulate(
        multiGateUncertaintyExpression,
        { sampleCount: 1, storeSamplesForSensitivity: true }
      );
      const onlyThreatResult = await onlyThreatSim.simulate(
        multiGateUncertaintyExpression,
        { sampleCount: 1, storeSamplesForSensitivity: true }
      );

      const bothAnxiety = bothResult.storedContexts[0].emotions.anxiety ?? 0;
      const onlyUncAnxiety =
        onlyUncResult.storedContexts[0].emotions.anxiety ?? 0;
      const onlyThreatAnxiety =
        onlyThreatResult.storedContexts[0].emotions.anxiety ?? 0;

      // Only passes when both gates pass
      expect(bothAnxiety).toBeGreaterThan(0);
      expect(onlyUncAnxiety).toBe(0);
      expect(onlyThreatAnxiety).toBe(0);
    });
  });

  describe('Statistical Impact on Trigger Rates', () => {
    it('should show higher confusion trigger rate with high uncertainty samples', async () => {
      // Generate samples with uniformly high uncertainty
      const highUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            uncertainty: 60 + Math.floor(Math.random() * 40), // 60-100
            engagement: 40 + Math.floor(Math.random() * 30),
            arousal: 20 + Math.floor(Math.random() * 30),
          },
        })
      );
      // Generate samples with uniformly low uncertainty
      const lowUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            uncertainty: -20 + Math.floor(Math.random() * 30), // -20 to +10
            engagement: 40 + Math.floor(Math.random() * 30),
            arousal: 20 + Math.floor(Math.random() * 30),
          },
        })
      );

      const { simulator: highSim } = buildSimulator({
        samples: highUncertaintySamples,
      });
      const { simulator: lowSim } = buildSimulator({
        samples: lowUncertaintySamples,
      });

      const highResult = await highSim.simulate(highUncertaintyExpression, {
        sampleCount: 100,
      });
      const lowResult = await lowSim.simulate(highUncertaintyExpression, {
        sampleCount: 100,
      });

      // High uncertainty samples should have higher trigger rate for confusion
      expect(highResult.triggerRate).toBeGreaterThan(lowResult.triggerRate);
    });

    it('should show higher confidence trigger rate with low uncertainty samples', async () => {
      // Samples with very low uncertainty and favorable conditions for confidence gate
      // Confidence gate: agency_control >= 0.10 AND uncertainty <= 0.20
      const lowUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            // Uncertainty: -60 to -10 → normalized -0.6 to -0.1, passes <= 0.20
            uncertainty: -60 + Math.floor(Math.random() * 50),
            // Agency: 50-80 → normalized 0.5-0.8, passes >= 0.10
            agency_control: 50 + Math.floor(Math.random() * 30),
            // Threat: -80 to -40 → normalized -0.8 to -0.4 (contributes positively via -0.8 weight)
            threat: -80 + Math.floor(Math.random() * 40),
          },
        })
      );
      // Samples with high uncertainty that will fail the uncertainty gate
      const highUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            // Uncertainty: 40-100 → normalized 0.4-1.0, fails <= 0.20
            uncertainty: 40 + Math.floor(Math.random() * 60),
            agency_control: 50 + Math.floor(Math.random() * 30),
            threat: -80 + Math.floor(Math.random() * 40),
          },
        })
      );

      const { simulator: lowSim } = buildSimulator({
        samples: lowUncertaintySamples,
      });
      const { simulator: highSim } = buildSimulator({
        samples: highUncertaintySamples,
      });

      const lowResult = await lowSim.simulate(lowUncertaintyExpression, {
        sampleCount: 100,
      });
      const highResult = await highSim.simulate(lowUncertaintyExpression, {
        sampleCount: 100,
      });

      // Low uncertainty samples should pass the gate, high uncertainty should fail
      // High uncertainty will have 0 trigger rate because gate fails
      expect(lowResult.triggerRate).toBeGreaterThan(highResult.triggerRate);
      // High uncertainty samples should mostly fail the uncertainty gate
      expect(highResult.triggerRate).toBe(0);
    });

    it('should show joy unaffected by uncertainty variance (control)', async () => {
      // Samples with varied uncertainty but consistent valence
      const highUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            uncertainty: 60 + Math.floor(Math.random() * 40),
            valence: 50 + Math.floor(Math.random() * 30),
          },
        })
      );
      const lowUncertaintySamples = Array.from({ length: 100 }, () =>
        buildSample({
          mood: {
            uncertainty: -60 + Math.floor(Math.random() * 40),
            valence: 50 + Math.floor(Math.random() * 30),
          },
        })
      );

      const { simulator: highSim } = buildSimulator({
        samples: highUncertaintySamples,
      });
      const { simulator: lowSim } = buildSimulator({
        samples: lowUncertaintySamples,
      });

      const highResult = await highSim.simulate(controlNoUncertaintyExpression, {
        sampleCount: 100,
      });
      const lowResult = await lowSim.simulate(controlNoUncertaintyExpression, {
        sampleCount: 100,
      });

      // Joy has no uncertainty dependency, rates should be similar
      // Allow 0.2 tolerance for random variation in valence
      expect(Math.abs(highResult.triggerRate - lowResult.triggerRate)).toBeLessThan(
        0.25
      );
    });
  });

  describe('Prototype Evaluation Summary', () => {
    it('should track uncertainty gate failures in prototypeEvaluationSummary', async () => {
      const samples = [
        buildSample({ mood: { uncertainty: 20, engagement: 50, arousal: 30 } }), // Below gate
        buildSample({ mood: { uncertainty: 50, engagement: 50, arousal: 30 } }), // Above gate
      ];
      const { simulator } = buildSimulator({ samples });

      const result = await simulator.simulate(highUncertaintyExpression, {
        sampleCount: 2,
      });

      const summary = result.prototypeEvaluationSummary;
      expect(summary).toBeDefined();
      expect(summary.emotions.confusion).toBeDefined();

      const confusionStats = summary.emotions.confusion;
      expect(confusionStats.moodSampleCount).toBe(2);
      expect(confusionStats.gatePassCount).toBe(1);
      expect(confusionStats.gateFailCount).toBe(1);
      // Check that the uncertainty gate failure was tracked
      expect(confusionStats.failedGateCounts['uncertainty >= 0.30']).toBe(1);
    });

    it('should include uncertainty weight in rawScoreSum calculation', async () => {
      // High uncertainty sample passing confusion gate
      const sample = buildSample({
        mood: { uncertainty: 80, engagement: 50, arousal: 30 },
      });
      const { simulator } = buildSimulator({ samples: [sample] });

      const result = await simulator.simulate(highUncertaintyExpression, {
        sampleCount: 1,
      });

      const stats = result.prototypeEvaluationSummary.emotions.confusion;
      expect(stats.rawScoreSum).toBeGreaterThan(0);
      // Confusion has uncertainty weight=1.0, so rawScoreSum should include 0.8 contribution
      // Plus engagement (0.4 * 0.5 = 0.2) and arousal (0.2 * 0.3 = 0.06)
      // Total ≈ 0.8 + 0.2 + 0.06 = 1.06
      expect(stats.rawScoreSum).toBeGreaterThan(0.5);
    });
  });

  describe('Direct moodAxes.uncertainty Access', () => {
    it('should evaluate JSON Logic using moodAxes.uncertainty directly', async () => {
      // Expression uses raw values: moodAxes.uncertainty >= 25
      const aboveThresholdSample = buildSample({ mood: { uncertainty: 40 } });
      const belowThresholdSample = buildSample({ mood: { uncertainty: 10 } });
      const { simulator: aboveSim } = buildSimulator({
        samples: [aboveThresholdSample],
      });
      const { simulator: belowSim } = buildSimulator({
        samples: [belowThresholdSample],
      });

      const aboveResult = await aboveSim.simulate(
        directUncertaintyAxisExpression,
        { sampleCount: 1 }
      );
      const belowResult = await belowSim.simulate(
        directUncertaintyAxisExpression,
        { sampleCount: 1 }
      );

      // Expression: moodAxes.uncertainty >= 25 (raw value)
      // Above: 40 >= 25 = true
      // Below: 10 >= 25 = false
      expect(aboveResult.triggerCount).toBe(1);
      expect(belowResult.triggerCount).toBe(0);
    });
  });

  describe('Temporal Expressions', () => {
    it('should compare current vs previous uncertainty correctly', async () => {
      const increasingSample = buildSample({
        mood: { uncertainty: 60 },
        previousMood: { uncertainty: 20 },
      });
      const decreasingSample = buildSample({
        mood: { uncertainty: 20 },
        previousMood: { uncertainty: 60 },
      });
      const { simulator: incSim } = buildSimulator({
        samples: [increasingSample],
      });
      const { simulator: decSim } = buildSimulator({
        samples: [decreasingSample],
      });

      const incResult = await incSim.simulate(temporalUncertaintyExpression, {
        sampleCount: 1,
      });
      const decResult = await decSim.simulate(temporalUncertaintyExpression, {
        sampleCount: 1,
      });

      // Expression: moodAxes.uncertainty > previousMoodAxes.uncertainty (raw values)
      expect(incResult.triggerCount).toBe(1);
      expect(decResult.triggerCount).toBe(0);
    });

    it('should store both current and previous uncertainty raw values in context', async () => {
      const sample = buildSample({
        mood: { uncertainty: 75 },
        previousMood: { uncertainty: -50 },
      });
      const { simulator } = buildSimulator({ samples: [sample] });

      const result = await simulator.simulate(temporalUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      const context = result.storedContexts[0];
      // moodAxes stores raw values (not normalized)
      expect(context.moodAxes.uncertainty).toBe(75);
      expect(context.previousMoodAxes.uncertainty).toBe(-50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exact gate threshold correctly', async () => {
      // Gate: uncertainty >= 0.30 (exactly at threshold)
      const exactThresholdSample = buildSample({
        mood: { uncertainty: 30, engagement: 50, arousal: 30 },
      });
      const { simulator } = buildSimulator({ samples: [exactThresholdSample] });

      const result = await simulator.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      // At exactly 0.30, the >= gate should pass
      const confusion = result.storedContexts[0].emotions.confusion ?? 0;
      expect(confusion).toBeGreaterThan(0);
    });

    it('should handle extreme uncertainty values (-100, +100)', async () => {
      const maxSample = buildSample({
        mood: { uncertainty: 100, engagement: 50, arousal: 30 },
      });
      const minSample = buildSample({
        mood: { uncertainty: -100, agency_control: 50, threat: -50 },
      });
      const { simulator: maxSim } = buildSimulator({ samples: [maxSample] });
      const { simulator: minSim } = buildSimulator({ samples: [minSample] });

      const maxResult = await maxSim.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      const minResult = await minSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      // Max uncertainty (1.0 normalized) should pass confusion gate
      expect(maxResult.storedContexts[0].emotions.confusion).toBeGreaterThan(0);
      // Min uncertainty (-1.0 normalized) should pass confidence gate (<=0.20)
      expect(minResult.storedContexts[0].emotions.confidence).toBeGreaterThan(0);
    });

    it('should handle zero uncertainty (neutral state)', async () => {
      const zeroSample = buildSample({
        mood: {
          uncertainty: 0,
          engagement: 50,
          arousal: 30,
          agency_control: 50,
          threat: -50,
        },
      });
      const { simulator } = buildSimulator({ samples: [zeroSample] });

      const confusionResult = await simulator.simulate(highUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });

      // Zero uncertainty (0.0 normalized) should NOT pass confusion gate (>= 0.30)
      expect(confusionResult.storedContexts[0].emotions.confusion).toBe(0);

      // But zero uncertainty SHOULD pass confidence gate (<= 0.20)
      const { simulator: confSim } = buildSimulator({ samples: [zeroSample] });
      const confidenceResult = await confSim.simulate(lowUncertaintyExpression, {
        sampleCount: 1,
        storeSamplesForSensitivity: true,
      });
      expect(confidenceResult.storedContexts[0].emotions.confidence).toBeGreaterThan(
        0
      );
    });
  });
});
