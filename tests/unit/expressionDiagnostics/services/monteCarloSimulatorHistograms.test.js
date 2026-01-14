/**
 * @file Unit tests for mood regime histograms and sample reservoir.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = ({ emotionEntries = {}, sexualEntries = {}, samples = [] } = {}) => {
  let sampleIndex = 0;
  const mockRandomStateGenerator = {
    generate: jest.fn(() => {
      const sample = samples[sampleIndex] ?? samples[samples.length - 1];
      sampleIndex += 1;
      return sample;
    }),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn(() => ({})),
    calculateEmotionsFiltered: jest.fn(() => ({})),
    calculateEmotionTraces: jest.fn(() => ({})),
    calculateEmotionTracesFiltered: jest.fn(() => ({})),
    calculateSexualStateTraces: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => 0.3),
    calculateSexualStates: jest.fn(() => ({})),
  };

  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn((type, id) => {
      if (type !== 'lookups') {
        return null;
      }
      if (id === 'core:emotion_prototypes') {
        return { entries: emotionEntries };
      }
      if (id === 'core:sexual_prototypes') {
        return { entries: sexualEntries };
      }
      return null;
    }),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

describe('MonteCarloSimulator mood regime histograms', () => {
  it('records in-regime histograms and reservoir samples for tracked axes', async () => {
    const samples = [
      {
        current: {
          mood: { valence: -100, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: -50 },
        },
        previous: {
          mood: { valence: -100, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 0, sex_inhibition: 0, baseline_libido: -50 },
        },
        affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
      },
      {
        current: {
          mood: { valence: 0, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 50, sex_inhibition: 0, baseline_libido: 0 },
        },
        previous: {
          mood: { valence: 0, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 50, sex_inhibition: 0, baseline_libido: 0 },
        },
        affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
      },
      {
        current: {
          mood: { valence: 100, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 100, sex_inhibition: 0, baseline_libido: 50 },
        },
        previous: {
          mood: { valence: 100, arousal: 0, agency_control: 0, threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 0, affiliation: 0 },
          sexual: { sex_excitation: 100, sex_inhibition: 0, baseline_libido: 50 },
        },
        affectTraits: { affective_empathy: 50, cognitive_empathy: 50, harm_aversion: 50 },
      },
    ];

    const simulator = buildSimulator({
      emotionEntries: {
        joy: {
          weights: { valence: 1 },
          gates: ['valence >= 0.35'],
        },
      },
      sexualEntries: {
        aroused: {
          weights: { sex_excitation: 1 },
          gates: ['sex_excitation >= 0.4', 'baseline_libido >= 0.0'],
        },
      },
      samples,
    });

    const expression = {
      id: 'test:mood-regime-histograms',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.5] } },
        { logic: { '>=': [{ var: 'moodAxes.valence' }, -100] } },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: 3,
      moodRegimeSampleReservoirLimit: 2,
    });

    const { moodRegimeAxisHistograms, moodRegimeSampleReservoir } = result;

    expect(Object.keys(moodRegimeAxisHistograms).sort()).toEqual([
      'baseline_libido',
      'sex_excitation',
      'valence',
    ]);

    const valenceHistogram = moodRegimeAxisHistograms.valence;
    expect(valenceHistogram.sampleCount).toBe(3);
    expect(valenceHistogram.bins[0]).toBe(1);
    expect(valenceHistogram.bins[100]).toBe(1);
    expect(valenceHistogram.bins[200]).toBe(1);

    const excitationHistogram = moodRegimeAxisHistograms.sex_excitation;
    expect(excitationHistogram.sampleCount).toBe(3);
    expect(excitationHistogram.bins[0]).toBe(1);
    expect(excitationHistogram.bins[50]).toBe(1);
    expect(excitationHistogram.bins[100]).toBe(1);

    const libidoHistogram = moodRegimeAxisHistograms.baseline_libido;
    expect(libidoHistogram.sampleCount).toBe(3);
    expect(libidoHistogram.bins[0]).toBe(1);
    expect(libidoHistogram.bins[50]).toBe(1);
    expect(libidoHistogram.bins[100]).toBe(1);

    expect(moodRegimeSampleReservoir.sampleCount).toBe(3);
    expect(moodRegimeSampleReservoir.storedCount).toBe(2);
    expect(moodRegimeSampleReservoir.samples).toHaveLength(2);
    expect(moodRegimeSampleReservoir.samples[0]).toMatchObject({
      valence: -100,
      sex_excitation: 0,
      baseline_libido: -50,
    });
    expect(moodRegimeSampleReservoir.samples[1]).toMatchObject({
      valence: 0,
      sex_excitation: 50,
      baseline_libido: 0,
    });
  });
});
