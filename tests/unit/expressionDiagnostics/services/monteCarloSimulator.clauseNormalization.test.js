/**
 * @file Unit tests for MonteCarloSimulator clause normalization
 */

import { describe, it, expect, jest } from '@jest/globals';
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

describe('MonteCarloSimulator - clause normalization', () => {
  it('assigns stable clause ids for threshold and axis constraints', async () => {
    const simulator = buildSimulator({
      emotions: { joy: 0.6 },
      currentMood: { threat: 10 },
    });
    const expression = {
      id: 'expr:normalized',
      prerequisites: [
        {
          logic: {
            and: [
              { '>=': [{ var: 'emotions.joy' }, 0.5] },
              { '<=': [{ var: 'moodAxes.threat' }, 20] },
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;
    const [joyNode, threatNode] = breakdown.children;

    expect(joyNode.clauseType).toBe('threshold');
    expect(joyNode.clauseId).toBe('var:emotions.joy:>=:0.5');
    expect(threatNode.clauseType).toBe('threshold');
    expect(threatNode.clauseId).toBe('axis:moodAxes.threat:<=:20');
  });

  it('normalizes delta clauses against previous state', async () => {
    const simulator = buildSimulator({
      emotions: { joy: 0.6 },
      previousMood: { threat: 5 },
    });
    const expression = {
      id: 'expr:delta',
      prerequisites: [
        {
          logic: {
            '>=': [
              {
                '-': [{ var: 'emotions.joy' }, { var: 'previousEmotions.joy' }],
              },
              0.1,
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

    expect(breakdown.clauseType).toBe('delta');
    expect(breakdown.clauseId).toBe('delta:emotions.joy:>=:0.1');
  });

  it('decomposes max < c clauses into AND children', async () => {
    const simulator = buildSimulator({
      emotions: { joy: 0.2, fear: 0.1 },
    });
    const expression = {
      id: 'expr:max',
      prerequisites: [
        {
          logic: {
            '<': [
              {
                max: [{ var: 'emotions.joy' }, { var: 'emotions.fear' }],
              },
              0.4,
            ],
          },
        },
      ],
    };

    const result = await runSimulation(simulator, expression);
    const breakdown = result.clauseFailures[0].hierarchicalBreakdown;

    expect(breakdown.nodeType).toBe('and');
    expect(breakdown.children).toHaveLength(2);
    expect(breakdown.children[0].clauseId).toBe('var:emotions.joy:<:0.4');
    expect(breakdown.children[1].clauseId).toBe('var:emotions.fear:<:0.4');
  });
});
