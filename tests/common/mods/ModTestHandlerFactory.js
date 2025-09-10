/**
 * @file Factory for creating standardized operation handlers for mod integration tests
 * @description Centralizes handler creation to eliminate duplication across mod test files
 */

import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import GetNameHandler from '../../../src/logic/operationHandlers/getNameHandler.js';
import GetTimestampHandler from '../../../src/logic/operationHandlers/getTimestampHandler.js';
import DispatchEventHandler from '../../../src/logic/operationHandlers/dispatchEventHandler.js';
import DispatchPerceptibleEventHandler from '../../../src/logic/operationHandlers/dispatchPerceptibleEventHandler.js';
import EndTurnHandler from '../../../src/logic/operationHandlers/endTurnHandler.js';
import SetVariableHandler from '../../../src/logic/operationHandlers/setVariableHandler.js';
import AddComponentHandler from '../../../src/logic/operationHandlers/addComponentHandler.js';
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import RemoveComponentHandler from '../../../src/logic/operationHandlers/removeComponentHandler.js';
import UnlockMovementHandler from '../../../src/logic/operationHandlers/unlockMovementHandler.js';
import LockMovementHandler from '../../../src/logic/operationHandlers/lockMovementHandler.js';
import LogHandler from '../../../src/logic/operationHandlers/logHandler.js';
import ModifyArrayFieldHandler from '../../../src/logic/operationHandlers/modifyArrayFieldHandler.js';
import { validateDependency } from '../../../src/utils/dependencyUtils.js';

/* global jest */

/**
 * Factory class for creating standardized operation handlers for mod tests.
 *
 * Eliminates the need for each test file to define its own createHandlers function,
 * providing consistent handler creation across all mod integration tests.
 */
export class ModTestHandlerFactory {
  /**
   * Validates required dependencies for handler creation.
   *
   * @private
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {string} methodName - Name of calling method for error context
   * @throws {Error} If any required dependency is missing or invalid
   */
  static #validateDependencies(entityManager, eventBus, logger, methodName) {
    if (!entityManager) {
      throw new Error(
        `ModTestHandlerFactory.${methodName}: entityManager is required`
      );
    }

    if (!eventBus) {
      throw new Error(
        `ModTestHandlerFactory.${methodName}: eventBus is required`
      );
    }

    if (!logger) {
      throw new Error(
        `ModTestHandlerFactory.${methodName}: logger is required`
      );
    }

    // Validate entityManager has required methods
    validateDependency(entityManager, 'entityManager', logger, {
      requiredMethods: ['getEntityInstance', 'getComponentData'],
    });

    // Validate eventBus has required methods
    validateDependency(eventBus, 'eventBus', logger, {
      requiredMethods: ['dispatch'],
    });

    // Validate logger has required methods
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
  }
  /**
   * Creates the standard set of handlers used by most mod integration tests.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Standard handlers object with common operation handlers
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createStandardHandlers(entityManager, eventBus, logger) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createStandardHandlers'
    );
    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      GET_NAME: new GetNameHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: { execute: jest.fn() },
      }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger }),
      LOG_MESSAGE: new LogHandler({ logger }),
    };
  }

  /**
   * Creates handlers with ADD_COMPONENT support for positioning and state-changing actions.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Extended handlers object including ADD_COMPONENT handler
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithAddComponent(entityManager, eventBus, logger) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithAddComponent'
    );
    const baseHandlers = this.createStandardHandlers(
      entityManager,
      eventBus,
      logger
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
  }

  /**
   * Creates minimal handlers for simple tests that don't need all operations.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Minimal handlers object with essential operations only
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createMinimalHandlers(entityManager, eventBus, logger) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createMinimalHandlers'
    );
    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      GET_NAME: new GetNameHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: { execute: jest.fn() },
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      LOG_MESSAGE: new LogHandler({ logger }),
    };
  }

  /**
   * Creates custom handlers based on specific requirements.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} options - Configuration options
   * @param {boolean} options.includeAddComponent - Whether to include ADD_COMPONENT handler
   * @param {boolean} options.includeSetVariable - Whether to include SET_VARIABLE handler
   * @param {boolean} options.includeQueryComponent - Whether to include QUERY_COMPONENT handler
   * @param {Array<string>} options.additionalHandlers - Additional handler types to include
   * @returns {object} Custom handlers object based on options
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createCustomHandlers(entityManager, eventBus, logger, options = {}) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createCustomHandlers'
    );
    const {
      includeAddComponent = false,
      includeSetVariable = true,
      includeQueryComponent = true,
      additionalHandlers: _additionalHandlers = [],
    } = options;

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    const handlers = {
      GET_NAME: new GetNameHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      GET_TIMESTAMP: new GetTimestampHandler({ logger }),
      DISPATCH_PERCEPTIBLE_EVENT: new DispatchPerceptibleEventHandler({
        dispatcher: eventBus,
        logger,
        addPerceptionLogEntryHandler: { execute: jest.fn() },
      }),
      DISPATCH_EVENT: new DispatchEventHandler({
        dispatcher: eventBus,
        logger,
      }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      LOG_MESSAGE: new LogHandler({ logger }),
    };

    // Add optional handlers based on configuration
    if (includeQueryComponent) {
      handlers.QUERY_COMPONENT = new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      });
    }

    if (includeSetVariable) {
      handlers.SET_VARIABLE = new SetVariableHandler({ logger });
    }

    if (includeAddComponent) {
      handlers.ADD_COMPONENT = new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      });
    }

    return handlers;
  }

  /**
   * Determines the appropriate handler factory method based on mod category.
   *
   * @param {string} modCategory - The mod category (e.g., 'positioning', 'intimacy')
   * @returns {Function} The appropriate factory method for the category
   */
  static getHandlerFactoryForCategory(modCategory) {
    const categoryMappings = {
      positioning: this.createHandlersWithPerceptionLogging.bind(this),
      exercise: this.createStandardHandlers.bind(this),
      violence: this.createStandardHandlers.bind(this),
      sex: this.createStandardHandlers.bind(this),
      intimacy: this.createStandardHandlers.bind(this),
    };

    return (
      categoryMappings[modCategory] || this.createStandardHandlers.bind(this)
    );
  }

  /**
   * Creates a safe event dispatcher for use in handlers.
   *
   * @param {object} eventBus - Event bus instance
   * @returns {object} Safe dispatcher that wraps event bus dispatch
   * @throws {Error} If eventBus is missing or invalid
   */
  static createSafeDispatcher(eventBus) {
    if (!eventBus) {
      throw new Error(
        'ModTestHandlerFactory.createSafeDispatcher: eventBus is required'
      );
    }

    // Validate eventBus has required methods
    validateDependency(eventBus, 'eventBus', console, {
      requiredMethods: ['dispatch'],
    });
    return {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };
  }

  /**
   * Creates handlers with perception logging support for tests that need full event processing.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Handlers with ADD_PERCEPTION_LOG_ENTRY included
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithPerceptionLogging(entityManager, eventBus, logger) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithPerceptionLogging'
    );

    // Ensure entityManager has getEntitiesInLocation for AddPerceptionLogEntryHandler
    if (typeof entityManager.getEntitiesInLocation !== 'function') {
      entityManager.getEntitiesInLocation = (locationId) => {
        // Find all entities in the given location
        const entityIds = entityManager.getEntityIds();
        const entitiesInLocation = [];

        for (const entityId of entityIds) {
          const entity = entityManager.getEntityInstance(entityId);
          if (
            entity &&
            entity.components &&
            entity.components['core:position']
          ) {
            const position = entity.components['core:position'];
            if (position.locationId === locationId) {
              entitiesInLocation.push(entityId);
            }
          }
        }

        return new Set(entitiesInLocation);
      };
    }

    const baseHandlers = this.createStandardHandlers(
      entityManager,
      eventBus,
      logger
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      ADD_PERCEPTION_LOG_ENTRY: new AddPerceptionLogEntryHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      REMOVE_COMPONENT: new RemoveComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      LOCK_MOVEMENT: new LockMovementHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      UNLOCK_MOVEMENT: new UnlockMovementHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
  }
}

export default ModTestHandlerFactory;
