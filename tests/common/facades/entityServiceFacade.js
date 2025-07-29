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
  #eventSubscriptions = new Map();

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
   * @param {string} [config.id] - Optional entity ID.
   * @param {string} [config.name] - Name for the actor.
   * @param {string} [config.location] - Location ID for the actor.
   * @param {object} [config.components] - Additional components to add.
   * @param {string} [config.type] - Entity definition type.
   * @returns {Promise<string>} The ID of the created actor entity.
   */
  async createTestActor(config = {}) {
    const {
      id,
      name = 'Test Actor',
      location = 'test-location',
      components = {},
      type = 'core:actor',
    } = config;

    this.#logger.debug('EntityServiceFacade: Creating test actor', {
      id,
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
        id,
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
   * Creates a generic entity with the specified configuration.
   * This provides a simplified interface for entity creation with
   * consistent error handling and test tracking.
   *
   * @param {object} config - Configuration for the entity.
   * @param {string} config.type - The entity type/definition ID.
   * @param {string} [config.id] - Optional entity ID.
   * @param {object} [config.initialData] - Initial component data.
   * @returns {Promise<string>} The created entity ID.
   */
  async createEntity(config = {}) {
    const { type, id, initialData = {} } = config;

    if (!type) {
      throw new Error('Entity type is required');
    }

    this.#logger.debug('EntityServiceFacade: Creating entity', {
      type,
      id,
      hasInitialData: Object.keys(initialData).length > 0,
    });

    try {
      // Create the entity
      const entityId = await this.#entityManager.createEntity({
        definitionId: type,
        id,
        components: initialData,
      });

      // Track for cleanup
      this.#testEntities.set(entityId, {
        type: type.split(':').pop(), // Extract type name from namespaced ID
        created: Date.now(),
      });

      this.#logger.debug('EntityServiceFacade: Entity created', {
        entityId,
        type,
      });

      return entityId;
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error creating entity', error);
      throw error;
    }
  }

  /**
   * Gets an entity by ID with validation.
   * This provides a simplified interface for entity retrieval with
   * consistent error handling and logging.
   * For tests, this is synchronous despite being async.
   *
   * @param {string} entityId - The ID of the entity to retrieve.
   * @returns {object} The entity instance.
   */
  getEntity(entityId) {
    this.#logger.debug('EntityServiceFacade: Getting entity', { entityId });

    // Better parameter validation
    if (!entityId) {
      const error = new Error('EntityServiceFacade: entityId parameter is required and cannot be null/undefined');
      this.#logger.error('EntityServiceFacade: Invalid entityId parameter', { entityId });
      throw error;
    }

    // First check test entities
    if (this.#testEntities.has(entityId)) {
      const metadata = this.#testEntities.get(entityId);
      // Return a simple entity object for tests
      return {
        id: entityId,
        components: {},
        hasComponent: (componentId) => false,
        ...metadata
      };
    }

    // If not in test entities, try to get from entity manager
    // Note: In test mode, getEntityInstance might be synchronous
    try {
      const entity = this.#entityManager.getEntityInstance(entityId);
      
      // Handle both sync and async returns from the mock
      if (entity && entity.then) {
        // It's a promise - this shouldn't happen in test mode but handle it
        throw new Error('EntityServiceFacade: getEntity called in sync mode but entity manager returned a promise');
      }

      if (!entity) {
        // Get available entity IDs for better debugging
        const availableEntities = this.#testEntities ? Array.from(this.#testEntities.keys()) : [];
        const errorMsg = `Entity not found: ${entityId}. Available entities: [${availableEntities.join(', ')}]`;
        this.#logger.warn('EntityServiceFacade: Entity not found', { 
          entityId, 
          availableEntities 
        });
        throw new Error(errorMsg);
      }

      return entity;
    } catch (error) {
      // If error is already about entity not found, re-throw it
      if (error.message && error.message.includes('Entity not found:')) {
        throw error;
      }
      this.#logger.error('EntityServiceFacade: Error getting entity', error);
      throw error;
    }
  }

  /**
   * Gets a component from an entity.
   * This provides a simplified interface for component retrieval with
   * consistent error handling.
   *
   * @param {string} entityId - The ID of the entity.
   * @param {string} componentId - The ID of the component to retrieve.
   * @returns {Promise<object|null>} The component data or null if not found.
   */
  async getComponent(entityId, componentId) {
    this.#logger.debug('EntityServiceFacade: Getting component', {
      entityId,
      componentId,
    });

    try {
      const entity = await this.#entityManager.getEntityInstance(entityId);
      if (!entity) {
        throw new Error(`Entity not found: ${entityId}`);
      }

      const component = entity.components?.[componentId];
      return component || null;
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error getting component', error);
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
   * Deletes an entity by ID.
   * This provides a simplified interface for entity deletion with
   * consistent error handling and cleanup tracking.
   *
   * @param {string} entityId - The ID of the entity to delete.
   * @returns {Promise<void>}
   */
  async deleteEntity(entityId) {
    this.#logger.debug('EntityServiceFacade: Deleting entity', { entityId });

    try {
      await this.#entityManager.removeEntity(entityId);

      // Remove from tracking
      this.#testEntities.delete(entityId);

      this.#logger.debug('EntityServiceFacade: Entity deleted', { entityId });
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error deleting entity', error);
      throw error;
    }
  }

  /**
   * Queries entities by scope and filter.
   * This provides a simplified interface for entity queries.
   *
   * @param {string} scope - The scope to query (e.g., 'core:actor').
   * @param {object} [filter] - Optional filter criteria.
   * @returns {Promise<object[]>} Array of entities matching the query.
   */
  async queryEntities(scope, filter = {}) {
    this.#logger.debug('EntityServiceFacade: Querying entities', {
      scope,
      filter,
    });

    try {
      // Use scope registry to query entities
      const scopeInstance = await this.#scopeRegistry.getScope(scope);
      if (!scopeInstance) {
        throw new Error(`Scope not found: ${scope}`);
      }

      // Apply filter if provided
      const entities = await scopeInstance.query(filter);

      this.#logger.debug('EntityServiceFacade: Query completed', {
        scope,
        resultCount: entities.length,
      });

      return entities;
    } catch (error) {
      this.#logger.error('EntityServiceFacade: Error querying entities', error);
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
      const trackedEvent = {
        ...event,
        timestamp: Date.now(),
      };
      this.#mockEvents.push(trackedEvent);

      // Notify subscribers
      if (this.#eventSubscriptions.has(event.type)) {
        const handlers = this.#eventSubscriptions.get(event.type);
        handlers.forEach(handler => {
          try {
            handler(trackedEvent);
          } catch (error) {
            this.#logger.warn('EntityServiceFacade: Error in event handler', error);
          }
        });
      }

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
   * Subscribes to an event type for testing purposes.
   * This allows tests to listen for specific events during test execution.
   *
   * @param {string} eventType - The type of event to listen for.
   * @param {Function} handler - The event handler function.
   */
  subscribeToEvent(eventType, handler) {
    this.#logger.debug('EntityServiceFacade: Subscribing to event', { eventType });
    
    // Initialize subscriptions map if not exists
    if (!this.#eventSubscriptions) {
      this.#eventSubscriptions = new Map();
    }
    
    if (!this.#eventSubscriptions.has(eventType)) {
      this.#eventSubscriptions.set(eventType, []);
    }
    
    this.#eventSubscriptions.get(eventType).push(handler);
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
    this.#eventSubscriptions.clear();

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
