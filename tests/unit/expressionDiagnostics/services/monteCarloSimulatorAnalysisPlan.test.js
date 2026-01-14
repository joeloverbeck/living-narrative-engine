/**
 * @file Unit tests for MonteCarloSimulator gate clamp analysis plan.
 */

import { describe, it, expect, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';

const buildSimulator = ({ emotionEntries = {}, sexualEntries = {} } = {}) => {
  const mockRandomStateGenerator = {
    generate: jest.fn(() => ({
      current: { mood: { valence: 10, arousal: 20 }, sexual: {} },
      previous: { mood: { valence: 10, arousal: 20 }, sexual: {} },
      affectTraits: { affective_empathy: 60 },
    })),
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

describe('MonteCarloSimulator gate clamp analysis plan', () => {
  it('builds tracked gate axes and per-clause gate metadata', async () => {
    const simulator = buildSimulator({
      emotionEntries: {
        joy: {
          weights: { valence: 1 },
          gates: ['valence >= 0.4', 'arousal <= 0.2'],
        },
      },
      sexualEntries: {
        passion: {
          weights: { sexual_arousal: 1 },
          gates: ['sexual_arousal >= 0.3', 'affective_empathy >= 0.6'],
        },
      },
    });

    const expression = {
      id: 'test:gate-clamp-plan',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.joy' }, 0.5] } },
        { logic: { '>=': [{ var: 'sexualStates.passion' }, 0.2] } },
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 10] } },
      ],
    };

    const result = await simulator.simulate(expression, { sampleCount: 1 });

    expect(result.gateClampRegimePlan).toEqual({
      trackedGateAxes: [
        'affective_empathy',
        'arousal',
        'sexual_arousal',
        'valence',
      ],
      clauseGateMap: {
        'var:emotions.joy:>=:0.5': {
          prototypeId: 'joy',
          type: 'emotion',
          usePrevious: false,
          gatePredicates: [
            {
              axis: 'valence',
              operator: '>=',
              thresholdNormalized: 0.4,
              thresholdRaw: 40,
            },
            {
              axis: 'arousal',
              operator: '<=',
              thresholdNormalized: 0.2,
              thresholdRaw: 20,
            },
          ],
        },
        'var:sexualStates.passion:>=:0.2': {
          prototypeId: 'passion',
          type: 'sexual',
          usePrevious: false,
          gatePredicates: [
            {
              axis: 'sexual_arousal',
              operator: '>=',
              thresholdNormalized: 0.3,
              thresholdRaw: 0.3,
            },
            {
              axis: 'affective_empathy',
              operator: '>=',
              thresholdNormalized: 0.6,
              thresholdRaw: 60,
            },
          ],
        },
      },
    });
  });

  it('skips clauses without gate predicates', async () => {
    const simulator = buildSimulator({
      emotionEntries: {
        sadness: {
          weights: { valence: -1 },
          gates: [],
        },
      },
    });

    const expression = {
      id: 'test:gate-clamp-plan-empty',
      prerequisites: [
        { logic: { '>=': [{ var: 'emotions.sadness' }, 0.2] } },
      ],
    };

    const result = await simulator.simulate(expression, { sampleCount: 1 });

    expect(result.gateClampRegimePlan).toEqual({
      trackedGateAxes: [],
      clauseGateMap: {},
    });
  });
});
