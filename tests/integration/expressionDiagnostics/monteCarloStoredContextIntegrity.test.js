/**
 * @file Integration tests for stored Monte Carlo context gate integrity.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import MonteCarloSimulator from '../../../src/expressionDiagnostics/services/MonteCarloSimulator.js';
import EmotionCalculatorAdapter from '../../../src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Monte Carlo stored context integrity', () => {
  let logger;
  let dataRegistry;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = {
      get: jest.fn((category, lookupId) => {
        if (category !== 'lookups') {
          return null;
        }
        if (lookupId === 'core:emotion_prototypes') {
          return {
            entries: {
              joy: {
                weights: { valence: 1.0 },
                gates: ['valence >= 0.20'],
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

  it('stores post-gate finals and gate traces in stored contexts', async () => {
    const samples = [
      {
        current: { mood: { valence: 10 }, sexual: {} },
        previous: { mood: { valence: 10 }, sexual: {} },
        affectTraits: null,
      },
      {
        current: { mood: { valence: 40 }, sexual: {} },
        previous: { mood: { valence: 40 }, sexual: {} },
        affectTraits: null,
      },
    ];
    let index = 0;

    const randomStateGenerator = {
      generate: jest.fn(() => {
        const sample = samples[Math.min(index, samples.length - 1)];
        index += 1;
        return sample;
      }),
    };

    const emotionCalculatorAdapter = new EmotionCalculatorAdapter({
      emotionCalculatorService: new EmotionCalculatorService({
        dataRegistry,
        logger,
      }),
      logger,
    });

    const monteCarloSimulator = new MonteCarloSimulator({
      logger,
      dataRegistry,
      emotionCalculatorAdapter,
      randomStateGenerator,
    });

    const expression = {
      id: 'test:gate-context-integrity',
      prerequisites: [
        {
          logic: {
            '>=': [{ var: 'emotions.joy' }, 0.2],
          },
        },
      ],
    };

    const result = await monteCarloSimulator.simulate(expression, {
      sampleCount: 2,
      storeSamplesForSensitivity: true,
      sensitivitySampleLimit: 2,
    });

    expect(result.storedContexts).toHaveLength(2);

    for (const context of result.storedContexts) {
      expect(context.gateTrace).toBeTruthy();
      expect(context.gateTrace.emotions?.joy).toBeTruthy();

      const trace = context.gateTrace.emotions.joy;
      expect(context.emotions.joy).toBeCloseTo(trace.final, 6);

      if (trace.gatePass) {
        expect(trace.final).toBeGreaterThan(0);
      } else {
        expect(trace.final).toBe(0);
      }
    }
  });
});
