/**
 * @file Unit tests for MonteCarloSimulator population metadata.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import {
  buildPopulationHash,
  buildPopulationPredicate,
} from '../../../../src/expressionDiagnostics/utils/populationHashUtils.js';

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

describe('MonteCarloSimulator populationMeta', () => {
  it('reports stored-global and stored-mood-regime metadata with stable hashes', async () => {
    const simulator = buildSimulator([0.6, 0.4, 0.8]);
    const expression = {
      id: 'test:population-meta',
      prerequisites: [
        {
          logic: { '>=': [{ var: 'moodAxes.valence' }, 0.5] },
        },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: 3,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 3,
    });

    const storedGlobalSampleIds = [0, 1, 2];
    const moodPredicate = buildPopulationPredicate([
      { varPath: 'moodAxes.valence', operator: '>=', threshold: 0.5 },
    ]);
    const storedMoodRegimeSampleIds = [0, 2];

    expect(result.populationMeta).toEqual({
      storedGlobal: {
        name: 'stored-global',
        predicate: 'all',
        count: 3,
        hash: buildPopulationHash(storedGlobalSampleIds, 'all'),
      },
      storedMoodRegime: {
        name: 'stored-mood-regime',
        predicate: moodPredicate,
        count: 2,
        hash: buildPopulationHash(storedMoodRegimeSampleIds, moodPredicate),
      },
    });
  });
});
