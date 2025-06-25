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
          getConditionDefinition: jest.fn().mockReturnValue(undefined),
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
    interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus: bus,
      dataRegistry: testDataRegistry,
      jsonLogicEvaluationService: jsonLogic,
      entityManager,
      operationInterpreter,
    });
    interpreter.initialize();
    return {
      entityManager,
      operationRegistry,
      operationInterpreter,
      systemLogicInterpreter: interpreter,
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
    entityManager: init.entityManager,
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
}

/**
 * Creates a complete test environment for system logic rule testing.
 *
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with (entityManager, eventBus, logger) parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial entities
 * @param {Array<object>} options.rules - System rules to load
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
  return env;
}
