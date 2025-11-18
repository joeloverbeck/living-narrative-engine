import { jest } from '@jest/globals';
import GoapPlanner from '../../../../../src/goap/planner/goapPlanner.js';

/**
 * Factory that builds a GoapPlanner instance with fully mocked dependencies.
 *
 * @param {object} [options]
 * @param {string} [options.actorId]
 * @returns {{planner: GoapPlanner, mocks: object}}
 */
export function createPlannerHarness(options = {}) {
  const actorId = options.actorId ?? 'planner-harness-actor';

  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    isLogger: () => true,
  };

  const jsonLogicEvaluationService = {
    evaluateCondition: jest.fn(),
  };

  const gameDataRepository = {
    get: jest.fn(),
  };

  const entityManager = {
    getEntityInstance: jest.fn().mockReturnValue({ id: actorId, components: {} }),
  };

  const scopeRegistry = {
    getScopeAst: jest.fn(),
  };

  const scopeEngine = {
    resolve: jest.fn(),
  };

  const spatialIndexManager = {};

  const planningEffectsSimulator = {
    simulateEffects: jest.fn(),
  };

  const heuristicRegistry = {
    calculate: jest.fn(),
  };

  const planner = new GoapPlanner({
    logger,
    jsonLogicEvaluationService,
    gameDataRepository,
    entityManager,
    scopeRegistry,
    scopeEngine,
    spatialIndexManager,
    planningEffectsSimulator,
    heuristicRegistry,
  });

  return {
    planner,
    mocks: {
      logger,
      jsonLogicEvaluationService,
      gameDataRepository,
      entityManager,
      scopeRegistry,
      scopeEngine,
      spatialIndexManager,
      effectsSimulator: planningEffectsSimulator,
      heuristicRegistry,
    },
  };
}
