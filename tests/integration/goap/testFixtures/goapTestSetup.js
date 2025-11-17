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
import { createEventBusMock } from '../../../common/mocks/createEventBusMock.js';
import { buildDualFormatState } from '../../../common/goap/planningStateTestUtils.js';
import { deepClone } from '../../../../src/utils/cloneUtils.js';
import { createPlanningStateView } from '../../../../src/goap/planner/planningStateView.js';
import { createGoapEventDispatcher } from '../../../../src/goap/debug/goapEventDispatcher.js';
import { createGoapEventTraceProbe } from '../../../../src/goap/debug/goapEventTraceProbe.js';

const GOAP_SETUP_ERRORS = {
  INVALID_TASK_REGISTRY: 'GOAP_SETUP_INVALID_TASK_REGISTRY',
  INVALID_EFFECT: 'GOAP_SETUP_INVALID_EFFECT',
  MISSING_ACTOR: 'GOAP_SETUP_MISSING_ACTOR',
};

const DEFAULT_TASK_NAMESPACE = 'test';

function throwSetupError(code, message) {
  const error = new Error(
    `${code}: ${message} (see specs/goap-system-specs.md#Planner Interface Contract)`
  );
  error.code = code;
  throw error;
}

function mirrorActorComponents(components = {}) {
  const normalized = {};
  for (const [componentId, data] of Object.entries(components)) {
    const cloned = deepClone(data);
    normalized[componentId] = cloned;
    if (componentId.includes(':')) {
      const aliasId = componentId.replace(/:/g, '_');
      normalized[aliasId] = deepClone(data);
    }
  }
  return normalized;
}

function normalizeTasksPayload(rawTasks, { logger }) {
  const warnings = [];
  if (!rawTasks) {
    return { tasks: {}, warnings };
  }

  const normalized = {};

  const registerNamespace = (namespace, namespaceTasks) => {
    normalized[namespace] = namespaceTasks;
  };

  const normalizeTaskMap = (namespace, tasksObject) => {
    const namespaceTasks = {};
    for (const [taskId, taskDef] of Object.entries(tasksObject)) {
      namespaceTasks[taskId] = normalizeSingleTask(
        taskDef,
        warnings,
        logger
      );
    }
    registerNamespace(namespace, namespaceTasks);
  };

  if (Array.isArray(rawTasks)) {
    const warning = 'Deprecated task array payload detected. Tasks will be registered under the "test" namespace automatically.';
    warnings.push(warning);
    logger?.warn(warning);

    const namespaceTasks = {};
    rawTasks.forEach((taskDef, index) => {
      if (!taskDef || typeof taskDef !== 'object') {
        throwSetupError(
          GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
          `Task at index ${index} must be an object`
        );
      }
      const normalizedTask = normalizeSingleTask(taskDef, warnings, logger);
      namespaceTasks[normalizedTask.id] = normalizedTask;
    });

    registerNamespace(DEFAULT_TASK_NAMESPACE, namespaceTasks);
    return { tasks: normalized, warnings };
  }

  if (typeof rawTasks !== 'object') {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
      `Task registry must be an object or array (received ${typeof rawTasks})`
    );
  }

  for (const [namespace, namespaceTasks] of Object.entries(rawTasks)) {
    if (!namespaceTasks || typeof namespaceTasks !== 'object') {
      throwSetupError(
        GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
        `Task namespace "${namespace}" must be an object map`
      );
    }
    normalizeTaskMap(namespace, namespaceTasks);
  }

  return { tasks: normalized, warnings };
}

export async function registerPlanningStateSnapshot(entityManager, planningState, options = {}) {
  if (!planningState || typeof planningState !== 'object') {
    throw new Error('registerPlanningStateSnapshot requires a planning state object');
  }

  const createdEntities = new Set();

  for (const [key, value] of Object.entries(planningState)) {
    if (typeof key !== 'string' || !key.includes(':')) {
      continue;
    }

    const [entityId, componentId] = key.split(':');
    if (!entityId || !componentId) {
      continue;
    }

    if (!entityManager.hasEntity(entityId)) {
      entityManager.createEntity(entityId);
      createdEntities.add(entityId);
    }

    if (value === undefined || value === null || value === false) {
      continue;
    }

    const componentData = typeof value === 'object' ? value : {};
    await entityManager.addComponent(entityId, componentId, componentData);
  }

  const stateView = createPlanningStateView(planningState, {
    metadata: {
      origin: options.origin || 'registerPlanningStateSnapshot',
      actorId: options.actorId || planningState.actor?.id,
    },
  });

  return {
    stateView,
    planningState,
    cleanup: () => {
      for (const entityId of createdEntities) {
        entityManager.deleteEntity(entityId);
      }
    },
  };
}

function normalizeSingleTask(taskDef, warnings, logger) {
  if (!taskDef || typeof taskDef !== 'object') {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
      'Tasks must be objects with an id field'
    );
  }

  if (!taskDef.id || typeof taskDef.id !== 'string') {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
      'Task definitions must include a string id property'
    );
  }

  if (!Array.isArray(taskDef.planningEffects)) {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
      `Task "${taskDef.id}" must include a planningEffects array`
    );
  }

  const normalizedTask = {
    ...taskDef,
    planningEffects: taskDef.planningEffects.map((effect, index) =>
      validatePlanningEffect(effect, taskDef.id, index, warnings, logger)
    ),
  };

  if (
    normalizedTask.structuralGates &&
    typeof normalizedTask.structuralGates === 'object' &&
    !normalizedTask.structuralGates.condition
  ) {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_TASK_REGISTRY,
      `Task "${taskDef.id}" structuralGates must include a condition`
    );
  }

  return normalizedTask;
}

function validatePlanningEffect(effect, taskId, index, warnings, logger) {
  if (!effect || typeof effect !== 'object') {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_EFFECT,
      `Task "${taskId}" effect[${index}] must be an object`
    );
  }

  const normalized = {
    ...effect,
    parameters: effect.parameters ? { ...effect.parameters } : undefined,
  };

  const supportedTypes = Object.values(PlanningEffectsSimulator.OPERATION_TYPES);

  if (!normalized.type) {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_EFFECT,
      `Task "${taskId}" effect[${index}] missing type`
    );
  }

  if (!supportedTypes.includes(normalized.type)) {
    throwSetupError(
      GOAP_SETUP_ERRORS.INVALID_EFFECT,
      `Task "${taskId}" effect[${index}] has unknown type "${normalized.type}"`
    );
  }

  if (!normalized.parameters) {
    return normalized;
  }

  const params = normalized.parameters;

  if (params.entityId && !params.entity_ref) {
    const warning = `Task "${taskId}" effect[${index}] uses deprecated entityId. Use entity_ref instead.`;
    warnings.push(warning);
    logger?.warn(warning);
  }

  if (params.entity_id && !params.entity_ref) {
    const warning = `Task "${taskId}" effect[${index}] uses deprecated entity_id. Use entity_ref instead.`;
    warnings.push(warning);
    logger?.warn(warning);
  }

  if (params.componentId && !params.component_type) {
    const warning = `Task "${taskId}" effect[${index}] uses deprecated componentId. Use component_type instead.`;
    warnings.push(warning);
    logger?.warn(warning);
  }

  if (params.component_id && !params.component_type) {
    const warning = `Task "${taskId}" effect[${index}] uses deprecated component_id. Use component_type instead.`;
    warnings.push(warning);
    logger?.warn(warning);
  }

  return normalized;
}

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
    enableGoapSetupGuards = true,
    eventTraceProbe = null,
    eventTraceProbes = null,
    autoAttachEventTraceProbe = true,
  } = config;

  const testBed = createTestBed();
  const guardsEnabled = enableGoapSetupGuards !== false;
  const guardLogger = testBed.createMockLogger();
  const taskNormalization = guardsEnabled
    ? normalizeTasksPayload(tasks, { logger: guardLogger })
    : null;
  const normalizedTasks = taskNormalization ? taskNormalization.tasks : (tasks || {});
  const taskWarnings = taskNormalization ? taskNormalization.warnings : [];

  // 1. Create real EntityManager
  const entityManager = new SimpleEntityManager();
  const registerPlanningActor = (actorDefinition) => {
    if (!actorDefinition || !actorDefinition.id) {
      throwSetupError(
        GOAP_SETUP_ERRORS.MISSING_ACTOR,
        'registerPlanningActor requires an actor definition with an id'
      );
    }

    const normalizedComponents = mirrorActorComponents(
      actorDefinition.components || {}
    );
    entityManager.addEntity({
      id: actorDefinition.id,
      components: normalizedComponents,
    });

    const planningState = buildDualFormatState({
      id: actorDefinition.id,
      components: actorDefinition.components || {},
    });

    const cleanup = () => {
      entityManager.deleteEntity(actorDefinition.id);
    };

    return {
      actor: entityManager.getEntityInstance(actorDefinition.id),
      planningState,
      cleanup,
    };
  };

  // 2. Create DataRegistry for GOAP goals
  const dataRegistry = createMockDataRegistry();

  // 3. Create GameDataRepository for tasks
  const gameDataRepository = createMockGameDataRepository(normalizedTasks);

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
  if (typeof planner.setExternalTaskLibraryDiagnostics === 'function') {
    planner.setExternalTaskLibraryDiagnostics({ warnings: taskWarnings });
  }
  if (guardsEnabled) {
    const originalPlan = planner.plan.bind(planner);
    planner.plan = (actorId, ...args) => {
      if (!entityManager.hasEntity(actorId)) {
        throwSetupError(
          GOAP_SETUP_ERRORS.MISSING_ACTOR,
          `Actor "${actorId}" must be registered via registerPlanningActor() before calling plan()`
        );
      }
      return originalPlan(actorId, ...args);
    };
  }

  // 9. Create Event Bus + dispatcher (shared across GOAP subsystems)
  const normalizeProbeList = (probeList) => {
    if (!probeList) {
      return [];
    }
    if (!Array.isArray(probeList)) {
      return [probeList].filter(
        (probe) => probe && typeof probe.record === 'function'
      );
    }
    return probeList.filter((probe) => probe && typeof probe.record === 'function');
  };

  const initialProbes = [
    ...normalizeProbeList(eventTraceProbe),
    ...normalizeProbeList(eventTraceProbes),
  ];
  let defaultEventTraceProbeInstance = null;
  let defaultEventTraceProbeDetach = null;
  const shouldAutoAttachTraceProbe = autoAttachEventTraceProbe !== false;
  if (initialProbes.length === 0 && shouldAutoAttachTraceProbe) {
    defaultEventTraceProbeInstance = createGoapEventTraceProbe({
      logger: testBed.createMockLogger(),
    });
    initialProbes.push(defaultEventTraceProbeInstance);
  }

  const eventBus = createEventBusMock();
  const goapEventDispatcherLogger = testBed.createMockLogger();
  const goapEventDispatcher = createGoapEventDispatcher(
    eventBus,
    goapEventDispatcherLogger,
    initialProbes.length > 0 ? { probes: initialProbes } : undefined
  );

  const attachEventTraceProbe = (probe) => {
    if (!probe || typeof probe.record !== 'function') {
      throw new Error('attachEventTraceProbe requires a probe with a record() method');
    }
    if (typeof goapEventDispatcher.registerProbe === 'function') {
      return goapEventDispatcher.registerProbe(probe);
    }
    throw new Error('GOAP event dispatcher does not support dynamic probe registration');
  };

  const bootstrapEventTraceProbe = ({ logger, forceNew } = {}) => {
    if (!forceNew && defaultEventTraceProbeInstance) {
      return {
        probe: defaultEventTraceProbeInstance,
        detach: defaultEventTraceProbeDetach,
      };
    }

    const probeLogger = logger ?? testBed.createMockLogger();
    const probe = createGoapEventTraceProbe({ logger: probeLogger });
    const detach = attachEventTraceProbe(probe);

    if (!forceNew && !defaultEventTraceProbeInstance) {
      defaultEventTraceProbeInstance = probe;
      defaultEventTraceProbeDetach = detach;
    }

    return { probe, detach };
  };

  // 10. Create Refinement Engine (real or mock)
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
      goapEventDispatcher,
      logger: testBed.createMockLogger(),
    });
  }

  // 11. Create Plan Invalidation Detector
  const invalidationDetector = new PlanInvalidationDetector({
    logger: testBed.createMockLogger(),
    jsonLogicEvaluationService: jsonLogicService,
    dataRegistry,
  });

  // 12. Create GOAP Controller
  const controller = new GoapController({
    goapPlanner: planner,
    refinementEngine,
    planInvalidationDetector: invalidationDetector,
    contextAssemblyService,
    jsonLogicService,
    dataRegistry,
    eventBus,
    goapEventDispatcher,
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
    goapEventDispatcher,
    goapEventDispatcherLogger,
    attachEventTraceProbe,
    bootstrapEventTraceProbe,
    defaultEventTraceProbe: defaultEventTraceProbeInstance,
    // Helper methods
    createActor,
    registerGoal,
    registerPlanningActor,
    registerPlanningStateSnapshot: (state, options) =>
      registerPlanningStateSnapshot(entityManager, state, options),
    buildPlanningState: buildDualFormatState,
    world,
  };
}
