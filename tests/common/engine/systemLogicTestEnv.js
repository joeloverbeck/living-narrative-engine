/**
 * @file Helper for creating system logic test environments
 * @description Provides a standardized way to set up test environments for rule integration tests
 */

import EventBus from '../../../src/events/eventBus.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';

/**
 * Minimal in-memory entity manager used for integration tests.
 *
 * @class SimpleEntityManager
 * @description Provides just enough of IEntityManager for the tested handlers.
 */
class SimpleEntityManager {
  /**
   * Create the manager with the provided entities.
   *
   * @param {Array<{id:string,components:object}>} entities - initial entities
   */
  constructor(entities) {
    console.log(
      'DEBUG: [SimpleEntityManager constructor] received entities:',
      JSON.stringify(entities, null, 2)
    );
    this.entities = new Map();
    for (const e of entities) {
      console.log(
        'DEBUG: Processing entity:',
        e.id,
        'with components:',
        JSON.stringify(e.components, null, 2)
      );
      this.entities.set(e.id, {
        id: e.id,
        components: JSON.parse(JSON.stringify(e.components)),
        getComponentData(type) {
          return this.components[type] ?? null;
        },
        hasComponent(type) {
          return Object.prototype.hasOwnProperty.call(this.components, type);
        },
      });
      console.log(
        'DEBUG: Stored entity:',
        e.id,
        'with components:',
        JSON.stringify(this.entities.get(e.id).components, null, 2)
      );
    }
  }

  /**
   * Return an entity instance.
   *
   * @param {string} id - entity id
   * @returns {object|undefined} entity object
   */
  getEntityInstance(id) {
    return this.entities.get(id);
  }

  /**
   * Retrieve component data.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {any} component data or null
   */
  getComponentData(id, type) {
    return this.entities.get(id)?.components[type] ?? null;
  }

  /**
   * Check if an entity has a component.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @returns {boolean} true if present
   */
  hasComponent(id, type) {
    return Object.prototype.hasOwnProperty.call(
      this.entities.get(id)?.components || {},
      type
    );
  }

  /**
   * Add or replace a component on an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   * @param {object} data - component data
   */
  addComponent(id, type, data) {
    const ent = this.entities.get(id);
    if (ent) {
      ent.components[type] = JSON.parse(JSON.stringify(data));
      return true;
    }
    return false;
  }

  /**
   * Remove a component from an entity.
   *
   * @param {string} id - entity id
   * @param {string} type - component type
   */
  removeComponent(id, type) {
    const ent = this.entities.get(id);
    if (ent) {
      delete ent.components[type];
      return true;
    }
    return false;
  }
}

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
  const testLogger = logger || {
    debug: (...args) => {
      console.log('[DEBUG]', ...args);
    },
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // Create data registry if not provided
  const testDataRegistry = dataRegistry || {
    getAllSystemRules: jest.fn().mockReturnValue(rules),
    getConditionDefinition: jest.fn().mockReturnValue(undefined),
  };

  // Create event bus
  const eventBus = new EventBus();

  // Create entity manager
  let entityManager = new SimpleEntityManager(entities);

  // Create operation registry
  let operationRegistry = new OperationRegistry({ logger: testLogger });

  // Create handlers using the provided function
  let handlers = createHandlers(entityManager, eventBus, testLogger);
  for (const [type, handler] of Object.entries(handlers)) {
    if (type === 'DISPATCH_EVENT') {
      const origExecute = handler.execute.bind(handler);
      handler.execute = function (...args) {
        console.log(
          '[DEBUG] DISPATCH_EVENT handler called with args:',
          JSON.stringify(args, null, 2)
        );
        return origExecute(...args);
      };
    }
    operationRegistry.register(type, handler.execute.bind(handler));
  }

  // Create operation interpreter
  let operationInterpreter = new OperationInterpreter({
    logger: testLogger,
    operationRegistry,
  });

  // Create JSON logic evaluation service
  const jsonLogic = new JsonLogicEvaluationService({
    logger: testLogger,
    gameDataRepository: testDataRegistry,
  });

  // Create system logic interpreter
  let interpreter = new SystemLogicInterpreter({
    logger: testLogger,
    eventBus,
    dataRegistry: testDataRegistry,
    jsonLogicEvaluationService: jsonLogic,
    entityManager,
    operationInterpreter,
  });

  // Initialize the interpreter
  interpreter.initialize();

  // The environment object to return
  const env = {
    eventBus,
    operationRegistry,
    operationInterpreter,
    jsonLogic,
    systemLogicInterpreter: interpreter,
    entityManager,
    logger: testLogger,
    dataRegistry: testDataRegistry,
    cleanup: () => {
      interpreter.shutdown();
    },
    reset: (newEntities = []) => {
      env.cleanup();
      // Unique debug log for reset
      console.log(
        'DEBUG: [reset] called with newEntities:',
        JSON.stringify(newEntities, null, 2)
      );
      // Deep clone entities and their components to avoid mutation issues
      const clonedEntities = newEntities.map((e) => ({
        id: e.id,
        components: JSON.parse(JSON.stringify(e.components)),
      }));
      // Unique debug log for reset
      console.log(
        'DEBUG: [reset] using clonedEntities:',
        JSON.stringify(clonedEntities, null, 2)
      );
      entityManager = new SimpleEntityManager(clonedEntities);
      env.entityManager = entityManager;
      operationRegistry = new OperationRegistry({ logger: testLogger });
      handlers = createHandlers(entityManager, eventBus, testLogger);
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
      // Update references on env
      env.entityManager = entityManager;
      env.operationRegistry = operationRegistry;
      env.operationInterpreter = operationInterpreter;
      env.systemLogicInterpreter = interpreter;
    },
  };

  return env;
}

/**
 * Creates a mock logger for testing.
 *
 * @returns {object} Mock logger with jest functions
 */
export function createMockLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
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
