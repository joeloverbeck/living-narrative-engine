/**
 * @file Integration tests for intensity/scoring behavior via PrototypeFitRankingService.
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

const createRegistry = (logger) => {
  const registry = new InMemoryDataRegistry({ logger });
  registry.store('lookups', 'core:emotion_prototypes', {
    id: 'core:emotion_prototypes',
    entries: {
      percentiles: {
        weights: { valence: 1 },
        gates: [],
      },
      conflicts: {
        weights: { valence: -0.6, arousal: -0.4 },
        gates: [],
      },
      composite: {
        weights: { valence: 1 },
        gates: ['valence >= 0.5'],
      },
    },
  });
  return registry;
};

describe('PrototypeIntensityCalculator Integration (via PrototypeFitRankingService)', () => {
  let logger;
  let registry;
  let service;

  beforeEach(() => {
    logger = createLogger();
    registry = createRegistry(logger);
    service = new PrototypeFitRankingService({ dataRegistry: registry, logger });
  });

  it('computes percentiles using the floor index', () => {
    const contexts = Array.from({ length: 10 }, (_, idx) => ({
      moodAxes: { valence: idx * 10 },
    }));

    const result = service.analyzeAllPrototypeFit({ id: 'expr' }, contexts, new Map(), 0.1);
    const entry = result.leaderboard.find((item) => item.prototypeId === 'percentiles');

    expect(entry.intensityDistribution.p50).toBeCloseTo(0.4, 6);
    expect(entry.intensityDistribution.p90).toBeCloseTo(0.8, 6);
    expect(entry.intensityDistribution.p95).toBeCloseTo(0.8, 6);
  });

  it('reports conflicts based on constraint midpoint direction', () => {
    const contexts = [{ moodAxes: { valence: 60, arousal: -40 } }];
    const axisConstraints = new Map([
      ['valence', { min: 0.2, max: 0.6 }],
      ['arousal', { min: -0.8, max: -0.4 }],
    ]);

    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      axisConstraints,
      0.2
    );
    const entry = result.leaderboard.find((item) => item.prototypeId === 'conflicts');

    expect(entry.conflictScore).toBeCloseTo(0.5, 6);
    expect(entry.conflictMagnitude).toBeCloseTo(0.6, 6);
    expect(entry.conflictingAxes).toEqual([
      { axis: 'valence', weight: -0.6, direction: 'negative' },
    ]);
  });

  it('computes composite score from gate pass rate and intensity rate', () => {
    const contexts = [
      { moodAxes: { valence: 0 } },
      { moodAxes: { valence: 50 } },
      { moodAxes: { valence: 100 } },
      { moodAxes: { valence: 100 } },
    ];
    const result = service.analyzeAllPrototypeFit(
      { id: 'expr' },
      contexts,
      new Map(),
      0.6
    );
    const entry = result.leaderboard.find((item) => item.prototypeId === 'composite');

    const gatePassRate = 3 / 4;
    const pIntensityAbove = 2 / 3;
    const conflictScore = 0;
    const exclusionCompatibility = 1;
    const expectedScore =
      0.3 * gatePassRate +
      0.35 * pIntensityAbove +
      0.2 * (1 - conflictScore) +
      0.15 * exclusionCompatibility;

    expect(entry.compositeScore).toBeCloseTo(expectedScore, 6);
  });
});
