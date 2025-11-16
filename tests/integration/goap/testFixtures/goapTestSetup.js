/**
 * @file GOAP test setup factory for integration tests
 * Creates complete GOAP system with all real dependencies properly initialized
 * Based on pattern from aStarPlanning.integration.test.js
 */

import { createTestBed } from '../../../common/testBed.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import GoapController from '../../../../src/goap/controllers/goapController.js';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import RefinementEngine from '../../../../src/goap/refinement/refinementEngine.js';
import PlanInvalidationDetector from '../../../../src/goap/planner/planInvalidationDetector.js';
import PlanningEffectsSimulator from '../../../../src/goap/planner/planningEffectsSimulator.js';
import HeuristicRegistry from '../../../../src/goap/planner/heuristicRegistry.js';
import GoalDistanceHeuristic from '../../../../src/goap/planner/goalDistanceHeuristic.js';
import RelaxedPlanningGraphHeuristic from '../../../../src/goap/planner/relaxedPlanningGraphHeuristic.js';
import NumericConstraintEvaluator from '../../../../src/goap/planner/numericConstraintEvaluator.js';
import ContextAssemblyService from '../../../../src/goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../../../src/goap/services/parameterResolutionService.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import { HasComponentOperator } from '../../../../src/logic/operators/hasComponentOperator.js';
import { createEventBusRecorder } from '../testHelpers/eventBusRecorder.js';

/**
 * Creates mock spatial index manager for scope engine
 * @returns {object} Mock spatial index manager
 */
function createMockSpatialIndexManager() {
  return {
    getEntitiesInLocation: jest.fn(() => []),
    getEntityLocation: jest.fn(() => null),
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
  };
}

/**
 * Creates mock data registry for GOAP goals
 * @returns {object} Mock data registry with goal storage
 */
function createMockDataRegistry() {
  const goals = new Map();

  return {
    register: jest.fn((category, id, data) => {
      if (category === 'goals') {
        if (data === null) {
          // Remove goal when null is registered (for cleanup)
          goals.delete(id);
        } else {
          goals.set(id, data);
        }
      }
    }),
    getAll: jest.fn((category) => {
      if (category === 'goals') {
        return Array.from(goals.values());
      }
      return [];
    }),
    get: jest.fn((category, id) => {
      if (category === 'goals') {
        return goals.get(id) || null;
      }
      return null;
    }),
  };
}

/**
 * Creates mock game data repository for tasks
 * @param {object} tasksData - Task definitions by namespace
 * @returns {object} Mock game data repository
 */
function createMockGameDataRepository(tasksData = {}) {
  return {
    get: jest.fn((key) => {
      if (key === 'tasks') {
        return tasksData;
      }
      return null;
    }),
    getTask: jest.fn((taskId) => {
      // Search all namespaces for the task
      for (const namespace of Object.values(tasksData)) {
        if (namespace[taskId]) {
          return namespace[taskId];
        }
      }
      return null;
    }),
  };
}

/**
 * Creates test scope AST (mock scope definition)
 * @param {string} scopeId - Scope identifier
 * @returns {object} Scope AST
 */
function createTestScopeAst(scopeId) {
  // Simple scope that returns empty array by default
  return {
    type: 'ROOT',
    children: [],
  };
}

/**
 * Creates mock method selection service for refinement engine
 * @param {object} methodsData - Method definitions
 * @returns {object} Mock method selection service
 */
function createMockMethodSelectionService(methodsData = {}) {
  return {
    selectMethod: jest.fn((taskId, actorId, taskParams) => {
      const methods = methodsData[taskId] || [];
      return methods[0] || null; // Return first method if available
    }),
  };
}

/**
 * Creates mock primitive action step executor
 * @returns {object} Mock step executor
 */
function createMockPrimitiveActionStepExecutor() {
  return {
    execute: jest.fn(async (step, task, actorId, params) => {
      return {
        success: true,
        actionId: step.actionId,
        targetBindings: step.targetBindings,
      };
    }),
  };
}

/**
 * Creates mock conditional step executor
 * @returns {object} Mock conditional executor
 */
function createMockConditionalStepExecutor() {
  return {
    execute: jest.fn(async (step, task, actorId, params) => {
      return {
        success: true,
        branchTaken: 'then',
      };
    }),
  };
}

/**
 * Creates complete GOAP system for integration testing
 * @param {object} config - Configuration options
 * @param {object} config.tasks - Task definitions by namespace
 * @param {object} config.methods - Refinement method definitions by task ID
 * @param {boolean} config.mockRefinement - Whether to mock refinement engine
 * @returns {object} GOAP system components
 */
export async function createGoapTestSetup(config = {}) {
  const {
    tasks = {},
    methods = {},
    mockRefinement = false,
  } = config;

  const testBed = createTestBed();

  // 1. Create real EntityManager
  const entityManager = new SimpleEntityManager();

  // 2. Create DataRegistry for GOAP goals
  const dataRegistry = createMockDataRegistry();

  // 3. Create GameDataRepository for tasks
  const gameDataRepository = createMockGameDataRepository(tasks);

  // 4. Create JSON Logic service with custom operators
  const baseJsonLogicService = new JsonLogicEvaluationService({
    logger: testBed.createMockLogger(),
  });

  // Register has_component operator (required for structural gates)
  const hasComponentOp = new HasComponentOperator({
    entityManager,
    logger: testBed.createMockLogger(),
  });

  baseJsonLogicService.addOperation('has_component', function (entityPath, componentId) {
    return hasComponentOp.evaluate([entityPath, componentId], this);
  });

  // Wrap to provide evaluateCondition method (GOAP expects this)
  const jsonLogicService = {
    evaluate: (logic, data) => baseJsonLogicService.evaluate(logic, data),
    evaluateCondition: (logic, data) => baseJsonLogicService.evaluate(logic, data),
  };

  // 5. Create scope system
  const scopeRegistry = new ScopeRegistry({
    logger: testBed.createMockLogger(),
  });

  scopeRegistry.getScopeAst = jest.fn((scopeId) => createTestScopeAst(scopeId));

  const scopeEngine = new ScopeEngine({
    scopeRegistry,
    logger: testBed.createMockLogger(),
  });

  const spatialIndexManager = createMockSpatialIndexManager();

  // 6. Create services for effects simulation
  const contextAssemblyService = new ContextAssemblyService({
    entityManager,
    logger: testBed.createMockLogger(),
  });

  // Add mock methods that RefinementEngine expects
  contextAssemblyService.assembleRefinementContext = jest.fn(async (actorId) => {
    const actor = entityManager.getEntityInstance(actorId);
    return { actor, world: {} };
  });

  // Add mock method that GoapController expects
  contextAssemblyService.assemblePlanningContext = jest.fn((actorId) => {
    const actor = entityManager.getEntityInstance(actorId);
    const world = {}; // Empty world state for tests
    return { actor, world };
  });

  const parameterResolutionService = new ParameterResolutionService({
    entityManager,
    logger: testBed.createMockLogger(),
  });

  const effectsSimulator = new PlanningEffectsSimulator({
    contextAssemblyService,
    parameterResolutionService,
    logger: testBed.createMockLogger(),
  });

  // 7. Create heuristics
  const numericConstraintEvaluator = new NumericConstraintEvaluator({
    jsonLogicEvaluator: jsonLogicService,
    logger: testBed.createMockLogger(),
  });

  const goalDistanceHeuristic = new GoalDistanceHeuristic({
    jsonLogicEvaluator: jsonLogicService,
    numericConstraintEvaluator,
    planningEffectsSimulator: effectsSimulator,
    logger: testBed.createMockLogger(),
  });

  const rpgHeuristic = new RelaxedPlanningGraphHeuristic({
    planningEffectsSimulator: effectsSimulator,
    jsonLogicEvaluator: jsonLogicService,
    logger: testBed.createMockLogger(),
  });

  const heuristicRegistry = new HeuristicRegistry({
    goalDistanceHeuristic,
    relaxedPlanningGraphHeuristic: rpgHeuristic,
    logger: testBed.createMockLogger(),
  });

  // 8. Create GOAP Planner
  const planner = new GoapPlanner({
    logger: testBed.createMockLogger(),
    jsonLogicEvaluationService: jsonLogicService,
    gameDataRepository,
    entityManager,
    scopeRegistry,
    scopeEngine,
    spatialIndexManager,
    planningEffectsSimulator: effectsSimulator,
    heuristicRegistry,
  });

  // 9. Create Refinement Engine (real or mock)
  let refinementEngine;
  if (mockRefinement) {
    refinementEngine = {
      refine: jest.fn(async (taskId, actorId, taskParams) => {
        return {
          success: true,
          stepResults: [
            {
              success: true,
              actionId: 'test:action',
              targetBindings: { target: 'self' },
            },
          ],
          methodId: 'test:method',
          taskId,
          actorId,
          timestamp: Date.now(),
        };
      }),
    };
  } else {
    const methodSelectionService = createMockMethodSelectionService(methods);
    const primitiveActionStepExecutor = createMockPrimitiveActionStepExecutor();
    const conditionalStepExecutor = createMockConditionalStepExecutor();

    // Mock container for lazy resolution
    const mockContainer = {
      resolve: jest.fn((token) => null),
    };

    refinementEngine = new RefinementEngine({
      methodSelectionService,
      container: mockContainer,
      primitiveActionStepExecutor,
      conditionalStepExecutor,
      contextAssemblyService,
      gameDataRepository,
      eventBus: createEventBusRecorder(), // Separate event bus for refinement
      logger: testBed.createMockLogger(),
    });
  }

  // 10. Create Plan Invalidation Detector
  const invalidationDetector = new PlanInvalidationDetector({
    logger: testBed.createMockLogger(),
    jsonLogicEvaluationService: jsonLogicService,
    dataRegistry,
  });

  // 11. Create Event Bus (recording for verification)
  const eventBus = createEventBusRecorder();

  // 12. Create GOAP Controller
  const controller = new GoapController({
    goapPlanner: planner,
    refinementEngine,
    planInvalidationDetector: invalidationDetector,
    contextAssemblyService,
    jsonLogicService,
    dataRegistry,
    eventBus,
    logger: testBed.createMockLogger(),
    parameterResolutionService,
  });

  // Helper methods for tests
  const createActor = (actorId) => {
    entityManager.createEntity(actorId);
    return entityManager.getEntityInstance(actorId);
  };

  const registerGoal = (goal) => {
    dataRegistry.register('goals', goal.id, goal);
  };

  const world = {}; // Simple world state for testing

  return {
    testBed,
    controller,
    planner,
    refinementEngine,
    invalidationDetector,
    contextAssemblyService,
    parameterResolutionService,
    dataRegistry,
    gameDataRepository,
    entityManager,
    jsonLogicService,
    scopeRegistry,
    scopeEngine,
    eventBus,
    spatialIndexManager,
    effectsSimulator,
    heuristicRegistry,
    // Helper methods
    createActor,
    registerGoal,
    world,
  };
}
