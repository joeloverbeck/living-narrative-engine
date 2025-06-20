/**
 * @file Module that contains common factories used in test suites.
 * @see tests/common/mockFactories.js
 */

import { jest } from '@jest/globals';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

/**
 * Creates a simple mock object with jest.fn methods.
 *
 * @description Utility to generate mock implementations for a list of method
 *   names. If default implementations are provided, they will be used instead
 *   of `jest.fn()`.
 * @param {string[]} methodNames - Names of the methods to mock.
 * @param {Record<string, any>} [defaults] - Optional default implementations.
 * @returns {Record<string, jest.Mock>} Object containing mocked methods.
 */
export function createSimpleMock(methodNames, defaults = {}) {
  const mock = {};
  for (const name of methodNames) {
    mock[name] = Object.prototype.hasOwnProperty.call(defaults, name)
      ? defaults[name]
      : jest.fn();
  }
  return mock;
}

// ── Core Service Mocks ────────────────────────────────────────────────────

export const createMockLogger = () =>
  createSimpleMock(['info', 'warn', 'error', 'debug']);

export const createMockSchemaValidator = (
  defaultValidationResult = { isValid: true }
) => ({
  validate: jest.fn(() => defaultValidationResult),
  isSchemaLoaded: jest.fn(),
  addSchema: jest.fn(),
  removeSchema: jest.fn(),
  getValidator: jest.fn(),
});

export const createSimpleMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(() => []),
  store: jest.fn(),
  clear: jest.fn(),
});

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
      Object.keys(internalStore).forEach((k) => delete internalStore[k]);
    }),
    // Convenience helpers frequently used in tests
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

export const createMockConfiguration = () => ({
  getContentTypeSchemaId: jest.fn((type) => `schema:${type}`),
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

export const createMockTurnManager = () =>
  createSimpleMock(['start', 'stop', 'nextTurn']);

/**
 * Creates a mock ITurnOrderService.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnOrderService.js').ITurnOrderService>} Mocked service
 */
export const createMockTurnOrderService = () =>
  createSimpleMock([
    'startNewRound',
    'getNextEntity',
    'peekNextEntity',
    'addEntity',
    'removeEntity',
    'isEmpty',
    'getCurrentOrder',
    'clearCurrentRound',
  ]);

/**
 * Creates a mock ITurnHandlerResolver.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandlerResolver.js').ITurnHandlerResolver>} Mocked resolver
 */
export const createMockTurnHandlerResolver = () =>
  createSimpleMock(['resolveHandler']);

/**
 * Creates a mock ITurnHandler instance.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ITurnHandler.js').ITurnHandler>} Mocked handler
 */
export const createMockTurnHandler = () =>
  createSimpleMock(['startTurn', 'destroy']);

/**
 * Mock for IGamePersistenceService.
 *
 * @description Creates a mock IGamePersistenceService service.
 * @returns {jest.Mocked<import('../../src/interfaces/IGamePersistenceService.js').IGamePersistenceService>} Mocked persistence service
 */
export const createMockGamePersistenceService = () =>
  createSimpleMock(['saveGame', 'loadAndRestoreGame', 'isSavingAllowed']);

export const createMockPlaytimeTracker = () =>
  createSimpleMock(
    [
      'reset',
      'startSession',
      'endSessionAndAccumulate',
      'getTotalPlaytime',
      'setAccumulatedPlaytime',
    ],
    { getTotalPlaytime: jest.fn().mockReturnValue(0) }
  );

export const createMockInitializationService = () =>
  createSimpleMock(['runInitializationSequence']);

// --- Prompting Mocks ---

/**
 * Creates a mock ILLMAdapter.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/ILLMAdapter.js').ILLMAdapter>} Mocked LLM adapter
 */
export const createMockLLMAdapter = () =>
  createSimpleMock(['getAIDecision', 'getCurrentActiveLlmId']);

/**
 * Creates a mock IAIGameStateProvider.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/IAIGameStateProvider.js').IAIGameStateProvider>} Mocked game state provider
 */
export const createMockAIGameStateProvider = () =>
  createSimpleMock(['buildGameState']);

/**
 * Creates a mock IAIPromptContentProvider.
 *
 * @returns {jest.Mocked<import('../../src/turns/interfaces/IAIPromptContentProvider.js').IAIPromptContentProvider>} Mocked prompt content provider
 */
export const createMockAIPromptContentProvider = () =>
  createSimpleMock(['getPromptData']);

/**
 * Creates a mock IPromptBuilder.
 *
 * @returns {jest.Mocked<import('../../src/interfaces/IPromptBuilder.js').IPromptBuilder>} Mocked prompt builder
 */
export const createMockPromptBuilder = () => createSimpleMock(['build']);

// --- Event Dispatcher Mocks ---

export const createMockSafeEventDispatcher = () =>
  createSimpleMock(['dispatch']);

export const createMockValidatedEventDispatcher = () =>
  createSimpleMock(['dispatch'], {
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
 * Generic content-loader mock (ActionLoader, ComponentLoader, …).
 *
 * @param defaultLoadResult
 */
export const createMockContentLoader = (
  defaultLoadResult = { count: 0, overrides: 0, errors: 0 }
) => ({
  loadItemsForMod: jest.fn().mockResolvedValue(defaultLoadResult),
});

/**
 * SchemaLoader stub.
 */
export const createMockSchemaLoader = () =>
  createSimpleMock(['loadAndCompileAllSchemas'], {
    loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
  });

/**
 * GameConfigLoader stub.
 */
export const createMockGameConfigLoader = () =>
  createSimpleMock(['loadConfig'], {
    loadConfig: jest.fn().mockResolvedValue([]),
  });

/**
 * ModManifestLoader stub.
 */
export const createMockModManifestLoader = () =>
  createSimpleMock(['loadRequestedManifests'], {
    loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
  });

/**
 * **NEW**: WorldLoader stub – satisfies ModsLoader’s dependency check.
 */
export const createMockWorldLoader = () =>
  createSimpleMock(['loadWorlds'], {
    loadWorlds: jest.fn().mockResolvedValue(undefined),
  });

// ── Modding Helper Mocks ──────────────────────────────────────────────────

/**
 * Creates a mock for the mod dependency validator.
 *
 * @returns {{ validate: jest.Mock }}
 */
export const createMockModDependencyValidator = () =>
  createSimpleMock(['validate']);

/**
 * Creates a mock for the mod version validator that satisfies both
 * the test helpers (which treat it like a plain function) and the
 * production dependency check (which expects a `.validate` method).
 *
 * @returns {jest.Mock & { validate: jest.Mock }}
 */
export const createMockModVersionValidator = () => {
  const fn = jest.fn();
  // expose the same function under the expected method name
  fn.validate = fn;
  return fn;
};

/**
 * Creates a mock for the mod load-order resolver.
 * Production code expects a `.resolve` method; tests expect `.resolveOrder`.
 * Provide both aliases that point to the same jest.fn for convenience.
 *
 * @returns {{ resolve: jest.Mock, resolveOrder: jest.Mock }}
 */
export const createMockModLoadOrderResolver = () => {
  const resolveFn = jest.fn((reqIds) => reqIds);
  return {
    resolve: resolveFn,
    resolveOrder: resolveFn, // alias so existing tests keep working
  };
};

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
