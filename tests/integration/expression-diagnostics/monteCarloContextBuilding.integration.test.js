/**
 * @file Integration tests pinning ContextBuilder behavior before refactoring.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { DEFAULT_AFFECT_TRAITS } from '../../../src/constants/moodAffectConstants.js';
import {
  simpleContextExpression,
  unknownVarExpression,
  moodRegimeExpression,
  prototypeLookups,
} from '../../fixtures/expressionDiagnostics/contextBuildingFixtures.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: prototypeLookups.emotions,
  });
  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: prototypeLookups.sexualStates,
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

const buildSimulator = ({ samples }) => {
  const logger = createLogger();
  const dataRegistry = createDataRegistry(logger);
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

  return { simulator, logger, emotionCalculatorAdapter };
};

describe('MonteCarloSimulator - Context Building Behavior', () => {
  it('builds context with required fields, derived values, and gate traces', async () => {
    const sample = {
      current: {
        mood: {
          valence: 60,
          arousal: -20,
          agency_control: 10,
          threat: -30,
          engagement: 5,
          future_expectancy: 15,
          self_evaluation: -10,
          affiliation: 25,
          inhibitory_control: 40,
        },
        sexual: {
          sex_excitation: 80,
          sex_inhibition: 20,
          baseline_libido: -10,
        },
      },
      previous: {
        mood: {
          valence: -10,
          arousal: 10,
          agency_control: 0,
          threat: 20,
          engagement: -5,
          future_expectancy: -15,
          self_evaluation: 5,
          affiliation: 10,
          inhibitory_control: -20,
        },
        sexual: {
          sex_excitation: 30,
          sex_inhibition: 50,
          baseline_libido: 5,
        },
      },
      affectTraits: {
        affective_empathy: 60,
        cognitive_empathy: 40,
        harm_aversion: 70,
        self_control: 55,
      },
    };

    const { simulator, emotionCalculatorAdapter } = buildSimulator({
      samples: [sample],
    });

    const referencedEmotions = new Set(['joy']);
    const expectedEmotions =
      emotionCalculatorAdapter.calculateEmotionsFiltered(
        sample.current.mood,
        sample.current.sexual,
        sample.affectTraits,
        referencedEmotions
      );
    const expectedSexualArousal =
      emotionCalculatorAdapter.calculateSexualArousal(sample.current.sexual);
    const expectedSexualStates = emotionCalculatorAdapter.calculateSexualStates(
      sample.current.mood,
      sample.current.sexual,
      expectedSexualArousal
    );
    const expectedPreviousEmotions =
      emotionCalculatorAdapter.calculateEmotionsFiltered(
        sample.previous.mood,
        sample.previous.sexual,
        sample.affectTraits,
        referencedEmotions
      );
    const expectedPreviousSexualArousal =
      emotionCalculatorAdapter.calculateSexualArousal(sample.previous.sexual);
    const expectedPreviousSexualStates =
      emotionCalculatorAdapter.calculateSexualStates(
        sample.previous.mood,
        sample.previous.sexual,
        expectedPreviousSexualArousal
      );
    const expectedEmotionTrace =
      emotionCalculatorAdapter.calculateEmotionTracesFiltered(
        sample.current.mood,
        sample.current.sexual,
        sample.affectTraits,
        referencedEmotions
      );
    const expectedSexualTrace =
      emotionCalculatorAdapter.calculateSexualStateTraces(
        sample.current.mood,
        sample.current.sexual,
        expectedSexualArousal
      );

    const result = await simulator.simulate(simpleContextExpression, {
      sampleCount: 1,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 1,
    });

    expect(result.storedContexts).toHaveLength(1);
    const [context] = result.storedContexts;

    expect(context.mood).toEqual(sample.current.mood);
    expect(context.moodAxes).toEqual(sample.current.mood);
    expect(context.sexualAxes).toEqual(sample.current.sexual);
    expect(context.emotions).toEqual(expectedEmotions);
    expect(context.sexualStates).toEqual(expectedSexualStates);
    expect(context.sexualArousal).toBe(expectedSexualArousal);
    expect(context.previousEmotions).toEqual(expectedPreviousEmotions);
    expect(context.previousSexualStates).toEqual(expectedPreviousSexualStates);
    expect(context.previousMoodAxes).toEqual(sample.previous.mood);
    expect(context.previousSexualAxes).toEqual(sample.previous.sexual);
    expect(context.previousSexualArousal).toBe(expectedPreviousSexualArousal);
    expect(context.affectTraits).toEqual(sample.affectTraits);
    expect(context.gateTrace).toEqual({
      emotions: expectedEmotionTrace,
      sexualStates: expectedSexualTrace,
    });
    expect(context.gateTrace.emotions.joy).toEqual(
      expect.objectContaining({
        raw: expect.any(Number),
        gated: expect.any(Number),
        final: expect.any(Number),
        gatePass: expect.any(Boolean),
      })
    );
  });

  it('keeps raw mood and sexual axes ranges intact', async () => {
    const sample = {
      current: {
        mood: {
          valence: -100,
          arousal: 100,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
        },
        sexual: {
          sex_excitation: 100,
          sex_inhibition: 0,
          baseline_libido: -50,
        },
      },
      previous: {
        mood: {
          valence: 100,
          arousal: -100,
          agency_control: 0,
          threat: 0,
          engagement: 0,
          future_expectancy: 0,
          self_evaluation: 0,
          affiliation: 0,
          inhibitory_control: 0,
        },
        sexual: {
          sex_excitation: 0,
          sex_inhibition: 100,
          baseline_libido: 50,
        },
      },
      affectTraits: null,
    };

    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(simpleContextExpression, {
      sampleCount: 1,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 1,
    });

    const [context] = result.storedContexts;
    expect(context.mood.valence).toBe(-100);
    expect(context.mood.arousal).toBe(100);
    expect(context.sexualAxes.sex_excitation).toBe(100);
    expect(context.sexualAxes.sex_inhibition).toBe(0);
    expect(context.sexualAxes.baseline_libido).toBe(-50);
  });

  it('defaults affect traits when the generator provides none', async () => {
    const sample = {
      current: {
        mood: { valence: 0 },
        sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      },
      previous: {
        mood: { valence: 0 },
        sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      },
      affectTraits: null,
    };

    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(simpleContextExpression, {
      sampleCount: 1,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 1,
    });

    const [context] = result.storedContexts;
    expect(context.affectTraits).toEqual({
      affective_empathy: 50,
      cognitive_empathy: 50,
      harm_aversion: 50,
    });
    expect(context.affectTraits.self_control).toBeUndefined();
  });

  it('normalizes gate context values for prototype evaluation', async () => {
    const sample = {
      current: {
        mood: { valence: -50 },
        sexual: { sex_excitation: 40, sex_inhibition: 0, baseline_libido: 0 },
      },
      previous: {
        mood: { valence: -50 },
        sexual: { sex_excitation: 40, sex_inhibition: 0, baseline_libido: 0 },
      },
      affectTraits: DEFAULT_AFFECT_TRAITS,
    };

    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(simpleContextExpression, {
      sampleCount: 1,
    });

    const summary = result.prototypeEvaluationSummary;
    expect(summary).toBeTruthy();
    expect(summary.emotions.joy.moodSampleCount).toBe(1);
    expect(summary.emotions.joy.gatePassCount).toBe(0);
    expect(summary.emotions.joy.gateFailCount).toBe(1);
    expect(summary.emotions.joy.failedGateCounts).toEqual({
      'valence >= -0.25': 1,
    });
    expect(summary.sexualStates.aroused.gatePassCount).toBe(0);
    expect(summary.sexualStates.aroused.gateFailCount).toBe(1);
    expect(summary.sexualStates.aroused.failedGateCounts).toEqual({
      'sex_excitation >= 0.6': 1,
    });
  });

  it('initializes histograms and respects reservoir capacity for tracked axes', async () => {
    const samples = [
      {
        current: {
          mood: { valence: -100 },
          sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: -50 },
        },
        previous: {
          mood: { valence: -100 },
          sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: -50 },
        },
        affectTraits: DEFAULT_AFFECT_TRAITS,
      },
      {
        current: {
          mood: { valence: 0 },
          sexual: { sex_excitation: 50, sex_inhibition: 0, baseline_libido: 0 },
        },
        previous: {
          mood: { valence: 0 },
          sexual: { sex_excitation: 50, sex_inhibition: 0, baseline_libido: 0 },
        },
        affectTraits: DEFAULT_AFFECT_TRAITS,
      },
      {
        current: {
          mood: { valence: 100 },
          sexual: { sex_excitation: 100, sex_inhibition: 0, baseline_libido: 50 },
        },
        previous: {
          mood: { valence: 100 },
          sexual: { sex_excitation: 100, sex_inhibition: 0, baseline_libido: 50 },
        },
        affectTraits: DEFAULT_AFFECT_TRAITS,
      },
    ];

    const { simulator } = buildSimulator({ samples });

    const result = await simulator.simulate(moodRegimeExpression, {
      sampleCount: 3,
      moodRegimeSampleReservoirLimit: 1,
    });

    const { moodRegimeAxisHistograms, moodRegimeSampleReservoir } = result;
    expect(Object.keys(moodRegimeAxisHistograms).sort()).toEqual([
      'sex_excitation',
      'valence',
    ]);

    const valenceHistogram = moodRegimeAxisHistograms.valence;
    expect(valenceHistogram.min).toBe(-100);
    expect(valenceHistogram.max).toBe(100);
    expect(valenceHistogram.binCount).toBe(201);
    expect(valenceHistogram.sampleCount).toBe(3);

    const excitationHistogram = moodRegimeAxisHistograms.sex_excitation;
    expect(excitationHistogram.min).toBe(0);
    expect(excitationHistogram.max).toBe(100);
    expect(excitationHistogram.binCount).toBe(101);
    expect(excitationHistogram.sampleCount).toBe(3);

    expect(moodRegimeSampleReservoir.limit).toBe(1);
    expect(moodRegimeSampleReservoir.sampleCount).toBe(3);
    expect(moodRegimeSampleReservoir.storedCount).toBe(1);
    expect(moodRegimeSampleReservoir.samples).toHaveLength(1);
    expect(moodRegimeSampleReservoir.samples[0]).toEqual({
      valence: -100,
      sex_excitation: 0,
    });
  });

  it('validates known context keys using prototype lookups', async () => {
    const sample = {
      current: {
        mood: { valence: 0 },
        sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      },
      previous: {
        mood: { valence: 0 },
        sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: 0 },
      },
      affectTraits: DEFAULT_AFFECT_TRAITS,
    };

    const { simulator: validSimulator } = buildSimulator({
      samples: [sample],
    });

    const validResult = await validSimulator.simulate(simpleContextExpression, {
      sampleCount: 1,
    });
    expect(validResult.unseededVarWarnings).toEqual([]);

    const { simulator: invalidSimulator } = buildSimulator({
      samples: [sample],
    });

    const invalidResult = await invalidSimulator.simulate(unknownVarExpression, {
      sampleCount: 1,
    });
    expect(invalidResult.unseededVarWarnings).toHaveLength(1);
    expect(invalidResult.unseededVarWarnings[0]).toMatchObject({
      path: 'unknown.axis',
      reason: 'unknown_root',
    });
  });
});
