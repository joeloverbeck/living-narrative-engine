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
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ILogger>}
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
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').ISchemaValidator>}
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
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IDataRegistry>}
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
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IDataRegistry> & { _internalStore: object }}
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
 * @returns {jest.Mocked<import('../../src/interfaces/coreServices.js').IConfiguration>}
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
export const createMockEntityManager = () => {
  const activeEntities = new Map();
  return {
    activeEntities,
    clearAll: jest.fn(() => {
      activeEntities.clear();
    }),
    getActiveEntities: jest.fn(() => activeEntities),
    getEntityInstance: jest.fn((id) => activeEntities.get(id)),
    removeEntityInstance: jest.fn((id) => activeEntities.delete(id)),
    reconstructEntity: jest.fn((data) => {
      const entity = { id: data.instanceId || data.id };
      activeEntities.set(entity.id, entity);
      return entity;
    }),
  };
};

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
 * Creates a mock ITurnOrderService.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnOrderService.js').ITurnOrderService>} Mocked service
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
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver>} Mocked resolver
 */
export const createMockTurnHandlerResolver = () => ({
  resolveHandler: jest.fn(),
});

/**
 * Creates a mock ITurnHandler instance.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandler.js').ITurnHandler>} Mocked handler
 */
export const createMockTurnHandler = () => ({
  startTurn: jest.fn(),
  destroy: jest.fn(),
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
 * @returns {jest.Mocked<import('../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher>}
 */
export const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

/**
 * Creates a mock ValidatedEventDispatcher.
 *
 * @returns {jest.Mocked<import('../../services/validatedEventDispatcher.js').default>}
 */
export const createMockValidatedEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock event bus that records subscriptions and allows manual triggering.
 *
 * @returns {object} Mock event bus with helper methods
 */
export const createMockValidatedEventBus = () => {
  const handlers = {};
  return {
    dispatch: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn((eventName, handler) => {
      if (!handlers[eventName]) {
        handlers[eventName] = [];
      }
      handlers[eventName].push(handler);
      return jest.fn(() => {
        const index = handlers[eventName].indexOf(handler);
        if (index > -1) {
          handlers[eventName].splice(index, 1);
        }
      });
    }),
    _triggerEvent: (eventName, payload) => {
      (handlers[eventName] || []).forEach((h) => h(payload));
    },
    _clearHandlers: () => {
      Object.keys(handlers).forEach((k) => delete handlers[k]);
    },
  };
};

// --- Loader Mocks ---

/**
 * Creates a generic mock for content loaders (e.g., ActionLoader, ComponentLoader).
 *
 * @param {object} [defaultLoadResult] - The default result for loadItemsForMod.
 * @returns {jest.Mocked<import('../../../src/interfaces/coreServices.js').BaseManifestItemLoaderInterface>}
 */
export const createMockContentLoader = (
  defaultLoadResult = { count: 0, overrides: 0, errors: 0 }
) => ({
  loadItemsForMod: jest.fn().mockResolvedValue(defaultLoadResult),
});

/**
 * Creates a mock SchemaLoader.
 *
 * @returns {jest.Mocked<import('../../src/loaders/schemaLoader.js').default>}
 */
export const createMockSchemaLoader = () => ({
  loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
});

/**
 * Creates a mock GameConfigLoader.
 *
 * @returns {jest.Mocked<import('../../src/loaders/gameConfigLoader.js').default>}
 */
export const createMockGameConfigLoader = () => ({
  loadConfig: jest.fn().mockResolvedValue([]), // Default to no mods
});

/**
 * Creates a mock ModManifestLoader.
 *
 * @returns {jest.Mocked<import('../../src/modding/modManifestLoader.js').default>}
 */
export const createMockModManifestLoader = () => ({
  loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
});

// --- Modding Helper Mocks ---

/**
 * Creates a mock for the mod dependency validator.
 *
 * @returns {{ validate: jest.Mock }}
 */
export const createMockModDependencyValidator = () => ({
  validate: jest.fn(),
});

/**
 * Creates a mock for the mod version validator.
 *
 * @returns {jest.Mock}
 */
export const createMockModVersionValidator = () => jest.fn();

/**
 * Creates a mock for the mod load order resolver.
 *
 * @returns {{ resolveOrder: jest.Mock }}
 */
export const createMockModLoadOrderResolver = () => ({
  // Default behavior resolves to the same order it was given
  resolveOrder: jest.fn((reqIds) => reqIds),
});

/**
 * Creates a simple mock entity with component checks.
 *
 * @param {string} id - Unique entity ID.
 * @param {{isActor?: boolean, isPlayer?: boolean}} [options] - Flags for component presence.
 * @returns {{id: string, hasComponent: jest.Mock}} Mock entity
 */
export const createMockEntity = (
  id,
  { isActor = false, isPlayer = false } = {}
) => ({
  id,
  hasComponent: jest.fn((compId) => {
    if (compId === ACTOR_COMPONENT_ID) return isActor;
    if (compId === PLAYER_COMPONENT_ID) return isPlayer;
    return false;
  }),
});
