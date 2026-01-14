/**
 * @file Unit tests for MonteCarloSimulator prototype gate aggregation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../../src/emotions/emotionCalculatorService.js';

const buildEmotionCalculatorAdapter = (dataRegistry, logger) =>
  new EmotionCalculatorAdapter({
    emotionCalculatorService: new EmotionCalculatorService({
      dataRegistry,
      logger,
    }),
    logger,
  });

describe('MonteCarloSimulator prototype gate aggregation', () => {
  let mockLogger;
  let mockDataRegistry;
  let randomStateGenerator;
  let simulator;

  const mockEmotionPrototypes = {
    entries: {
      joy: {
        weights: { valence: 1.0 },
        gates: ['valence >= 0.35'],
      },
    },
  };

  const mockSexualPrototypes = {
    entries: {
      aroused: {
        weights: { sex_excitation: 1.0 },
        gates: ['sex_excitation >= 0.40'],
      },
    },
  };

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category === 'lookups') {
          if (lookupId === 'core:emotion_prototypes') {
            return mockEmotionPrototypes;
          }
          if (lookupId === 'core:sexual_prototypes') {
            return mockSexualPrototypes;
          }
        }
        return null;
      }),
    };
  });

  it('aggregates gate pass/fail counts and failed gate frequencies per prototype', async () => {
    const samples = [
      {
        current: { mood: { valence: 60 }, sexual: { sex_excitation: 80 } },
        previous: { mood: { valence: 60 }, sexual: { sex_excitation: 80 } },
        affectTraits: null,
      },
      {
        current: { mood: { valence: 10 }, sexual: { sex_excitation: 20 } },
        previous: { mood: { valence: 10 }, sexual: { sex_excitation: 20 } },
        affectTraits: null,
      },
    ];
    let index = 0;
    randomStateGenerator = {
      generate: jest.fn(() => samples[index++]),
    };

    simulator = new MonteCarloSimulator({
      dataRegistry: mockDataRegistry,
      logger: mockLogger,
      emotionCalculatorAdapter: buildEmotionCalculatorAdapter(
        mockDataRegistry,
        mockLogger
      ),
      randomStateGenerator,
    });

    const expression = {
      id: 'test:prototype-eval-aggregation',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.2] } },
        { logic: { '>=': [{ var: 'sexualStates.aroused' }, 0.2] } },
      ],
    };

    const result = await simulator.simulate(expression, { sampleCount: 2 });

    const summary = result.prototypeEvaluationSummary;
    expect(summary).toBeDefined();

    const joyStats = summary.emotions.joy;
    const arousedStats = summary.sexualStates.aroused;

    expect(joyStats.moodSampleCount).toBe(2);
    expect(joyStats.gatePassCount).toBe(1);
    expect(joyStats.gateFailCount).toBe(1);
    expect(joyStats.failedGateCounts['valence >= 0.35']).toBe(1);
    expect(joyStats.rawScoreSum).toBeCloseTo(0.7, 6);
    expect(joyStats.valueSum).toBeCloseTo(0.6, 6);
    expect(joyStats.valueSumGivenGate).toBeCloseTo(0.6, 6);

    const joyFailedGateTotal = Object.values(joyStats.failedGateCounts).reduce(
      (total, count) => total + count,
      0
    );
    expect(joyFailedGateTotal).toBe(joyStats.gateFailCount);
    expect(joyStats.gatePassCount + joyStats.gateFailCount).toBe(
      joyStats.moodSampleCount
    );

    expect(arousedStats.moodSampleCount).toBe(2);
    expect(arousedStats.gatePassCount).toBe(1);
    expect(arousedStats.gateFailCount).toBe(1);
    expect(arousedStats.failedGateCounts['sex_excitation >= 0.40']).toBe(1);
    expect(arousedStats.rawScoreSum).toBeCloseTo(1.0, 6);
    expect(arousedStats.valueSum).toBeCloseTo(0.8, 6);
    expect(arousedStats.valueSumGivenGate).toBeCloseTo(0.8, 6);

    const arousedFailedGateTotal = Object.values(
      arousedStats.failedGateCounts
    ).reduce((total, count) => total + count, 0);
    expect(arousedFailedGateTotal).toBe(arousedStats.gateFailCount);
    expect(arousedStats.gatePassCount + arousedStats.gateFailCount).toBe(
      arousedStats.moodSampleCount
    );
  });
});
