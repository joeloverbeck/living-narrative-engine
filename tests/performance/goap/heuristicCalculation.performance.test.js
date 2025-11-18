import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GoalDistanceHeuristic from '../../../src/goap/planner/goalDistanceHeuristic.js';
import RelaxedPlanningGraphHeuristic from '../../../src/goap/planner/relaxedPlanningGraphHeuristic.js';
import PlanningEffectsSimulator from '../../../src/goap/planner/planningEffectsSimulator.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../src/goap/services/parameterResolutionService.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { HasComponentOperator } from '../../../src/logic/operators/hasComponentOperator.js';
import NumericConstraintEvaluator from '../../../src/goap/planner/numericConstraintEvaluator.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { registerPlanningStateSnapshot } from '../../integration/goap/testFixtures/goapTestSetup.js';

describe('GOAP Heuristics - Performance Requirements', () => {
  let testBed;
  let goalDistanceHeuristic;
  let rpgHeuristic;
  let entityManager;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = new SimpleEntityManager();

    const parameterResolutionService = new ParameterResolutionService({
      entityManager,
      logger: mockLogger,
    });

    const contextAssemblyService = new ContextAssemblyService({
      entityManager,
      logger: mockLogger,
      enableKnowledgeLimitation: false,
    });

    const planningEffectsSimulator = new PlanningEffectsSimulator({
      parameterResolutionService,
      contextAssemblyService,
      logger: mockLogger,
    });

    const jsonLogicEvaluator = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    const hasComponentOp = new HasComponentOperator({
      entityManager,
      logger: mockLogger,
    });

    jsonLogicEvaluator.addOperation('has_component', function (entityPath, componentId) {
      return hasComponentOp.evaluate([entityPath, componentId], this);
    });

    const numericConstraintEvaluator = new NumericConstraintEvaluator({
      jsonLogicEvaluator,
      logger: mockLogger,
      goapEventDispatcher: { dispatch: () => {} },
    });

    goalDistanceHeuristic = new GoalDistanceHeuristic({
      jsonLogicEvaluator,
      numericConstraintEvaluator,
      planningEffectsSimulator,
      logger: mockLogger,
    });

    rpgHeuristic = new RelaxedPlanningGraphHeuristic({
      planningEffectsSimulator,
      jsonLogicEvaluator,
      logger: mockLogger,
      maxLayers: 10,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should calculate goal-distance heuristic quickly for moderate condition counts', () => {
    const state = {};
    const goal = {
      conditions: Array.from({ length: 20 }, (_, i) => ({
        condition: {
          has_component: [`entity-${i}`, 'core:test'],
        },
      })),
    };

    const start = performance.now();
    goalDistanceHeuristic.calculate(state, goal);
    const duration = performance.now() - start;

    // Allow modest headroom for CI jitter while enforcing a tight upper bound.
    expect(duration).toBeLessThan(5);
  });

  it('should calculate RPG heuristic reasonably fast for small domains', async () => {
    const state = {
      'entity-1:core:hungry': true,
    };

    await registerPlanningStateSnapshot(entityManager, state);

    const goal = {
      conditions: [
        {
          condition: {
            has_component: ['entity-1', 'core:shelter'],
          },
        },
      ],
    };

    const tasks = Array.from({ length: 20 }, (_, i) => ({
      id: `task-${i}`,
      planningPreconditions: [],
      planningEffects: [
        {
          type: 'ADD_COMPONENT',
          parameters: {
            entityId: 'entity-1',
            componentId: `core:component-${i}`,
            data: {},
          },
        },
      ],
    }));

    const start = performance.now();
    rpgHeuristic.calculate(state, goal, tasks);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10);
  });
});
