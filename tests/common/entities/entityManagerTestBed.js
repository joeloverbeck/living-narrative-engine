/**
 * @file This module provides a centralized EntityManagerTestBed helper and standardized test data
 * for all EntityManager unit tests. It aims to reduce boilerplate, improve readability,
 * and make the test suite easier to maintain.
 * @see tests/common/entities/entityManagerTestBed.js
 */

import EntityManager from '../../../src/entities/entityManager.js';
import { TestData } from './testData.js';
import {
  createMockLogger,
  createMockSchemaValidator,
  createMockSafeEventDispatcher,
  createSimpleMockDataRegistry,
} from '../mockFactories';
import FactoryTestBed from '../factoryTestBed.js';
import { createDescribeTestBedSuite } from '../describeSuite.js';

// --- Centralized Mocks (REMOVED) ---
// Mock creation functions are now imported.

// --- Centralized Test Data (UNCHANGED) ---

/**
 * Encapsulates the complete test setup for EntityManager tests.
 * Creates mocks, instantiates the manager, and provides helper methods
 * to streamline test writing.
 */
export class EntityManagerTestBed extends FactoryTestBed {
  /**
   * Collection of all mocks for easy access in tests.
   *
   * @type {{registry: ReturnType<typeof createSimpleMockDataRegistry>, validator: ReturnType<typeof createMockSchemaValidator>, logger: ReturnType<typeof createMockLogger>, eventDispatcher: ReturnType<typeof createMockSafeEventDispatcher>}}
   */

  /**
   * The instance of EntityManager under test, pre-configured with mocks.
   *
   * @type {EntityManager}
   */
  entityManager;

  /**
   * Creates a new EntityManagerTestBed instance.
   *
   * @param {object} [overrides] - Optional overrides.
   * @param {object} [overrides.entityManagerOptions] - Options forwarded to the EntityManager constructor.
   * @param {Function} [overrides.idGenerator] - Legacy shortcut for entityManagerOptions.idGenerator.
   * @param {import('../../../src/entities/services/entityRepositoryAdapter.js').EntityRepositoryAdapter} [overrides.entityManagerOptions.entityRepository]
   *   - EntityRepository implementation used by the EntityManager.
   */
  constructor(overrides = {}) {
    const { entityManagerOptions = {}, ...legacyOptions } = overrides;
    const emOptions = { ...legacyOptions, ...entityManagerOptions };
    super({
      registry: createSimpleMockDataRegistry,
      validator: createMockSchemaValidator,
      logger: createMockLogger,
      eventDispatcher: createMockSafeEventDispatcher,
    });

    this.entityManager = new EntityManager({
      registry: this.mocks.registry,
      validator: this.mocks.validator,
      logger: this.mocks.logger,
      dispatcher: this.mocks.eventDispatcher,
      ...emOptions,
    });
  }

  /**
   * Configures the mock IDataRegistry to return specific definitions for a test.
   *
   * @param {...object} definitions - The definitions to make available via the mock registry.
   */
  setupDefinitions(...definitions) {
    this.mocks.registry.getEntityDefinition.mockImplementation((id) => {
      return definitions.find((def) => def.id === id);
    });
  }

  /**
   * Clears mock implementations and resets entity manager state after base cleanup.
   *
   * @protected
   * @returns {Promise<void>} Promise resolving when entity cleanup is complete.
   */
  async _afterCleanup() {
    // Reset specific mock implementations that tests commonly override
    this.mocks.registry.getEntityDefinition.mockReset();
    this.mocks.validator.validate.mockReset();
    // Restore default behavior for validate after reset
    this.mocks.validator.validate.mockReturnValue({ isValid: true });

    if (
      this.entityManager &&
      typeof this.entityManager.clearAll === 'function'
    ) {
      this.entityManager.clearAll();
    }
    await super._afterCleanup();
  }

  /**
   * Creates a new entity instance from a definition stored in {@link TestData}.
   *
   * Internally this configures the mock registry via {@link EntityManagerTestBed#setupDefinitions}
   * and then delegates to {@link EntityManager#createEntityInstance}.
   *
   * @param {keyof typeof TestData.Definitions} defKey - Key of the test
   *   definition to use.
   * @param {object} [options] - Options forwarded to
   *   {@link EntityManager#createEntityInstance}.
   * @param {Record<string, object>} [options.overrides] - Component data
   *   overrides applied during creation.
   * @param {string} [options.instanceId] - Specific instance ID to use.
   * @param {boolean} [options.resetDispatch] - If true, resets the event
   *   dispatch mock after creation.
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  async createEntity(
    defKey,
    { overrides, instanceId, resetDispatch = false } = {}
  ) {
    const definition = TestData.Definitions[defKey];
    if (!definition) {
      throw new Error(`Unknown test definition key: ${defKey}`);
    }
    this.setupDefinitions(definition);
    const entity = await this.entityManager.createEntityInstance(
      definition.id,
      {
        instanceId,
        componentOverrides: overrides,
      }
    );
    if (resetDispatch) {
      this.resetDispatchMock();
    }
    return entity;
  }

  /**
   * Convenience wrapper around {@link EntityManagerTestBed#setupDefinitions} for test
   * definitions stored in {@link TestData}.
   *
   * @param {...keyof typeof TestData.Definitions} defKeys - Keys of test
   *   definitions to register.
   * @returns {void}
   */
  setupTestDefinitions(...defKeys) {
    this.setupDefinitions(...defKeys.map((key) => TestData.Definitions[key]));
  }

  /**
   * Convenience wrapper for creating an entity using the 'basic' test
   * definition.
   *
   * @param {object} [options] - Options forwarded to
   *   {@link EntityManager#createEntityInstance}.
   * @param {boolean} [options.resetDispatch] - If true, resets the event
   *   dispatch mock after creation.
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  async createBasicEntity(options = {}) {
    return await this.createEntity('basic', options);
  }

  /**
   * Convenience wrapper for creating an entity using the 'actor' test
   * definition.
   *
   * @param {object} [options] - Options forwarded to
   *   {@link EntityManager#createEntityInstance}.
   * @param {boolean} [options.resetDispatch] - If true, resets the event
   *   dispatch mock after creation.
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  async createActorEntity(options = {}) {
    return await this.createEntity('actor', options);
  }

  /**
   * Convenience helper for creating an entity with initial component overrides.
   *
   * @description Creates a new entity instance from {@link TestData} with the
   *   provided component overrides applied.
   * @param {keyof typeof TestData.Definitions} defKey - Key of the test
   *   definition to use.
   * @param {object} [options] - Options forwarded to
   *   {@link EntityManager#createEntityInstance}.
   * @param {Record<string, object>} [options.overrides] - Component overrides
   *   applied during creation.
   * @param {string} [options.instanceId] - Specific instance ID to use.
   * @param {boolean} [options.resetDispatch] - If true, resets the event
   *   dispatch mock after creation.
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  async createEntityWithOverrides(
    defKey,
    { overrides = {}, instanceId, resetDispatch = false } = {}
  ) {
    return await this.createEntity(defKey, {
      overrides,
      instanceId,
      resetDispatch,
    });
  }

  /**
   * Creates multiple entities in a batch for better performance.
   *
   * @param {Array<{definitionKey: keyof typeof TestData.Definitions, instanceId?: string, overrides?: Record<string, object>}>} entitySpecs - Array of entity specifications
   * @param {object} [options] - Options for batch creation
   * @param {boolean} [options.stopOnError] - Stop on first error
   * @returns {Promise<Array>} Array of created entities
   */
  async batchCreateEntities(entitySpecs, options = {}) {
    // Setup all definitions that will be needed
    const uniqueDefKeys = [
      ...new Set(entitySpecs.map((spec) => spec.definitionKey)),
    ];
    const definitions = uniqueDefKeys.map((key) => {
      const def = TestData.Definitions[key];
      if (!def) {
        throw new Error(`Unknown test definition key: ${key}`);
      }
      return def;
    });
    this.setupDefinitions(...definitions);

    // Convert our test specs to the format expected by entityManager.batchCreateEntities
    const managerSpecs = entitySpecs.map((spec) => ({
      definitionId: TestData.Definitions[spec.definitionKey].id,
      opts: {
        instanceId: spec.instanceId,
        componentOverrides: spec.overrides,
      },
    }));

    // Use the entity manager's batch creation if available
    if (
      this.entityManager.hasBatchSupport &&
      this.entityManager.hasBatchSupport()
    ) {
      const result = await this.entityManager.batchCreateEntities(
        managerSpecs,
        options
      );
      return result.successes.map((s) => s.entity);
    }

    // Fallback to sequential creation if batch not available
    const entities = [];
    for (const spec of entitySpecs) {
      const entity = await this.createEntity(spec.definitionKey, {
        instanceId: spec.instanceId,
        overrides: spec.overrides,
      });
      entities.push(entity);
    }
    return entities;
  }

  /**
   * Resets the dispatch mock on the internal event dispatcher.
   *
   * @returns {void}
   */
  resetDispatchMock() {
    this.mocks.eventDispatcher.dispatch.mockClear();
  }
}

/**
 * Creates a test suite for {@link EntityManager} utilizing {@link EntityManagerTestBed} for
 * setup and cleanup. The provided suite function receives a getter that
 * returns the current {@link EntityManagerTestBed} instance.
 *
 * @param {string} title - Title of the suite passed to `describe`.
 * @param {(getTestBed: () => EntityManagerTestBed) => void} suiteFn - Function containing the
 *   tests. It receives a callback that returns the active {@link EntityManagerTestBed}.
 * @returns {void}
 */
export const describeEntityManagerSuite =
  createDescribeTestBedSuite(EntityManagerTestBed);

export default EntityManagerTestBed;
