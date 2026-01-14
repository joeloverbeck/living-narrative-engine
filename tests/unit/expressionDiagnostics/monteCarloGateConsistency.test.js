/**
 * @file Unit tests for Monte Carlo report gate evaluation consistency.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';
import { computeIntensitySignals } from '../../../src/expressionDiagnostics/utils/intensitySignalUtils.js';
import {
  normalizeAffectTraits,
  normalizeMoodAxes,
  normalizeSexualAxes,
} from '../../../src/expressionDiagnostics/utils/axisNormalizationUtils.js';

describe('Monte Carlo gate evaluation consistency', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  const mockEmotionPrototypes = {
    joy: {
      weights: { valence: 1.0 },
      gates: ['valence >= 0.005'],
    },
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDataRegistry = {
      get: jest.fn((category, id) => {
        if (category === 'lookups' && id === 'core:emotion_prototypes') {
          return { entries: mockEmotionPrototypes };
        }
        if (category === 'lookups' && id === 'core:sexual_prototypes') {
          return { entries: {} };
        }
        return null;
      }),
    };

    service = new EmotionCalculatorService({
      logger: mockLogger,
      dataRegistry: mockDataRegistry,
    });
  });

  it('matches runtime gate evaluation for edge mood values (-1, 0, 1)', () => {
    const testValues = [-1, 0, 1];

    for (const valence of testValues) {
      const moodData = { valence };
      const runtimeTrace = service
        .calculateEmotionTraces(moodData, null, null)
        .get('joy');

      const normalizedMood = normalizeMoodAxes(moodData);
      const normalizedSexual = normalizeSexualAxes(null, null);
      const normalizedTraits = normalizeAffectTraits(null);

      const diagnosticsSignals = computeIntensitySignals({
        weights: mockEmotionPrototypes.joy.weights,
        gates: mockEmotionPrototypes.joy.gates,
        normalizedMood,
        normalizedSexual,
        normalizedTraits,
      });

      expect(diagnosticsSignals.gatePass).toBe(runtimeTrace.gatePass);
      expect(diagnosticsSignals.raw).toBeCloseTo(runtimeTrace.raw, 6);
      expect(diagnosticsSignals.final).toBeCloseTo(runtimeTrace.final, 6);
    }
  });
});
