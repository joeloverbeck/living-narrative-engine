/**
 * @file This module provides a centralized TestBed helper and standardized test data
 * for all EntityManager unit tests. It aims to reduce boilerplate, improve readability,
 * and make the test suite easier to maintain.
 * @see tests/common/entities/testBed.js
 */

import { jest } from '@jest/globals';
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
} from '../mockFactories.js';

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
  DefaultComponentData: {
    [GOALS_COMPONENT_ID]: { goals: [] },
    [NOTES_COMPONENT_ID]: { notes: [] },
    [SHORT_TERM_MEMORY_COMPONENT_ID]: {
      thoughts: [],
      maxEntries: 10,
    },
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
};

/**
 * Encapsulates the complete test setup for EntityManager tests.
 * Creates mocks, instantiates the manager, and provides helper methods
 * to streamline test writing.
 */
export class TestBed {
  /**
   * Collection of all mocks for easy access in tests.
   *
   * @type {{registry: ReturnType<typeof createSimpleMockDataRegistry>, validator: ReturnType<typeof createMockSchemaValidator>, logger: ReturnType<typeof createMockLogger>, eventDispatcher: ReturnType<typeof createMockSafeEventDispatcher>}}
   */
  mocks;

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
    this.mocks = {
      registry: createSimpleMockDataRegistry(),
      validator: createMockSchemaValidator(),
      logger: createMockLogger(),
      eventDispatcher: createMockSafeEventDispatcher(),
    };

    this.entityManager = new EntityManager(
      this.mocks.registry,
      this.mocks.validator,
      this.mocks.logger,
      this.mocks.eventDispatcher,
      entityManagerOptions
    );
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
   * Clears all mocks and the entity manager's internal state.
   * This should be called in an `afterEach` block to ensure test isolation.
   */
  cleanup() {
    // FIX: Clear mocks first to make the call to clearAll() testable.
    // This doesn't change the external behavior, which is to reset the test environment.
    jest.clearAllMocks();

    if (
      this.entityManager &&
      typeof this.entityManager.clearAll === 'function'
    ) {
      this.entityManager.clearAll();
    }
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
   * @returns {import('../../../src/entities/entity.js').default} The created
   *   entity instance.
   */
  createEntity(defKey, options = {}) {
    const definition = TestData.Definitions[defKey];
    if (!definition) {
      throw new Error(`Unknown test definition key: ${defKey}`);
    }
    this.setupDefinitions(definition);
    return this.entityManager.createEntityInstance(definition.id, options);
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
