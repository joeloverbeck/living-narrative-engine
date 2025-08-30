/**
 * @file Helper for creating system logic test environments
 * @description Provides a standardized way to set up test environments for rule integration tests
 */
/* eslint-env jest */
/* global jest */

import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { SimpleEntityManager } from '../entities/index.js';
import {
  createMockLogger,
  createCapturingEventBus,
} from '../mockFactories/index.js';
import { deepClone } from '../../../src/utils/cloneUtils.js';

/**
 * Creates base services needed for rule engine tests.
 *
 * @description Builds the fundamental components used by the rule test
 * environment. This includes entity and operation managers along with the
 * system logic interpreter.
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with
 *   `(entityManager, eventBus, logger)` parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial
 *   entities to load
 * @param {Array<object>} options.rules - System rules to load
 * @param {Array<object>} [options.actions] - Action definitions to load
 * @param {object} [options.conditions] - Condition definitions to load
 * @param {object} [options.macros] - Macro definitions to load
 * @param {object} [options.logger] - Logger instance to use
 * @param {() => object} [options.createLogger] - Factory to create a logger if
 *   none is provided
 * @param {object} [options.dataRegistry] - Data registry instance to use
 * @param {() => object} [options.createDataRegistry] - Factory to create a data
 *   registry if none is provided
 * @param {object} [options.eventBus] - Event bus instance to use
 * @param {() => object} [options.createEventBus] - Factory to create an event
 *   bus if none is provided
 * @returns {{
 *   eventBus: import('../../../src/events/eventBus.js').default,
 *   events: any[],
 *   operationRegistry: OperationRegistry,
 *   operationInterpreter: OperationInterpreter,
 *   jsonLogic: JsonLogicEvaluationService,
 *   systemLogicInterpreter: SystemLogicInterpreter,
 *   entityManager: SimpleEntityManager,
 *   logger: any,
 *   dataRegistry: any,
 *   cleanup: () => void,
 *   initializeEnv: (entities: Array<{id:string,components:object}>) => any
 * }} Base environment pieces used for tests.
 */
export function createBaseRuleEnvironment({
  createHandlers,
  entities = [],
  rules = [],
  actions = [],
  conditions = {},
  macros = {},
  logger = null,
  createLogger = null,
  dataRegistry = null,
  createDataRegistry = null,
  eventBus = null,
  createEventBus = null,
}) {
  const testLogger =
    logger ||
    (typeof createLogger === 'function' ? createLogger() : createMockLogger());
  const testDataRegistry =
    dataRegistry ||
    (typeof createDataRegistry === 'function'
      ? createDataRegistry()
      : {
          getAllSystemRules: jest.fn().mockReturnValue(rules),
          getAllActionDefinitions: jest.fn().mockReturnValue(actions),
          getConditionDefinition: jest
            .fn()
            .mockImplementation((conditionId) => {
              return conditions[conditionId] || undefined;
            }),
          getMacroDefinition: jest.fn().mockImplementation((macroId) => {
            return macros[macroId] || undefined;
          }),
        });

  const bus =
    eventBus ||
    (typeof createEventBus === 'function'
      ? createEventBus()
      : createCapturingEventBus());

  let entityManager;
  let operationRegistry;
  let operationInterpreter;
  let interpreter;

  const jsonLogic = new JsonLogicEvaluationService({
    logger: testLogger,
    gameDataRepository: testDataRegistry,
  });

  /**
   * Initializes core engine components for the rule environment.
   *
   * @private
   * @param {Array<{id:string,components:object}>} entityList - Entities to load.
   * @returns {{
   *   entityManager: SimpleEntityManager,
   *   operationRegistry: OperationRegistry,
   *   operationInterpreter: OperationInterpreter,
   *   systemLogicInterpreter: SystemLogicInterpreter
   * }} Initialized services.
   */
  function initializeEnv(entityList) {
    entityManager = new SimpleEntityManager(entityList);
    operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(entityManager, bus, testLogger);
    for (const [type, handler] of Object.entries(handlers)) {
      if (!handler || typeof handler.execute !== 'function') {
        throw new Error(
          `Handler for ${type} must be an object with an execute() method`
        );
      }
      operationRegistry.register(type, handler.execute.bind(handler));
    }
    operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });
    // Create the bodyGraphService mock that actually checks entity components
    const mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(
        (bodyComponent, componentId, propertyPath, expectedValue) => {
          // If no body component or root, return not found
          if (!bodyComponent || !bodyComponent.root) {
            return { found: false };
          }

          // Check the root entity first
          const rootEntity = entityManager.getEntity(bodyComponent.root);
          if (rootEntity && rootEntity.components[componentId]) {
            const component = rootEntity.components[componentId];
            const actualValue = propertyPath
              ? component[propertyPath]
              : component;
            if (actualValue === expectedValue) {
              return { found: true, partId: bodyComponent.root };
            }
          }

          // For test environments, also check all entities that look like body parts
          // This is a simplified approach since we don't have the full graph traversal
          const allEntities = entityManager.getAllEntities();
          for (const entity of allEntities) {
            // Check if this entity has the component we're looking for
            if (entity.components && entity.components[componentId]) {
              const component = entity.components[componentId];
              const actualValue = propertyPath
                ? component[propertyPath]
                : component;
              if (actualValue === expectedValue) {
                return { found: true, partId: entity.id };
              }
            }
          }

          return { found: false };
        }
      ),
    };

    // Create and initialize ActionIndex
    const actionIndex = new ActionIndex({
      logger: testLogger,
      entityManager,
    });
    actionIndex.buildIndex(actions);

    interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: testDataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager,
      operationInterpreter,
      bodyGraphService: mockBodyGraphService,
    });
    interpreter.initialize();
    return {
      entityManager,
      operationRegistry,
      operationInterpreter,
      systemLogicInterpreter: interpreter,
      actionIndex,
      handlers,
    };
  }

  const init = initializeEnv(entities);

  return {
    eventBus: bus,
    events: bus.events,
    operationRegistry: init.operationRegistry,
    operationInterpreter: init.operationInterpreter,
    jsonLogic,
    systemLogicInterpreter: init.systemLogicInterpreter,
    // Alias for backward compatibility with tests
    systemLogicOrchestrator: init.systemLogicInterpreter,
    entityManager: init.entityManager,
    actionIndex: init.actionIndex,
    handlers: init.handlers,
    logger: testLogger,
    dataRegistry: testDataRegistry,
    cleanup: () => {
      interpreter.shutdown();
    },
    initializeEnv,
  };
}

/**
 * Resets an existing rule test environment.
 *
 * @description Shuts down the current interpreter and reinitializes core
 * components using the provided entities.
 * @param {ReturnType<typeof createBaseRuleEnvironment>} env - Environment to
 *   reset
 * @param {Array<{id:string,components:object}>} newEntities - Entities to load
 *   after reset
 */
export function resetRuleEnvironment(env, newEntities = []) {
  env.cleanup();
  const clonedEntities = newEntities.map((e) => deepClone(e));
  const newEnv = env.initializeEnv(clonedEntities);
  env.entityManager = newEnv.entityManager;
  env.operationRegistry = newEnv.operationRegistry;
  env.operationInterpreter = newEnv.operationInterpreter;
  env.systemLogicInterpreter = newEnv.systemLogicInterpreter;
  env.actionIndex = newEnv.actionIndex;
}

/**
 * Helper function to create a properly formatted attempt_action event payload
 * that meets schema requirements and supports both legacy and multi-target formats.
 *
 * @param {object} params - Event parameters
 * @param {string} params.actorId - The acting entity ID
 * @param {string} params.actionId - The action being attempted
 * @param {string} [params.targetId] - Primary target for legacy format
 * @param {object} [params.targets] - Multi-target format targets
 * @param {string} [params.originalInput] - Original input (defaults to generated)
 * @returns {object} Properly formatted event payload
 */
export function createAttemptActionPayload({
  actorId,
  actionId,
  targetId = null,
  targets = null,
  originalInput = null,
}) {
  // Build the base payload with required fields
  const payload = {
    eventName: 'core:attempt_action',
    actorId,
    actionId,
    originalInput: originalInput || `${actionId} ${targetId || 'none'}`.trim(),
  };

  // Add target information based on what's provided
  if (targets) {
    // Multi-target format
    payload.targets = targets;
    // Set targetId as primary for backward compatibility
    if (targets.primary) {
      payload.targetId =
        typeof targets.primary === 'string'
          ? targets.primary
          : targets.primary.entityId;
    }
  } else if (targetId) {
    // Legacy single-target format
    payload.targetId = targetId;
  }

  return payload;
}

/**
 * Creates a complete test environment for system logic rule testing.
 *
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with (entityManager, eventBus, logger) parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial entities
 * @param {Array<object>} options.rules - System rules to load
 * @param {Array<object>} [options.actions] - Action definitions to load
 * @param {object} [options.conditions] - Condition definitions to load
 * @param {object} [options.macros] - Macro definitions to load
 * @param {object} [options.logger] - Logger instance to use
 * @param {() => object} [options.createLogger] - Logger factory
 * @param {object} [options.dataRegistry] - Data registry instance to use
 * @param {() => object} [options.createDataRegistry] - Data registry factory
 * @param {object} [options.eventBus] - Event bus instance to use
 * @param {() => object} [options.createEventBus] - Event bus factory
 * @returns {object} Test environment with all components and cleanup function
 */
export function createRuleTestEnvironment(options) {
  const env = createBaseRuleEnvironment(options);
  env.reset = (newEntities = []) => {
    resetRuleEnvironment(env, newEntities);
  };

  // Add the helper function to the environment for easy access
  env.createAttemptActionPayload = createAttemptActionPayload;

  // Add a convenience method for dispatching attempt_action events with validation
  env.dispatchAction = async (params) => {
    const payload = createAttemptActionPayload(params);

    // Validate action using ActionIndex before dispatch
    if (payload.actionId) {
      const actor = { id: payload.actorId };
      const isValid = env.validateAction(payload.actorId, payload.actionId);

      if (!isValid) {
        env.logger.debug(
          `Action ${payload.actionId} filtered out by ActionIndex for actor ${payload.actorId}`
        );
        // Return early - don't dispatch the event
        return true;
      }
    }

    return env.eventBus.dispatch('core:attempt_action', payload);
  };

  // Add action validation helper
  env.validateAction = (actorId, actionId) => {
    // Check if entity exists
    const actor = env.entityManager.getEntityInstance(actorId);
    if (!actor) {
      return false; // Entity doesn't exist, action invalid
    }

    // Create proper actor entity object for ActionIndex
    const actorEntity = { id: actorId };
    const candidates = env.actionIndex.getCandidateActions(actorEntity);
    return candidates.some((action) => action.id === actionId);
  };

  return env;
}
