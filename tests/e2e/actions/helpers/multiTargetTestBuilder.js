/**
 * @file MultiTargetTestBuilder - Builder for multi-target action test scenarios
 * @description Provides utilities for setting up complex multi-target action tests
 * using real production services via the e2eTestContainer.
 *
 * Migration: FACARCANA-008 - Removed legacy MultiTargetTestBuilder class and
 * createMultiTargetTestBuilder factory that used mock facades. All tests now
 * use createMultiTargetTestContext with real production services.
 */

import { createE2ETestEnvironment } from '../../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

/**
 * Creates a multi-target test context using real production services.
 * This is the standard approach for multi-target action tests.
 *
 * @param {object} options - Configuration options
 * @param {string[]} [options.mods=['core']] - Mods to load
 * @param {boolean} [options.stubLLM=true] - Whether to stub the LLM adapter
 * @param {object} [options.entityDefinitions={}] - Custom entity definitions to register
 * @returns {Promise<object>} Test context with real services
 *
 * @example
 * const ctx = await createMultiTargetTestContext({
 *   mods: ['core', 'positioning'],
 *   entityDefinitions: {
 *     'test:actor': { 'core:name': { text: 'Test' }, 'core:actor': {} }
 *   }
 * });
 *
 * const entity = await ctx.entityManager.createEntityInstance('test:actor', {
 *   instanceId: 'test-1',
 *   componentOverrides: { 'core:name': { text: 'Actor 1' } }
 * });
 *
 * const result = await ctx.actionDiscoveryService.getValidActions(entity, {}, { trace: false });
 * await ctx.cleanup();
 */
export async function createMultiTargetTestContext(options = {}) {
  const {
    mods = ['core'],
    stubLLM = true,
    entityDefinitions = {},
  } = options;

  // Create real e2e test environment with mod loading
  const env = await createE2ETestEnvironment({
    loadMods: true,
    mods,
    stubLLM,
  });

  const entityManager = env.services.entityManager;
  const actionDiscoveryService = env.services.actionDiscoveryService;
  const actionExecutor = env.services.actionExecutor;
  const eventBus = env.services.eventBus;
  const registry = env.container.resolve(tokens.IDataRegistry);

  // Register custom entity definitions if provided
  for (const [defId, components] of Object.entries(entityDefinitions)) {
    const definition = createEntityDefinition(defId, components);
    registry.store('entityDefinitions', defId, definition);
  }

  return {
    // Full environment for advanced access
    env,
    container: env.container,

    // Real production services
    entityManager,
    actionDiscoveryService,
    actionExecutor,
    eventBus,
    registry,

    // Helper to register entity definitions on-the-fly
    registerEntityDefinition: (defId, components) => {
      const definition = createEntityDefinition(defId, components);
      registry.store('entityDefinitions', defId, definition);
      return definition;
    },

    // Helper to create an actor entity with standard components
    createActor: async (instanceId, name, locationId, extraComponents = {}) => {
      return entityManager.createEntityInstance('test:actor', {
        instanceId,
        componentOverrides: {
          'core:name': { text: name },
          'core:position': { locationId },
          'core:actor': {},
          ...extraComponents,
        },
      });
    },

    // Helper to create a location entity
    createLocation: async (instanceId, name) => {
      return entityManager.createEntityInstance('test:location', {
        instanceId,
        componentOverrides: {
          'core:name': { text: name },
        },
      });
    },

    // Cleanup function
    cleanup: async () => {
      await env.cleanup();
    },
  };
}

/**
 * Registers standard test entity definitions (actor, location, item).
 * Use this helper when you need basic entity definitions for testing.
 *
 * @param {object} registry - The data registry to store definitions in
 */
export function registerStandardTestDefinitions(registry) {
  // Register location definition
  const locationDef = createEntityDefinition('test:location', {
    'core:name': { text: 'Test Location' },
  });
  registry.store('entityDefinitions', 'test:location', locationDef);

  // Register actor definition
  const actorDef = createEntityDefinition('test:actor', {
    'core:name': { text: 'Test Actor' },
    'core:actor': {},
  });
  registry.store('entityDefinitions', 'test:actor', actorDef);

  // Register item definition
  const itemDef = createEntityDefinition('test:item', {
    'core:name': { text: 'Test Item' },
  });
  registry.store('entityDefinitions', 'test:item', itemDef);
}
