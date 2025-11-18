/**
 * @file entityWorkflowTestBed.js
 * @description Test bed for entity lifecycle workflow E2E tests
 *
 * Provides a comprehensive test environment for testing entity lifecycle operations
 * including creation, removal, component mutations, and repository consistency validation.
 */

import { BaseTestBed } from '../../../common/baseTestBed.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';
import {
  assertPresent,
  assertNonBlankString,
} from '../../../../src/utils/dependencyUtils.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../../src/constants/eventIds.js';

/**
 * Test bed for entity lifecycle workflow testing
 *
 * Provides utilities for:
 * - Setting up test environment with full dependency injection container
 * - Creating and managing test entities with proper definition resolution
 * - Monitoring entity lifecycle events (ENTITY_CREATED, ENTITY_REMOVED, etc.)
 * - Validating repository consistency during entity operations
 * - Performance measurement for entity operations
 * - Comprehensive cleanup and resource management
 */
export class EntityWorkflowTestBed extends BaseTestBed {
  /**
   * @description Static cache for entity definitions shared across instances.
   * @type {Map<string, object>}
   * @private
   * @static
   */
  static #definitionCache = new Map();

  /**
   * @description Tracks cache statistics for debugging and validation.
   * @type {{hits: number, misses: number, stores: number}}
   * @private
   * @static
   */
  static #definitionCacheStats = {
    hits: 0,
    misses: 0,
    stores: 0,
  };

  /**
   * @description Flag to enable/disable definition caching for debugging.
   * @type {boolean}
   * @static
   */
  static enableDefinitionCache = true;

  constructor(options = {}) {
    super();

    // Event monitoring configuration (NEW)
    this.eventMonitoringOptions = {
      monitorAll: options.monitorAll ?? false, // Default: don't monitor all events
      specificEvents: options.specificEvents ?? [], // Only monitor these event types
      enablePerformanceTracking: options.enablePerformanceTracking ?? true,
      monitorComponentEvents: options.monitorComponentEvents ?? false, // Default: don't monitor component events
    };

    // Core services
    this.container = null;
    this.entityManager = null;
    this.eventBus = null;
    this.registry = null;
    this.logger = null;
    this.validator = null;

    // Event monitoring
    this.events = [];
    this.entityEvents = [];
    this.componentEvents = [];
    this.eventSubscriptions = [];

    // Entity tracking
    this.createdEntities = new Set();
    this.removedEntities = new Set();

    // Performance tracking
    this.performanceMetrics = new Map();
  }

  /**
   * Initialize the test bed with all required services
   */
  async initialize() {
    await super.setup();

    // Create and configure container
    this.container = new AppContainer();
    await configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Resolve core services
    this.entityManager = this.container.resolve(tokens.IEntityManager);
    this.eventBus = this.container.resolve(tokens.IEventBus);
    this.registry = this.container.resolve(tokens.IDataRegistry);
    this.logger = this.container.resolve(tokens.ILogger);
    this.validator = this.container.resolve(tokens.ISchemaValidator);

    // Initialize SpatialIndexSynchronizer to start listening to events
    // This is required for automatic spatial index maintenance
    this.container.resolve('SpatialIndexSynchronizer');

    // Register required component schemas for testing
    await this.registerTestComponentSchemas();

    // Set up event monitoring
    this.setupEventMonitoring();

    this.logger.debug('EntityWorkflowTestBed initialized successfully');
  }

  /**
   * Register required component schemas for testing.
   * Uses batch registration for better performance.
   */
  async registerTestComponentSchemas() {
    const schemas = [
      {
        $id: 'core:position',
        type: 'object',
        properties: {
          locationId: { type: 'string' },
        },
        required: ['locationId'],
        additionalProperties: false,
      },

      {
        $id: 'core:name',
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },

      {
        $id: 'core:description',
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
        required: ['text'],
        additionalProperties: false,
      },

      {
        $id: 'core:stats',
        type: 'object',
        properties: {
          health: {
            type: 'number',
            minimum: 0,
            default: 100,
          },
          maxHealth: {
            type: 'number',
            minimum: 1,
            default: 100,
          },
          mana: {
            type: 'number',
            minimum: 0,
            default: 0,
          },
          maxMana: {
            type: 'number',
            minimum: 0,
            default: 0,
          },
          level: {
            type: 'number',
            minimum: 1,
            default: 1,
          },
          strength: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
          agility: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
          intelligence: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
          wisdom: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
          dexterity: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
          stealth: {
            type: 'number',
            minimum: 1,
            default: 10,
          },
        },
        required: ['health', 'maxHealth'],
        additionalProperties: false,
      },

      {
        $id: 'core:inventory',
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'string' },
            default: [],
          },
          maxSize: {
            type: 'number',
            minimum: 0,
            default: 20,
          },
          capacity: {
            type: 'number',
            minimum: 0,
            default: 20,
          },
        },
        required: ['items'],
        additionalProperties: false,
      },

      {
        $id: 'core:actor',
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
          conscious: { type: 'boolean', default: true },
          trader: { type: 'boolean', default: false },
          isPlayer: { type: 'boolean', default: false },
        },
        additionalProperties: false,
      },

      {
        $id: 'core:item',
        type: 'object',
        properties: {
          name: { type: 'string', default: '' },
          value: { type: 'number', minimum: 0, default: 0 },
          type: { type: 'string', default: '' },
          weight: { type: 'number', minimum: 0, default: 0 },
          throwable: { type: 'boolean', default: false },
          enchantable: { type: 'boolean', default: false },
          catalyst: { type: 'boolean', default: false },
          explosive: { type: 'boolean', default: false },
          equippable: { type: 'boolean', default: false },
          slot: { type: 'string', default: '' },
        },
        additionalProperties: false,
      },
    ];

    // Batch registration using existing AjvSchemaValidator.addSchemas()
    await this.validator.addSchemas(schemas);

    this.logger.debug(`Registered ${schemas.length} test component schemas in batch`);
  }

  /**
   * Set up event monitoring based on configuration.
   * Only subscribes to events that tests actually need.
   *
   * @private
   */
  setupEventMonitoring() {
    const startTime = performance.now();

    const { monitorAll, specificEvents } = this.eventMonitoringOptions;

    // Helper to safely clone event data. Always shallow-clone for performance.
    const clonePayload = (payload) => {
      if (!payload) {
        return null;
      }
      return { ...payload };
    };

    // Option 1: Monitor all events (only if explicitly requested)
    if (monitorAll) {
      const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
        this.events.push({
          timestamp: Date.now(),
          type: event.type,
          payload: clonePayload(event.payload),
        });
      });
      this.eventSubscriptions.push(allEventsSubscription);
      this.logger?.debug('Event monitoring: ALL events (monitorAll=true)');
    }

    // Option 2: Monitor specific events only
    else if (specificEvents.length > 0) {
      specificEvents.forEach((eventType) => {
        const subscription = this.eventBus.subscribe(eventType, (event) => {
          this.events.push({
            timestamp: Date.now(),
            type: event.type,
            payload: clonePayload(event.payload),
          });
        });
        this.eventSubscriptions.push(subscription);
      });
      this.logger?.debug(`Event monitoring: Specific events [${specificEvents.join(', ')}]`);
    }

    // Option 3: No general event monitoring (fastest)
    else {
      this.logger?.debug('Event monitoring: Disabled (best performance)');
    }

    // ALWAYS monitor entity lifecycle events (these are needed for test assertions)
    this._setupEntityLifecycleMonitoring();

    const endTime = performance.now();
    if (this.eventMonitoringOptions.enablePerformanceTracking) {
      this.recordPerformanceMetric('event_monitoring_setup', endTime - startTime);
      this.logger?.debug(`Event monitoring setup took ${(endTime - startTime).toFixed(2)}ms`);
    }
  }

  /**
   * Set up monitoring for entity lifecycle events.
   * These are always monitored because entity tests depend on them.
   *
   * @private
   */
  _setupEntityLifecycleMonitoring() {
    // Monitor entity created events
    const entityCreatedSubscription = this.eventBus.subscribe(
      ENTITY_CREATED_ID,
      (event) => {
        this.entityEvents.push({
          type: 'ENTITY_CREATED',
          entityId: event.payload.entity?.id,
          definitionId: event.payload.definitionId,
          timestamp: Date.now(),
          payload: event.payload, // Don't clone - not needed for assertions
        });

        if (event.payload.entity?.id) {
          this.createdEntities.add(event.payload.entity.id);
        }
      }
    );
    this.eventSubscriptions.push(entityCreatedSubscription);

    // Monitor entity removed events
    const entityRemovedSubscription = this.eventBus.subscribe(
      ENTITY_REMOVED_ID,
      (event) => {
        this.entityEvents.push({
          type: 'ENTITY_REMOVED',
          entityId: event.payload.instanceId,
          timestamp: Date.now(),
          payload: event.payload, // Don't clone - not needed for assertions
        });

        const entityId = event.payload.instanceId;
        if (entityId) {
          this.removedEntities.add(entityId);
          this.createdEntities.delete(entityId);
        }
      }
    );
    this.eventSubscriptions.push(entityRemovedSubscription);

    // Only monitor component events if explicitly requested
    if (this.eventMonitoringOptions.monitorComponentEvents) {
      this._setupComponentEventMonitoring();
    }
  }

  /**
   * Set up monitoring for component mutation events.
   * Only called if explicitly enabled via options.
   *
   * @private
   */
  _setupComponentEventMonitoring() {
    const componentAddedSubscription = this.eventBus.subscribe(
      COMPONENT_ADDED_ID,
      (event) => {
        this.componentEvents.push({
          type: 'COMPONENT_ADDED',
          entityId: event.payload.entity?.id,
          componentId: event.payload.componentTypeId,
          componentData: event.payload.componentData,
          timestamp: Date.now(),
        });
      }
    );
    this.eventSubscriptions.push(componentAddedSubscription);

    const componentRemovedSubscription = this.eventBus.subscribe(
      COMPONENT_REMOVED_ID,
      (event) => {
        this.componentEvents.push({
          type: 'COMPONENT_REMOVED',
          entityId: event.payload.entity?.id,
          componentId: event.payload.componentTypeId,
          timestamp: Date.now(),
        });
      }
    );
    this.eventSubscriptions.push(componentRemovedSubscription);
  }

  /**
   * Create a test entity with proper definition resolution and validation
   *
   * @param {string} definitionId - Entity definition ID
   * @param {object} options - Creation options
   * @param {string} [options.instanceId] - Specific instance ID to use
   * @param {object} [options.componentOverrides] - Component data overrides
   * @param {boolean} [options.validateDefinition] - Whether to validate definition exists
   * @returns {Promise<object>} Created entity instance
   */
  async createTestEntity(definitionId, options = {}) {
    assertNonBlankString(definitionId, 'definitionId');

    const {
      instanceId,
      componentOverrides = {},
      validateDefinition = true,
    } = options;

    // Ensure entity definition exists if validation is enabled
    if (validateDefinition) {
      await this.ensureEntityDefinitionExists(definitionId);
    }

    const startTime = performance.now();

    try {
      // For now, only pass instanceId to avoid schema validation issues with component overrides
      const createOptions = { instanceId };

      // Only add componentOverrides if they're provided and not empty
      if (Object.keys(componentOverrides).length > 0) {
        createOptions.componentOverrides = componentOverrides;
      }

      const entity = await this.entityManager.createEntityInstance(
        definitionId,
        createOptions
      );

      const endTime = performance.now();
      this.recordPerformanceMetric('entity_creation', endTime - startTime);

      assertPresent(entity, 'Created entity should not be null');
      assertNonBlankString(entity.id, 'Created entity should have valid ID');

      this.logger.debug(
        `Created test entity: ${entity.id} (definition: ${definitionId})`
      );
      return entity;
    } catch (error) {
      const endTime = performance.now();
      this.recordPerformanceMetric(
        'entity_creation_failed',
        endTime - startTime
      );
      throw error;
    }
  }

  /**
   * Remove a test entity and validate cleanup
   *
   * @param {string} entityId - Entity instance ID to remove
   * @param {object} options - Removal options
   * @param {boolean} [options.expectSuccess] - Whether removal should succeed
   * @returns {Promise<boolean>} Whether removal was successful
   */
  async removeTestEntity(entityId, options = {}) {
    assertNonBlankString(entityId, 'entityId');

    const { expectSuccess = true } = options;
    const startTime = performance.now();

    try {
      // Entity removal either succeeds (no exception) or throws
      await this.entityManager.removeEntityInstance(entityId);
      const endTime = performance.now();
      this.recordPerformanceMetric('entity_removal', endTime - startTime);

      this.logger.debug(`Removed test entity: ${entityId}`);
      return true; // If no exception was thrown, removal was successful
    } catch (error) {
      const endTime = performance.now();
      this.recordPerformanceMetric(
        'entity_removal_failed',
        endTime - startTime
      );

      if (expectSuccess) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Create multiple test entities in batch for performance testing
   *
   * @param {Array<object>} entityConfigs - Array of entity configurations
   * @param {object} options - Batch creation options
   * @returns {Promise<Array<object>>} Created entities
   */
  async createTestEntitiesBatch(entityConfigs, options = {}) {
    assertPresent(entityConfigs, 'entityConfigs');

    const startTime = performance.now();
    const createdEntities = [];

    try {
      for (const config of entityConfigs) {
        const entity = await this.createTestEntity(config.definitionId, {
          instanceId: config.instanceId,
          componentOverrides: config.componentOverrides,
          validateDefinition: config.validateDefinition,
        });
        createdEntities.push(entity);
      }

      const endTime = performance.now();
      this.recordPerformanceMetric(
        'batch_entity_creation',
        endTime - startTime
      );
      this.recordPerformanceMetric(
        'batch_entity_creation_count',
        entityConfigs.length
      );

      return createdEntities;
    } catch (error) {
      const endTime = performance.now();
      this.recordPerformanceMetric(
        'batch_entity_creation_failed',
        endTime - startTime
      );
      throw error;
    }
  }

  /**
   * @description Ensure an entity definition exists, using cached definitions when available.
   * @param {string} definitionId - Entity definition ID
   * @param {object} [customDefinition] - Custom definition data
   * @returns {Promise<void>}
   */
  async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
    assertNonBlankString(definitionId, 'definitionId');

    const cachingEnabled = EntityWorkflowTestBed.enableDefinitionCache;

    if (cachingEnabled) {
      const cachedDefinition =
        EntityWorkflowTestBed.#definitionCache.get(definitionId);

      if (cachedDefinition) {
        EntityWorkflowTestBed.#definitionCacheStats.hits += 1;

        const registryDefinition = this.registry.get(
          'entityDefinitions',
          definitionId
        );

        if (!registryDefinition) {
          this.registry.store('entityDefinitions', definitionId, cachedDefinition);
        }

        return;
      }

      EntityWorkflowTestBed.#definitionCacheStats.misses += 1;
    }

    const existingDefinition = this.registry.get(
      'entityDefinitions',
      definitionId
    );

    if (existingDefinition) {
      if (
        cachingEnabled &&
        !EntityWorkflowTestBed.#definitionCache.has(definitionId)
      ) {
        EntityWorkflowTestBed.#definitionCache.set(
          definitionId,
          existingDefinition
        );
        EntityWorkflowTestBed.#definitionCacheStats.stores += 1;
      }
      return;
    }

    const targetDefinitionId = customDefinition?.id ?? definitionId;
    const definitionComponents = customDefinition?.components ?? {
      'core:name': {
        text: `Test Entity ${targetDefinitionId}`,
      },
      'core:description': {
        text: `Test entity created for ${targetDefinitionId}`,
      },
    };

    const definition = createEntityDefinition(
      targetDefinitionId,
      definitionComponents
    );

    this.registry.store('entityDefinitions', definitionId, definition);

    if (cachingEnabled) {
      EntityWorkflowTestBed.#definitionCache.set(definitionId, definition);
      EntityWorkflowTestBed.#definitionCacheStats.stores += 1;
    }

    this.logger.debug(`Created entity definition: ${definitionId}`);
  }

  /**
   * @description Clears the shared definition cache and resets statistics.
   * @returns {void}
   */
  static clearDefinitionCache() {
    EntityWorkflowTestBed.#definitionCache.clear();
    EntityWorkflowTestBed.#definitionCacheStats.hits = 0;
    EntityWorkflowTestBed.#definitionCacheStats.misses = 0;
    EntityWorkflowTestBed.#definitionCacheStats.stores = 0;
  }

  /**
   * @description Retrieves current cache statistics for debugging.
   * @returns {{size: number, hits: number, misses: number, stores: number, enabled: boolean}}
   */
  static getDefinitionCacheStats() {
    return {
      size: EntityWorkflowTestBed.#definitionCache.size,
      hits: EntityWorkflowTestBed.#definitionCacheStats.hits,
      misses: EntityWorkflowTestBed.#definitionCacheStats.misses,
      stores: EntityWorkflowTestBed.#definitionCacheStats.stores,
      enabled: EntityWorkflowTestBed.enableDefinitionCache,
    };
  }

  /**
   * Validate repository consistency after entity operations
   *
   * @param {object} [options] - Validation options
   * @param {boolean} [options.skipIfSimple] - Skip full validation for simple scenarios
   * @param {number} [options.simpleThreshold] - Entity count threshold for "simple" tests
   * @param {boolean} [options.quickCheck] - Perform only basic validation
   * @param {boolean} [options.forceFullValidation] - Force full validation regardless of complexity
   * @param {boolean} [options.logPerformance] - Emit performance logs for consistency checks
   * @returns {object} Consistency validation results
   */
  async validateRepositoryConsistency(options = {}) {
    const {
      skipIfSimple = true,
      simpleThreshold = 3,
      quickCheck = false,
      forceFullValidation = false,
      logPerformance = false,
    } = options;

    const startTime = performance.now();
    const entityIds = this.entityManager.getEntityIds();
    const entityCount = entityIds.length;
    const results = {
      isConsistent: true,
      issues: [],
      entityCount,
      indexIntegrity: true,
      validationType: 'none',
      skipped: false,
      skipReason: null,
      duration: 0,
    };

    const finalizeResults = () => {
      const endTime = performance.now();
      results.duration = endTime - startTime;
      this.recordPerformanceMetric(
        'repository_consistency_check',
        results.duration
      );

      if (logPerformance) {
        this.logger?.info(
          `Repository consistency check (${results.validationType}): ${results.duration.toFixed(2)}ms - ${results.isConsistent ? 'PASS' : 'FAIL'}`
        );
      }

      return results;
    };

    // Check explicit validation request FIRST (before auto-skip)
    if (quickCheck && !forceFullValidation) {
      results.validationType = 'quick';

      if (entityCount < 0) {
        results.isConsistent = false;
        results.issues.push('Negative entity count detected');
      }

      if (this.createdEntities.size > entityCount + this.removedEntities.size) {
        results.isConsistent = false;
        results.issues.push(
          `Created entities (${this.createdEntities.size}) exceeds expected based on current count (${entityCount}) and removed (${this.removedEntities.size})`
        );
      }

      this.logger?.debug(
        `Repository quick consistency check: ${results.isConsistent ? 'PASSED' : 'FAILED'}`
      );

      return finalizeResults();
    }

    // Auto-skip only applies when quickCheck is NOT requested
    if (!forceFullValidation && skipIfSimple && entityCount <= simpleThreshold) {
      results.skipped = true;
      results.skipReason = `Entity count (${entityCount}) below threshold (${simpleThreshold})`;
      results.validationType = 'skipped';
      this.logger?.debug(
        `Repository consistency check skipped: ${results.skipReason}`
      );
      return finalizeResults();
    }

    results.validationType = 'full';

    try {
      for (const entityId of entityIds) {
        try {
          const entity = await this.entityManager.getEntityInstance(entityId);
          if (!entity) {
            results.issues.push(
              `Entity ${entityId} in ID list but not retrievable`
            );
            results.isConsistent = false;
          } else if (entity.id !== entityId) {
            results.issues.push(
              `Entity ID mismatch: expected ${entityId}, got ${entity.id}`
            );
            results.isConsistent = false;
          }
        } catch (error) {
          results.issues.push(
            `Error retrieving entity ${entityId}: ${error.message}`
          );
          results.isConsistent = false;
        }
      }

      for (const entityId of this.createdEntities) {
        if (
          !this.removedEntities.has(entityId) &&
          !entityIds.includes(entityId)
        ) {
          results.issues.push(
            `Entity ${entityId} tracked as created but missing from repository`
          );
          results.isConsistent = false;
        }
      }

      this.logger.debug(
        `Repository full consistency check: ${results.isConsistent ? 'PASSED' : 'FAILED'} (${results.issues.length} issues)`
      );
    } catch (error) {
      results.isConsistent = false;
      results.issues.push(
        `Repository consistency check failed: ${error.message}`
      );
    }

    return finalizeResults();
  }

  /**
   * Record performance metric for operation
   *
   * @param {string} operation - Operation name
   * @param {number} value - Metric value (usually time in ms)
   */
  recordPerformanceMetric(operation, value) {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, []);
    }
    this.performanceMetrics.get(operation).push(value);
  }

  /**
   * Get performance statistics for an operation
   *
   * @param {string} operation - Operation name
   * @returns {object} Performance statistics
   */
  getPerformanceStats(operation) {
    const metrics = this.performanceMetrics.get(operation) || [];
    if (metrics.length === 0) {
      return { count: 0, average: 0, min: 0, max: 0, total: 0 };
    }

    const total = metrics.reduce((sum, value) => sum + value, 0);
    const average = total / metrics.length;
    const min = Math.min(...metrics);
    const max = Math.max(...metrics);

    return {
      count: metrics.length,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  /**
   * Get events of a specific type.
   *
   * IMPORTANT: Returned events are shallow clones meant for read-only assertions.
   * Create a local copy if you need to mutate payload data.
   *
   * @param {string} eventType - Event type to filter
   * @returns {Array<object>} Matching events (read-only)
   */
  getEventsByType(eventType) {
    // Map event type to internal type names used in specialized arrays
    const typeMapping = {
      'core:entity_created': 'ENTITY_CREATED',
      'core:entity_removed': 'ENTITY_REMOVED',
      'core:component_added': 'COMPONENT_ADDED',
      'core:component_removed': 'COMPONENT_REMOVED',
    };

    const internalType = typeMapping[eventType];

    // Search in all event arrays
    const allEvents = [
      ...this.events,
      ...this.entityEvents,
      ...this.componentEvents,
    ];

    // Filter by either the requested type or its internal mapping
    return allEvents.filter(
      (event) => event.type === eventType || event.type === internalType
    );
  }

  /**
   * Get entity lifecycle events for a specific entity.
   *
   * IMPORTANT: Returned objects are references to internal event data. Treat them as
   * read-only and clone locally if mutations are required for a test scenario.
   *
   * @param {string} entityId - Entity ID to filter
   * @returns {Array<object>} Entity lifecycle events (read-only)
   */
  getEntityEvents(entityId) {
    return this.entityEvents.filter((event) => event.entityId === entityId);
  }

  /**
   * Get component mutation events for a specific entity.
   *
   * IMPORTANT: Returned objects reference internal monitoring arrays. Do not mutate the
   * returned values; clone them locally if changes are required.
   *
   * @param {string} entityId - Entity ID to filter
   * @returns {Array<object>} Component mutation events (read-only)
   */
  getComponentEvents(entityId) {
    return this.componentEvents.filter((event) => event.entityId === entityId);
  }

  /**
   * Wait for a specific event to be dispatched
   *
   * @param {string} eventType - Event type to wait for
   * @param {object} options - Wait options
   * @param {number} [options.timeout] - Timeout in milliseconds
   * @param {Function} [options.predicate] - Additional predicate function
   * @returns {Promise<object>} The event that was received
   */
  async waitForEvent(eventType, options = {}) {
    const { timeout = 2000, predicate } = options;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.eventBus.unsubscribe(subscription);
        reject(
          new Error(`Timeout waiting for event ${eventType} after ${timeout}ms`)
        );
      }, timeout);

      const subscription = this.eventBus.subscribe(eventType, (event) => {
        if (!predicate || predicate(event)) {
          clearTimeout(timeoutId);
          this.eventBus.unsubscribe(subscription);
          resolve(event);
        }
      });
    });
  }

  /**
   * Enable monitoring for specific events.
   * Useful when a test needs to verify events that aren't monitored by default.
   *
   * @param {string[]} eventTypes - Event types to monitor
   * @returns {Function} Unsubscribe function to stop monitoring
   */
  enableEventMonitoring(eventTypes) {
    assertPresent(eventTypes, 'eventTypes');
    if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
      throw new Error('eventTypes must be a non-empty array');
    }

    const subscriptions = eventTypes.map((eventType) => {
      return this.eventBus.subscribe(eventType, (event) => {
        this.events.push({
          timestamp: Date.now(),
          type: event.type,
          payload: { ...event.payload }, // Shallow clone
        });
      });
    });

    this.eventSubscriptions.push(...subscriptions);

    this.logger?.debug(`Enabled monitoring for: ${eventTypes.join(', ')}`);

    // Return unsubscribe function
    return () => {
      subscriptions.forEach((sub) => {
        const index = this.eventSubscriptions.indexOf(sub);
        if (index > -1) {
          this.eventSubscriptions.splice(index, 1);
        }
        if (typeof sub === 'function') {
          sub(); // Unsubscribe
        }
      });
    };
  }

  /**
   * Assert that an entity was created successfully
   *
   * @param {string} entityId - Entity ID to check
   * @param {string} [definitionId] - Expected definition ID
   */
  assertEntityCreated(entityId, definitionId = null) {
    const createdEvents = this.entityEvents.filter(
      (event) => event.type === 'ENTITY_CREATED' && event.entityId === entityId
    );

    if (createdEvents.length === 0) {
      throw new Error(`No ENTITY_CREATED event found for entity ${entityId}`);
    }

    if (definitionId) {
      const event = createdEvents[createdEvents.length - 1];
      if (event.definitionId !== definitionId) {
        throw new Error(
          `Expected entity ${entityId} to be created with definition ${definitionId}, got ${event.definitionId}`
        );
      }
    }

    if (!this.createdEntities.has(entityId)) {
      throw new Error(`Entity ${entityId} not tracked as created`);
    }
  }

  /**
   * Assert that an entity was removed successfully
   *
   * @param {string} entityId - Entity ID to check
   */
  assertEntityRemoved(entityId) {
    const removedEvents = this.entityEvents.filter(
      (event) => event.type === 'ENTITY_REMOVED' && event.entityId === entityId
    );

    if (removedEvents.length === 0) {
      throw new Error(`No ENTITY_REMOVED event found for entity ${entityId}`);
    }

    if (!this.removedEntities.has(entityId)) {
      throw new Error(`Entity ${entityId} not tracked as removed`);
    }
  }

  /**
   * Assert that repository is in a consistent state.
   *
   * @param {object} [options] - Validation options (see validateRepositoryConsistency)
   * @returns {Promise<void>}
   */
  async assertRepositoryConsistency(options = {}) {
    const results = await this.validateRepositoryConsistency(options);

    if (results.skipped) {
      return;
    }

    if (!results.isConsistent) {
      throw new Error(
        `Repository consistency check failed (${results.validationType}): ${results.issues.join(', ')}`
      );
    }
  }

  /**
   * Perform a quick repository sanity check for simple tests.
   *
   * @returns {Promise<void>}
   */
  async assertRepositorySanity() {
    await this.assertRepositoryConsistency({ quickCheck: true });
  }

  /**
   * Force the repository consistency check to run the full validation flow.
   *
   * @returns {Promise<void>}
   */
  async assertRepositoryFullyConsistent() {
    await this.assertRepositoryConsistency({ forceFullValidation: true });
  }

  /**
   * Explicitly skip the repository consistency check.
   *
   * @returns {Promise<void>}
   */
  async skipRepositoryConsistencyCheck() {
    this.logger?.debug('Repository consistency check explicitly skipped');
  }

  /**
   * Validate batch operation results for correctness and consistency
   *
   * @param {object} result - Batch operation result object
   * @param {number} expectedSuccesses - Expected number of successful operations
   * @param {number} expectedFailures - Expected number of failed operations
   * @param {object} options - Validation options
   * @param {boolean} [options.validateMetrics] - Whether to validate metrics
   * @param {boolean} [options.validateTiming] - Whether to validate timing
   * @returns {object} Validation results
   */
  validateBatchOperationResults(
    result,
    expectedSuccesses,
    expectedFailures,
    options = {}
  ) {
    const { validateMetrics = true, validateTiming = true } = options;
    const validation = {
      isValid: true,
      issues: [],
      metrics: {},
    };

    // Validate basic structure
    if (!result || typeof result !== 'object') {
      validation.isValid = false;
      validation.issues.push('Batch result is not a valid object');
      return validation;
    }

    // Validate required properties
    const requiredProps = [
      'successes',
      'failures',
      'totalProcessed',
      'successCount',
      'failureCount',
    ];
    for (const prop of requiredProps) {
      if (!(prop in result)) {
        validation.isValid = false;
        validation.issues.push(`Missing required property: ${prop}`);
      }
    }

    // Validate counts
    if (result.successCount !== expectedSuccesses) {
      validation.isValid = false;
      validation.issues.push(
        `Expected ${expectedSuccesses} successes, got ${result.successCount}`
      );
    }

    if (result.failureCount !== expectedFailures) {
      validation.isValid = false;
      validation.issues.push(
        `Expected ${expectedFailures} failures, got ${result.failureCount}`
      );
    }

    if (result.totalProcessed !== expectedSuccesses + expectedFailures) {
      validation.isValid = false;
      validation.issues.push(
        `Total processed (${result.totalProcessed}) doesn't match sum of successes and failures`
      );
    }

    // Validate array lengths
    if (result.successes.length !== result.successCount) {
      validation.isValid = false;
      validation.issues.push(
        `Successes array length (${result.successes.length}) doesn't match successCount (${result.successCount})`
      );
    }

    if (result.failures.length !== result.failureCount) {
      validation.isValid = false;
      validation.issues.push(
        `Failures array length (${result.failures.length}) doesn't match failureCount (${result.failureCount})`
      );
    }

    // Validate metrics if requested
    if (validateMetrics && 'processingTime' in result) {
      if (
        typeof result.processingTime !== 'number' ||
        result.processingTime < 0
      ) {
        validation.isValid = false;
        validation.issues.push('Processing time must be a non-negative number');
      } else {
        validation.metrics.processingTime = result.processingTime;
        validation.metrics.avgTimePerOperation =
          result.totalProcessed > 0
            ? result.processingTime / result.totalProcessed
            : 0;
      }
    }

    // Validate timing if requested
    if (validateTiming && result.totalProcessed > 0) {
      const avgTime = validation.metrics.avgTimePerOperation || 0;
      if (avgTime > 100) {
        // Warning for operations taking more than 100ms on average
        validation.issues.push(
          `Average operation time (${avgTime.toFixed(2)}ms) may be too slow`
        );
      }
    }

    // Validate failure objects structure
    result.failures.forEach((failure, index) => {
      if (!failure.item || !failure.error) {
        validation.isValid = false;
        validation.issues.push(
          `Failure ${index} missing required item or error property`
        );
      } else if (!(failure.error instanceof Error)) {
        validation.isValid = false;
        validation.issues.push(
          `Failure ${index} error property is not an Error instance`
        );
      }
    });

    return validation;
  }

  /**
   * Measure performance of batch operations with detailed metrics
   *
   * @param {Function} operation - Async operation to measure
   * @param {number} iterations - Number of iterations to perform
   * @param {object} options - Measurement options
   * @returns {Promise<object>} Performance measurement results
   */
  async measureBatchOperationPerformance(
    operation,
    iterations = 1,
    options = {}
  ) {
    assertPresent(operation, 'operation');

    const {
      warmupIterations = 0,
      collectMemoryStats = false,
      collectGCStats = false,
    } = options;

    const results = {
      iterations,
      times: [],
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      totalTime: 0,
      memoryStats: null,
      gcStats: null,
    };

    // Warmup iterations
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }

    // Collect memory stats before if requested
    if (collectMemoryStats && performance.memory) {
      results.memoryStats = {
        before: {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        },
      };
    }

    // Perform measured iterations
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await operation();
      const endTime = performance.now();

      const operationTime = endTime - startTime;
      results.times.push(operationTime);
      results.totalTime += operationTime;
      results.minTime = Math.min(results.minTime, operationTime);
      results.maxTime = Math.max(results.maxTime, operationTime);
    }

    // Calculate statistics
    results.averageTime = results.totalTime / iterations;

    // Collect memory stats after if requested
    if (collectMemoryStats && performance.memory) {
      results.memoryStats.after = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };

      results.memoryStats.increase = {
        usedJSHeapSize:
          results.memoryStats.after.usedJSHeapSize -
          results.memoryStats.before.usedJSHeapSize,
        totalJSHeapSize:
          results.memoryStats.after.totalJSHeapSize -
          results.memoryStats.before.totalJSHeapSize,
      };
    }

    // Record performance metrics
    this.recordPerformanceMetric(
      'batch_operation_measurement',
      results.averageTime
    );

    return results;
  }

  /**
   * Create large entity datasets for scale testing
   *
   * @param {number} count - Number of entities to create
   * @param {object} options - Dataset creation options
   * @returns {Promise<Array<object>>} Array of entity specifications
   */
  async createLargeEntityDatasets(count, options = {}) {
    const {
      definitionId = 'test:scale_entity',
      includeComponentOverrides = false,
      componentTypes = ['core:name', 'core:description'],
      idPrefix = 'scale_entity',
    } = options;

    // Ensure entity definition exists
    await this.ensureEntityDefinitionExists(definitionId);

    const entitySpecs = [];

    for (let i = 0; i < count; i++) {
      const spec = {
        definitionId,
        opts: {
          instanceId: `${idPrefix}_${i + 1}`,
        },
      };

      // Add component overrides if requested
      if (includeComponentOverrides) {
        spec.opts.componentOverrides = {};

        componentTypes.forEach((componentType) => {
          switch (componentType) {
            case 'core:name':
              spec.opts.componentOverrides[componentType] = {
                text: `Scale Entity ${i + 1}`,
              };
              break;
            case 'core:description':
              spec.opts.componentOverrides[componentType] = {
                text: `Description for scale entity ${i + 1}`,
              };
              break;
            case 'core:position':
              spec.opts.componentOverrides[componentType] = {
                locationId: `scale_location_${i + 1}`,
              };
              break;
          }
        });
      }

      entitySpecs.push(spec);
    }

    this.logger.debug(
      `Created ${count} entity specifications for scale testing`
    );
    return entitySpecs;
  }

  /**
   * Validate batch operation performance against thresholds
   *
   * @param {object} performanceData - Performance measurement data
   * @param {object} thresholds - Performance thresholds
   * @returns {object} Performance validation results
   */
  validateBatchPerformanceThresholds(performanceData, thresholds = {}) {
    const {
      maxAverageTime = 50, // 50ms default
      maxTotalTime = 5000, // 5s default
      maxMemoryIncrease = 50 * 1024 * 1024, // 50MB default
      minThroughput = 10, // operations per second
    } = thresholds;

    const validation = {
      isValid: true,
      issues: [],
      metrics: {
        averageTime: performanceData.averageTime,
        totalTime: performanceData.totalTime,
        throughput:
          performanceData.iterations / (performanceData.totalTime / 1000),
        memoryIncrease:
          performanceData.memoryStats?.increase?.usedJSHeapSize || 0,
      },
    };

    // Validate average time threshold
    if (performanceData.averageTime > maxAverageTime) {
      validation.isValid = false;
      validation.issues.push(
        `Average operation time (${performanceData.averageTime.toFixed(2)}ms) exceeds threshold (${maxAverageTime}ms)`
      );
    }

    // Validate total time threshold
    if (performanceData.totalTime > maxTotalTime) {
      validation.isValid = false;
      validation.issues.push(
        `Total operation time (${performanceData.totalTime.toFixed(2)}ms) exceeds threshold (${maxTotalTime}ms)`
      );
    }

    // Validate throughput threshold
    if (validation.metrics.throughput < minThroughput) {
      validation.isValid = false;
      validation.issues.push(
        `Throughput (${validation.metrics.throughput.toFixed(2)} ops/sec) below threshold (${minThroughput} ops/sec)`
      );
    }

    // Validate memory increase if available
    if (performanceData.memoryStats?.increase?.usedJSHeapSize !== undefined) {
      if (validation.metrics.memoryIncrease > maxMemoryIncrease) {
        validation.isValid = false;
        validation.issues.push(
          `Memory increase (${(validation.metrics.memoryIncrease / 1024 / 1024).toFixed(2)}MB) exceeds threshold (${(maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB)`
        );
      }
    }

    return validation;
  }

  /**
   * Clear all recorded events and metrics
   */
  clearRecordedData() {
    this.events = [];
    this.entityEvents = [];
    this.componentEvents = [];
    this.performanceMetrics.clear();
  }

  /**
   * Clear transient state between tests without destroying the container.
   * This enables test isolation while reusing the expensive initialization.
   *
   * @returns {void}
   */
  clearTransientState() {
    // Clear event tracking (events, entityEvents, componentEvents, performanceMetrics)
    this.clearRecordedData();

    // Clear entity tracking
    this.createdEntities.clear();
    this.removedEntities.clear();

    // DO NOT clear:
    // - this.container (expensive to rebuild)
    // - this.entityManager (expensive to rebuild)
    // - this.eventBus (expensive to rebuild)
    // - this.registry (expensive to rebuild)
    // - this.logger (expensive to rebuild)
    // - this.validator (expensive to rebuild)
    // - this.eventSubscriptions (keep these active)

    this.logger?.debug('EntityWorkflowTestBed transient state cleared');
  }

  /**
   * Verify that the test bed is in a clean state.
   * Useful for debugging test isolation issues.
   *
   * @throws {Error} If the test bed has unexpected state
   * @returns {void}
   */
  verifyCleanState() {
    const issues = [];

    // Check for leftover entities
    const entityIds = this.entityManager.getEntityIds();
    if (entityIds.length > 0) {
      issues.push(`${entityIds.length} entities still exist: ${entityIds.join(', ')}`);
    }

    // Check for leftover event tracking
    if (this.events.length > 0) {
      issues.push(`${this.events.length} events still tracked`);
    }

    if (this.entityEvents.length > 0) {
      issues.push(`${this.entityEvents.length} entity events still tracked`);
    }

    if (this.componentEvents.length > 0) {
      issues.push(`${this.componentEvents.length} component events still tracked`);
    }

    // Check for leftover entity tracking
    if (this.createdEntities.size > 0) {
      issues.push(`${this.createdEntities.size} entities in createdEntities set`);
    }

    if (issues.length > 0) {
      throw new Error(`Test bed is not in clean state:\n  - ${issues.join('\n  - ')}`);
    }
  }

  /**
   * Clean up resources after tests
   */
  async cleanup() {
    // Unsubscribe from all event subscriptions
    for (const subscription of this.eventSubscriptions) {
      if (typeof subscription === 'function') {
        subscription();
      }
    }
    this.eventSubscriptions = [];

    // Clean up any remaining test entities
    for (const entityId of this.createdEntities) {
      if (!this.removedEntities.has(entityId)) {
        try {
          await this.removeTestEntity(entityId, { expectSuccess: false });
        } catch (error) {
          this.logger.warn(
            `Failed to cleanup test entity ${entityId}: ${error.message}`
          );
        }
      }
    }

    // Clear tracking sets
    this.createdEntities.clear();
    this.removedEntities.clear();

    // Clear recorded data
    this.clearRecordedData();

    if (this.logger && typeof this.logger.debug === 'function') {
      this.logger.debug('EntityWorkflowTestBed cleanup completed');
    }

    EntityWorkflowTestBed.clearDefinitionCache();
    await super.cleanup();
  }
}

export default EntityWorkflowTestBed;
