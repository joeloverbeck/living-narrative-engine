/**
 * @file Unit tests for MonteCarloSimulator stored context fields.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = ({ currentSexual, previousSexual }) => {
  const mockRandomStateGenerator = {
    generate: jest.fn(() => ({
      current: { mood: { valence: 10 }, sexual: currentSexual },
      previous: { mood: { valence: 20 }, sexual: previousSexual },
      affectTraits: null,
    })),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn(() => ({})),
    calculateEmotionsFiltered: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => 0.42),
    calculateSexualStates: jest.fn(() => ({ aroused: 0.3 })),
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

describe('MonteCarloSimulator stored context', () => {
  it('stores raw sexual axes alongside derived sexual fields', async () => {
    const currentSexual = {
      sex_excitation: 35,
      sex_inhibition: 65,
      baseline_libido: 50,
    };
    const previousSexual = {
      sex_excitation: 15,
      sex_inhibition: 85,
      baseline_libido: 40,
    };

    const simulator = buildSimulator({ currentSexual, previousSexual });
    const expression = { id: 'test:context-sexual-axes' };

    const result = await simulator.simulate(expression, {
      sampleCount: 1,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 1,
    });

    expect(result.storedContexts).toHaveLength(1);
    const [context] = result.storedContexts;

    expect(context.sexualAxes).toEqual(currentSexual);
    expect(context.previousSexualAxes).toEqual(previousSexual);
    expect(context.sexualStates).toEqual({ aroused: 0.3 });
    expect(context.sexualArousal).toBe(0.42);
  });
});
