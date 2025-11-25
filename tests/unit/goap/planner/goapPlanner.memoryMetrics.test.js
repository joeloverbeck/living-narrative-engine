import { describe, expect, it, jest } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';

const createDependencies = () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  jsonLogicEvaluationService: { evaluateCondition: jest.fn() },
  gameDataRepository: { get: jest.fn() },
  entityManager: { getEntityInstance: jest.fn() },
  scopeRegistry: { getScopeAst: jest.fn() },
  scopeEngine: { resolve: jest.fn() },
  spatialIndexManager: {},
  planningEffectsSimulator: { simulateEffects: jest.fn() },
  heuristicRegistry: { calculate: jest.fn() },
});

describe('GoapPlanner memory metrics', () => {
  it('exposes bounded cache sizes and limits', () => {
    const planner = new GoapPlanner(createDependencies());

    const metrics = planner.getCacheMetrics();

    expect(metrics.goalPathNormalizationCache).toMatchObject({
      size: 0,
      maxSize: 100,
    });
  });
});
