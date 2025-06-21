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

/**
 * Generates simple mock factory functions based on a specification map.
 *
 * @param {Record<string, string[] | {methods: string[], defaults?: object}>} specMap
 *  Mapping of factory names to method arrays or spec objects.
 * @returns {Record<string, () => object>} Generated factory functions.
 */
function generateFactories(specMap) {
  const factories = {};
  for (const [name, spec] of Object.entries(specMap)) {
    const { methods, defaults = {} } = Array.isArray(spec)
      ? { methods: spec, defaults: {} }
      : spec;
    factories[name] = () => createSimpleMock(methods, defaults);
  }
  return factories;
}

// Definitions for factories that only wrap createSimpleMock
const simpleFactories = {
  createMockLogger: ['info', 'warn', 'error', 'debug'],
  createMockTurnManager: ['start', 'stop', 'nextTurn'],
  createMockTurnOrderService: [
    'startNewRound',
    'getNextEntity',
    'peekNextEntity',
    'addEntity',
    'removeEntity',
    'isEmpty',
    'getCurrentOrder',
    'clearCurrentRound',
  ],
  createMockTurnHandlerResolver: ['resolveHandler'],
  createMockTurnHandler: ['startTurn', 'destroy'],
  createMockGamePersistenceService: [
    'saveGame',
    'loadAndRestoreGame',
    'isSavingAllowed',
  ],
  createMockPlaytimeTracker: {
    methods: [
      'reset',
      'startSession',
      'endSessionAndAccumulate',
      'getTotalPlaytime',
      'setAccumulatedPlaytime',
    ],
    defaults: { getTotalPlaytime: jest.fn().mockReturnValue(0) },
  },
  createMockInitializationService: ['runInitializationSequence'],
  createMockLLMAdapter: ['getAIDecision', 'getCurrentActiveLlmId'],
  createMockAIGameStateProvider: ['buildGameState'],
  createMockAIPromptContentProvider: ['getPromptData'],
  createMockPromptBuilder: ['build'],
  createMockSafeEventDispatcher: ['dispatch'],
  createMockValidatedEventDispatcher: {
    methods: ['dispatch'],
    defaults: { dispatch: jest.fn().mockResolvedValue(undefined) },
  },
  createMockSchemaLoader: {
    methods: ['loadAndCompileAllSchemas'],
    defaults: {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    },
  },
  createMockGameConfigLoader: {
    methods: ['loadConfig'],
    defaults: { loadConfig: jest.fn().mockResolvedValue([]) },
  },
  createMockModManifestLoader: {
    methods: ['loadRequestedManifests'],
    defaults: {
      loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
    },
  },
  createMockWorldLoader: {
    methods: ['loadWorlds'],
    defaults: { loadWorlds: jest.fn().mockResolvedValue(undefined) },
  },
  createMockModDependencyValidator: ['validate'],
};

export const {
  createMockLogger,
  createMockTurnManager,
  createMockTurnOrderService,
  createMockTurnHandlerResolver,
  createMockTurnHandler,
  createMockGamePersistenceService,
  createMockPlaytimeTracker,
  createMockInitializationService,
  createMockLLMAdapter,
  createMockAIGameStateProvider,
  createMockAIPromptContentProvider,
  createMockPromptBuilder,
  createMockSafeEventDispatcher,
  createMockValidatedEventDispatcher,
  createMockSchemaLoader,
  createMockGameConfigLoader,
  createMockModManifestLoader,
  createMockWorldLoader,
  createMockModDependencyValidator,
} = generateFactories(simpleFactories);

// ── Core Service Mocks ────────────────────────────────────────────────────

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

  const toPascalCase = (str) =>
    str
      .split(/[_-]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');

  const registry = {
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
    getAllSystemRules: jest.fn(() => []),
    getManifest: jest.fn(),
    setManifest: jest.fn(),
    getStartingPlayerId: jest.fn(() => null),
    getStartingLocationId: jest.fn(() => null),
  };

  const contentTypes = [
    'entity_definitions',
    'items',
    'locations',
    'connections',
    'blockers',
    'actions',
    'events',
    'components',
  ];

  for (const type of contentTypes) {
    const pascal = toPascalCase(type);
    registry[`get${pascal}Definition`] = jest.fn(
      (id) => internalStore[type]?.[id]
    );
    registry[`getAll${pascal}Definitions`] = jest.fn(() =>
      Object.values(internalStore[type] || {})
    );
  }

  return registry;
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
 * Minimal DI container mock.
 */
export const createMockContainer = (mapping, overrides = {}) => ({
  resolve: jest.fn((token) => {
    if (Object.prototype.hasOwnProperty.call(overrides, token)) {
      return overrides[token];
    }
    if (Object.prototype.hasOwnProperty.call(mapping, token)) {
      return mapping[token];
    }
    const tokenName =
      typeof token === 'symbol' ? token.toString() : String(token);
    throw new Error(`createMockContainer: Unmapped token: ${tokenName}`);
  }),
});
