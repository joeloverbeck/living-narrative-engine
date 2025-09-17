import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import EntityManagerIntegrationTestBed from '../../../common/entities/entityManagerIntegrationTestBed.js';
import BatchOperationManager from '../../../../src/entities/operations/BatchOperationManager.js';
import EntityLifecycleManager from '../../../../src/entities/services/entityLifecycleManager.js';
import {
  initializeGlobalConfig,
  resetGlobalConfig,
} from '../../../../src/entities/utils/configUtils.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';

describe('EntityLifecycleManager - Batch Operations Integration', () => {
  let testBed;
  let entityManager;
  let lifecycleManager;
  let componentMutationService;
  let batchOperationManager;
  let registry;
  let logger;
  let eventDispatcher;

  beforeEach(async () => {
    testBed = new EntityManagerIntegrationTestBed();
    entityManager = testBed.entityManager;
    registry = testBed.mocks.registry;
    logger = testBed.mocks.logger;
    eventDispatcher = testBed.mocks.eventDispatcher;

    // Initialize global configuration
    initializeGlobalConfig(logger, {});

    // Set up test entity definitions in the registry
    const actorDefinition = new EntityDefinition('core:actor', {
      description: 'Actor entity for testing',
      components: {
        'core:short_term_memory': {},
        'core:notes': {},
        'movement:goals': {},
      },
    });

    const locationDefinition = new EntityDefinition('core:location', {
      description: 'Location entity for testing',
      components: {
        'core:description': {
          name: 'Default Location',
          description: 'A default place',
        },
      },
    });

    const healthDefinition = {
      id: 'core:health',
      dataSchema: {
        type: 'object',
        properties: {
          maxHealth: { type: 'number', minimum: 1 },
          currentHealth: { type: 'number', minimum: 0 },
        },
        required: ['maxHealth'],
      },
    };

    const descriptionDefinition = {
      id: 'core:description',
      dataSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    };

    // Store definitions in the real registry
    registry.store('entityDefinitions', 'core:actor', actorDefinition);
    registry.store('entityDefinitions', 'core:location', locationDefinition);
    registry.store('components', 'core:health', healthDefinition);
    registry.store('components', 'core:description', descriptionDefinition);
    registry.store('components', 'core:short_term_memory', {
      id: 'core:short_term_memory',
    });
    registry.store('components', 'core:notes', { id: 'core:notes' });
    registry.store('components', 'movement:goals', { id: 'movement:goals' });

    // Create services using the factory
    const services = await import(
      '../../../../src/entities/utils/createDefaultServicesWithConfig.js'
    );
    const { createDefaultServicesWithConfig } = services;

    const defaultServices = createDefaultServicesWithConfig({
      registry,
      validator: testBed.mocks.validator,
      logger,
      eventDispatcher,
      idGenerator: () => Math.random().toString(36).substr(2, 9),
      cloner: (obj) => JSON.parse(JSON.stringify(obj)),
      defaultPolicy: { apply: () => {} },
    });

    componentMutationService = defaultServices.componentMutationService;

    // Create a real BatchOperationManager
    batchOperationManager = new BatchOperationManager({
      lifecycleManager: defaultServices.entityLifecycleManager,
      componentMutationService,
      logger,
      defaultBatchSize: 10,
      enableTransactions: true,
    });

    // Create a new lifecycle manager with batch operations enabled
    lifecycleManager = new EntityLifecycleManager({
      registry,
      logger,
      eventDispatcher,
      entityRepository: defaultServices.entityRepository,
      factory: defaultServices.entityFactory,
      errorTranslator: defaultServices.errorTranslator,
      definitionCache: defaultServices.definitionCache,
      monitoringCoordinator: defaultServices.monitoringCoordinator,
      batchOperationManager,
      enableBatchOperations: true,
    });

    // Update batch operation manager with new lifecycle manager to resolve circular dependency
    batchOperationManager = new BatchOperationManager({
      lifecycleManager,
      componentMutationService,
      logger,
      defaultBatchSize: 10,
      enableTransactions: true,
    });
    lifecycleManager.setBatchOperationManager(batchOperationManager);
  });

  afterEach(() => {
    resetGlobalConfig();
    testBed?.cleanup();
  });

  describe('Batch Entity Creation', () => {
    it('should create multiple entities successfully', async () => {
      const entitySpecs = [
        { definitionId: 'core:actor', opts: { instanceId: 'actor1' } },
        { definitionId: 'core:actor', opts: { instanceId: 'actor2' } },
        { definitionId: 'core:location', opts: { instanceId: 'loc1' } },
      ];

      const result = await lifecycleManager.batchCreateEntities(entitySpecs);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);
      expect(result.successes).toHaveLength(3);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify entities were actually created
      expect(result.successes[0].id).toBe('actor1');
      expect(result.successes[1].id).toBe('actor2');
      expect(result.successes[2].id).toBe('loc1');
      expect(result.successes[0].definitionId).toBe('core:actor');
      expect(result.successes[2].definitionId).toBe('core:location');
    });

    it('should handle mixed success and failure', async () => {
      const entitySpecs = [
        { definitionId: 'core:actor', opts: { instanceId: 'actor1' } },
        { definitionId: 'invalid:type', opts: { instanceId: 'invalid1' } },
        { definitionId: 'core:location', opts: { instanceId: 'loc1' } },
      ];

      const result = await lifecycleManager.batchCreateEntities(entitySpecs);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].item.definitionId).toBe('invalid:type');

      // Verify successful entities were created and invalid one was not
      expect(result.successes.find((e) => e.id === 'actor1')).toBeDefined();
      expect(result.successes.find((e) => e.id === 'loc1')).toBeDefined();
      expect(result.successes.find((e) => e.id === 'invalid1')).toBeUndefined();
    });

    it('should respect batch size configuration', async () => {
      const entitySpecs = Array(25)
        .fill(0)
        .map((_, i) => ({
          definitionId: 'core:actor',
          opts: { instanceId: `actor${i}` },
        }));

      const result = await lifecycleManager.batchCreateEntities(entitySpecs, {
        batchSize: 5,
      });

      expect(result.totalProcessed).toBe(25);
      expect(result.successCount).toBe(25);

      // Verify all entities were created
      for (let i = 0; i < 25; i++) {
        expect(
          result.successes.find((e) => e.id === `actor${i}`)
        ).toBeDefined();
      }
    });

    it('should handle errors in batch processing', async () => {
      const entitySpecs = [
        { definitionId: 'core:actor', opts: { instanceId: 'actor1' } },
        {
          definitionId: 'invalid:definition',
          opts: { instanceId: 'invalid1' },
        }, // Invalid definition
        { definitionId: 'core:actor', opts: { instanceId: 'actor3' } },
      ];

      const result = await lifecycleManager.batchCreateEntities(entitySpecs);

      // The batch processes all items, continuing after errors
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.totalProcessed).toBe(3);

      // Verify successful entities were created
      expect(result.successes.find((e) => e.id === 'actor1')).toBeDefined();
      expect(result.successes.find((e) => e.id === 'actor3')).toBeDefined();

      // Verify the failure was recorded
      expect(result.failures[0].item.definitionId).toBe('invalid:definition');
    });
  });

  describe('Batch Component Addition', () => {
    beforeEach(async () => {
      // Create some entities to add components to
      await lifecycleManager.createEntityInstance('core:actor', {
        instanceId: 'actor1',
      });
      await lifecycleManager.createEntityInstance('core:actor', {
        instanceId: 'actor2',
      });
      await lifecycleManager.createEntityInstance('core:location', {
        instanceId: 'loc1',
      });
    });

    it('should add components to multiple entities', async () => {
      const componentSpecs = [
        {
          instanceId: 'actor1',
          componentTypeId: 'core:health',
          componentData: { maxHealth: 100, currentHealth: 100 },
        },
        {
          instanceId: 'actor2',
          componentTypeId: 'core:health',
          componentData: { maxHealth: 150, currentHealth: 150 },
        },
        {
          instanceId: 'loc1',
          componentTypeId: 'core:description',
          componentData: { name: 'Test Location', description: 'A test place' },
        },
      ];

      const result = await lifecycleManager.batchAddComponents(componentSpecs);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);

      // Verify components were added - addComponent returns true on success
      expect(result.successes).toHaveLength(3);
      expect(result.successes[0]).toBe(true);
      expect(result.successes[1]).toBe(true);
      expect(result.successes[2]).toBe(true);
    });

    it('should handle component addition errors', async () => {
      const componentSpecs = [
        {
          instanceId: 'actor1',
          componentTypeId: 'core:health',
          componentData: { maxHealth: 100 },
        },
        {
          instanceId: 'nonexistent',
          componentTypeId: 'core:health',
          componentData: { maxHealth: 100 },
        },
      ];

      const result = await lifecycleManager.batchAddComponents(componentSpecs);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].item.instanceId).toBe('nonexistent');
    });
  });

  describe('Batch Entity Removal', () => {
    beforeEach(async () => {
      // Create entities to remove
      await lifecycleManager.createEntityInstance('core:actor', {
        instanceId: 'actor1',
      });
      await lifecycleManager.createEntityInstance('core:actor', {
        instanceId: 'actor2',
      });
      await lifecycleManager.createEntityInstance('core:location', {
        instanceId: 'loc1',
      });
    });

    it('should remove multiple entities successfully', async () => {
      const instanceIds = ['actor1', 'actor2', 'loc1'];

      const result = await lifecycleManager.batchRemoveEntities(instanceIds);

      expect(result.successCount).toBe(3);
      expect(result.failureCount).toBe(0);

      // removeEntityInstance returns undefined, so successes will be undefined values
      expect(result.successes).toHaveLength(3);
      expect(result.successes[0]).toBeUndefined();
      expect(result.successes[1]).toBeUndefined();
      expect(result.successes[2]).toBeUndefined();
    });

    it('should handle removal of non-existent entities', async () => {
      const instanceIds = ['actor1', 'nonexistent', 'loc1'];

      const result = await lifecycleManager.batchRemoveEntities(instanceIds);

      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(1);
      expect(result.failures[0].item).toBe('nonexistent');

      // Verify existing entities were removed (successes will be undefined)
      expect(result.successes).toHaveLength(2);
      expect(result.successes[0]).toBeUndefined();
      expect(result.successes[1]).toBeUndefined();
      expect(result.failures[0].error).toBeDefined();
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to sequential operations when batch disabled', async () => {
      // Import services factory
      const services = await import(
        '../../../../src/entities/utils/createDefaultServicesWithConfig.js'
      );
      const { createDefaultServicesWithConfig } = services;

      const fallbackServices = createDefaultServicesWithConfig({
        registry,
        validator: testBed.mocks.validator,
        logger,
        eventDispatcher,
        idGenerator: () => Math.random().toString(36).substr(2, 9),
        cloner: (obj) => JSON.parse(JSON.stringify(obj)),
        defaultPolicy: { apply: () => {} },
      });

      // Create a lifecycle manager without batch operations
      const nonBatchLifecycleManager = new EntityLifecycleManager({
        registry,
        logger,
        eventDispatcher,
        entityRepository: fallbackServices.entityRepository,
        factory: fallbackServices.entityFactory,
        errorTranslator: fallbackServices.errorTranslator,
        definitionCache: fallbackServices.definitionCache,
        enableBatchOperations: false,
      });

      const entitySpecs = [
        { definitionId: 'core:actor', opts: { instanceId: 'fallback1' } },
        { definitionId: 'core:actor', opts: { instanceId: 'fallback2' } },
      ];

      const result =
        await nonBatchLifecycleManager.batchCreateEntities(entitySpecs);

      expect(result.successCount).toBe(2);
      expect(result.successes).toHaveLength(2);

      // Verify entities were created in the repository
      expect(fallbackServices.entityRepository.get('fallback1')).toBeDefined();
      expect(fallbackServices.entityRepository.get('fallback2')).toBeDefined();
    });
  });
});
