/**
 * @file Module that contains common factories used in test suites.
 * @see tests/common/mockFactories.js
 */

import { jest } from '@jest/globals';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

// --- Core Service Mocks ---

/**
 * Creates a mock ILogger with jest functions.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>} A mocked ILogger.
 */
export const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

/**
 * Creates a mock ISchemaValidator with jest functions.
 *
 * @param {{ isValid: boolean }} [defaultValidationResult] - The default result for the validate method.
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ISchemaValidator>} A mocked validator.
 */
export const createMockSchemaValidator = (
  defaultValidationResult = { isValid: true }
) => ({
  validate: jest.fn(() => defaultValidationResult),
  isSchemaLoaded: jest.fn(),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  getValidator: jest.fn(),
});

/**
 * Creates a simple, non-stateful mock IDataRegistry.
 * Useful for unit tests where only specific methods need to be mocked.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IDataRegistry>} A mocked data registry.
 */
export const createSimpleMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(() => []),
  store: jest.fn(),
  clear: jest.fn(),
  // Add other methods mocked to return default values if needed by other tests
});

/**
 * Creates a sophisticated, stateful mock IDataRegistry for integration testing.
 * It simulates an in-memory store.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IDataRegistry> & { _internalStore: object }} A stateful mocked data registry.
 */
export const createStatefulMockDataRegistry = () => {
  const internalStore = {};
  return {
    _internalStore: internalStore,
    store: jest.fn((type, id, data) => {
      if (!internalStore[type]) internalStore[type] = {};
      internalStore[type][id] = data;
    }),
    get: jest.fn((type, id) => internalStore[type]?.[id]),
    getAll: jest.fn((type) => Object.values(internalStore[type] || {})),
    clear: jest.fn(() => {
      Object.keys(internalStore).forEach((key) => delete internalStore[key]);
    }),
    getAllSystemRules: jest.fn(() => []),
    getManifest: jest.fn(),
    setManifest: jest.fn(),
    getEntityDefinition: jest.fn(
      (id) => internalStore['entity_definitions']?.[id]
    ),
    getItemDefinition: jest.fn((id) => internalStore['items']?.[id]),
    getLocationDefinition: jest.fn((id) => internalStore['locations']?.[id]),
    getConnectionDefinition: jest.fn(
      (id) => internalStore['connections']?.[id]
    ),
    getBlockerDefinition: jest.fn((id) => internalStore['blockers']?.[id]),
    getActionDefinition: jest.fn((id) => internalStore['actions']?.[id]),
    getEventDefinition: jest.fn((id) => internalStore['events']?.[id]),
    getComponentDefinition: jest.fn((id) => internalStore['components']?.[id]),
    getAllEntityDefinitions: jest.fn(() =>
      Object.values(internalStore['entity_definitions'] || {})
    ),
    getAllItemDefinitions: jest.fn(() =>
      Object.values(internalStore['items'] || {})
    ),
    getAllLocationDefinitions: jest.fn(() =>
      Object.values(internalStore['locations'] || {})
    ),
    getAllConnectionDefinitions: jest.fn(() =>
      Object.values(internalStore['connections'] || {})
    ),
    getAllBlockerDefinitions: jest.fn(() =>
      Object.values(internalStore['blockers'] || {})
    ),
    getAllActionDefinitions: jest.fn(() =>
      Object.values(internalStore['actions'] || {})
    ),
    getAllEventDefinitions: jest.fn(() =>
      Object.values(internalStore['events'] || {})
    ),
    getAllComponentDefinitions: jest.fn(() =>
      Object.values(internalStore['components'] || {})
    ),
    getStartingPlayerId: jest.fn(() => null),
    getStartingLocationId: jest.fn(() => null),
  };
};

/**
 * Creates a mock IConfiguration service with common default values.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IConfiguration>} A mocked configuration service.
 */
export const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest.fn((typeName) => `schema:${typeName}`),
  getBaseDataPath: jest.fn(() => './data'),
  getSchemaFiles: jest.fn(() => []),
  getSchemaBasePath: jest.fn(() => 'schemas'),
  getContentBasePath: jest.fn(() => 'content'),
  getGameConfigFilename: jest.fn(() => 'game.json'),
  getModsBasePath: jest.fn(() => 'mods'),
  getModManifestFilename: jest.fn(() => 'mod.manifest.json'),
});

/**
 * Mock for IEntityManager.
 *
 * @description Creates a mock IEntityManager service.
 * @returns {jest.Mocked<import('../../src/interfaces/IEntityManager.js').IEntityManager>} Mocked IEntityManager
 */
export const createMockEntityManager = () => ({
  clearAll: jest.fn(),
  getActiveEntities: jest.fn().mockReturnValue([]),
});

/**
 * Mock for ITurnManager.
 *
 * @description Creates a mock ITurnManager service.
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnManager.js').ITurnManager>} Mocked turn manager
 */
export const createMockTurnManager = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  nextTurn: jest.fn(),
});

/**
 * Mock for IGamePersistenceService.
 *
 * @description Creates a mock IGamePersistenceService service.
 * @returns {jest.Mocked<import('../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService>} Mocked persistence service
 */
export const createMockGamePersistenceService = () => ({
  saveGame: jest.fn(),
  loadAndRestoreGame: jest.fn(),
  isSavingAllowed: jest.fn(),
});

/**
 * Mock for PlaytimeTracker.
 *
 * @description Creates a mock PlaytimeTracker service.
 * @returns {jest.Mocked<import('../../src/interfaces/IPlaytimeTracker.js').default>} Mocked playtime tracker
 */
export const createMockPlaytimeTracker = () => ({
  reset: jest.fn(),
  startSession: jest.fn(),
  endSessionAndAccumulate: jest.fn(),
  getTotalPlaytime: jest.fn().mockReturnValue(0),
  setAccumulatedPlaytime: jest.fn(),
});

/**
 * Mock for IInitializationService.
 *
 * @description Creates a mock IInitializationService service.
 * @returns {jest.Mocked<import('../../src/interfaces/IInitializationService.js').IInitializationService>} Mocked initialization service
 */
export const createMockInitializationService = () => ({
  runInitializationSequence: jest.fn(),
});

// --- Event Dispatcher Mocks ---

/**
 * Creates a mock ISafeEventDispatcher with jest functions.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher>} A mocked safe dispatcher.
 */
export const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

/**
 * Creates a mock ValidatedEventDispatcher.
 *
 * @returns {jest.Mocked<import('../../services/validatedEventDispatcher.js').default>} A mocked validated dispatcher.
 */
export const createMockValidatedEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

// --- Loader Mocks ---

/**
 * Creates a generic mock for content loaders (e.g., ActionLoader, ComponentLoader).
 *
 * @param {object} [defaultLoadResult] - The default result for loadItemsForMod.
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').BaseManifestItemLoaderInterface>} A mocked content loader.
 */
export const createMockContentLoader = (
  defaultLoadResult = { count: 0, overrides: 0, errors: 0 }
) => ({
  loadItemsForMod: jest.fn().mockResolvedValue(defaultLoadResult),
});

/**
 * Creates a mock SchemaLoader.
 *
 * @returns {jest.Mocked<import('../../src/loaders/schemaLoader.js').default>} A mocked schema loader.
 */
export const createMockSchemaLoader = () => ({
  loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock GameConfigLoader.
 *
 * @returns {jest.Mocked<import('../../src/loaders/gameConfigLoader.js').default>} A mocked game config loader.
 */
export const createMockGameConfigLoader = () => ({
  loadConfig: jest.fn().mockResolvedValue([]), // Default to no mods
});

/**
 * Creates a mock ModManifestLoader.
 *
 * @returns {jest.Mocked<import('../../src/modding/modManifestLoader.js').default>} A mocked mod manifest loader.
 */
export const createMockModManifestLoader = () => ({
  loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
});

// --- Modding Helper Mocks ---

/**
 * Creates a mock for the mod dependency validator.
 *
 * @returns {{ validate: jest.Mock }} The mocked dependency validator.
 */
export const createMockModDependencyValidator = () => ({
  validate: jest.fn(),
});

/**
 * Creates a mock for the mod version validator.
 *
 * @returns {jest.Mock} The mocked version validator.
 */
export const createMockModVersionValidator = () => jest.fn();

/**
 * Creates a mock for the mod load order resolver.
 *
 * @returns {{ resolveOrder: jest.Mock }} The mocked resolver.
 */
export const createMockModLoadOrderResolver = () => ({
  // Default behavior resolves to the same order it was given
  resolveOrder: jest.fn((reqIds) => reqIds),
});

// --- Turn & Entity System Mocks ---

/**
 * Creates a mock ITurnOrderService with jest.fn() methods.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnOrderService.js').ITurnOrderService>} The mocked service instance.
 */
export const createMockTurnOrderService = () => ({
  startNewRound: jest.fn(),
  getNextEntity: jest.fn(),
  peekNextEntity: jest.fn(),
  addEntity: jest.fn(),
  removeEntity: jest.fn(),
  isEmpty: jest.fn(),
  getCurrentOrder: jest.fn(),
  clearCurrentRound: jest.fn(),
});

/**
 * Creates a mock ITurnHandlerResolver.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver>} The mocked resolver.
 */
export const createMockTurnHandlerResolver = () => ({
  resolveHandler: jest.fn(),
});

/**
 * Creates a mock ITurnHandler instance.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandler.js').ITurnHandler>} The mocked handler.
 */
export const createMockTurnHandler = () => ({
  startTurn: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  signalNormalApparentTermination: jest.fn(),
});

/**
 * Creates a mock IEntityManager.
 *
 * @returns {jest.Mocked<import('../../src/entities/entityManager.js').default> & { activeEntities: Map<string, any> }} The mocked entity manager.
 */
export const createMockEntityManager = () => ({
  getEntityInstance: jest.fn(),
  getEntitiesInLocation: jest.fn(() => new Set()),
  clearAll: jest.fn(),
  getActiveEntities: jest.fn(() => []),
  createEntity: jest.fn(),
  destroyEntity: jest.fn(),
  activeEntities: new Map(),
});

/**
 * Creates a mock Validated EventBus for tests.
 * Provides helper methods to manually trigger events and clear handlers.
 *
 * @returns {{
 *   dispatch: jest.Mock,
 *   subscribe: jest.Mock,
 *   _triggerEvent: (eventName: string, payload: any) => void,
 *   _clearHandlers: () => void,
 * }} The mocked event bus with manual trigger helpers.
 */
export const createMockValidatedEventBus = () => {
  const handlers = {};
  return {
    dispatch: jest.fn(async (eventName, payload) => {
      const listeners = handlers[eventName] || [];
      for (const listener of listeners) {
        await listener({ type: eventName, payload });
      }
    }),
    subscribe: jest.fn((eventName, handler) => {
      handlers[eventName] = handlers[eventName] || [];
      handlers[eventName].push(handler);
      return () => {
        const idx = handlers[eventName].indexOf(handler);
        if (idx > -1) handlers[eventName].splice(idx, 1);
      };
    }),
    _triggerEvent(eventName, payload) {
      const listeners = handlers[eventName] || [];
      listeners.forEach((h) => h(payload));
    },
    _clearHandlers() {
      Object.keys(handlers).forEach((k) => delete handlers[k]);
    },
  };
};

/**
 * Creates a simple mock Entity with configurable component flags.
 *
 * @param {string} id - The entity identifier.
 * @param {{ isActor?: boolean, isPlayer?: boolean }} [options] - Flags indicating component presence.
 * @returns {{ id: string, hasComponent: jest.Mock }} The created mock entity.
 */
export const createMockEntity = (
  id,
  { isActor = false, isPlayer = false } = {}
) => ({
  id,
  hasComponent: jest.fn((componentId) => {
    if (componentId === ACTOR_COMPONENT_ID) return isActor;
    if (componentId === PLAYER_COMPONENT_ID) return isPlayer;
    return false;
  }),
});
