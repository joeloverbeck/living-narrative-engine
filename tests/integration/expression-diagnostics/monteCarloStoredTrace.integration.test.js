/**
 * @file Integration tests for stored Monte Carlo gate traces.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

const buildLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('MonteCarloSimulator stored gate traces', () => {
  let logger;
  let dataRegistry;

  beforeEach(() => {
    logger = buildLogger();
    dataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category !== 'lookups') {
          return null;
        }
        if (lookupId === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: {
                weights: { valence: 1 },
                gates: ['valence >= 0.2'],
              },
            },
          };
        }
        if (lookupId === 'core:sexual_prototypes') {
          return { entries: {} };
        }
        return null;
      }),
    };
  });

  it('stores gate traces using runtime normalization', async () => {
    const emotionCalculatorAdapter = new EmotionCalculatorAdapter({
      emotionCalculatorService: new EmotionCalculatorService({
        dataRegistry,
        logger,
      }),
      logger,
    });

    const randomStateGenerator = {
      generate: jest.fn(() => ({
        current: { mood: { valence: 1 }, sexual: null },
        previous: { mood: { valence: 1 }, sexual: null },
        affectTraits: null,
      })),
    };

    const simulator = new MonteCarloSimulator({
      dataRegistry,
      logger,
      emotionCalculatorAdapter,
      randomStateGenerator,
    });

    const expression = {
      id: 'test:gate-trace',
      prerequisites: [
        {
          logic: { '>=': [{ var: 'emotions.joy' }, 0.1] },
        },
      ],
    };

    const result = await simulator.simulate(expression, {
      sampleCount: 1,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 1,
      validateVarPaths: false,
    });

    expect(result.storedContexts).toHaveLength(1);
    const [context] = result.storedContexts;

    expect(context.emotions.joy).toBe(0);
    expect(context.gateTrace).toBeTruthy();
    expect(context.gateTrace.emotions).toHaveProperty('joy');

    const joyTrace = context.gateTrace.emotions.joy;
    expect(joyTrace.gatePass).toBe(false);
    expect(joyTrace.raw).toBeCloseTo(0.01, 5);
    expect(joyTrace.gated).toBe(0);
    expect(joyTrace.final).toBe(0);
  });
});
