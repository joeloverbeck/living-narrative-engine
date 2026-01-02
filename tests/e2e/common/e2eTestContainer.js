/**
 * @file E2E Test Container Builder
 * Creates a real DI container with production services for e2e testing.
 * This replaces mock facades with actual production services while stubbing
 * external dependencies like LLM adapters.
 *
 * Supports optional mod loading for true end-to-end testing against real
 * game content and production services.
 *
 * @see reports/facade-architecture-analysis.md
 */

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Creates a Node.js-compatible fetch function for loading local files.
 * This is required because Jest's jsdom environment doesn't have native
 * fetch for local filesystem access.
 *
 * @param {string} identifier - Path to the file to fetch
 * @returns {Promise<object>} Response-like object with ok, json(), text(), status
 */
async function nodeFileFetch(identifier) {
  try {
    let absolutePath = path.resolve(process.cwd(), identifier);
    let content;
    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch (err) {
      // If the file is 'mod-manifest.json', try 'mod.manifest.json' as fallback
      if (absolutePath.endsWith('mod-manifest.json')) {
        absolutePath = absolutePath.replace(
          'mod-manifest.json',
          'mod.manifest.json'
        );
        content = await fs.readFile(absolutePath, 'utf8');
      } else {
        throw err;
      }
    }
    return {
      ok: true,
      json: async () => JSON.parse(content),
      text: async () => content,
      status: 200,
      statusText: 'OK',
    };
  } catch {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
    };
  }
}

/**
 * Creates a test-isolated fetch function that intercepts game.json requests.
 * Returns test configuration for game.json while delegating all other
 * requests to the real file system via nodeFileFetch.
 *
 * This approach prevents any modification to the actual data/game.json file,
 * ensuring test isolation even if Jest times out or the process is terminated.
 *
 * @param {string[]} mods - Array of mod IDs to include in test configuration
 * @returns {function(string): Promise<object>} Response-like object
 */
function createTestIsolatedFetch(mods) {
  const testGameConfig = { mods };

  return async function testIsolatedFetch(identifier) {
    // Normalize path for comparison
    const normalizedPath = identifier.replace(/\\/g, '/');

    // Intercept game.json requests - match various path formats
    if (
      normalizedPath.endsWith('/game.json') ||
      normalizedPath.endsWith('/data/game.json') ||
      normalizedPath === './data/game.json' ||
      normalizedPath === 'data/game.json'
    ) {
      return {
        ok: true,
        json: async () => testGameConfig,
        text: async () => JSON.stringify(testGameConfig, null, 2),
        status: 200,
        statusText: 'OK',
      };
    }

    // Delegate all other requests to real file system
    return nodeFileFetch(identifier);
  };
}

/**
 * Creates an LLM stub that returns configurable responses.
 * Implements the ILLMAdapter interface with minimal required methods.
 *
 * @param {object|string} defaultResponse - Default response to return
 * @returns {object} LLM adapter stub implementing ILLMAdapter interface
 */
function createLLMStub(defaultResponse) {
  let currentResponse = defaultResponse;

  return {
    /**
     * Returns a configured AI decision response.
     *
     * @param {object} _gameSummary - The game summary (ignored in stub)
     * @param {AbortSignal} [_abortSignal] - Optional abort signal (ignored in stub)
     * @param {object} [_requestOptions] - Optional request options (ignored in stub)
     * @returns {Promise<string>} JSON string response
     */
    async getAIDecision(_gameSummary, _abortSignal, _requestOptions) {
      return typeof currentResponse === 'string'
        ? currentResponse
        : JSON.stringify(currentResponse);
    },

    /**
     * Returns the current active LLM ID.
     *
     * @returns {string} Stub LLM identifier
     */
    getCurrentActiveLlmId() {
      return 'stub-llm';
    },

    /**
     * Configures the response for subsequent getAIDecision calls.
     *
     * @param {object|string} response - The response to return
     */
    setResponse(response) {
      currentResponse = response;
    },
  };
}

/**
 * @typedef {object} E2ETestHelpers
 * @property {(config: {name?: string, location?: string, components?: object}) => Promise<string>} createTestActor - Create test actor
 * @property {(config: {type: string, initialData?: object}) => Promise<string>} createEntity - Create entity
 * @property {(entityId: string, componentId: string) => Promise<object|null>} getComponent - Get component
 * @property {(entityId: string, componentId: string, data: object) => Promise<void>} updateComponent - Update component
 * @property {(entityId: string) => Promise<void>} deleteEntity - Delete entity
 * @property {(config: {actionId: string, actorId: string, targets?: object}) => Promise<{success: boolean, result?: object, error?: string}>} executeAction - Execute action
 * @property {(event: object) => Promise<void>} dispatchEvent - Dispatch event
 * @property {() => string[]} getCreatedEntities - Get created entity IDs
 */

/**
 * @typedef {object} E2ETestEnvironment
 * @property {AppContainer} container - The DI container
 * @property {object} services - Commonly-used resolved services
 * @property {object} services.entityManager - Entity management service
 * @property {object} services.actionDiscoveryService - Action discovery service
 * @property {object} services.actionExecutor - Action execution service
 * @property {object} services.eventBus - Event bus service
 * @property {object} services.logger - Logger service
 * @property {E2ETestHelpers} helpers - Facade-like helper functions (mocked when loadMods=false)
 * @property {boolean} modsLoaded - Whether real mods were loaded
 * @property {(response: object|string) => void} stubLLM - Function to configure LLM stub
 * @property {() => Promise<void>} cleanup - Async cleanup function
 * @property {() => Promise<void>} cleanupAll - Alias for cleanup (facade pattern)
 */

/**
 * Module-level cache for preloaded mod environments.
 * Used to share expensive mod loading across tests in the same file.
 * Key: JSON-stringified mods array, Value: cached registry data snapshot
 * @type {Map<string, {registrySnapshot: Map<string, Map<string, any>>}>}
 */
const modEnvironmentCache = new Map();

/**
 * Preloads mod data that can be shared across multiple test environments.
 * This avoids repeated filesystem I/O for the same mods.
 *
 * Call this in beforeAll() and pass the result to createE2ETestEnvironment()
 * via the preloadedModEnvironment option.
 *
 * @param {string[]} mods - Which mods to preload
 * @param {string} [worldName='testworld'] - World name for mod loading context
 * @returns {Promise<{registrySnapshot: Map<string, Map<string, any>>}>} Cached mod environment
 * @example
 * let cachedModEnv;
 * beforeAll(async () => {
 *   cachedModEnv = await preloadModEnvironment(['core']);
 * });
 * beforeEach(async () => {
 *   env = await createE2ETestEnvironment({
 *     loadMods: true,
 *     mods: ['core'],
 *     preloadedModEnvironment: cachedModEnv,
 *   });
 * });
 */
export async function preloadModEnvironment(mods, worldName = 'testworld') {
  const cacheKey = JSON.stringify(mods.slice().sort());

  // Return cached if available
  if (modEnvironmentCache.has(cacheKey)) {
    return modEnvironmentCache.get(cacheKey);
  }

  // Track original fetch for cleanup
  const originalFetch = globalThis.fetch;

  // Create temporary container to load mods
  const tempContainer = new AppContainer();
  await configureContainer(tempContainer, {
    outputDiv: globalThis.document?.createElement('div') || { innerHTML: '' },
    inputElement:
      globalThis.document?.createElement('input') || { value: '' },
    titleElement:
      globalThis.document?.createElement('h1') || { textContent: '' },
    document: globalThis.document || {},
  });

  // Patch global.fetch with test-isolated fetcher
  globalThis.fetch = createTestIsolatedFetch(mods);

  try {
    const modsLoader = tempContainer.resolve(tokens.ModsLoader);
    await modsLoader.loadMods(worldName, mods);

    // Capture registry data snapshot
    const registry = tempContainer.resolve(tokens.IDataRegistry);
    const registrySnapshot = new Map();

    // Copy all registry stores
    if (registry._stores) {
      for (const [storeKey, storeMap] of registry._stores.entries()) {
        registrySnapshot.set(storeKey, new Map(storeMap));
      }
    }

    const cachedEnv = { registrySnapshot };
    modEnvironmentCache.set(cacheKey, cachedEnv);
    return cachedEnv;
  } finally {
    globalThis.fetch = originalFetch;
    tempContainer.cleanup();
  }
}

/**
 * Clears the mod environment cache. Call in afterAll() if needed.
 */
export function clearModEnvironmentCache() {
  modEnvironmentCache.clear();
}

/**
 * Creates an e2e test environment with production container.
 * The environment uses real DI container with all production registrations,
 * but stubs external dependencies like LLM adapters by default.
 *
 * When `loadMods` is true, actual mod files are loaded from the filesystem,
 * enabling true end-to-end testing against real game content. This uses
 * local filesystem access (no network required).
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.stubLLM=true] - Whether to stub LLM calls
 * @param {object} [options.defaultLLMResponse] - Default LLM stub response
 * @param {boolean} [options.loadMods=false] - Whether to load real mods from filesystem
 * @param {string[]} [options.mods=['core']] - Which mods to load (requires loadMods=true)
 * @param {string} [options.worldName='testworld'] - World name for mod loading context
 * @param {object} [options.preloadedModEnvironment] - Cached mod environment from preloadModEnvironment()
 * @returns {Promise<E2ETestEnvironment>} The test environment
 * @example
 * // Basic usage with mock helpers
 * const env = await createE2ETestEnvironment({ stubLLM: true });
 *
 * @example
 * // True e2e with real mods
 * const env = await createE2ETestEnvironment({
 *   loadMods: true,
 *   mods: ['core', 'positioning'],
 *   stubLLM: true
 * });
 *
 * @example
 * // Optimized: Shared mod loading across tests
 * let cachedModEnv;
 * beforeAll(async () => {
 *   cachedModEnv = await preloadModEnvironment(['core']);
 * });
 * beforeEach(async () => {
 *   env = await createE2ETestEnvironment({
 *     loadMods: true,
 *     mods: ['core'],
 *     preloadedModEnvironment: cachedModEnv,
 *   });
 * });
 *
 * try {
 *   const { entityManager, actionDiscoveryService, actionExecutor } = env.services;
 *   // Use REAL production services with real mod data
 * } finally {
 *   await env.cleanup();
 * }
 */
export async function createE2ETestEnvironment(options = {}) {
  const {
    stubLLM = true,
    defaultLLMResponse = { actionId: 'core:wait' },
    loadMods = false,
    mods = ['core'],
    worldName = 'testworld',
    preloadedModEnvironment = null,
  } = options;

  // Track original fetch for cleanup
  const originalFetch = globalThis.fetch;

  // Create real container
  const container = new AppContainer();

  // Configure with production services using mock UI elements
  // This mirrors how existing e2e tests set up their containers
  await configureContainer(container, {
    outputDiv: globalThis.document?.createElement('div') || { innerHTML: '' },
    inputElement:
      globalThis.document?.createElement('input') || { value: '' },
    titleElement:
      globalThis.document?.createElement('h1') || { textContent: '' },
    document: globalThis.document || {},
  });

  // Stub LLM if requested (before resolving services)
  if (stubLLM) {
    container.setOverride(tokens.LLMAdapter, createLLMStub(defaultLLMResponse));
  }

  // Optionally load real mods from filesystem for true e2e testing
  if (loadMods) {
    // Use preloaded mod environment if available (significantly faster)
    if (preloadedModEnvironment?.registrySnapshot) {
      // Restore registry data from snapshot
      const registry = container.resolve(tokens.IDataRegistry);
      for (const [storeKey, storeMap] of preloadedModEnvironment.registrySnapshot.entries()) {
        for (const [itemKey, itemValue] of storeMap.entries()) {
          registry.store(storeKey, itemKey, itemValue);
        }
      }
    } else {
      // Fallback: Load mods from filesystem (slower, for backward compatibility)
      // Patch global.fetch with test-isolated fetcher
      // This intercepts game.json requests to return test config
      // while allowing all other file reads to proceed normally.
      // No file system modifications - safe even if tests crash.
      globalThis.fetch = createTestIsolatedFetch(mods);

      try {
        // ModsLoader is already registered by configureContainer via baseContainerConfig
        const modsLoader = container.resolve(tokens.ModsLoader);
        await modsLoader.loadMods(worldName, mods);
      } finally {
        // Restore original fetch
        globalThis.fetch = originalFetch;
      }
    }
  }

  // Resolve common services
  const services = {
    entityManager: container.resolve(tokens.IEntityManager),
    actionDiscoveryService: container.resolve(tokens.IActionDiscoveryService),
    actionExecutor: container.resolve(tokens.ActionPipelineOrchestrator),
    eventBus: container.resolve(tokens.IEventBus),
    logger: container.resolve(tokens.ILogger),
  };

  // In-memory entity store for test isolation
  // This mirrors the mock facade pattern where tests manage entity state directly
  // without depending on the real EntityManager's API
  const entityStore = new Map();

  // Create helper functions that provide facade-like convenience
  // using an in-memory store (matches original mock facade behavior)
  const helpers = {
    /**
     * Creates a test actor entity with sensible defaults.
     * Mirrors the facade pattern: entityService.createTestActor({name, location, components})
     *
     * @param {object} config - Actor configuration
     * @param {string} [config.name='Test Actor'] - Actor name
     * @param {string} [config.location='test:location'] - Location ID
     * @param {object} [config.components={}] - Additional components
     * @returns {Promise<string>} Created entity ID
     */
    async createTestActor(config = {}) {
      const {
        name = 'Test Actor',
        location = 'test:location',
        components = {},
      } = config;

      const entityId = uuidv4();
      const baseComponents = {
        'core:name': { name },
        'core:location': { locationId: location },
        'core:actor': { type: 'npc' },
        ...components,
      };

      // Store entity in our in-memory store (matches mock facade behavior)
      const entity = {
        id: entityId,
        components: baseComponents,
      };

      entityStore.set(entityId, entity);
      return entityId;
    },

    /**
     * Creates an entity with specified type and initial data.
     * Mirrors the facade pattern: entityService.createEntity({type, initialData})
     *
     * @param {object} config - Entity configuration
     * @param {string} config.type - Entity definition type
     * @param {object} [config.initialData={}] - Initial component data
     * @returns {Promise<string>} Created entity ID
     */
    async createEntity(config = {}) {
      const { type, initialData = {} } = config;

      if (!type) {
        throw new Error('Entity type is required');
      }

      const entityId = uuidv4();
      const entity = {
        id: entityId,
        definitionId: type,
        components: initialData,
      };

      entityStore.set(entityId, entity);
      return entityId;
    },

    /**
     * Gets a component from an entity.
     * Mirrors the facade pattern: entityService.getComponent(entityId, componentId)
     *
     * @param {string} entityId - Entity ID
     * @param {string} componentId - Component ID
     * @returns {Promise<object|null>} Component data or null
     */
    async getComponent(entityId, componentId) {
      const entity = entityStore.get(entityId);
      if (!entity) {
        return null;
      }
      return entity.components?.[componentId] || null;
    },

    /**
     * Updates a component on an entity.
     * Mirrors the facade pattern: entityService.updateComponent(entityId, componentId, data)
     *
     * @param {string} entityId - Entity ID
     * @param {string} componentId - Component ID
     * @param {object} data - New component data
     * @returns {Promise<void>}
     */
    async updateComponent(entityId, componentId, data) {
      const entity = entityStore.get(entityId);
      if (entity) {
        if (!entity.components) {
          entity.components = {};
        }
        entity.components[componentId] = data;
      }
    },

    /**
     * Deletes an entity.
     * Mirrors the facade pattern: entityService.deleteEntity(entityId)
     *
     * @param {string} entityId - Entity ID to delete
     * @returns {Promise<void>}
     */
    async deleteEntity(entityId) {
      entityStore.delete(entityId);
    },

    /**
     * Executes an action (mock implementation for e2e tests without loaded mods).
     * Mirrors the facade pattern: actionService.executeAction({actionId, actorId, targets})
     *
     * Note: Since mods are not loaded in this test environment, this returns a mock
     * success response. Tests should manually set up entity state after calling this.
     * This matches the behavior of the original mock facades.
     *
     * @param {object} config - Action configuration
     * @param {string} config.actionId - Action ID to execute
     * @param {string} config.actorId - Actor performing the action
     * @param {object} [config.targets={}] - Target entities
     * @returns {Promise<object>} Execution result with success property
     */
    async executeAction(config) {
      const { actionId, actorId, targets = {} } = config;

      // Return mock success like the original facade
      // Tests manually set up state after calling executeAction
      services.logger.debug('E2E executeAction mock', {
        actionId,
        actorId,
        targets,
      });

      return {
        success: true,
        effects: ['Action executed successfully'],
        description: 'The action was performed.',
      };
    },

    /**
     * Dispatches an event through the event bus.
     *
     * @param {object} event - Event to dispatch
     * @returns {Promise<void>}
     */
    async dispatchEvent(event) {
      await services.eventBus.dispatch(event);
    },

    /**
     * Gets all created entity IDs for inspection.
     *
     * @returns {string[]} Array of entity IDs
     */
    getCreatedEntities() {
      return Array.from(entityStore.keys());
    },

    /**
     * Gets an entity by ID.
     *
     * @param {string} entityId - Entity ID
     * @returns {Promise<object|null>} Entity object or null
     */
    async getEntity(entityId) {
      return entityStore.get(entityId) || null;
    },
  };

  // Return environment object
  return {
    container,
    services,
    helpers,
    modsLoaded: loadMods,

    /**
     * Configures the LLM stub to return a specific response.
     *
     * @param {object|string} response - The response to return from subsequent LLM calls
     */
    stubLLM: (response) => {
      container.setOverride(tokens.LLMAdapter, createLLMStub(response));
    },

    /**
     * Cleans up container resources. Must be called after test completion.
     *
     * @returns {Promise<void>}
     */
    cleanup: async () => {
      // Clear in-memory entity store
      entityStore.clear();
      container.cleanup();
    },

    /**
     * Cleans up all tracked resources.
     * Alias for cleanup() to match facade pattern.
     *
     * @returns {Promise<void>}
     */
    cleanupAll: async () => {
      entityStore.clear();
      container.cleanup();
    },
  };
}
