/**
 * @file Integration tests pinning PrototypeEvaluator behavior before refactoring.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { describe, it, expect, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import {
  dedupePrototypeExpression,
  missingPrototypeExpression,
  moodRegimePrototypeExpression,
  multiplePrototypeExpression,
  negativeScoreExpression,
  noPrototypeExpression,
  prototypeEvaluationPrototypes,
  singlePrototypeExpression,
  zeroWeightExpression,
} from '../../fixtures/expressionDiagnostics/prototypeEvaluationFixtures.js';

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
    entries: prototypeEvaluationPrototypes.emotions,
  });
  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: prototypeEvaluationPrototypes.sexualStates,
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

  return { simulator, logger };
};

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

describe('MonteCarloSimulator - Prototype Evaluation Behavior', () => {
  it('collects emotion and sexual prototype references from comparison logic', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(multiplePrototypeExpression, {
      sampleCount: 1,
    });

    const summary = result.prototypeEvaluationSummary;
    expect(summary).toBeTruthy();
    expect(Object.keys(summary.emotions).sort()).toEqual(['joy', 'trust']);
    expect(Object.keys(summary.sexualStates)).toEqual(['aroused']);
  });

  it('deduplicates prototype references across prerequisites', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(dedupePrototypeExpression, {
      sampleCount: 1,
    });

    expect(Object.keys(result.prototypeEvaluationSummary.emotions)).toEqual([
      'joy',
    ]);
  });

  it('returns null summary when no prototype references exist', async () => {
    const sample = buildSample();
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(noPrototypeExpression, {
      sampleCount: 1,
    });

    expect(result.prototypeEvaluationSummary).toBeNull();
  });

  it('skips missing prototypes and logs a warning', async () => {
    const sample = buildSample();
    const { simulator, logger } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(missingPrototypeExpression, {
      sampleCount: 1,
    });

    expect(result.prototypeEvaluationSummary).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('emotions.missing')
    );
  });

  it('updates prototype evaluation summary only for in-regime samples', async () => {
    const samples = [
      buildSample({ mood: { valence: 0 } }),
      buildSample({ mood: { valence: 80 } }),
    ];
    const { simulator } = buildSimulator({ samples });

    const result = await simulator.simulate(moodRegimePrototypeExpression, {
      sampleCount: 2,
    });

    const stats = result.prototypeEvaluationSummary.emotions.joy;
    expect(stats.moodSampleCount).toBe(1);
    expect(stats.gatePassCount + stats.gateFailCount).toBe(1);
  });

  it('records gate pass/fail counts and value sums for emotion and sexual targets', async () => {
    const samples = [
      buildSample({ mood: { valence: 60 }, sexual: { sex_excitation: 50 } }),
      buildSample({ mood: { valence: 10 }, sexual: { sex_excitation: 10 } }),
    ];
    const { simulator } = buildSimulator({ samples });

    const expression = {
      id: 'test:prototype_gate_counts',
      prerequisites: [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } },
        { logic: { '>=': [{ var: 'sexualAxes.sex_excitation' }, -100] } },
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.2] } },
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.2] } },
      ],
    };

    const result = await simulator.simulate(expression, { sampleCount: 2 });
    const summary = result.prototypeEvaluationSummary;

    const joyStats = summary.emotions.joy;
    expect(joyStats.moodSampleCount).toBe(2);
    expect(joyStats.gatePassCount).toBe(1);
    expect(joyStats.gateFailCount).toBe(1);
    expect(joyStats.failedGateCounts).toEqual({ 'valence >= 0.25': 1 });
    expect(joyStats.rawScoreSum).toBeCloseTo(0.7, 6);
    expect(joyStats.valueSum).toBeCloseTo(0.6, 6);
    expect(joyStats.valueSumGivenGate).toBeCloseTo(0.6, 6);

    const arousedStats = summary.sexualStates.aroused;
    expect(arousedStats.moodSampleCount).toBe(2);
    expect(arousedStats.gatePassCount).toBe(1);
    expect(arousedStats.gateFailCount).toBe(1);
    expect(arousedStats.failedGateCounts).toEqual({
      'sex_excitation >= 0.4': 1,
    });
    expect(arousedStats.rawScoreSum).toBeCloseTo(0.6, 6);
    expect(arousedStats.valueSum).toBeCloseTo(0.5, 6);
    expect(arousedStats.valueSumGivenGate).toBeCloseTo(0.5, 6);
  });

  it('handles zero-weight prototypes without NaN totals', async () => {
    const sample = buildSample({ mood: { valence: 40 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(zeroWeightExpression, {
      sampleCount: 1,
    });

    const stats = result.prototypeEvaluationSummary.emotions.neutral;
    expect(stats.moodSampleCount).toBe(1);
    expect(stats.gatePassCount).toBe(1);
    expect(stats.gateFailCount).toBe(0);
    expect(stats.failedGateCounts).toEqual({});
    expect(stats.rawScoreSum).toBe(0);
    expect(stats.valueSum).toBe(0);
    expect(stats.valueSumGivenGate).toBe(0);
  });

  it('clamps negative raw scores to zero value while retaining rawScoreSum', async () => {
    const sample = buildSample({ mood: { valence: -100 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(negativeScoreExpression, {
      sampleCount: 1,
    });

    const stats = result.prototypeEvaluationSummary.emotions.sad;
    expect(stats.moodSampleCount).toBe(1);
    expect(stats.gatePassCount).toBe(1);
    expect(stats.gateFailCount).toBe(0);
    expect(stats.failedGateCounts).toEqual({});
    expect(stats.rawScoreSum).toBe(-1);
    expect(stats.valueSum).toBe(0);
    expect(stats.valueSumGivenGate).toBe(0);
  });

  it('initializes summary entries with expected fields', async () => {
    const sample = buildSample({ mood: { valence: 50 } });
    const { simulator } = buildSimulator({ samples: [sample] });

    const result = await simulator.simulate(singlePrototypeExpression, {
      sampleCount: 1,
    });

    const stats = result.prototypeEvaluationSummary.emotions.joy;
    expect(stats.moodSampleCount).toBe(1);
    expect(stats.gatePassCount).toBe(1);
    expect(stats.gateFailCount).toBe(0);
    expect(stats.failedGateCounts).toEqual({});
    expect(stats.rawScoreSum).toBeCloseTo(0.5, 6);
    expect(stats.valueSum).toBeCloseTo(0.5, 6);
    expect(stats.valueSumGivenGate).toBeCloseTo(0.5, 6);
  });
});
