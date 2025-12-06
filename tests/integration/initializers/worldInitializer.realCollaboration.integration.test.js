import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import WorldInitializer from '../../../src/initializers/worldInitializer.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import {
  WORLDINIT_ENTITY_INSTANTIATED_ID,
  WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
} from '../../../src/constants/eventIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

/**
 * Creates a production-like WorldInitializer harness with real collaborators.
 *
 * @param {object} options
 * @param {string} [options.worldId]
 * @param {Array<{instanceId?: string}>} [options.worldInstances]
 * @param {Array<{id: string, description?: string, components: Record<string, object>}>} [options.entityDefinitions]
 * @param {Array<{id: string, definitionId?: string, componentOverrides?: Record<string, object>}>} [options.instanceDefinitions]
 * @param {boolean} [options.includeWorld]
 * @param {object} [options.configOverrides]
 * @param {Set<string>} [options.invalidOverrideNames]
 * @returns {Promise<object>}
 */
async function createWorldInitializerHarness({
  worldId = 'integration:test-world',
  worldInstances = [],
  entityDefinitions = [],
  instanceDefinitions = [],
  includeWorld = true,
  configOverrides = {},
  invalidOverrideNames = new Set(),
} = {}) {
  const logger = new ConsoleLogger(LogLevel.DEBUG);

  const registry = new InMemoryDataRegistry({ logger });
  const repository = new GameDataRepository(registry, logger);
  const schemaValidator = new AjvSchemaValidator({ logger });

  schemaValidator.isSchemaLoaded = (schemaId) => schemaId === 'core:name';
  schemaValidator.validate = (schemaId, data) => {
    if (schemaId === 'core:name' && data?.name) {
      if (invalidOverrideNames.has(data.name)) {
        return {
          isValid: false,
          errors: [
            {
              instancePath: '',
              message: 'Name override rejected for integration coverage',
            },
          ],
        };
      }
      return { isValid: true, errors: [] };
    }
    return { isValid: true, errors: [] };
  };

  const eventBus = new EventBus({ logger });
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: repository,
    schemaValidator,
    logger,
  });
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });
  const eventDispatchService = new EventDispatchService({
    safeEventDispatcher,
    logger,
  });
  const scopeRegistry = new ScopeRegistry();

  const entityManager = new EntityManager({
    registry,
    validator: schemaValidator,
    logger,
    dispatcher: safeEventDispatcher,
  });

  const storedDefinitions = entityDefinitions.map((definition) =>
    definition instanceof EntityDefinition
      ? definition
      : new EntityDefinition(definition.id, {
          description: definition.description,
          components: definition.components,
        })
  );

  for (const definition of storedDefinitions) {
    registry.store('entityDefinitions', definition.id, definition);
  }

  for (const instance of instanceDefinitions) {
    registry.store('entityInstances', instance.id, {
      id: instance.id,
      definitionId: instance.definitionId,
      componentOverrides: instance.componentOverrides ?? {},
    });
  }

  if (includeWorld) {
    registry.store('worlds', worldId, {
      id: worldId,
      label: 'Integration Test World',
      instances: worldInstances,
    });
  }

  const baseConfigValues = {
    'performance.WORLD_LOADING_BATCH_SIZE': 64,
    'performance.WORLD_LOADING_MAX_BATCH_SIZE': 128,
    'performance.WORLD_LOADING_ENABLE_PARALLEL': true,
    'performance.WORLD_LOADING_BATCH_THRESHOLD': 20,
    'performance.WORLD_LOADING_TIMEOUT_MS': 30000,
  };

  const config = {
    isFeatureEnabled: (key) =>
      key === 'performance.ENABLE_WORLD_LOADING_OPTIMIZATION'
        ? true
        : Boolean(configOverrides?.isFeatureEnabled?.(key)),
    getValue: (key) => {
      if (typeof configOverrides?.getValue === 'function') {
        const override = configOverrides.getValue(key);
        if (override !== undefined) {
          return override;
        }
      }
      return baseConfigValues[key];
    },
  };

  const successEvents = [];
  const failureEvents = [];
  const systemErrors = [];

  const unsubscribeHandlers = [
    validatedEventDispatcher.subscribe(
      WORLDINIT_ENTITY_INSTANTIATED_ID,
      ({ payload }) => successEvents.push(payload)
    ),
    validatedEventDispatcher.subscribe(
      WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID,
      ({ payload }) => failureEvents.push(payload)
    ),
    validatedEventDispatcher.subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      ({ payload }) => systemErrors.push(payload)
    ),
  ].filter(Boolean);

  const worldInitializer = new WorldInitializer({
    entityManager,
    worldContext: { id: `${worldId}:context` },
    gameDataRepository: repository,
    validatedEventDispatcher,
    eventDispatchService,
    logger,
    scopeRegistry,
    config,
  });

  const cleanup = async () => {
    for (const unsubscribe of unsubscribeHandlers) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    if (typeof entityManager.clearAll === 'function') {
      entityManager.clearAll();
    }
    eventBus.resetRecursionCounters();
  };

  return {
    worldInitializer,
    entityManager,
    registry,
    repository,
    successEvents,
    failureEvents,
    systemErrors,
    cleanup,
    logger,
  };
}

describe('WorldInitializer integration with production collaborators', () => {
  let consoleDebugSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    consoleDebugSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('instantiates sequentially with mixed outcomes and dispatches real events', async () => {
    const worldInstances = [
      { instanceId: 'core:valid_actor' },
      { instanceId: 'core:failed_actor' },
      { instanceId: 'core:missing_definition' },
      { instanceId: 'core:invalid_definition_entry' },
      {},
      { instanceId: 'core:valid_actor' },
    ];

    const entityDefinitions = [
      {
        id: 'core:test_actor',
        components: {
          'core:name': { name: 'Base Actor' },
        },
      },
    ];

    const instanceDefinitions = [
      {
        id: 'core:valid_actor',
        definitionId: 'core:test_actor',
        componentOverrides: {
          'core:name': { name: 'Heroic Presence' },
        },
      },
      {
        id: 'core:failed_actor',
        definitionId: 'core:test_actor',
        componentOverrides: {
          'core:name': { name: 'Invalid override' },
        },
      },
      {
        id: 'core:invalid_definition_entry',
        componentOverrides: {
          'core:name': { name: 'No definition mapping' },
        },
      },
    ];

    const harness = await createWorldInitializerHarness({
      worldInstances,
      entityDefinitions,
      instanceDefinitions,
      invalidOverrideNames: new Set(['Invalid override']),
    });

    try {
      expect(harness.worldInitializer.getWorldContext()).toEqual(
        expect.objectContaining({ id: 'integration:test-world:context' })
      );

      const result = await harness.worldInitializer.initializeWorldEntities(
        'integration:test-world'
      );

      expect(result.optimizationUsed).toBe('sequential');
      expect(result.totalProcessed).toBe(worldInstances.length);
      expect(result.instantiatedCount).toBe(1);
      expect(result.failedCount).toBe(4);
      expect(harness.successEvents).toHaveLength(1);
      expect(harness.successEvents[0]).toEqual(
        expect.objectContaining({ entityId: 'core:valid_actor' })
      );

      expect(harness.failureEvents).toHaveLength(1);
      expect(harness.failureEvents[0]).toEqual(
        expect.objectContaining({ instanceId: 'core:failed_actor' })
      );

      const systemErrorInstanceIds = harness.systemErrors.map(
        (evt) => evt.details?.resourceId
      );
      expect(systemErrorInstanceIds).toContain('core:missing_definition');
    } finally {
      await harness.cleanup();
    }
  });

  it('dispatches critical system errors when the world definition is missing', async () => {
    const harness = await createWorldInitializerHarness({
      includeWorld: false,
    });

    try {
      await expect(
        harness.worldInitializer.initializeWorldEntities(
          'integration:test-world'
        )
      ).rejects.toThrow("World 'integration:test-world' not found");

      expect(harness.systemErrors.length).toBeGreaterThanOrEqual(1);
      expect(harness.systemErrors[0]).toEqual(
        expect.objectContaining({
          message: expect.stringContaining(
            "World 'integration:test-world' not found"
          ),
        })
      );
    } finally {
      await harness.cleanup();
    }
  });

  it('returns an empty result when the world contains no instance array', async () => {
    const harness = await createWorldInitializerHarness({
      worldInstances: undefined,
    });

    try {
      const result = await harness.worldInitializer.initializeWorldEntities(
        'integration:test-world'
      );

      expect(result.entities).toEqual([]);
      expect(result.instantiatedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.totalProcessed).toBe(0);
      expect(harness.successEvents).toHaveLength(0);
      expect(harness.failureEvents).toHaveLength(0);
      expect(harness.systemErrors).toHaveLength(0);
    } finally {
      await harness.cleanup();
    }
  });
});
