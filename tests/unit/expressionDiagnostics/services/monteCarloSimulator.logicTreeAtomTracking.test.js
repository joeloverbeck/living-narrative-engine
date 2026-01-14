/**
 * @file Unit tests for MonteCarloSimulator atom truth tracking
 */

import { describe, it, expect, jest } from '@jest/globals';
import jsonLogic from 'json-logic-js';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = ({
  emotions = {},
  sexualStates = {},
  sexualArousal = 0,
  currentMood = {},
  currentSexual = {},
  previousMood = {},
  previousSexual = {},
  affectTraits = {},
} = {}) => {
  const mockLogger = {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockDataRegistry = {
    get: jest.fn(() => null),
  };

  const mockEmotionCalculatorAdapter = {
    calculateEmotions: jest.fn(() => emotions),
    calculateEmotionsFiltered: jest.fn(() => emotions),
    calculateEmotionTraces: jest.fn(() => ({})),
    calculateEmotionTracesFiltered: jest.fn(() => ({})),
    calculateSexualStateTraces: jest.fn(() => ({})),
    calculateSexualArousal: jest.fn(() => sexualArousal),
    calculateSexualStates: jest.fn(() => sexualStates),
  };

  const mockRandomStateGenerator = {
    generate: jest.fn(() => ({
      current: { mood: currentMood, sexual: currentSexual },
      previous: { mood: previousMood, sexual: previousSexual },
      affectTraits,
    })),
  };

  return new MonteCarloSimulator({
    dataRegistry: mockDataRegistry,
    logger: mockLogger,
    emotionCalculatorAdapter: mockEmotionCalculatorAdapter,
    randomStateGenerator: mockRandomStateGenerator,
  });
};

const runSimulation = async (simulator, expression, overrides = {}) =>
  simulator.simulate(expression, {
    sampleCount: 1,
    validateVarPaths: false,
    ...overrides,
  });

describe('MonteCarloSimulator - atom truth tracking', () => {
  it('reuses atom evaluations for identical leaf clauses', async () => {
    const simulator = buildSimulator({ emotions: { joy: 0.8, fear: 0.8 } });
    const duplicateExpression = {
      id: 'expr:duplicate',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
            ],
          },
        },
      ],
    };
    const distinctExpression = {
      id: 'expr:distinct',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '>=': [{ var: 'emotions.fear' }, 0.5] },
            ],
          },
        },
      ],
    };

    const applySpy = jest.spyOn(jsonLogic, 'apply');
    await runSimulation(simulator, duplicateExpression);
    const duplicateCalls = applySpy.mock.calls.length;

    applySpy.mockClear();
    await runSimulation(simulator, distinctExpression);
    const distinctCalls = applySpy.mock.calls.length;

    expect(duplicateCalls).toBeLessThan(distinctCalls);
    applySpy.mockRestore();
  });
});
