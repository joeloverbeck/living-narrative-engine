/**
 * @file Factory for creating standardized operation handlers for mod integration tests
 * @description Centralizes handler creation to eliminate duplication across mod test files
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

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
import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
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
import BreakBidirectionalClosenessHandler from '../../../src/logic/operationHandlers/breakBidirectionalClosenessHandler.js';
import MergeClosenessCircleHandler from '../../../src/logic/operationHandlers/mergeClosenessCircleHandler.js';
import EstablishBidirectionalClosenessHandler from '../../../src/logic/operationHandlers/establishBidirectionalClosenessHandler.js';
import EstablishLyingClosenessHandler from '../../../src/logic/operationHandlers/establishLyingClosenessHandler.js';
import EstablishSittingClosenessHandler from '../../../src/logic/operationHandlers/establishSittingClosenessHandler.js';
import RemoveLyingClosenessHandler from '../../../src/logic/operationHandlers/removeLyingClosenessHandler.js';
import RegenerateDescriptionHandler from '../../../src/logic/operationHandlers/regenerateDescriptionHandler.js';
import IfHandler from '../../../src/logic/operationHandlers/ifHandler.js';
import ForEachHandler from '../../../src/logic/operationHandlers/forEachHandler.js';
import UnwieldItemHandler from '../../../src/logic/operationHandlers/unwieldItemHandler.js';
import PrepareActionContextHandler from '../../../src/logic/operationHandlers/prepareActionContextHandler.js';
import * as closenessCircleService from '../../../src/logic/services/closenessCircleService.js';
import { validateDependency } from '../../../src/utils/dependencyUtils.js';
import AutoMoveClosenessPartnersHandler from '../../../src/logic/operationHandlers/autoMoveClosenessPartnersHandler.js';
import BreakFollowRelationHandler from '../../../src/logic/operationHandlers/breakFollowRelationHandler.js';
import CheckFollowCycleHandler from '../../../src/logic/operationHandlers/checkFollowCycleHandler.js';
import DispatchSpeechHandler from '../../../src/logic/operationHandlers/dispatchSpeechHandler.js';
import DispatchThoughtHandler from '../../../src/logic/operationHandlers/dispatchThoughtHandler.js';
import EstablishFollowRelationHandler from '../../../src/logic/operationHandlers/establishFollowRelationHandler.js';
import HasComponentHandler from '../../../src/logic/operationHandlers/hasComponentHandler.js';
import IfCoLocatedHandler from '../../../src/logic/operationHandlers/ifCoLocatedHandler.js';
import QueryEntitiesHandler from '../../../src/logic/operationHandlers/queryEntitiesHandler.js';
import RebuildLeaderListCacheHandler from '../../../src/logic/operationHandlers/rebuildLeaderListCacheHandler.js';
import RemoveFromClosenessCircleHandler from '../../../src/logic/operationHandlers/removeFromClosenessCircleHandler.js';
import RemoveSittingClosenessHandler from '../../../src/logic/operationHandlers/removeSittingClosenessHandler.js';
import ResolveOutcomeHandler from '../../../src/logic/operationHandlers/resolveOutcomeHandler.js';
import SystemMoveEntityHandler from '../../../src/logic/operationHandlers/systemMoveEntityHandler.js';
import EquipClothingHandler from '../../../src/logic/operationHandlers/equipClothingHandler.js';
import ModifyPartHealthHandler from '../../../src/logic/operationHandlers/modifyPartHealthHandler.js';
import PickRandomArrayElementHandler from '../../../src/logic/operationHandlers/pickRandomArrayElementHandler.js';
import AutoMoveFollowersHandler from '../../../src/logic/operationHandlers/autoMoveFollowersHandler.js';
import { EquipmentOrchestrator } from '../../../src/clothing/orchestration/equipmentOrchestrator.js';
import { LayerCompatibilityService } from '../../../src/clothing/validation/layerCompatibilityService.js';

const ITEM_OPERATION_TYPES = new Set([
  'TRANSFER_ITEM',
  'VALIDATE_INVENTORY_CAPACITY',
  'VALIDATE_CONTAINER_CAPACITY',
  'DROP_ITEM_AT_LOCATION',
  'PICK_UP_ITEM_FROM_LOCATION',
  'OPEN_CONTAINER',
  'TAKE_FROM_CONTAINER',
  'PUT_IN_CONTAINER',
  'DRINK_FROM',
  'DRINK_ENTIRELY',
  'MODIFY_ARRAY_FIELD',
  'UNWIELD_ITEM',
  'LOCK_GRABBING',
  'UNLOCK_GRABBING',
]);

const MOUTH_OPERATION_TYPES = new Set([
  'LOCK_MOUTH_ENGAGEMENT',
  'UNLOCK_MOUTH_ENGAGEMENT',
]);

/**
 * Types that use "type" property but are NOT operation types.
 * These are used in action schema structures like chanceOfSuccess.modifiers,
 * and damage_entry.type values in APPLY_DAMAGE operations.
 * @see data/schemas/action.schema.json - chanceModifier definition
 * @see data/schemas/operations/applyDamage.schema.json - damage_entry.type values
 */
const NON_OPERATION_TYPES = new Set([
  'flat',
  'percentage',
  // Damage types from APPLY_DAMAGE operation schema
  'slashing',
  'piercing',
  'bludgeoning',
  'fire',
  'cold',
  'lightning',
  'poison',
  'acid',
  'psychic',
  'necrotic',
  'radiant',
  'force',
  'thunder',
]);

const MUTATION_OR_PERCEPTION_TYPES = new Set([
  'ADD_COMPONENT',
  'MODIFY_COMPONENT',
  'REMOVE_COMPONENT',
  'ATOMIC_MODIFY_COMPONENT',
  'ADD_PERCEPTION_LOG_ENTRY',
  'MERGE_CLOSENESS_CIRCLE',
  'ESTABLISH_LYING_CLOSENESS',
  'ESTABLISH_SITTING_CLOSENESS',
  'ESTABLISH_BIDIRECTIONAL_CLOSENESS',
  'BREAK_BIDIRECTIONAL_CLOSENESS',
  'REMOVE_LYING_CLOSENESS',
  'LOCK_MOVEMENT',
  'UNLOCK_MOVEMENT',
  'BREAK_CLOSENESS_WITH_TARGET',
  'REGENERATE_DESCRIPTION',
  'MODIFY_ARRAY_FIELD',
]);

/* global jest */

/**
 * Factory class for creating standardized operation handlers for mod tests.
 *
 * Eliminates the need for each test file to define its own createHandlers function,
 * providing consistent handler creation across all mod integration tests.
 */
export class ModTestHandlerFactory {
  static #operationProfileCache = new Map();

  static #collectOperationsFromNode(candidate, operations, macroRefs) {
    if (!candidate) {
      return;
    }

    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        this.#collectOperationsFromNode(entry, operations, macroRefs);
      }
      return;
    }

    if (typeof candidate !== 'object') {
      return;
    }

    if (typeof candidate.type === 'string') {
      // Exclude non-operation types (e.g., chanceModifier types like "flat", "percentage")
      if (!NON_OPERATION_TYPES.has(candidate.type)) {
        operations.add(candidate.type);
      }
    }

    if (typeof candidate.macro === 'string' && macroRefs) {
      macroRefs.add(candidate.macro);
    }

    for (const value of Object.values(candidate)) {
      this.#collectOperationsFromNode(value, operations, macroRefs);
    }
  }

  static #readJsonFileSafe(filePath) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  static #resolveMacroPath(macroId, modCategory) {
    if (!macroId) {
      return null;
    }

    const [namespace, macroName] = macroId.includes(':')
      ? macroId.split(':')
      : [null, macroId];

    const searchNamespaces = [];
    if (namespace) {
      searchNamespaces.push(namespace);
    }
    if (modCategory && modCategory !== namespace) {
      searchNamespaces.push(modCategory);
    }
    searchNamespaces.push('core');

    for (const namespaceCandidate of searchNamespaces) {
      const candidate = resolvePath(
        process.cwd(),
        'data',
        'mods',
        namespaceCandidate || '',
        'macros',
        `${macroName}.macro.json`
      );

      if (existsSync(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  static #expandMacroOperations(modCategory, macroRefs, operations) {
    if (!macroRefs || macroRefs.size === 0) {
      return;
    }

    const visited = new Set();
    const queue = [...macroRefs];

    while (queue.length > 0) {
      const macroId = queue.pop();
      if (visited.has(macroId)) {
        continue;
      }

      visited.add(macroId);
      const macroPath = this.#resolveMacroPath(macroId, modCategory);
      if (!macroPath) {
        continue;
      }

      const macroDefinition = this.#readJsonFileSafe(macroPath);
      if (!macroDefinition) {
        continue;
      }

      const nestedMacroRefs = new Set();
      this.#collectOperationsFromNode(
        macroDefinition.actions ||
          macroDefinition.operations ||
          macroDefinition,
        operations,
        nestedMacroRefs
      );

      for (const nested of nestedMacroRefs) {
        if (!visited.has(nested)) {
          queue.push(nested);
        }
      }
    }
  }

  static #scanOperationsForMod(modCategory) {
    if (this.#operationProfileCache.has(modCategory)) {
      return this.#operationProfileCache.get(modCategory);
    }

    const operations = new Set();
    const macroRefs = new Set();

    const collectFromDefinition = (definition) => {
      if (!definition) {
        return;
      }

      this.#collectOperationsFromNode(
        definition.actions || definition.operations || definition,
        operations,
        macroRefs
      );
    };

    const rulesDir = resolvePath(
      process.cwd(),
      'data',
      'mods',
      modCategory || '',
      'rules'
    );

    if (modCategory && existsSync(rulesDir)) {
      const ruleFiles = readdirSync(rulesDir).filter((file) =>
        file.endsWith('.json')
      );

      for (const file of ruleFiles) {
        const filePath = resolvePath(rulesDir, file);
        const ruleDefinition = this.#readJsonFileSafe(filePath);
        if (!ruleDefinition) {
          continue;
        }

        collectFromDefinition(ruleDefinition);
      }
    }

    const actionsDir = resolvePath(
      process.cwd(),
      'data',
      'mods',
      modCategory || '',
      'actions'
    );

    if (modCategory && existsSync(actionsDir)) {
      const actionFiles = readdirSync(actionsDir).filter((file) =>
        file.endsWith('.json')
      );

      for (const file of actionFiles) {
        const filePath = resolvePath(actionsDir, file);
        const actionDefinition = this.#readJsonFileSafe(filePath);
        if (!actionDefinition) {
          continue;
        }

        collectFromDefinition(actionDefinition);
      }
    }

    this.#expandMacroOperations(modCategory, macroRefs, operations);

    const profile = { operations };
    this.#operationProfileCache.set(modCategory, profile);
    return profile;
  }

  static getOperationProfileForCategory(modCategory) {
    const profile = this.#scanOperationsForMod(modCategory);
    return {
      operations: new Set(profile.operations),
    };
  }

  static #buildProfileHint(modCategory) {
    const { operations } = this.#scanOperationsForMod(modCategory);
    const operationsArray = Array.from(operations);
    const needsItems = operationsArray.some((op) =>
      ITEM_OPERATION_TYPES.has(op)
    );
    const needsMouthEngagement = operationsArray.some((op) =>
      MOUTH_OPERATION_TYPES.has(op)
    );
    const needsSuperset =
      operationsArray.length === 0
        ? false
        : needsItems ||
          needsMouthEngagement ||
          operationsArray.some((op) => MUTATION_OR_PERCEPTION_TYPES.has(op));

    return {
      hasDiscoveredOperations: operationsArray.length > 0,
      needsItems,
      needsMouthEngagement,
      needsSuperset: needsSuperset || operationsArray.length > 0,
    };
  }

  static #pickHandlers(sourceHandlers, keys) {
    return keys.reduce((acc, key) => {
      if (sourceHandlers[key]) {
        acc[key] = sourceHandlers[key];
      }
      return acc;
    }, {});
  }

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
      requiredMethods: [
        'getEntityInstance',
        'getComponentData',
        'addComponent',
        'hasComponent',
      ],
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
    const equipmentOrchestrator = new EquipmentOrchestrator({
      entityManager,
      logger,
      eventDispatcher: safeDispatcher,
      layerCompatibilityService: new LayerCompatibilityService({
        entityManager,
        logger,
      }),
    });

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
      // Alias used by older schemas/tests
      LOG: new LogHandler({ logger }),
      PREPARE_ACTION_CONTEXT: new PrepareActionContextHandler({
        entityManager,
        logger,
      }),
      EQUIP_CLOTHING: new EquipClothingHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        equipmentOrchestrator,
      }),
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
      // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
      REGENERATE_DESCRIPTION: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      // Mock handler for UNEQUIP_CLOTHING - satisfies fail-fast enforcement
      UNEQUIP_CLOTHING: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
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
   * @param gameDataRepository
   * @returns {object} Extended handlers object including ADD_COMPONENT handler
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithAddComponent(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
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
   * @param gameDataRepository
   * @returns {object} Handlers object with component mutation support
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithComponentMutations(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
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
      MODIFY_COMPONENT: new ModifyComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      REMOVE_COMPONENT: new RemoveComponentHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      // Mock handler for REGENERATE_DESCRIPTION - satisfies fail-fast enforcement
      REGENERATE_DESCRIPTION: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
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
   * @param gameDataRepository
   * @returns {object} Handlers object with mouth engagement support
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithMouthEngagement(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
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
   * @param gameDataRepository
   * @param {object} options - Configuration options
   * @param {boolean} options.includeAddComponent - Whether to include ADD_COMPONENT handler
   * @param {boolean} options.includeSetVariable - Whether to include SET_VARIABLE handler
   * @param {boolean} options.includeQueryComponent - Whether to include QUERY_COMPONENT handler
   * @param {Array<string>} options.additionalHandlers - Additional handler types to include
   * @returns {object} Custom handlers object based on options
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createCustomHandlers(
    entityManager,
    eventBus,
    logger,
    gameDataRepository,
    options = {}
  ) {
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
  static createHandlersWithItemsSupport(
    entityManager,
    eventBus,
    logger,
    dataRegistry
  ) {
    this.#validateDependencies(
      entityManager,
      eventBus,
      logger,
      'createHandlersWithItemsSupport'
    );

    // Items mod needs ADD_COMPONENT/REMOVE_COMPONENT for aiming and other component mutations
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
      MODIFY_ARRAY_FIELD: new ModifyArrayFieldHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      UNWIELD_ITEM: new UnwieldItemHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
      }),
      // Mock handler for LOCK_GRABBING - satisfies fail-fast enforcement
      LOCK_GRABBING: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      // Mock handler for UNLOCK_GRABBING - satisfies fail-fast enforcement
      UNLOCK_GRABBING: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
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
    const profileHint = this.#buildProfileHint(modCategory);

    const buildAutoDetectedFactory =
      (hint) => (entityManager, eventBus, logger, dataRegistry) => {
        const shouldUseSupersetBase =
          hint.needsSuperset ||
          hint.needsItems ||
          hint.needsMouthEngagement ||
          !hint.hasDiscoveredOperations;

        const handlers = shouldUseSupersetBase
          ? this.createHandlersWithPerceptionLogging(
              entityManager,
              eventBus,
              logger,
              dataRegistry
            )
          : this.createStandardHandlers(
              entityManager,
              eventBus,
              logger,
              dataRegistry
            );

        if (hint.needsItems) {
          Object.assign(
            handlers,
            this.#pickHandlers(
              this.createHandlersWithItemsSupport(
                entityManager,
                eventBus,
                logger,
                dataRegistry
              ),
              Array.from(ITEM_OPERATION_TYPES)
            )
          );
        }

        if (hint.needsMouthEngagement) {
          Object.assign(
            handlers,
            this.#pickHandlers(
              this.createHandlersWithMouthEngagement(
                entityManager,
                eventBus,
                logger,
                dataRegistry
              ),
              Array.from(MOUTH_OPERATION_TYPES)
            )
          );
        }

        return handlers;
      };

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
      patrol: this.createHandlersWithPerceptionLogging.bind(this),
      movement: this.createHandlersWithPerceptionLogging.bind(this),
      metabolism: this.createHandlersWithPerceptionLogging.bind(this),
      locks: this.createHandlersWithComponentMutations.bind(this),
      weapons: this.createHandlersWithPerceptionLogging.bind(this),
      distress: this.createHandlersWithPerceptionLogging.bind(this),
      'first-aid': this.createHandlersWithPerceptionLogging.bind(this),
    };

    if (profileHint.hasDiscoveredOperations) {
      return buildAutoDetectedFactory(profileHint);
    }

    if (typeof modCategory === 'string' && modCategory.startsWith('sex-')) {
      return this.createHandlersWithComponentMutations.bind(this);
    }

    if (!categoryMappings[modCategory]) {
      return buildAutoDetectedFactory(profileHint);
    }

    return categoryMappings[modCategory];
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
   * @param gameDataRepository
   * @returns {object} Handlers with ADD_PERCEPTION_LOG_ENTRY included
   * @throws {Error} If any required parameter is missing or invalid
   */
  static createHandlersWithPerceptionLogging(
    entityManager,
    eventBus,
    logger,
    gameDataRepository
  ) {
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

    // Ensure entityManager has getEntitiesWithComponent for EstablishLyingClosenessHandler
    if (typeof entityManager.getEntitiesWithComponent !== 'function') {
      entityManager.getEntitiesWithComponent = (componentId) => {
        // Find all entities with the given component
        const entityIds = entityManager.getEntityIds();
        const entitiesWithComponent = [];

        for (const entityId of entityIds) {
          if (entityManager.hasComponent(entityId, componentId)) {
            entitiesWithComponent.push(entityId);
          }
        }

        return entitiesWithComponent;
      };
    }

    // Ensure entityManager has batchAddComponentsOptimized for ConsumeItemHandler
    if (typeof entityManager.batchAddComponentsOptimized !== 'function') {
      entityManager.batchAddComponentsOptimized = async (
        componentSpecs,
        _emitBatchEvent = true
      ) => {
        const results = [];
        const errors = [];
        let updateCount = 0;

        for (const spec of componentSpecs) {
          try {
            const { instanceId, componentTypeId, componentData } = spec;
            await entityManager.addComponent(
              instanceId,
              componentTypeId,
              componentData
            );
            results.push({ instanceId, componentTypeId, success: true });
            updateCount++;
          } catch (error) {
            errors.push({
              instanceId: spec.instanceId,
              componentTypeId: spec.componentTypeId,
              error: error.message,
            });
          }
        }

        return { results, errors, updateCount };
      };
    }

    // Ensure entityManager has removeEntityInstance for ConsumeItemHandler
    if (typeof entityManager.removeEntityInstance !== 'function') {
      entityManager.removeEntityInstance = (entityId) => {
        if (typeof entityManager.deleteEntity === 'function') {
          entityManager.deleteEntity(entityId);
        }
      };
    }

    // Ensure entityManager has hasEntity for ConsumeItemHandler
    if (typeof entityManager.hasEntity !== 'function') {
      entityManager.hasEntity = (entityId) => {
        // Delegate to getEntityIds if available, otherwise return true as safe default
        if (typeof entityManager.getEntityIds === 'function') {
          return entityManager.getEntityIds().includes(entityId);
        }
        // Fallback: Check if entity has any components
        if (typeof entityManager.hasComponent === 'function') {
          return true; // Assume entity exists if we can check components
        }
        return true;
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
    const operationInterpreter = () => ({ execute: jest.fn() });
    const jsonLogicEvaluationService = {
      evaluate: jest.fn((rule, data) => {
        if (
          rule &&
          typeof rule === 'object' &&
          Object.prototype.hasOwnProperty.call(rule, 'var')
        ) {
          const path = String(rule.var || '')
            .split('.')
            .filter(Boolean);
          return path.reduce((acc, key) => (acc ? acc[key] : undefined), data);
        }

        return rule ?? data;
      }),
    };
    // Helper function to extract all part IDs from a body component structure
    const getDescendantPartIds = (rootId) => {
      const visited = new Set();
      const stack = rootId ? [rootId] : [];
      const descendants = new Set();

      while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId || visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);

        // Check if entity has anatomy:part component
        const partComponent = entityManager.getComponentData(
          currentId,
          'anatomy:part'
        );
        if (!partComponent) {
          continue;
        }

        descendants.add(currentId);

        // Check for children in the part component
        const children = Array.isArray(partComponent.children)
          ? partComponent.children
          : [];
        for (const childId of children) {
          if (!visited.has(childId)) {
            stack.push(childId);
          }
        }
      }

      return descendants;
    };

    const bodyGraphService = {
      getAllParts: jest.fn((bodyComponentOrRoot) => {
        if (!bodyComponentOrRoot) {
          return [];
        }

        // Extract root ID from various body component formats
        let rootId = null;
        if (typeof bodyComponentOrRoot === 'string') {
          rootId = bodyComponentOrRoot;
        } else {
          rootId =
            bodyComponentOrRoot.root ?? bodyComponentOrRoot.body?.root ?? null;
        }

        if (!rootId) {
          return [];
        }

        return Array.from(getDescendantPartIds(rootId));
      }),
    };
    const damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn().mockResolvedValue(undefined),
    };
    const damagePropagationService = {
      propagateDamage: jest.fn().mockReturnValue([]),
    };
    /**
     * DeathCheckService mock
     * Required methods (from src/anatomy/services/deathCheckService.js):
     * - checkDeathConditions(entityId, attackerId) → DeathCheckResult
     * - evaluateDeathConditions(entityId, attackerId) → DeathEvaluation
     * - finalizeDeathFromEvaluation(entityId, evaluation) → void
     * - processDyingTurn(entityId) → TurnResult
     */
    const deathCheckService = {
      checkDeathConditions: jest.fn(() => ({
        isDead: false,
        isDying: false,
        deathInfo: null,
      })),
      evaluateDeathConditions: jest.fn(() => ({
        isDead: false,
        isDying: false,
        shouldFinalize: false,
        finalizationParams: null,
        deathInfo: null,
      })),
      finalizeDeathFromEvaluation: jest.fn(),
      processDyingTurn: jest.fn(() => ({
        actionTaken: 'none',
        stillDying: false,
      })),
    };
    const damageAccumulator = {
      createSession: jest.fn((entityId) => ({
        entityId,
        sessionId: `session-${entityId}`,
        createdAt: Date.now(),
        entries: [],
        effects: new Map(),
        pendingEvents: [],
      })),
      recordDamage: jest.fn(),
      recordEffect: jest.fn(),
      queueEvent: jest.fn(),
      finalize: jest.fn((session) => ({
        entries: session?.entries || [],
        pendingEvents: session?.pendingEvents || [],
      })),
      hasEntries: jest.fn(() => false),
      getPrimaryEntry: jest.fn(() => null),
    };
    const damageNarrativeComposer = {
      compose: jest.fn(() => ''),
    };
    const systemMoveEntityHandler = new SystemMoveEntityHandler({
      entityManager,
      safeEventDispatcher: safeDispatcher,
      logger,
    });
    const rebuildLeaderListCacheHandler = new RebuildLeaderListCacheHandler({
      entityManager,
      logger,
      safeEventDispatcher: safeDispatcher,
    });
    const autoMoveClosenessPartnersHandler =
      new AutoMoveClosenessPartnersHandler({
        logger,
        entityManager,
        safeEventDispatcher: safeDispatcher,
        systemMoveEntityHandler,
        operationInterpreter,
      });
    const chanceCalculationService = {
      resolveOutcome: jest.fn(() => ({
        outcome: 'SUCCESS',
        roll: 1,
        threshold: 1,
        margin: 0,
        isCritical: false,
        actorSkill: 0,
        targetSkill: 0,
        breakdown: {},
      })),
    };

    // Create a mock body description composer for testing
    const bodyDescriptionComposer = {
      composeDescription: jest.fn(
        async (entity) => `Description for ${entity.id}`
      ),
    };

    const regenerateDescriptionHandler = new RegenerateDescriptionHandler({
      entityManager,
      bodyDescriptionComposer,
      logger,
      safeEventDispatcher: safeDispatcher,
    });

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
      ESTABLISH_BIDIRECTIONAL_CLOSENESS:
        new EstablishBidirectionalClosenessHandler({
          entityManager,
          safeEventDispatcher: safeDispatcher,
          regenerateDescriptionHandler,
          logger,
        }),
      BREAK_BIDIRECTIONAL_CLOSENESS: new BreakBidirectionalClosenessHandler({
        entityManager,
        safeEventDispatcher: safeDispatcher,
        regenerateDescriptionHandler,
        logger,
      }),
      ESTABLISH_LYING_CLOSENESS: new EstablishLyingClosenessHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      ESTABLISH_SITTING_CLOSENESS: new EstablishSittingClosenessHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      REMOVE_LYING_CLOSENESS: new RemoveLyingClosenessHandler({
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
      HAS_COMPONENT: new HasComponentHandler({
        logger,
        entityManager,
        safeEventDispatcher: safeDispatcher,
      }),
      QUERY_ENTITIES: new QueryEntitiesHandler({
        entityManager,
        logger,
        jsonLogicEvaluationService,
        safeEventDispatcher: safeDispatcher,
      }),
      IF_CO_LOCATED: new IfCoLocatedHandler({
        logger,
        entityManager,
        operationInterpreter,
        safeEventDispatcher: safeDispatcher,
      }),
      SYSTEM_MOVE_ENTITY: systemMoveEntityHandler,
      AUTO_MOVE_CLOSENESS_PARTNERS: autoMoveClosenessPartnersHandler,
      REMOVE_SITTING_CLOSENESS: new RemoveSittingClosenessHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      REMOVE_FROM_CLOSENESS_CIRCLE: new RemoveFromClosenessCircleHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      BREAK_CLOSENESS_WITH_TARGET: new BreakClosenessWithTargetHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        closenessCircleService,
      }),
      REGENERATE_DESCRIPTION: regenerateDescriptionHandler,
      APPLY_DAMAGE: new ApplyDamageHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        jsonLogicService: jsonLogicEvaluationService,
        bodyGraphService,
        damageTypeEffectsService,
        damagePropagationService,
        deathCheckService,
        damageAccumulator,
        damageNarrativeComposer,
      }),
      DISPATCH_SPEECH: new DispatchSpeechHandler({
        dispatcher: eventBus,
        logger,
      }),
      DISPATCH_THOUGHT: new DispatchThoughtHandler({
        dispatcher: eventBus,
        logger,
      }),
      REBUILD_LEADER_LIST_CACHE: rebuildLeaderListCacheHandler,
      ESTABLISH_FOLLOW_RELATION: new EstablishFollowRelationHandler({
        logger,
        entityManager,
        rebuildLeaderListCacheHandler,
        safeEventDispatcher: safeDispatcher,
      }),
      BREAK_FOLLOW_RELATION: new BreakFollowRelationHandler({
        logger,
        entityManager,
        rebuildLeaderListCacheHandler,
        safeEventDispatcher: safeDispatcher,
      }),
      CHECK_FOLLOW_CYCLE: new CheckFollowCycleHandler({
        logger,
        entityManager,
        safeEventDispatcher: safeDispatcher,
      }),
      RESOLVE_OUTCOME: new ResolveOutcomeHandler({
        chanceCalculationService,
        logger,
      }),
      MODIFY_PART_HEALTH: new ModifyPartHealthHandler({
        logger,
        entityManager,
        safeEventDispatcher: safeDispatcher,
        jsonLogicService: jsonLogicEvaluationService,
      }),
      // Mock handler for LOCK_GRABBING - satisfies fail-fast enforcement
      LOCK_GRABBING: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      // Mock handler for UNLOCK_GRABBING - satisfies fail-fast enforcement
      UNLOCK_GRABBING: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      // Mock handler for GET_DAMAGE_CAPABILITIES - satisfies fail-fast enforcement
      GET_DAMAGE_CAPABILITIES: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      // Mock handler for PICK_RANDOM_ENTITY - satisfies fail-fast enforcement
      PICK_RANDOM_ENTITY: {
        execute: jest.fn().mockResolvedValue(undefined),
      },
      PICK_RANDOM_ARRAY_ELEMENT: new PickRandomArrayElementHandler({
        entityManager,
        logger,
      }),
      AUTO_MOVE_FOLLOWERS: new AutoMoveFollowersHandler({
        entityManager,
        logger,
        safeEventDispatcher: safeDispatcher,
        moveEntityHandler: systemMoveEntityHandler,
      }),
    };
  }
}

export default ModTestHandlerFactory;
