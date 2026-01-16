/**
 * @file Unit tests for registry behavior via PrototypeFitRankingService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDataRegistry = (lookups) => ({
  get: jest.fn(() => null),
  getLookupData: jest.fn((key) => lookups[key] || null),
});

describe('PrototypeRegistryService (via PrototypeFitRankingService)', () => {
  let service;
  let dataRegistry;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = createDataRegistry({
      'core:emotion_prototypes': {
        entries: {
          joy: {
            weights: { valence: 0.8, arousal: 0.6 },
            gates: ['valence >= 0.5'],
          },
          calm: {
            weights: { valence: 0.4 },
          },
        },
      },
      'core:sexual_prototypes': {
        entries: {
          aroused: {
            weights: { sexual_arousal: 0.9, desire: 0.7 },
            gates: ['sexual_arousal >= 0.6'],
          },
          neutral: {},
        },
      },
    });

    service = new PrototypeFitRankingService({ dataRegistry, logger });
  });

  it('returns qualified definitions for emotion and sexual refs', () => {
    const definitions = service.getPrototypeDefinitions([
      { type: 'emotion', id: 'joy' },
      { type: 'sexual', id: 'aroused' },
    ]);

    expect(definitions).toEqual({
      'emotions:joy': {
        weights: { valence: 0.8, arousal: 0.6 },
        gates: ['valence >= 0.5'],
      },
      'sexualStates:aroused': {
        weights: { sexual_arousal: 0.9, desire: 0.7 },
        gates: ['sexual_arousal >= 0.6'],
      },
    });
  });

  it('ignores missing prototype refs', () => {
    const definitions = service.getPrototypeDefinitions([
      { type: 'emotion', id: 'joy' },
      { type: 'sexual', id: 'missing' },
    ]);

    expect(definitions).toEqual({
      'emotions:joy': {
        weights: { valence: 0.8, arousal: 0.6 },
        gates: ['valence >= 0.5'],
      },
    });
  });

  it('returns empty object for non-array input', () => {
    expect(service.getPrototypeDefinitions(null)).toEqual({});
  });

  it('defaults missing weights and gates when present in registry', () => {
    const definitions = service.getPrototypeDefinitions([
      { type: 'emotion', id: 'calm' },
      { type: 'sexual', id: 'neutral' },
    ]);

    expect(definitions).toEqual({
      'emotions:calm': {
        weights: { valence: 0.4 },
        gates: [],
      },
      'sexualStates:neutral': {
        weights: {},
        gates: [],
      },
    });
  });

  it('returns empty object for unsupported prototype types', () => {
    const emotionOnlyRegistry = createDataRegistry({
      'core:emotion_prototypes': {
        entries: {
          joy: {
            weights: { valence: 0.8, arousal: 0.6 },
            gates: ['valence >= 0.5'],
          },
        },
      },
    });
    const emotionOnlyService = new PrototypeFitRankingService({
      dataRegistry: emotionOnlyRegistry,
      logger,
    });

    expect(
      emotionOnlyService.getPrototypeDefinitions([{ type: 'invalid', id: 'joy' }])
    ).toEqual({});
  });

  it('returns empty object when registry lookups are missing', () => {
    const emptyRegistry = createDataRegistry({});
    const emptyService = new PrototypeFitRankingService({
      dataRegistry: emptyRegistry,
      logger,
    });

    expect(
      emptyService.getPrototypeDefinitions([
        { type: 'emotion', id: 'joy' },
        { type: 'sexual', id: 'aroused' },
      ])
    ).toEqual({});
  });
});
