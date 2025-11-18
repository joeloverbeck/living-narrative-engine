import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GoapPlanner from '../../src/goap/planner/goapPlanner.js';
import {
  GOAP_PLANNER_CONTRACT,
  hasValidPlanArity,
} from '../../src/goap/planner/goapPlannerContractDefinition.js';

/**
 *
 */
function createPlannerDependencies() {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  return {
    logger,
    jsonLogicEvaluationService: {
      evaluateCondition: jest.fn().mockReturnValue(true),
    },
    gameDataRepository: {
      get: jest.fn().mockReturnValue({}),
    },
    entityManager: {
      getEntityInstance: jest.fn().mockReturnValue({
        id: 'actor-1',
        components: {},
      }),
    },
    scopeRegistry: {
      getScopeAst: jest.fn().mockReturnValue({}),
    },
    scopeEngine: {
      resolve: jest.fn().mockReturnValue(new Set()),
    },
    spatialIndexManager: {},
    planningEffectsSimulator: {
      simulateEffects: jest.fn().mockReturnValue({ success: true, state: {}, cost: 0 }),
    },
    heuristicRegistry: {
      calculate: jest.fn().mockReturnValue(0),
    },
  };
}

describe('GOAP Planner Contract', () => {
  let planner;

  beforeEach(() => {
    planner = new GoapPlanner(createPlannerDependencies());
  });

  it('exposes the required methods from the shared contract', () => {
    for (const method of GOAP_PLANNER_CONTRACT.requiredMethods) {
      expect(typeof planner[method]).toBe('function');
    }
  });

  it('uses the expected plan signature', () => {
    expect(planner.plan.length).toBe(GOAP_PLANNER_CONTRACT.methodSignatures.plan);
    expect(hasValidPlanArity(planner.plan)).toBe(true);
  });

  it('returns null for unsolved plans and exposes failure copies', () => {
    const result = planner.plan(
      'actor-1',
      {
        id: 'goal:test',
        goalState: { '==': [{ var: 'actor.state.hunger' }, 0] },
      },
      { 'actor-1:core:needs:hunger': 30 }
    );

    expect(result).toBeNull();

    const failure = planner.getLastFailure();
    expect(failure).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        reason: expect.any(String),
      })
    );

    if (failure) {
      failure.reason = 'mutated';
      expect(planner.getLastFailure().reason).not.toBe('mutated');
    }
  });
});
