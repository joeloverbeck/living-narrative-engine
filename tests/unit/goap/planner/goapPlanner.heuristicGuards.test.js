import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed, buildPlanningGoal } from '../../../common/testBed.js';
import { buildPlanningState } from '../../../common/goap/planningStateTestUtils.js';

const TEST_ACTOR_ID = 'actor-heuristic';
const HUNGER_KEY = `${TEST_ACTOR_ID}:core:hunger`;

/**
 *
 * @param logger
 * @param level
 * @param message
 */
function getLogCount(logger, level, message) {
  return logger[level].mock.calls.filter(([loggedMessage]) => loggedMessage === message).length;
}

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

  it('recovers when a non-initial heuristic throws once and continues planning', () => {
    mockHeuristicRegistry.calculate
      // First call seeds the initial node successfully
      .mockImplementationOnce((_heuristicId, state) => {
        if (typeof state?.[HUNGER_KEY] === 'number') {
          return state[HUNGER_KEY];
        }
        return 0;
      })
      // Second call simulates a successor/state guard throwing once
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      // Remaining calls behave normally
      .mockImplementation((_heuristicId, state) => {
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

  it('bypasses the numeric guard when either estimate is Infinity and logs only once', () => {
    mockHeuristicRegistry.calculate.mockImplementation(() => Number.POSITIVE_INFINITY);

    const goal = createNumericGoal();
    const currentState = createState(50);
    const task = { id: 'core:reduce_hunger', planningEffects: [] };

    const result = planner.testTaskReducesDistance(task, currentState, goal, TEST_ACTOR_ID);

    expect(result).toBe(true);
    expect(getLogCount(mockLogger, 'warn', 'Heuristic produced invalid value')).toBe(1);
    expect(getLogCount(mockLogger, 'debug', 'Heuristic distance invalid, bypassing guard')).toBe(1);
  });

  it('bypasses the numeric guard when current distance sanitizes due to negative outputs', () => {
    mockHeuristicRegistry.calculate.mockImplementation((_heuristicId, state) => {
      if (state?.[HUNGER_KEY] > 0) {
        return -5;
      }
      return 0;
    });

    const goal = createNumericGoal();
    const currentState = createState(70);
    const task = { id: 'core:reduce_hunger', planningEffects: [] };

    const result = planner.testTaskReducesDistance(task, currentState, goal, TEST_ACTOR_ID);

    expect(result).toBe(true);
    expect(getLogCount(mockLogger, 'warn', 'Heuristic produced invalid value')).toBe(1);
    expect(getLogCount(mockLogger, 'debug', 'Heuristic distance invalid, bypassing guard')).toBe(1);
  });

  it('still bypasses when only the next estimate sanitizes', () => {
    mockHeuristicRegistry.calculate.mockImplementation((_heuristicId, state) => {
      if (state?.[HUNGER_KEY] === 0) {
        return Number.POSITIVE_INFINITY;
      }
      return state?.[HUNGER_KEY] ?? 0;
    });

    const goal = createNumericGoal();
    const currentState = createState(20);
    const task = { id: 'core:reduce_hunger', planningEffects: [] };

    const result = planner.testTaskReducesDistance(task, currentState, goal, TEST_ACTOR_ID);

    expect(result).toBe(true);
    expect(getLogCount(mockLogger, 'warn', 'Heuristic produced invalid value')).toBe(1);
    expect(getLogCount(mockLogger, 'debug', 'Heuristic distance invalid, bypassing guard')).toBe(1);
  });
});
