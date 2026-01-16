/**
 * @file Integration tests for registry behavior via PrototypeFitRankingService
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createDataRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });

  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 0.8, arousal: 0.3 },
        gates: ['valence >= 0.2'],
      },
      calm: {
        weights: { valence: 0.4, arousal: -0.4 },
        gates: ['arousal <= 0.4'],
      },
    },
  });

  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: {
      aroused: {
        weights: { sexual_arousal: 0.9, valence: 0.2 },
        gates: ['sexual_arousal >= 0.3'],
      },
      passion: {
        weights: { sexual_arousal: 0.7, engagement: 0.6 },
        gates: ['sexual_arousal >= 0.3', 'engagement >= 0.2'],
      },
    },
  });

  return registry;
};

const createStoredContexts = () => [
  {
    moodAxes: { valence: 0.6, arousal: 0.4, engagement: 0.5 },
    sexualStates: { sexual_arousal: 0.6 },
  },
  {
    moodAxes: { valence: 0.4, arousal: 0.2, engagement: 0.3 },
    sexualStates: { sexual_arousal: 0.4 },
  },
  {
    moodAxes: { valence: 0.2, arousal: 0.5, engagement: 0.7 },
    sexualStates: { sexual_arousal: 0.7 },
  },
];

const createMixedPrerequisites = () => [
  {
    logic: {
      and: [
        { '>=': [{ var: 'sexualStates.aroused' }, 0.4] },
        { '>=': [{ var: 'emotions.joy' }, 0.2] },
        { '>=': [{ var: 'moodAxes.valence' }, 0.1] },
      ],
    },
  },
];

const createSexualOnlyPrerequisites = () => [
  {
    logic: {
      and: [
        { '>=': [{ var: 'sexualStates.aroused' }, 0.4] },
        { '>=': [{ var: 'sexualStates.passion' }, 0.3] },
      ],
    },
  },
];

const createEmotionOnlyPrerequisites = () => [
  {
    logic: {
      and: [
        { '>=': [{ var: 'emotions.joy' }, 0.2] },
        { '>=': [{ var: 'emotions.calm' }, 0.2] },
      ],
    },
  },
];

describe('PrototypeRegistryService Integration (via PrototypeFitRankingService)', () => {
  let logger;
  let service;
  let dataRegistry;

  beforeEach(() => {
    logger = createLogger();
    dataRegistry = createDataRegistry(logger);
    service = new PrototypeFitRankingService({ dataRegistry, logger });
  });

  it('includes both emotion and sexual prototypes for mixed prerequisites', () => {
    const results = service.analyzeAllPrototypeFit(
      createMixedPrerequisites(),
      createStoredContexts(),
      new Map()
    );

    expect(results.leaderboard.some((result) => result.type === 'emotion')).toBe(true);
    expect(results.leaderboard.some((result) => result.type === 'sexual')).toBe(true);
  });

  it('limits results to sexual prototypes for sexual-only prerequisites', () => {
    const results = service.analyzeAllPrototypeFit(
      createSexualOnlyPrerequisites(),
      createStoredContexts(),
      new Map()
    );

    expect(results.leaderboard.length).toBeGreaterThan(0);
    expect(results.leaderboard.every((result) => result.type === 'sexual')).toBe(true);
  });

  it('limits results to emotion prototypes for emotion-only prerequisites', () => {
    const results = service.analyzeAllPrototypeFit(
      createEmotionOnlyPrerequisites(),
      createStoredContexts(),
      new Map()
    );

    expect(results.leaderboard.length).toBeGreaterThan(0);
    expect(results.leaderboard.every((result) => result.type === 'emotion')).toBe(true);
  });

  it('returns qualified definitions for prototype refs', () => {
    const definitions = service.getPrototypeDefinitions([
      { type: 'emotion', id: 'joy' },
      { type: 'sexual', id: 'aroused' },
    ]);

    expect(definitions).toEqual({
      'emotions:joy': {
        weights: { valence: 0.8, arousal: 0.3 },
        gates: ['valence >= 0.2'],
      },
      'sexualStates:aroused': {
        weights: { sexual_arousal: 0.9, valence: 0.2 },
        gates: ['sexual_arousal >= 0.3'],
      },
    });
  });

  it('returns empty definitions when registry is empty', () => {
    const emptyRegistry = new InMemoryDataRegistry({ logger });
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
