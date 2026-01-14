/**
 * @file Unit tests for EmotionCalculatorService gate invariants.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EmotionCalculatorService from '../../../src/emotions/emotionCalculatorService.js';

describe('EmotionCalculatorService gate invariants', () => {
  let service;
  let mockLogger;
  let mockDataRegistry;

  const mockEmotionPrototypes = {
    joy: {
      weights: { valence: 1.0 },
      gates: ['valence >= 0.20'],
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

  it('clamps final intensity to 0 when a gate fails', () => {
    const traces = service.calculateEmotionTraces({ valence: 10 }, null, null);
    const joyTrace = traces.get('joy');

    expect(joyTrace.gatePass).toBe(false);
    expect(joyTrace.final).toBe(0);
  });

  it('treats non-zero final intensity as a gate pass', () => {
    const traces = service.calculateEmotionTraces({ valence: 40 }, null, null);
    const joyTrace = traces.get('joy');

    expect(joyTrace.final).toBeGreaterThan(0);
    expect(joyTrace.gatePass).toBe(true);
  });
});
