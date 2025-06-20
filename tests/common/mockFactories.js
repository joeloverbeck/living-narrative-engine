/**
 * @file Module that contains common factories used in test suites.
 * @see tests/common/mockFactories.js
 */

import { jest } from '@jest/globals';

// ── Core Service Mocks ────────────────────────────────────────────────────

export const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

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
    getEntityDefinition: jest.fn((id) => internalStore['entity_definitions']?.[id]),
    getItemDefinition: jest.fn((id) => internalStore['items']?.[id]),
    getLocationDefinition: jest.fn((id) => internalStore['locations']?.[id]),
    getConnectionDefinition: jest.fn((id) => internalStore['connections']?.[id]),
    getBlockerDefinition: jest.fn((id) => internalStore['blockers']?.[id]),
    getActionDefinition: jest.fn((id) => internalStore['actions']?.[id]),
    getEventDefinition: jest.fn((id) => internalStore['events']?.[id]),
    getComponentDefinition: jest.fn((id) => internalStore['components']?.[id]),
    getAllEntityDefinitions: jest.fn(() => Object.values(internalStore['entity_definitions'] || {})),
    getAllItemDefinitions: jest.fn(() => Object.values(internalStore['items'] || {})),
    getAllLocationDefinitions: jest.fn(() => Object.values(internalStore['locations'] || {})),
    getAllConnectionDefinitions: jest.fn(() => Object.values(internalStore['connections'] || {})),
    getAllBlockerDefinitions: jest.fn(() => Object.values(internalStore['blockers'] || {})),
    getAllActionDefinitions: jest.fn(() => Object.values(internalStore['actions'] || {})),
    getAllEventDefinitions: jest.fn(() => Object.values(internalStore['events'] || {})),
    getAllComponentDefinitions: jest.fn(() => Object.values(internalStore['components'] || {})),
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

// ── Misc Service Mocks ───────────────────────────────────────────────────

export const createMockEntityManager = () => ({
  clearAll: jest.fn(),
  getActiveEntities: jest.fn().mockReturnValue([]),
});

export const createMockTurnManager = () => ({
  start: jest.fn(),
  stop: jest.fn(),
  nextTurn: jest.fn(),
});

export const createMockGamePersistenceService = () => ({
  saveGame: jest.fn(),
  loadAndRestoreGame: jest.fn(),
  isSavingAllowed: jest.fn(),
});

export const createMockPlaytimeTracker = () => ({
  reset: jest.fn(),
  startSession: jest.fn(),
  endSessionAndAccumulate: jest.fn(),
  getTotalPlaytime: jest.fn().mockReturnValue(0),
  setAccumulatedPlaytime: jest.fn(),
});

export const createMockInitializationService = () => ({
  runInitializationSequence: jest.fn(),
});

// ── Dispatcher Mocks ──────────────────────────────────────────────────────

export const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

export const createMockValidatedEventDispatcher = () => ({
  dispatch: jest.fn().mockResolvedValue(undefined),
});

/* ── Loader-specific mocks ─────────────────────────────────────────────── */

/**
 * Generic content-loader mock (ActionLoader, ComponentLoader, …).
 */
export const createMockContentLoader = (
  defaultLoadResult = { count: 0, overrides: 0, errors: 0 }
) => ({
  loadItemsForMod: jest.fn().mockResolvedValue(defaultLoadResult),
});

/**
 * SchemaLoader stub.
 */
export const createMockSchemaLoader = () => ({
  loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
});

/**
 * GameConfigLoader stub.
 */
export const createMockGameConfigLoader = () => ({
  loadConfig: jest.fn().mockResolvedValue([]),
});

/**
 * ModManifestLoader stub.
 */
export const createMockModManifestLoader = () => ({
  loadRequestedManifests: jest.fn().mockResolvedValue(new Map()),
});

/**
 * **NEW**: WorldLoader stub – satisfies ModsLoader’s dependency check.
 */
export const createMockWorldLoader = () => ({
  loadWorlds: jest.fn().mockResolvedValue(undefined),
});

// ── Modding Helper Mocks ──────────────────────────────────────────────────

/**
 * Creates a mock for the mod dependency validator.
 * @returns {{ validate: jest.Mock }}
 */
export const createMockModDependencyValidator = () => ({
  validate: jest.fn(),
});

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