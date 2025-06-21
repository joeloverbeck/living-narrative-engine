/**
 * @file Helper for creating system logic test environments
 * @description Provides a standardized way to set up test environments for rule integration tests
 */
/* eslint-env jest */
/* global jest */

import EventBus from '../../../src/events/eventBus.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { SimpleEntityManager } from '../entities/index.js';
import { createMockLogger } from '../mockFactories/index.js';

/**
 * Creates a complete test environment for system logic rule testing.
 *
 * @param {object} options - Configuration options
 * @param {Function} options.createHandlers - Function to create handlers with (entityManager, eventBus, logger) parameters
 * @param {Array<{id:string,components:object}>} options.entities - Initial entities
 * @param {Array<object>} options.rules - System rules to load
 * @param {object} options.logger - Logger instance (optional, creates mock if not provided)
 * @param {object} options.dataRegistry - Data registry (optional, creates mock if not provided)
 * @returns {object} Test environment with all components and cleanup function
 */
export function createRuleTestEnvironment({
  createHandlers,
  entities = [],
  rules = [],
  logger = null,
  dataRegistry = null,
}) {
  // Create logger if not provided

  const testLogger = logger || createMockLogger();

  // Create data registry if not provided
  const testDataRegistry = dataRegistry || {
    getAllSystemRules: jest.fn().mockReturnValue(rules),
    getConditionDefinition: jest.fn().mockReturnValue(undefined),
  };

  // Create event bus
  const eventBus = new EventBus();

  // Hold core components so they can be recreated on reset
  let entityManager;
  let operationRegistry;
  let operationInterpreter;
  let interpreter;

  // Create JSON logic evaluation service
  const jsonLogic = new JsonLogicEvaluationService({
    logger: testLogger,
    gameDataRepository: testDataRegistry,
  });

  /**
   * Initializes core engine components.
   *
   * @private
   * @param {Array<{id:string,components:object}>} entityList - Entities to load.
   * @returns {object} Initialized environment pieces.
   */
  function initializeEnv(entityList) {
    entityManager = new SimpleEntityManager(entityList);
    operationRegistry = new OperationRegistry({ logger: testLogger });
    const handlers = createHandlers(entityManager, eventBus, testLogger);
    for (const [type, handler] of Object.entries(handlers)) {
      operationRegistry.register(type, handler.execute.bind(handler));
    }
    operationInterpreter = new OperationInterpreter({
      logger: testLogger,
      operationRegistry,
    });
    interpreter = new SystemLogicInterpreter({
      logger: testLogger,
      eventBus,
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

  // The environment object to return
  const env = {
    eventBus,
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
    reset: (newEntities = []) => {
      env.cleanup();
      // Deep clone entities and their components to avoid mutation issues
      const clonedEntities = newEntities.map((e) => ({
        id: e.id,
        components: JSON.parse(JSON.stringify(e.components)),
      }));
      const newEnv = initializeEnv(clonedEntities);
      env.entityManager = newEnv.entityManager;
      env.operationRegistry = newEnv.operationRegistry;
      env.operationInterpreter = newEnv.operationInterpreter;
      env.systemLogicInterpreter = newEnv.systemLogicInterpreter;
    },
  };

  return env;
}

/**
 * Creates a mock data registry for testing.
 *
 * @param {Array<object>} rules - Rules to return from getAllSystemRules
 * @param {object} conditionDefinitions - Condition definitions to return from getConditionDefinition
 * @returns {object} Mock data registry
 */
export function createMockDataRegistry(rules = [], conditionDefinitions = {}) {
  return {
    getAllSystemRules: jest.fn().mockReturnValue(rules),
    getConditionDefinition: jest.fn((id) => conditionDefinitions[id]),
  };
}
