/**
 * @file This module provides a centralized TestBed helper and standardized test data
 * for all EntityManager unit tests. It aims to reduce boilerplate, improve readability,
 * and make the test suite easier to maintain.
 * @see tests/common/entities/testBed.js
 */

import EntityManager from '../../../src/entities/entityManager.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  POSITION_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
  NAME_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
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
 * Provides a centralized repository of common data used across EntityManager tests.
 * This includes component IDs, definition IDs, pre-built mock definitions, and instance IDs.
 */
export const TestData = {
  ComponentIDs: {
    ACTOR_COMPONENT_ID,
    POSITION_COMPONENT_ID,
    SHORT_TERM_MEMORY_COMPONENT_ID,
    NOTES_COMPONENT_ID,
    GOALS_COMPONENT_ID,
    NAME_COMPONENT_ID,
  },
  DefinitionIDs: {
    BASIC: 'test-def:basic',
    ACTOR: 'test-def:actor',
    WITH_POS: 'test-def:with-pos',
  },
  /** Pre-built, reusable definitions */
  Definitions: {
    basic: new EntityDefinition('test-def:basic', {
      description: 'A basic definition for general testing',
      components: { 'core:name': { name: 'Basic' } },
    }),
    actor: new EntityDefinition('test-def:actor', {
      description: 'A definition containing the actor component',
      components: { [ACTOR_COMPONENT_ID]: {} },
    }),
    withPos: new EntityDefinition('test-def:with-pos', {
      description: 'A definition containing the position component',
      components: {
        [POSITION_COMPONENT_ID]: { x: 0, y: 0, locationId: 'zone:a' },
      },
    }),
  },
  InstanceIDs: {
    PRIMARY: 'test-instance-01',
    SECONDARY: 'test-instance-02',
    GHOST: 'non-existent-instance-id',
  },

  /**
   * Default payloads that {@link EntityManager} injects for core components.
   *
   * @type {Record<string, object>}
   */
  DefaultComponentData: {
    [SHORT_TERM_MEMORY_COMPONENT_ID]: { thoughts: [], maxEntries: 10 },
    [NOTES_COMPONENT_ID]: { notes: [] },
    [GOALS_COMPONENT_ID]: { goals: [] },
  },

  /**
   * Collections of intentionally invalid values for negative test cases.
   *
   * @property {Array<*>} componentDataNotObject - Values that are not objects
   *   when component data is expected.
   * @property {Array<Array<*>>} invalidIdPairs - Invalid definition/instance ID
   *   pairs used in tests.
   * @property {Array<*>} invalidIds - Generic invalid ID values.
   * @property {Array<*>} serializedEntityShapes - Invalid serialized entity
   *   structures passed to {@link EntityManager#reconstructEntity}.
   * @property {Array<*>} serializedInstanceIds - Invalid instanceId values used
   *   in reconstruction tests.
   */
  InvalidValues: {
    componentDataNotObject: [null, 42, 'string', [], true],
    invalidIdPairs: [
      [null, 'id'],
      ['def', null],
      ['', ''],
      [123, {}],
    ],
    invalidIds: [null, undefined, '', 123, {}, []],
    invalidDefinitionIds: [null, undefined, '', 123, {}, []],
    serializedEntityShapes: [null, 'invalid', 42, [], { foo: 'bar' }],
    serializedInstanceIds: [null, undefined, '', 42],
  },
};

/**
 * Encapsulates the complete test setup for EntityManager tests.
 * Creates mocks, instantiates the manager, and provides helper methods
 * to streamline test writing.
 */
export class TestBed extends FactoryTestBed {
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
   * Creates a new TestBed instance.
   *
   * @param {object} [entityManagerOptions] - Optional options to pass to the EntityManager constructor.
   * @param {Function} [entityManagerOptions.idGenerator] - A mock ID generator function.
   */
  constructor(entityManagerOptions = {}) {
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
      ...entityManagerOptions,
    });
  }

  /**
   * Configures the mock IDataRegistry to return specific definitions for a test.
   *
   * @param {...EntityDefinition} definitions - The definitions to make available via the mock registry.
   */
  setupDefinitions(...definitions) {
    this.mocks.registry.getEntityDefinition.mockImplementation((id) => {
      return definitions.find((def) => def.id === id);
    });
  }

  /**
   * Looks up test definitions by key and forwards them to
   * {@link TestBed#setupDefinitions}.
   *
   * @param {...keyof typeof TestData.Definitions} keys - Definition keys.
   * @returns {void}
   */
  setupTestDefinitions(...keys) {
    const defs = keys.map((k) => {
      const def = TestData.Definitions[k];
      if (!def) {
        throw new Error(`Unknown test definition key: ${k}`);
      }
      return def;
    });
    this.setupDefinitions(...defs);
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
   * Internally this configures the mock registry via {@link TestBed#setupDefinitions}
   * and then delegates to {@link EntityManager#createEntityInstance}.
   *
   * @param {keyof typeof TestData.Definitions} defKey - Key of the test
   *   definition to use.
   * @param {object} [options] - Options forwarded to
   *   {@link EntityManager#createEntityInstance}.
   * @param {object} [config] - Additional configuration options.
   * @param {boolean} [config.resetDispatch] - If true, resets the event
   *   dispatch mock after creation.
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  createEntity(defKey, options = {}, { resetDispatch = false } = {}) {
    const definition = TestData.Definitions[defKey];
    if (!definition) {
      throw new Error(`Unknown test definition key: ${defKey}`);
    }
    this.setupDefinitions(definition);
    const entity = this.entityManager.createEntityInstance(
      definition.id,
      options
    );
    if (resetDispatch) {
      this.resetDispatchMock();
    }
    return entity;
  }

  /**
   * Creates an entity instance using a definition key.
   *
   * @param {keyof typeof TestData.Definitions} key - Definition key.
   * @param {object} [options] - Options forwarded to {@link TestBed#createEntity}.
   * @param {object} [config] - Additional configuration options.
   * @returns {import('../../../src/entities/entity.js').default} The created entity.
   */
  createEntityByKey(key, options = {}, config = {}) {
    return this.createEntity(key, options, config);
  }

  /**
   * Shortcut for creating the basic entity.
   *
   * @param {object} [options] - Options forwarded to {@link TestBed#createEntityByKey}.
   * @param {object} [config] - Additional configuration options.
   * @returns {import('../../../src/entities/entity.js').default} The created entity.
   */
  createBasicEntity(options = {}, config = {}) {
    return this.createEntityByKey('basic', options, config);
  }

  /**
   * Shortcut for creating the actor entity.
   *
   * @param {object} [options] - Options forwarded to {@link TestBed#createEntityByKey}.
   * @param {object} [config] - Additional configuration options.
   * @returns {import('../../../src/entities/entity.js').default} The created entity.
   */
  createActorEntity(options = {}, config = {}) {
    return this.createEntityByKey('actor', options, config);
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
 * Creates a test suite for {@link EntityManager} utilizing {@link TestBed} for
 * setup and cleanup. The provided suite function receives a getter that
 * returns the current {@link TestBed} instance.
 *
 * @param {string} title - Title of the suite passed to `describe`.
 * @param {(getTestBed: () => TestBed) => void} suiteFn - Function containing the
 *   tests. It receives a callback that returns the active {@link TestBed}.
 * @returns {void}
 */
export const describeEntityManagerSuite = createDescribeTestBedSuite(TestBed);

/**
 * Configures the provided TestBed with definitions referenced by key.
 *
 * @param {TestBed} testBed - Test bed instance.
 * @param {...keyof typeof TestData.Definitions} keys - Definition keys.
 * @returns {void}
 */
export function setupTestDefinitions(testBed, ...keys) {
  const definitions = keys.map((k) => {
    const def = TestData.Definitions[k];
    if (!def) {
      throw new Error(`Unknown test definition key: ${k}`);
    }
    return def;
  });
  testBed.setupDefinitions(...definitions);
}

/**
 * Creates an entity using a definition key via the given TestBed.
 *
 * @param {TestBed} testBed - Test bed instance.
 * @param {keyof typeof TestData.Definitions} key - Definition key.
 * @param {object} [options] - Options forwarded to createEntity.
 * @param {object} [config] - Additional configuration options.
 * @returns {import('../../../src/entities/entity.js').default} The created entity.
 */
export function createEntityByKey(testBed, key, options = {}, config = {}) {
  return testBed.createEntityByKey(key, options, config);
}

/**
 * Convenience wrapper for creating the basic entity.
 *
 * @param {TestBed} testBed - Test bed instance.
 * @param {object} [options] - Options forwarded to createEntity.
 * @param {object} [config] - Additional configuration options.
 * @returns {import('../../../src/entities/entity.js').default} The created entity.
 */
export function createBasicEntity(testBed, options = {}, config = {}) {
  return createEntityByKey(testBed, 'basic', options, config);
}

/**
 * Convenience wrapper for creating the actor entity.
 *
 * @param {TestBed} testBed - Test bed instance.
 * @param {object} [options] - Options forwarded to createEntity.
 * @param {object} [config] - Additional configuration options.
 * @returns {import('../../../src/entities/entity.js').default} The created entity.
 */
export function createActorEntity(testBed, options = {}, config = {}) {
  return createEntityByKey(testBed, 'actor', options, config);
}

export default TestBed;
