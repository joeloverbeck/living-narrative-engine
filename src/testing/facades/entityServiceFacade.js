/**
 * @file EntityServiceFacade - Simplified interface for entity operations in tests
 * @description Service facade that consolidates entity-related services into a single,
 * easy-to-use interface for testing. Reduces test complexity by wrapping
 * EntityManager, EventBus, DataRegistry, ScopeRegistry, and related services.
 */

/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../interfaces/IEventBus.js').IEventBus} IEventBus */
/** @typedef {import('../../interfaces/IDataRegistry.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IScopeRegistry.js').IScopeRegistry} IScopeRegistry */
/** @typedef {import('../../data/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */

/**
 * Facade providing simplified access to all entity-related services for testing.
 * This facade reduces the complexity of setting up entity operations in tests
 * by providing a single interface that coordinates multiple underlying services.
 */
export class EntityServiceFacade {
  #entityManager;
  #eventBus;
  #dataRegistry;
  #scopeRegistry;
  #gameDataRepository;
  #logger;

  // Test-specific state
  #testEntities = new Map();
  #testComponents = new Map();
  #mockEvents = [];

  /**
   * Creates an instance of EntityServiceFacade.
   *
   * @param {object} deps - Dependencies object containing all required entity services.
   * @param {EntityManager} deps.entityManager - The entity manager for entity lifecycle operations.
   * @param {IEventBus} deps.eventBus - The event bus for entity events and communication.
   * @param {IDataRegistry} deps.dataRegistry - The data registry for accessing game data.
   * @param {IScopeRegistry} deps.scopeRegistry - The scope registry for scope-based queries.
   * @param {GameDataRepository} deps.gameDataRepository - Repository for persistent game data.
   * @param {ILogger} deps.logger - Logger for diagnostic output.
   * @throws {Error} If any required dependency is missing or invalid.
   */
  constructor({
    entityManager,
    eventBus,
    dataRegistry,
    scopeRegistry,
    gameDataRepository,
    logger,
  }) {
    // Validate entity manager
    if (!entityManager || typeof entityManager.createEntity !== 'function') {
      throw new Error(
        'EntityServiceFacade: Missing or invalid entityManager dependency.'
      );
    }

    // Validate event bus
    if (!eventBus || typeof eventBus.dispatch !== 'function') {
      throw new Error(
        'EntityServiceFacade: Missing or invalid eventBus dependency.'
      );
    }

    // Validate data registry
    if (!dataRegistry || typeof dataRegistry.get !== 'function') {
      throw new Error(
        'EntityServiceFacade: Missing or invalid dataRegistry dependency.'
      );
    }

    // Validate scope registry
    if (!scopeRegistry || typeof scopeRegistry.getScope !== 'function') {
      throw new Error(
        'EntityServiceFacade: Missing or invalid scopeRegistry dependency.'
      );
    }

    // Validate game data repository
    if (
      !gameDataRepository ||
      typeof gameDataRepository.getEntityDefinition !== 'function'
    ) {
      throw new Error(
        'EntityServiceFacade: Missing or invalid gameDataRepository dependency.'
      );
    }

    // Validate logger
    if (!logger || typeof logger.debug !== 'function') {
      throw new Error(
        'EntityServiceFacade: Missing or invalid logger dependency.'
      );
    }

    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
    this.#dataRegistry = dataRegistry;
    this.#scopeRegistry = scopeRegistry;
    this.#gameDataRepository = gameDataRepository;
    this.#logger = logger;
  }

  /**
   * Creates a test actor with sensible defaults.
   * This simplifies actor creation for testing by providing commonly needed
   * components and reducing the setup required.
   *
   * @param {object} [config] - Configuration for the test actor.
   * @param {string} [config.name] - Name for the actor.
   * @param {string} [config.location] - Location ID for the actor.
   * @param {object} [config.components] - Additional components to add.
   * @param {string} [config.type] - Entity definition type.
   * @returns {Promise<string>} The ID of the created actor entity.
   */
  async createTestActor(config = {}) {
    const {
      name = 'Test Actor',
      location = 'test-location',
      components = {},
      type = 'core:actor',
    } = config;

    this.#logger.debug('EntityServiceFacade: Creating test actor', {
      name,
      location,
      type,
    });

    try {
      // Get the actor definition
      const actorDefinition =
        await this.#gameDataRepository.getEntityDefinition(type);
      if (!actorDefinition) {
        throw new Error(`Actor definition not found: ${type}`);
      }

      // Create base components for the actor
      const baseComponents = {
        'core:name': { name },
        'core:location': { locationId: location },
        'core:actor': { type: 'ai' },
        ...components,
      };

      // Create the entity
      const actorId = await this.#entityManager.createEntity({
        definitionId: type,
        components: baseComponents,
      });

      // Track for cleanup
      this.#testEntities.set(actorId, { type: 'actor', created: Date.now() });

      this.#logger.debug('EntityServiceFacade: Test actor created', {
        actorId,
        name,
      });
      return actorId;
    } catch (error) {
      this.#logger.error(
        'EntityServiceFacade: Error creating test actor',
        error
      );
      throw error;
    }
  }

  /**
   * Creates a test world/location with sensible defaults.
   * This simplifies world setup for testing by creating commonly needed
   * location entities and connections.
   *
   * @param {object} [config] - Configuration for the test world.
   * @param {string} [config.name] - Name for the main location.
   * @param {string} [config.description] - Description of the location.
   * @param {object} [config.components] - Additional components to add.
   * @param {boolean} [config.createConnections] - Whether to create connected locations.
   * @returns {Promise<object>} Object with created location IDs and configuration.
   */
  async createTestWorld(config = {}) {
    const {
      name = 'Test Location',
      description = 'A test location for testing purposes',
      components = {},
      createConnections = false,
    } = config;

    this.#logger.debug('EntityServiceFacade: Creating test world', {
      name,
      createConnections,
    });

    try {
      // Create main location
      const mainLocationId = await this.#entityManager.createEntity({
        definitionId: 'core:location',
        components: {
          'core:name': { name },
          'core:description': { description },
          'core:location': {
            type: 'room',
            contents: [],
          },
          ...components,
        },
      });

      // Track for cleanup
      this.#testEntities.set(mainLocationId, {
        type: 'location',
        created: Date.now(),
      });

      const result = {
        mainLocationId,
        locations: [mainLocationId],
      };

      // Create connected locations if requested
      if (createConnections) {
        const northLocationId = await this.#entityManager.createEntity({
          definitionId: 'core:location',
          components: {
            'core:name': { name: `${name} - North` },
            'core:description': { description: 'North of the main location' },
            'core:location': {
              type: 'room',
              contents: [],
            },
          },
        });

        this.#testEntities.set(northLocationId, {
          type: 'location',
          created: Date.now(),
        });
        result.locations.push(northLocationId);
        result.northLocationId = northLocationId;
      }

      this.#logger.debug('EntityServiceFacade: Test world created', result);
      return result;
    } catch (error) {
      this.#logger.error(
        'EntityServiceFacade: Error creating test world',
        error
      );
      throw error;
    }
  }

  /**
   * Gets an entity by ID with validation.
   * This provides a simplified interface for entity retrieval with
   * consistent error handling and logging.
   *
   * @param {string} entityId - The ID of the entity to retrieve.
   * @returns {Promise<object>} The entity instance.
   */
  async getEntity(entityId) {
    this.#logger.debug('EntityServiceFacade: Getting entity', { entityId });

    try {
      const entity = await this.#entityManager.getEntityInstance(entityId);

      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      return entity;
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error getting entity', error);
      throw error;
    }
  }

  /**
   * Updates a component on an entity.
   * This provides a simplified interface for component updates with
   * validation and event handling.
   *
   * @param {string} entityId - The ID of the entity to update.
   * @param {string} componentId - The ID of the component to update.
   * @param {object} data - The new component data.
   * @returns {Promise<void>}
   */
  async updateComponent(entityId, componentId, data) {
    this.#logger.debug('EntityServiceFacade: Updating component', {
      entityId,
      componentId,
      data,
    });

    try {
      await this.#entityManager.updateComponent(entityId, componentId, data);

      // Track component update
      const updateKey = `${entityId}:${componentId}`;
      this.#testComponents.set(updateKey, { data, updated: Date.now() });

      this.#logger.debug('EntityServiceFacade: Component updated', {
        entityId,
        componentId,
      });
    } catch (error) {
      this.#logger.error(
        'EntityServiceFacade: Error updating component',
        error
      );
      throw error;
    }
  }

  /**
   * Dispatches an event through the event bus.
   * This provides a simplified interface for event dispatching with
   * logging and test tracking.
   *
   * @param {object} event - The event to dispatch.
   * @param {string} event.type - The event type.
   * @param {object} [event.payload] - The event payload.
   * @returns {Promise<void>}
   */
  async dispatchEvent(event) {
    this.#logger.debug('EntityServiceFacade: Dispatching event', { event });

    try {
      await this.#eventBus.dispatch(event);

      // Track event for testing
      this.#mockEvents.push({
        ...event,
        timestamp: Date.now(),
      });

      this.#logger.debug('EntityServiceFacade: Event dispatched', {
        type: event.type,
      });
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error dispatching event', error);
      throw error;
    }
  }

  /**
   * Gets events that have been dispatched during testing.
   * This allows tests to verify that expected events were dispatched.
   *
   * @param {string} [eventType] - Optional filter by event type.
   * @returns {object[]} Array of dispatched events.
   */
  getDispatchedEvents(eventType) {
    if (eventType) {
      return this.#mockEvents.filter((event) => event.type === eventType);
    }
    return [...this.#mockEvents];
  }

  /**
   * Clears all test data.
   * This is useful for test cleanup between test cases.
   */
  async clearTestData() {
    this.#logger.debug('EntityServiceFacade: Clearing test data');

    // Clean up test entities
    for (const [entityId, metadata] of this.#testEntities) {
      try {
        await this.#entityManager.removeEntity(entityId);
      } catch (error) {
        this.#logger.warn('EntityServiceFacade: Error removing test entity', {
          entityId,
          error,
        });
      }
    }

    this.#testEntities.clear();
    this.#testComponents.clear();
    this.#mockEvents.length = 0;

    this.#logger.debug('EntityServiceFacade: Test data cleared');
  }

  /**
   * Gets statistics about test entities created.
   * This is useful for test validation and debugging.
   *
   * @returns {object} Statistics about created test entities.
   */
  getTestStatistics() {
    const stats = {
      totalEntities: this.#testEntities.size,
      totalComponents: this.#testComponents.size,
      totalEvents: this.#mockEvents.length,
      entityTypes: {},
    };

    // Count entity types
    for (const [entityId, metadata] of this.#testEntities) {
      const type = metadata.type || 'unknown';
      stats.entityTypes[type] = (stats.entityTypes[type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Provides direct access to the entity manager.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {EntityManager} The entity manager instance.
   */
  get entityManager() {
    return this.#entityManager;
  }

  /**
   * Provides direct access to the event bus.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {IEventBus} The event bus instance.
   */
  get eventBus() {
    return this.#eventBus;
  }

  /**
   * Provides direct access to the data registry.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {IDataRegistry} The data registry instance.
   */
  get dataRegistry() {
    return this.#dataRegistry;
  }

  /**
   * Provides direct access to the scope registry.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {IScopeRegistry} The scope registry instance.
   */
  get scopeRegistry() {
    return this.#scopeRegistry;
  }

  /**
   * Provides direct access to the game data repository.
   * Use sparingly - prefer the higher-level facade methods.
   *
   * @returns {GameDataRepository} The game data repository instance.
   */
  get gameDataRepository() {
    return this.#gameDataRepository;
  }

  /**
   * Dispose method to clean up resources.
   * Call this when the facade is no longer needed.
   */
  async dispose() {
    this.#logger.debug('EntityServiceFacade: Disposing resources');

    // Clean up test data
    await this.clearTestData();

    // Dispose underlying services if they support it
    this.#entityManager?.dispose?.();
    this.#eventBus?.dispose?.();
    this.#dataRegistry?.dispose?.();
    this.#scopeRegistry?.dispose?.();
    this.#gameDataRepository?.dispose?.();
  }
}
