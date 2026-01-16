/**
 * @file Integration tests for prototype type detection via PrototypeFitRankingService.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function createDataRegistry(logger) {
  const registry = new InMemoryDataRegistry({ logger });

  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: {
      joy: {
        weights: { valence: 0.8, arousal: 0.3, engagement: 0.2 },
        gates: ['valence >= 0.2'],
      },
      calm: {
        weights: { valence: 0.4, arousal: -0.4, engagement: 0.1 },
        gates: ['arousal <= 0.4'],
      },
    },
  });

  registry.store('lookups', 'core:sexual_prototypes', {
    id: 'core:sexual_prototypes',
    entries: {
      passion: {
        weights: { sexual_arousal: 0.7, engagement: 0.6, valence: 0.4 },
        gates: ['sexual_arousal >= 0.3', 'engagement >= 0.2'],
      },
    },
  });

  return registry;
}

function createStoredContexts() {
  return [
    {
      moodAxes: { valence: 0.6, arousal: 0.4, threat: 0.1, engagement: 0.5 },
      sexualStates: { sexual_arousal: 0.6 },
    },
    {
      moodAxes: { valence: 0.4, arousal: 0.2, threat: 0.2, engagement: 0.3 },
      sexualStates: { sexual_arousal: 0.4 },
    },
  ];
}

function createEmotionOnlyPrerequisites() {
  return [
    {
      logic: {
        and: [
          { '>=': [{ var: 'emotions.joy' }, 0.2] },
          { '<=': [{ var: 'moodAxes.threat' }, 0.5] },
        ],
      },
    },
  ];
}

describe('PrototypeTypeDetector Integration', () => {
  let logger;
  let prototypeFitRankingService;

  beforeEach(() => {
    logger = createLogger();
    const dataRegistry = createDataRegistry(logger);
    prototypeFitRankingService = new PrototypeFitRankingService({
      dataRegistry,
      logger,
    });
  });

  it('limits results to emotion prototypes when prerequisites reference emotions only', () => {
    const storedContexts = createStoredContexts();
    const prerequisites = createEmotionOnlyPrerequisites();

    const fitResults = prototypeFitRankingService.analyzeAllPrototypeFit(
      prerequisites,
      storedContexts
    );
    const impliedPrototype = prototypeFitRankingService.computeImpliedPrototype(
      prerequisites,
      storedContexts
    );
    const gapDetection = prototypeFitRankingService.detectPrototypeGaps(
      prerequisites,
      storedContexts
    );

    expect(fitResults.leaderboard.length).toBeGreaterThan(0);
    expect(fitResults.leaderboard.every((result) => result.type === 'emotion')).toBe(true);
    expect(impliedPrototype.bySimilarity.length).toBeGreaterThan(0);
    expect(impliedPrototype.bySimilarity.every((result) => result.type === 'emotion')).toBe(true);
    expect(gapDetection.kNearestNeighbors.length).toBeGreaterThan(0);
    expect(gapDetection.kNearestNeighbors.every((result) => result.type === 'emotion')).toBe(true);
  });
});
