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

/**
 * Factory class for creating standardized operation handlers for mod tests.
 * 
 * Eliminates the need for each test file to define its own createHandlers function,
 * providing consistent handler creation across all mod integration tests.
 */
export class ModTestHandlerFactory {
  /**
   * Creates the standard set of handlers used by most mod integration tests.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance  
   * @param {object} logger - Logger instance
   * @returns {object} Standard handlers object with common operation handlers
   */
  static createStandardHandlers(entityManager, eventBus, logger) {
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
      DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
      SET_VARIABLE: new SetVariableHandler({ logger }),
    };
  }

  /**
   * Creates handlers with ADD_COMPONENT support for positioning and state-changing actions.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Extended handlers object including ADD_COMPONENT handler
   */
  static createHandlersWithAddComponent(entityManager, eventBus, logger) {
    const baseHandlers = this.createStandardHandlers(entityManager, eventBus, logger);
    
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
   */
  static createMinimalHandlers(entityManager, eventBus, logger) {
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
   */
  static createCustomHandlers(entityManager, eventBus, logger, options = {}) {
    const {
      includeAddComponent = false,
      includeSetVariable = true,
      includeQueryComponent = true,
      additionalHandlers = []
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
      DISPATCH_EVENT: new DispatchEventHandler({ dispatcher: eventBus, logger }),
      END_TURN: new EndTurnHandler({
        safeEventDispatcher: safeDispatcher,
        logger,
      }),
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
      positioning: this.createHandlersWithAddComponent.bind(this),
      exercise: this.createStandardHandlers.bind(this),
      violence: this.createStandardHandlers.bind(this),
      sex: this.createStandardHandlers.bind(this),
      intimacy: this.createStandardHandlers.bind(this),
    };

    return categoryMappings[modCategory] || this.createStandardHandlers.bind(this);
  }

  /**
   * Creates a safe event dispatcher for use in handlers.
   * 
   * @param {object} eventBus - Event bus instance
   * @returns {object} Safe dispatcher that wraps event bus dispatch
   */
  static createSafeDispatcher(eventBus) {
    return {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };
  }
}

export default ModTestHandlerFactory;