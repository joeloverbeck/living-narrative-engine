/**
 * @file sharedEntityTestBed.js
 * @description Optimized test bed for entity lifecycle workflow E2E tests with shared infrastructure
 *
 * Provides high-performance test environment for E2E entity tests by:
 * - Sharing container setup across all tests (beforeAll/afterAll pattern)
 * - Optimized event monitoring (specific events only, no deep cloning)
 * - Cached schema registration
 * - Entity pooling and reuse
 * - Minimal performance monitoring overhead
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

/**
 * Optimized test bed for entity lifecycle workflow testing
 *
 * Performance optimizations:
 * - Single container shared across all tests
 * - Selective event monitoring (no universal '*' subscription)
 * - Schema registration caching
 * - Entity pooling and state reset instead of recreation
 * - Minimal repository validation overhead
 */
export class SharedEntityTestBed extends BaseTestBed {
  constructor() {
    super();

    // Shared infrastructure (created once)
    this.container = null;
    this.entityManager = null;
    this.eventBus = null;
    this.registry = null;
    this.logger = null;
    this.validator = null;

    // Optimized event tracking (specific events only)
    this.componentEvents = [];
    this.eventSubscriptions = [];

    // Entity pool management
    this.entityPool = new Map();
    this.nextEntityIndex = 1;
    this.createdEntityIds = new Set();

    // Schema cache
    this.schemasRegistered = false;
  }

  /**
   * Initialize shared infrastructure (called once per test suite)
   */
  async initializeShared() {
    await super.setup();

    // Create and configure container once
    this.container = new AppContainer();
    await configureContainer(this.container, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    });

    // Resolve core services once
    this.entityManager = this.container.resolve(tokens.IEntityManager);
    this.eventBus = this.container.resolve(tokens.IEventBus);
    this.registry = this.container.resolve(tokens.IDataRegistry);
    this.logger = this.container.resolve(tokens.ILogger);
    this.validator = this.container.resolve(tokens.ISchemaValidator);

    // Register schemas once
    if (!this.schemasRegistered) {
      await this.registerTestComponentSchemas();
      this.schemasRegistered = true;
    }

    // Set up optimized event monitoring (specific events only)
    this.setupOptimizedEventMonitoring();

    this.logger.debug(
      'SharedEntityTestBed initialized with shared infrastructure'
    );
  }

  /**
   * Register required component schemas once and cache
   */
  async registerTestComponentSchemas() {
    const schemas = [
      {
        id: 'core:position',
        schema: {
          type: 'object',
          properties: {
            locationId: { type: 'string' },
          },
          required: ['locationId'],
          additionalProperties: false,
        },
      },
      {
        id: 'core:name',
        schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
          additionalProperties: false,
        },
      },
      {
        id: 'core:description',
        schema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
          required: ['text'],
          additionalProperties: false,
        },
      },
    ];

    // Batch register all schemas
    for (const { id, schema } of schemas) {
      await this.validator.addSchema(schema, id);
    }

    this.logger.debug('Test component schemas registered and cached');
  }

  /**
   * Set up optimized event monitoring (specific events only, no deep cloning)
   */
  setupOptimizedEventMonitoring() {
    // Monitor only component mutation events (not all events)
    const componentAddedSubscription = this.eventBus.subscribe(
      'core:component_added',
      (event) => {
        // Lightweight event capture (no deep cloning)
        this.componentEvents.push({
          type: 'COMPONENT_ADDED',
          entityId: event.payload.entity?.id,
          componentId: event.payload.componentTypeId,
          componentData: event.payload.componentData, // Reference, not clone
          timestamp: Date.now(),
        });
      }
    );
    this.eventSubscriptions.push(componentAddedSubscription);

    const componentRemovedSubscription = this.eventBus.subscribe(
      'core:component_removed',
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

    this.logger.debug('Optimized event monitoring setup complete');
  }

  /**
   * Get or create a test entity from the pool
   *
   * @param definitionId
   * @param options
   * @param customDefinition
   */
  async getOrCreateTestEntity(
    definitionId,
    options = {},
    customDefinition = null
  ) {
    const {
      instanceId,
      componentOverrides = {},
      reuseExisting = true,
    } = options;

    // Generate pool key
    const poolKey = `${definitionId}_${JSON.stringify(componentOverrides)}`;

    if (reuseExisting && this.entityPool.has(poolKey)) {
      const cachedEntity = this.entityPool.get(poolKey);
      this.logger.debug(`Reusing cached entity: ${cachedEntity.id}`);
      return cachedEntity;
    }

    // Create new entity
    await this.ensureEntityDefinitionExists(definitionId, customDefinition);

    const entityInstanceId =
      instanceId || `test_entity_${this.nextEntityIndex++}`;
    const createOptions = { instanceId: entityInstanceId };

    if (Object.keys(componentOverrides).length > 0) {
      createOptions.componentOverrides = componentOverrides;
    }

    const entity = await this.entityManager.createEntityInstance(
      definitionId,
      createOptions
    );

    // Cache for reuse
    this.entityPool.set(poolKey, entity);
    this.createdEntityIds.add(entity.id);

    this.logger.debug(`Created and cached new entity: ${entity.id}`);
    return entity;
  }

  /**
   * Reset entity state instead of recreating
   *
   * @param entity
   * @param definitionId
   */
  async resetEntityState(entity, definitionId) {
    // Reset to definition state by removing any component overrides
    const definition = this.registry.get('entityDefinitions', definitionId);
    if (definition && definition.components) {
      // Remove non-definition components
      const definitionComponentIds = Object.keys(definition.components);
      const currentComponentIds = entity.getComponentIds();

      for (const componentId of currentComponentIds) {
        if (!definitionComponentIds.includes(componentId)) {
          try {
            await this.entityManager.removeComponent(entity.id, componentId);
          } catch (error) {
            // Ignore errors for components that can't be removed
          }
        }
      }
    }

    this.logger.debug(`Reset entity state: ${entity.id}`);
    return entity;
  }

  /**
   * Lightweight entity creation for simple test cases
   *
   * @param definitionId
   */
  async createSimpleTestEntity(definitionId = 'test:simple_entity') {
    return this.getOrCreateTestEntity(definitionId, {
      reuseExisting: false, // Always create new for simple cases
      instanceId: `simple_${this.nextEntityIndex++}`,
    });
  }

  /**
   * Ensure an entity definition exists (with caching)
   *
   * @param definitionId
   * @param customDefinition
   */
  async ensureEntityDefinitionExists(definitionId, customDefinition = null) {
    assertNonBlankString(definitionId, 'definitionId');

    // Check if definition already exists (cached)
    try {
      const existingDef = this.registry.get('entityDefinitions', definitionId);
      if (existingDef) {
        return;
      }
    } catch (error) {
      // Definition doesn't exist, we'll create it
    }

    // Create basic entity definition
    const definition = customDefinition
      ? createEntityDefinition(customDefinition.id, customDefinition.components)
      : createEntityDefinition(definitionId, {
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
   * Get component mutation events for a specific entity
   *
   * @param entityId
   */
  getComponentEvents(entityId) {
    return this.componentEvents.filter((event) => event.entityId === entityId);
  }

  /**
   * Clear events between tests (lightweight reset)
   */
  clearEvents() {
    this.componentEvents = [];
  }

  /**
   * Selective repository consistency validation (only when needed)
   *
   * @param entityIds
   */
  async validateRepositoryConsistencySelective(entityIds = null) {
    const idsToCheck = entityIds || Array.from(this.createdEntityIds);
    let isConsistent = true;
    const issues = [];

    for (const entityId of idsToCheck) {
      try {
        const entity = await this.entityManager.getEntityInstance(entityId);
        if (!entity) {
          isConsistent = false;
          issues.push(`Entity ${entityId} not found`);
        } else if (entity.id !== entityId) {
          isConsistent = false;
          issues.push(
            `Entity ID mismatch: expected ${entityId}, got ${entity.id}`
          );
        }
      } catch (error) {
        isConsistent = false;
        issues.push(`Error retrieving entity ${entityId}: ${error.message}`);
      }
    }

    if (!isConsistent) {
      throw new Error(
        `Repository consistency check failed: ${issues.join(', ')}`
      );
    }

    return { isConsistent: true, issues: [], entityCount: idsToCheck.length };
  }

  /**
   * Lightweight cleanup between tests (reset state, don't recreate infrastructure)
   */
  async resetForNextTest() {
    // Clear events but keep subscriptions
    this.clearEvents();

    // Reset entity pool if needed (optional - can reuse entities)
    // this.entityPool.clear();

    this.logger.debug('SharedEntityTestBed reset for next test');
  }

  /**
   * Full cleanup after all tests
   */
  async cleanupShared() {
    // Unsubscribe from events
    for (const subscription of this.eventSubscriptions) {
      if (typeof subscription === 'function') {
        subscription();
      }
    }
    this.eventSubscriptions = [];

    // Clean up created entities
    for (const entityId of this.createdEntityIds) {
      try {
        await this.entityManager.removeEntityInstance(entityId);
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup entity ${entityId}: ${error.message}`
        );
      }
    }

    // Clear caches
    this.entityPool.clear();
    this.createdEntityIds.clear();
    this.clearEvents();

    this.logger.debug('SharedEntityTestBed shared cleanup completed');
    await super.cleanup();
  }
}

export default SharedEntityTestBed;
