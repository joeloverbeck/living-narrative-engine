/**
 * @file Unit tests for MonteCarloSimulator population summary metadata.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = (moodValues) => {
  let index = 0;
  const mockRandomStateGenerator = {
    generate: jest.fn(() => {
      const moodValue = moodValues[index];
      index += 1;
      return {
        current: { mood: { valence: moodValue }, sexual: {} },
        previous: { mood: { valence: moodValue }, sexual: {} },
        affectTraits: null,
      };
    }),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn(() => ({})),
    calculateEmotionsFiltered: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => 0),
    calculateSexualStates: jest.fn(() => ({})),
  };

  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(() => null),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

describe('MonteCarloSimulator populationSummary', () => {
  it('captures stored context counts separately from full samples', async () => {
    const simulator = buildSimulator([0.6, 0.4, 0.8, 0.2]);
    const expression = {
      id: 'test:population-summary',
      prerequisites: [
        {
          logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
        },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: 4,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 2,
    });

    expect(result.populationSummary).toEqual({
      sampleCount: 4,
      inRegimeSampleCount: 2,
      inRegimeSampleRate: 0.5,
      storedContextCount: 2,
      storedContextLimit: 2,
      storedInRegimeCount: 1,
      storedInRegimeRate: 0.5,
    });
  });
});
