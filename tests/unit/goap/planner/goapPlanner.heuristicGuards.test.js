import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed, buildPlanningGoal } from '../../../common/testBed.js';
import { buildPlanningState } from '../../../common/goap/planningStateTestUtils.js';

const TEST_ACTOR_ID = 'actor-heuristic';
const HUNGER_KEY = `${TEST_ACTOR_ID}:core:hunger`;

/**
 * Build a planning state snapshot with a specific hunger value.
 *
 * @param {number} hungerValue - Desired hunger meter value for the actor state.
 * @returns {object} Planning state hash for the actor.
 */
function createState(hungerValue) {
  return buildPlanningState({ [HUNGER_KEY]: hungerValue }, { actorId: TEST_ACTOR_ID });
}

/**
 * Create a numeric planning goal for the heuristic guard tests.
 *
 * @param {object} overrides - Optional overrides for the generated goal object.
 * @returns {object} Planning goal definition.
 */
function createNumericGoal(overrides = {}) {
  return buildPlanningGoal(
    { '<=': [{ var: 'actor.core:hunger' }, 0] },
    {
      id: 'heuristic-guard-goal',
      maxActions: 4,
      ...overrides,
    }
  );
}

describe('GoapPlanner - Heuristic Guards', () => {
  let testBed;
  let planner;
  let mockLogger;
  let mockJsonLogicService;
  let mockRepository;
  let mockEntityManager;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockSpatialIndexManager;
  let mockEffectsSimulator;
  let mockHeuristicRegistry;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockJsonLogicService = testBed.createMock('jsonLogicService', ['evaluateCondition']);
    mockRepository = testBed.createMock('repository', ['get']);
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);
    mockScopeRegistry = testBed.createMock('scopeRegistry', ['getScopeAst']);
    mockScopeEngine = testBed.createMock('scopeEngine', ['resolve']);
    mockSpatialIndexManager = testBed.createMock('spatialIndexManager', []);
    mockEffectsSimulator = testBed.createMock('effectsSimulator', ['simulateEffects']);
    mockHeuristicRegistry = testBed.createMock('heuristicRegistry', ['calculate']);

    mockEntityManager.getEntityInstance.mockReturnValue({
      id: TEST_ACTOR_ID,
      components: {},
    });

    mockRepository.get.mockImplementation((key) => {
      if (key === 'tasks') {
        return {
          core: {
            'core:reduce_hunger': {
              id: 'core:reduce_hunger',
              cost: 1,
              planningEffects: [],
            },
          },
        };
      }
      return null;
    });

    mockEffectsSimulator.simulateEffects.mockImplementation(() => ({
      success: true,
      state: createState(0),
    }));

    mockJsonLogicService.evaluateCondition.mockImplementation((_condition, context = {}) => {
      const hunger = context.state?.[HUNGER_KEY];
      if (typeof hunger === 'number') {
        return hunger <= 0;
      }
      return true;
    });

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicService,
      gameDataRepository: mockRepository,
      entityManager: mockEntityManager,
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      spatialIndexManager: mockSpatialIndexManager,
      planningEffectsSimulator: mockEffectsSimulator,
      heuristicRegistry: mockHeuristicRegistry,
    });
  });

  it('clamps NaN heuristics and logs a single warning per actor/goal/heuristic tuple', () => {
    mockHeuristicRegistry.calculate.mockImplementation(() => Number.NaN);

    const goal = createNumericGoal();
    const initialState = createState(80);

    const plan = planner.plan(TEST_ACTOR_ID, goal, initialState);

    expect(plan).not.toBeNull();
    expect(plan.tasks).toHaveLength(1);

    const warningCalls = mockLogger.warn.mock.calls.filter(([message]) => message === 'Heuristic produced invalid value');
    expect(warningCalls).toHaveLength(1);

    const bypassLogs = mockLogger.debug.mock.calls.filter(([message]) => message === 'Heuristic distance invalid, bypassing guard');
    expect(bypassLogs.length).toBeGreaterThan(0);
  });

  it('recovers when heuristics throw once and continues planning', () => {
    let callCount = 0;
    mockHeuristicRegistry.calculate.mockImplementation((_heuristicId, state) => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error('boom');
      }
      if (typeof state?.[HUNGER_KEY] === 'number') {
        return state[HUNGER_KEY];
      }
      return 0;
    });

    const goal = createNumericGoal();
    const initialState = createState(60);

    const plan = planner.plan(TEST_ACTOR_ID, goal, initialState);

    expect(plan).not.toBeNull();
    expect(plan.cost).toBe(1);

    const warningCalls = mockLogger.warn.mock.calls.filter(([message]) => message === 'Heuristic produced invalid value');
    expect(warningCalls).toHaveLength(1);
  });
});
