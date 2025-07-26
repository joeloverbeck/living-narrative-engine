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
import { assertPresent, assertNonBlankString } from '../../../../src/utils/dependencyUtils.js';

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
  constructor() {
    super();
    
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
    configureContainer(this.container, {
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

    // Set up event monitoring
    this.setupEventMonitoring();
    
    this.logger.debug('EntityWorkflowTestBed initialized successfully');
  }

  /**
   * Set up comprehensive event monitoring for entity operations
   */
  setupEventMonitoring() {
    // Monitor all events for general tracking
    const allEventsSubscription = this.eventBus.subscribe('*', (event) => {
      this.events.push({
        timestamp: Date.now(),
        type: event.type,
        payload: JSON.parse(JSON.stringify(event.payload)), // Deep clone
      });
    });
    this.eventSubscriptions.push(allEventsSubscription);

    // Monitor entity lifecycle events specifically
    const entityCreatedSubscription = this.eventBus.subscribe('core:entity_created', (event) => {
      this.entityEvents.push({
        type: 'ENTITY_CREATED',
        entityId: event.payload.entity?.id,
        definitionId: event.payload.definitionId,
        timestamp: Date.now(),
        payload: event.payload,
      });
      
      if (event.payload.entity?.id) {
        this.createdEntities.add(event.payload.entity.id);
      }
    });
    this.eventSubscriptions.push(entityCreatedSubscription);

    const entityRemovedSubscription = this.eventBus.subscribe('core:entity_removed', (event) => {
      this.entityEvents.push({
        type: 'ENTITY_REMOVED',
        entityId: event.payload.instanceId,
        timestamp: Date.now(),
        payload: event.payload,
      });
      
      const entityId = event.payload.instanceId;
      if (entityId) {
        this.removedEntities.add(entityId);
        this.createdEntities.delete(entityId);
      }
    });
    this.eventSubscriptions.push(entityRemovedSubscription);

    // Monitor component mutation events
    const componentAddedSubscription = this.eventBus.subscribe('core:component_added', (event) => {
      this.componentEvents.push({
        type: 'COMPONENT_ADDED',
        entityId: event.payload.entity?.id,
        componentId: event.payload.componentTypeId,
        componentData: event.payload.componentData,
        timestamp: Date.now(),
      });
    });
    this.eventSubscriptions.push(componentAddedSubscription);

    const componentRemovedSubscription = this.eventBus.subscribe('core:component_removed', (event) => {
      this.componentEvents.push({
        type: 'COMPONENT_REMOVED',
        entityId: event.payload.entity?.id,
        componentId: event.payload.componentTypeId,
        timestamp: Date.now(),
      });
    });
    this.eventSubscriptions.push(componentRemovedSubscription);
  }

  /**
   * Create a test entity with proper definition resolution and validation
   * 
   * @param {string} definitionId - Entity definition ID
   * @param {object} options - Creation options
   * @param {string} [options.instanceId] - Specific instance ID to use
   * @param {object} [options.componentOverrides] - Component data overrides
   * @param {boolean} [options.validateDefinition=true] - Whether to validate definition exists
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
      
      const entity = await this.entityManager.createEntityInstance(definitionId, createOptions);
      
      const endTime = performance.now();
      this.recordPerformanceMetric('entity_creation', endTime - startTime);
      
      assertPresent(entity, 'Created entity should not be null');
      assertNonBlankString(entity.id, 'Created entity should have valid ID');
      
      this.logger.debug(`Created test entity: ${entity.id} (definition: ${definitionId})`);
      return entity;
      
    } catch (error) {
      const endTime = performance.now();
      this.recordPerformanceMetric('entity_creation_failed', endTime - startTime);
      throw error;
    }
  }

  /**
   * Remove a test entity and validate cleanup
   * 
   * @param {string} entityId - Entity instance ID to remove
   * @param {object} options - Removal options
   * @param {boolean} [options.expectSuccess=true] - Whether removal should succeed
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
      this.recordPerformanceMetric('entity_removal_failed', endTime - startTime);
      
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
      this.recordPerformanceMetric('batch_entity_creation', endTime - startTime);
      this.recordPerformanceMetric('batch_entity_creation_count', entityConfigs.length);
      
      return createdEntities;
      
    } catch (error) {
      const endTime = performance.now();
      this.recordPerformanceMetric('batch_entity_creation_failed', endTime - startTime);
      throw error;
    }
  }

  /**
   * Ensure an entity definition exists in the registry
   * 
   * @param {string} definitionId - Entity definition ID
   * @param {object} [customDefinition] - Custom definition data
   */
  async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
    assertNonBlankString(definitionId, 'definitionId');
    
    // Check if definition already exists
    try {
      const existingDef = this.registry.get('entityDefinitions', definitionId);
      if (existingDef) {
        return;
      }
    } catch (error) {
      // Definition doesn't exist, we'll create it
    }

    // Create a basic entity definition
    const definition = customDefinition || createEntityDefinition(definitionId, {
      'core:name': {
        text: `Test Entity ${definitionId}`,
      },
      'core:description': {
        text: `Test entity created for ${definitionId}`,
      },
    });

    this.registry.store('entityDefinitions', definitionId, definition);
    this.logger.debug(`Created entity definition: ${definitionId}`);
  }

  /**
   * Validate repository consistency after entity operations
   * 
   * @returns {object} Consistency validation results
   */
  async validateRepositoryConsistency() {
    const results = {
      isConsistent: true,
      issues: [],
      entityCount: 0,
      indexIntegrity: true,
    };

    try {
      // Get all entity IDs from the entity manager
      const entityIds = this.entityManager.getEntityIds();
      results.entityCount = entityIds.length;

      // Validate each entity can be retrieved and has consistent data
      for (const entityId of entityIds) {
        try {
          const entity = await this.entityManager.getEntityInstance(entityId);
          if (!entity) {
            results.issues.push(`Entity ${entityId} in ID list but not retrievable`);
            results.isConsistent = false;
          } else if (entity.id !== entityId) {
            results.issues.push(`Entity ID mismatch: expected ${entityId}, got ${entity.id}`);
            results.isConsistent = false;
          }
        } catch (error) {
          results.issues.push(`Error retrieving entity ${entityId}: ${error.message}`);
          results.isConsistent = false;
        }
      }

      // Check for orphaned entities in created tracking
      for (const entityId of this.createdEntities) {
        if (!this.removedEntities.has(entityId) && !entityIds.includes(entityId)) {
          results.issues.push(`Entity ${entityId} tracked as created but missing from repository`);
          results.isConsistent = false;
        }
      }

      this.logger.debug(`Repository consistency check: ${results.isConsistent ? 'PASSED' : 'FAILED'} (${results.issues.length} issues)`);
      
    } catch (error) {
      results.isConsistent = false;
      results.issues.push(`Repository consistency check failed: ${error.message}`);
    }

    return results;
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
   * Get events of a specific type
   * 
   * @param {string} eventType - Event type to filter
   * @returns {Array<object>} Matching events
   */
  getEventsByType(eventType) {
    return this.events.filter(event => event.type === eventType);
  }

  /**
   * Get entity lifecycle events for a specific entity
   * 
   * @param {string} entityId - Entity ID to filter
   * @returns {Array<object>} Entity lifecycle events
   */
  getEntityEvents(entityId) {
    return this.entityEvents.filter(event => event.entityId === entityId);
  }

  /**
   * Get component mutation events for a specific entity
   * 
   * @param {string} entityId - Entity ID to filter
   * @returns {Array<object>} Component mutation events
   */
  getComponentEvents(entityId) {
    return this.componentEvents.filter(event => event.entityId === entityId);
  }

  /**
   * Wait for a specific event to be dispatched
   * 
   * @param {string} eventType - Event type to wait for
   * @param {object} options - Wait options
   * @param {number} [options.timeout=2000] - Timeout in milliseconds
   * @param {function} [options.predicate] - Additional predicate function
   * @returns {Promise<object>} The event that was received
   */
  async waitForEvent(eventType, options = {}) {
    const { timeout = 2000, predicate } = options;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.eventBus.unsubscribe(subscription);
        reject(new Error(`Timeout waiting for event ${eventType} after ${timeout}ms`));
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
   * Assert that an entity was created successfully
   * 
   * @param {string} entityId - Entity ID to check
   * @param {string} [definitionId] - Expected definition ID
   */
  assertEntityCreated(entityId, definitionId = null) {
    const createdEvents = this.entityEvents.filter(
      event => event.type === 'ENTITY_CREATED' && event.entityId === entityId
    );
    
    if (createdEvents.length === 0) {
      throw new Error(`No ENTITY_CREATED event found for entity ${entityId}`);
    }
    
    if (definitionId) {
      const event = createdEvents[createdEvents.length - 1];
      if (event.definitionId !== definitionId) {
        throw new Error(`Expected entity ${entityId} to be created with definition ${definitionId}, got ${event.definitionId}`);
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
      event => event.type === 'ENTITY_REMOVED' && event.entityId === entityId
    );
    
    if (removedEvents.length === 0) {
      throw new Error(`No ENTITY_REMOVED event found for entity ${entityId}`);
    }
    
    if (!this.removedEntities.has(entityId)) {
      throw new Error(`Entity ${entityId} not tracked as removed`);
    }
  }

  /**
   * Assert that repository is in a consistent state
   */
  async assertRepositoryConsistency() {
    const results = await this.validateRepositoryConsistency();
    if (!results.isConsistent) {
      throw new Error(`Repository consistency check failed: ${results.issues.join(', ')}`);
    }
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
          this.logger.warn(`Failed to cleanup test entity ${entityId}: ${error.message}`);
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
    await super.cleanup();
  }
}

export default EntityWorkflowTestBed;