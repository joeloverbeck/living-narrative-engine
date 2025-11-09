/**
 * @file Factory for creating standardized operation handlers for mod integration tests
 * @description Centralizes handler creation to eliminate duplication across mod test files
 */

import QueryComponentHandler from '../../../src/logic/operationHandlers/queryComponentHandler.js';
import QueryComponentsHandler from '../../../src/logic/operationHandlers/queryComponentsHandler.js';
import QueryLookupHandler from '../../../src/logic/operationHandlers/queryLookupHandler.js';
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
import ModifyComponentHandler from '../../../src/logic/operationHandlers/modifyComponentHandler.js';
import TransferItemHandler from '../../../src/logic/operationHandlers/transferItemHandler.js';
import ValidateInventoryCapacityHandler from '../../../src/logic/operationHandlers/validateInventoryCapacityHandler.js';
import DropItemAtLocationHandler from '../../../src/logic/operationHandlers/dropItemAtLocationHandler.js';
import PickUpItemFromLocationHandler from '../../../src/logic/operationHandlers/pickUpItemFromLocationHandler.js';
import OpenContainerHandler from '../../../src/logic/operationHandlers/openContainerHandler.js';
import TakeFromContainerHandler from '../../../src/logic/operationHandlers/takeFromContainerHandler.js';
import PutInContainerHandler from '../../../src/logic/operationHandlers/putInContainerHandler.js';
import ValidateContainerCapacityHandler from '../../../src/logic/operationHandlers/validateContainerCapacityHandler.js';
import DrinkFromHandler from '../../../src/logic/operationHandlers/drinkFromHandler.js';
import DrinkEntirelyHandler from '../../../src/logic/operationHandlers/drinkEntirelyHandler.js';
import AtomicModifyComponentHandler from '../../../src/logic/operationHandlers/atomicModifyComponentHandler.js';
import LockMouthEngagementHandler from '../../../src/logic/operationHandlers/lockMouthEngagementHandler.js';
import UnlockMouthEngagementHandler from '../../../src/logic/operationHandlers/unlockMouthEngagementHandler.js';
import BreakClosenessWithTargetHandler from '../../../src/logic/operationHandlers/breakClosenessWithTargetHandler.js';
import MergeClosenessCircleHandler from '../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import EstablishLyingClosenessHandler from '../../../src/logic/operationHandlers/establishLyingClosenessHandler.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
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
   * @param {object} [dataRegistry] - Optional data registry instance for lookup operations
   * @returns {object} Standard handlers object with common operation handlers
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createStandardHandlers(entityManager, eventBus, logger, dataRegistry) {
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

    const handlers = {
      QUERY_COMPONENT: new QueryComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      QUERY_COMPONENTS: new QueryComponentsHandler({
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
      FOR_EACH: new ForEachHandler({
        operationInterpreter: () => ({ execute: jest.fn() }),
        jsonLogic: { evaluate: jest.fn((rule, data) => data) },
        logger,
      }),
      IF: new IfHandler({
        operationInterpreter: () => ({ execute: jest.fn() }),
        jsonLogic: { evaluate: jest.fn((rule, data) => data) },
        logger,
      }),
    };

    // Add QUERY_LOOKUP handler if dataRegistry is provided
    if (dataRegistry) {
      handlers.QUERY_LOOKUP = new QueryLookupHandler({
        dataRegistry,
        logger,
        safeEventDispatcher: safeDispatcher,
      });
    }

    return handlers;
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
  static createHandlersWithAddComponent(entityManager, eventBus, logger, gameDataRepository) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithAddComponent'
    );
    const baseHandlers = this.createStandardHandlers(
      entityManager,
      eventBus,
      logger,
      gameDataRepository
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    const handlers = {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        gameDataRepository,
      }),
    };

    return handlers;
  }

  /**
   * Creates handlers that support adding and removing components.
   *
   * @description Extends the standard handler set with ADD_COMPONENT and
   * REMOVE_COMPONENT operations for rules that mutate state.
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Handlers object with component mutation support
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithComponentMutations(entityManager, eventBus, logger, gameDataRepository) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithComponentMutations'
    );

    const baseHandlers = this.createStandardHandlers(
      entityManager,
      eventBus,
      logger,
      gameDataRepository
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
        gameDataRepository,
      }),
      REMOVE_COMPONENT: new RemoveComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
  }

  /**
   * Creates handlers with mouth engagement locking/unlocking support for kissing actions.
   *
   * @description Extends the component mutation handler set with mouth engagement
   * locking/unlocking operations for kissing mod rules.
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @returns {object} Handlers object with mouth engagement support
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithMouthEngagement(entityManager, eventBus, logger, gameDataRepository) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithMouthEngagement'
    );

    const baseHandlers = this.createHandlersWithComponentMutations(
      entityManager,
      eventBus,
      logger,
      gameDataRepository
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      LOCK_MOUTH_ENGAGEMENT: new LockMouthEngagementHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      UNLOCK_MOUTH_ENGAGEMENT: new UnlockMouthEngagementHandler({
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
  static createCustomHandlers(entityManager, eventBus, logger, gameDataRepository, options = {}) {
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
        gameDataRepository,
      });
    }

    return handlers;
  }

  /**
   * Creates handlers with items system support for item-related actions.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} [dataRegistry] - Optional data registry instance for lookup operations
   * @returns {object} Handlers with item operation handlers included
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithItemsSupport(entityManager, eventBus, logger, dataRegistry) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithItemsSupport'
    );

    const baseHandlers = this.createStandardHandlers(
      entityManager,
      eventBus,
      logger,
      dataRegistry
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    return {
      ...baseHandlers,
      TRANSFER_ITEM: new TransferItemHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      VALIDATE_INVENTORY_CAPACITY: new ValidateInventoryCapacityHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      VALIDATE_CONTAINER_CAPACITY: new ValidateContainerCapacityHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      DROP_ITEM_AT_LOCATION: new DropItemAtLocationHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      PICK_UP_ITEM_FROM_LOCATION: new PickUpItemFromLocationHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      OPEN_CONTAINER: new OpenContainerHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      TAKE_FROM_CONTAINER: new TakeFromContainerHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      PUT_IN_CONTAINER: new PutInContainerHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      DRINK_FROM: new DrinkFromHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      DRINK_ENTIRELY: new DrinkEntirelyHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
  }

  /**
   * Creates handlers with description regeneration support for mods that need to update entity descriptions.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {object} eventBus - Event bus instance
   * @param {object} logger - Logger instance
   * @param {object} [dataRegistry] - Optional data registry instance for lookup operations
   * @returns {object} Handlers with ADD_COMPONENT, REMOVE_COMPONENT, and REGENERATE_DESCRIPTION included
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithDescriptionRegeneration(
    entityManager,
    eventBus,
    logger,
    dataRegistry
  ) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithDescriptionRegeneration'
    );

    const baseHandlers = this.createHandlersWithComponentMutations(
      entityManager,
      eventBus,
      logger,
      dataRegistry
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    // Create a mock body description composer for testing
    const bodyDescriptionComposer = {
      composeDescription: jest.fn(
        async (entity) => `Description for ${entity.id}`
      ),
    };

    return {
      ...baseHandlers,
      REGENERATE_DESCRIPTION: new RegenerateDescriptionHandler({
        entityManager,
        bodyDescriptionComposer,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
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
      items: this.createHandlersWithItemsSupport.bind(this),
      exercise: this.createStandardHandlers.bind(this),
      violence: this.createHandlersWithPerceptionLogging.bind(this),
      'physical-control': this.createHandlersWithPerceptionLogging.bind(this),
      sex: this.createHandlersWithComponentMutations.bind(this),
      intimacy: this.createStandardHandlers.bind(this),
      affection: this.createHandlersWithComponentMutations.bind(this),
      'hand-holding': this.createHandlersWithComponentMutations.bind(this),
      hugging: this.createHandlersWithComponentMutations.bind(this),
      kissing: this.createHandlersWithMouthEngagement.bind(this),
      vampirism: this.createHandlersWithComponentMutations.bind(this),
      music: this.createHandlersWithDescriptionRegeneration.bind(this),
    };

    if (typeof modCategory === 'string' && modCategory.startsWith('sex-')) {
      return this.createHandlersWithComponentMutations.bind(this);
    }

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
  static createHandlersWithPerceptionLogging(entityManager, eventBus, logger, gameDataRepository) {
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
      logger,
      gameDataRepository
    );

    const safeDispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventBus.dispatch(eventType, payload);
        return Promise.resolve(true);
      }),
    };

    // Create a mock body description composer for testing
    const bodyDescriptionComposer = {
      composeDescription: jest.fn(
        async (entity) => `Description for ${entity.id}`
      ),
    };

    return {
      ...baseHandlers,
      ADD_COMPONENT: new AddComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        gameDataRepository,
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
      MERGE_CLOSENESS_CIRCLE: new MergeClosenessCircleHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      ESTABLISH_LYING_CLOSENESS: new EstablishLyingClosenessHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
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
      MODIFY_COMPONENT: new ModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      ATOMIC_MODIFY_COMPONENT: new AtomicModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      BREAK_CLOSENESS_WITH_TARGET: new BreakClosenessWithTargetHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      REGENERATE_DESCRIPTION: new RegenerateDescriptionHandler({
        entityManager,
        bodyDescriptionComposer,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
    };
  }
}

export default ModTestHandlerFactory;
