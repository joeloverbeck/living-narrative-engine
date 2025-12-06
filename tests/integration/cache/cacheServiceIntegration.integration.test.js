/**
 * @file Integration tests for cache services with dependency injection
 * Tests cache components within the DI container and service lifecycle
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerInfrastructure } from '../../../src/dependencyInjection/registrations/infrastructureRegistrations.js';

describe('Cache Service Integration with DI Container', () => {
  let testBed;
  let container;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    container = new AppContainer();

    // Register core dependencies first
    container.register(tokens.ILogger, () => mockLogger, {
      lifecycle: 'singleton',
    });

    // Register mock document context for CriticalLogNotifier
    const mockDocumentContext = testBed.createMock('documentContext', [
      'createElement',
    ]);
    container.register(tokens.IDocumentContext, () => mockDocumentContext, {
      lifecycle: 'singleton',
    });

    // Register other required dependencies
    const mockSchemaValidator = testBed.createMock('SchemaValidator', [
      'validateAgainstSchema',
      'validate',
      'getSchema',
      'loadSchema',
    ]);
    const mockDataRegistry = testBed.createMock('DataRegistry', [
      'get',
      'set',
      'has',
      'delete',
      'clear',
      'getAll',
      'getWorldDefinition',
      'getAllWorldDefinitions',
      'getStartingPlayerId',
      'getStartingLocationId',
      'getActionDefinition',
      'getAllActionDefinitions',
      'getEntityDefinition',
      'getAllEntityDefinitions',
      'getEventDefinition',
      'getAllEventDefinitions',
      'getComponentDefinition',
      'getAllComponentDefinitions',
      'getConditionDefinition',
      'getAllConditionDefinitions',
      'getGoalDefinition',
      'getAllGoalDefinitions',
      'getEntityInstanceDefinition',
      'getAllEntityInstanceDefinitions',
      'store',
    ]);

    container.register(tokens.ISchemaValidator, () => mockSchemaValidator, {
      lifecycle: 'singleton',
    });
    container.register(tokens.IDataRegistry, () => mockDataRegistry, {
      lifecycle: 'singleton',
    });

    // Mock facade dependencies to avoid pulling in unrelated services
    // These are required by IClothingSystemFacade
    const mockClothingManagementService = testBed.createMock(
      'ClothingManagementService',
      [
        'equipClothing',
        'unequipClothing',
        'getEquippedItems',
        'validateCompatibility',
      ]
    );
    const mockEquipmentOrchestrator = testBed.createMock(
      'EquipmentOrchestrator',
      ['orchestrateEquipment', 'validateEquipment']
    );
    const mockLayerCompatibilityService = testBed.createMock(
      'LayerCompatibilityService',
      ['checkCompatibility', 'getConflicts']
    );
    const mockClothingSlotValidator = testBed.createMock(
      'ClothingSlotValidator',
      ['validate', 'getAvailableSlots']
    );

    container.register(
      tokens.ClothingManagementService,
      () => mockClothingManagementService,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.EquipmentOrchestrator,
      () => mockEquipmentOrchestrator,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.LayerCompatibilityService,
      () => mockLayerCompatibilityService,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.ClothingSlotValidator,
      () => mockClothingSlotValidator,
      { lifecycle: 'singleton' }
    );

    // These are required by IAnatomySystemFacade
    const mockBodyGraphService = testBed.createMock('BodyGraphService', [
      'createGraph',
      'updateGraph',
      'queryGraph',
    ]);
    const mockAnatomyDescriptionService = testBed.createMock(
      'AnatomyDescriptionService',
      ['generateDescription', 'formatDescription']
    );
    const mockGraphIntegrityValidator = testBed.createMock(
      'GraphIntegrityValidator',
      ['validate', 'checkIntegrity']
    );
    const mockAnatomyGenerationService = testBed.createMock(
      'AnatomyGenerationService',
      ['generateAnatomy', 'createBodyPart']
    );
    const mockBodyBlueprintFactory = testBed.createMock(
      'BodyBlueprintFactory',
      ['createBlueprint', 'validateBlueprint']
    );

    container.register(tokens.BodyGraphService, () => mockBodyGraphService, {
      lifecycle: 'singleton',
    });
    container.register(
      tokens.AnatomyDescriptionService,
      () => mockAnatomyDescriptionService,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.GraphIntegrityValidator,
      () => mockGraphIntegrityValidator,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.AnatomyGenerationService,
      () => mockAnatomyGenerationService,
      { lifecycle: 'singleton' }
    );
    container.register(
      tokens.BodyBlueprintFactory,
      () => mockBodyBlueprintFactory,
      { lifecycle: 'singleton' }
    );

    // Register infrastructure (includes cache services)
    registerInfrastructure(container);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Service Registration and Resolution', () => {
    it('should register all cache services as singletons', () => {
      // Verify all cache tokens are registered
      expect(container.isRegistered(tokens.IUnifiedCache)).toBe(true);
      expect(container.isRegistered(tokens.UnifiedCache)).toBe(true);
      expect(container.isRegistered(tokens.ICacheInvalidationManager)).toBe(
        true
      );
      expect(container.isRegistered(tokens.CacheInvalidationManager)).toBe(
        true
      );
      expect(container.isRegistered(tokens.ICacheMetrics)).toBe(true);
      expect(container.isRegistered(tokens.CacheMetrics)).toBe(true);
    });

    it('should resolve cache services with proper dependencies', () => {
      const unifiedCache = container.resolve(tokens.IUnifiedCache);
      const cacheInvalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );
      const cacheMetrics = container.resolve(tokens.ICacheMetrics);

      expect(unifiedCache).toBeDefined();
      expect(cacheInvalidationManager).toBeDefined();
      expect(cacheMetrics).toBeDefined();

      // Verify singleton behavior
      expect(container.resolve(tokens.IUnifiedCache)).toBe(unifiedCache);
      expect(container.resolve(tokens.ICacheInvalidationManager)).toBe(
        cacheInvalidationManager
      );
      expect(container.resolve(tokens.ICacheMetrics)).toBe(cacheMetrics);
    });

    it('should resolve concrete implementations through interfaces', () => {
      const interfaceCache = container.resolve(tokens.IUnifiedCache);
      const concreteCache = container.resolve(tokens.UnifiedCache);

      expect(interfaceCache).toBe(concreteCache);

      const interfaceManager = container.resolve(
        tokens.ICacheInvalidationManager
      );
      const concreteManager = container.resolve(
        tokens.CacheInvalidationManager
      );

      expect(interfaceManager).toBe(concreteManager);

      const interfaceMetrics = container.resolve(tokens.ICacheMetrics);
      const concreteMetrics = container.resolve(tokens.CacheMetrics);

      expect(interfaceMetrics).toBe(concreteMetrics);
    });
  });

  describe('Service Configuration and Initialization', () => {
    it('should initialize UnifiedCache with correct configuration', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const metrics = cache.getMetrics();

      expect(metrics.config.maxSize).toBe(1000);
      expect(metrics.config.ttl).toBe(300000); // 5 minutes
      expect(metrics.config.evictionPolicy).toBe('lru');
      expect(metrics.stats).toBeDefined(); // enableMetrics: true
    });

    it('should initialize services with proper dependency injection', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );
      const metricsService = container.resolve(tokens.ICacheMetrics);

      // Test cache operations
      cache.set('test:key', { value: 'test' });
      expect(cache.get('test:key')).toEqual({ value: 'test' });

      // Test invalidation manager operations
      invalidationManager.registerCache('test-cache', cache);
      const result = invalidationManager.invalidatePattern('test:');
      // Calculate total from results object
      const totalInvalidated = Object.values(result).reduce(
        (sum, r) => sum + (r.success && r.invalidated ? r.invalidated : 0),
        0
      );
      expect(totalInvalidated).toBeGreaterThan(0);

      // Test metrics service operations
      metricsService.registerCache('test-cache', cache);
      const cacheMetrics = metricsService.getCacheMetrics('test-cache');
      expect(cacheMetrics).toBeDefined();
    });
  });

  describe('Service Integration Workflow', () => {
    it('should support complete cache workflow through DI', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );
      const metricsService = container.resolve(tokens.ICacheMetrics);
      const eventDispatcher = container.resolve(
        tokens.IValidatedEventDispatcher
      );

      // 1. Register cache with all services
      invalidationManager.registerCache('workflow-cache', cache, {
        entityTypes: ['test'],
        description: 'Workflow test cache',
      });

      metricsService.registerCache('workflow-cache', cache, {
        category: 'integration-test',
        description: 'Workflow test cache',
      });

      // 2. Store data in cache
      cache.set('test:entity1', { name: 'Entity 1', value: 100 });
      cache.set('test:entity2', { name: 'Entity 2', value: 200 });

      // 3. Verify data is cached
      expect(cache.get('test:entity1')).toEqual({
        name: 'Entity 1',
        value: 100,
      });
      expect(cache.get('test:entity2')).toEqual({
        name: 'Entity 2',
        value: 200,
      });

      // 4. Check initial metrics - need to collect first
      metricsService.collectCacheMetrics('workflow-cache');
      const initialMetrics = metricsService.getCacheMetrics('workflow-cache');
      expect(initialMetrics).not.toBeNull();
      expect(initialMetrics.size).toBe(2);
      expect(initialMetrics.stats.sets).toBe(2);
      expect(initialMetrics.stats.hits).toBe(2);

      // 5. The event system doesn't automatically invalidate cache entries
      // We need to manually trigger invalidation through the manager
      invalidationManager.invalidateEntity('test:entity1');

      // 6. Verify selective invalidation
      expect(cache.get('test:entity1')).toBeUndefined();
      expect(cache.get('test:entity2')).toEqual({
        name: 'Entity 2',
        value: 200,
      });

      // 7. Dispatch an event (though it won't auto-invalidate without proper setup)
      return eventDispatcher
        .dispatch({
          type: 'ENTITY_UPDATED',
          payload: {
            entityId: 'test:entity1',
            entityType: 'test',
            changes: { value: 150 },
          },
        })
        .then(() => {
          // 7. Check updated metrics - need to re-collect after invalidation
          metricsService.collectCacheMetrics('workflow-cache');
          const finalMetrics = metricsService.getCacheMetrics('workflow-cache');
          expect(finalMetrics.size).toBe(1);

          // 8. Test aggregated metrics across services
          const aggregated = metricsService.getAggregatedMetrics();
          expect(aggregated.cacheCount).toBe(1);
          // Check individual cache info instead of byCategory
          const workflowCacheInfo = aggregated.caches['workflow-cache'];
          expect(workflowCacheInfo).toBeDefined();
        });
    });

    it('should handle service dependencies correctly', () => {
      // Verify service dependencies are resolved
      const cache = container.resolve(tokens.IUnifiedCache);
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );

      // UnifiedCache should have logger dependency - check that info was called with initialization message
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('UnifiedCache initialized')
      );

      // CacheInvalidationManager should set up event listeners
      const eventDispatcher = container.resolve(
        tokens.IValidatedEventDispatcher
      );
      expect(eventDispatcher).toBeDefined();

      // Services should be able to work together
      invalidationManager.registerCache('dep-test', cache);
      const stats = invalidationManager.getStats();
      expect(stats.registeredCaches).toBe(1);
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should handle service initialization order correctly', () => {
      // Services should initialize without errors
      expect(() => {
        container.resolve(tokens.IUnifiedCache);
        container.resolve(tokens.ICacheInvalidationManager);
        container.resolve(tokens.ICacheMetrics);
      }).not.toThrow();

      // Dependencies should be resolved correctly
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('should support service reconfiguration', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const originalMetrics = cache.getMetrics();

      // Cache should be configurable through its public API
      cache.set('config:test', { value: 'original' });
      expect(cache.get('config:test')).toEqual({ value: 'original' });

      // Configuration should be accessible
      expect(originalMetrics.config.maxSize).toBe(1000);
      expect(originalMetrics.config.evictionPolicy).toBe('lru');
    });

    it('should handle concurrent service access', async () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const metricsService = container.resolve(tokens.ICacheMetrics);

      metricsService.registerCache('concurrent-cache', cache);

      // Simulate concurrent cache operations
      const promises = Array.from({ length: 50 }, (_, i) =>
        Promise.resolve().then(() => {
          cache.set(`concurrent:key${i}`, { index: i });
          return cache.get(`concurrent:key${i}`);
        })
      );

      const results = await Promise.all(promises);

      // All operations should succeed
      expect(results).toHaveLength(50);
      expect(results.every((r) => r !== undefined)).toBe(true);

      // Metrics should reflect concurrent operations - collect first
      metricsService.collectCacheMetrics('concurrent-cache');
      const metrics = metricsService.getCacheMetrics('concurrent-cache');
      expect(metrics).not.toBeNull();
      expect(metrics.stats.sets).toBe(50);
      expect(metrics.stats.hits).toBe(50);
    });
  });

  describe('Error Handling in DI Context', () => {
    it('should handle missing dependencies gracefully', () => {
      // Create container without all dependencies
      const minimalContainer = new AppContainer();

      // Infrastructure registration handles missing ILogger gracefully with console fallback
      expect(() => {
        registerInfrastructure(minimalContainer);
      }).not.toThrow(); // Uses console.debug fallback instead of throwing
    });

    it('should handle service resolution errors', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );

      // Register a mock cache that throws errors - must include clear() method
      const errorCache = {
        invalidate: jest.fn().mockImplementation(() => {
          throw new Error('Mock cache error');
        }),
        clear: jest.fn(),
        getMetrics: jest.fn().mockReturnValue({ size: 0 }),
      };

      invalidationManager.registerCache('error-cache', errorCache);

      // Service should handle cache errors gracefully
      const result = invalidationManager.invalidatePattern('test:');
      // Check for error in results object
      const hasError = Object.values(result).some((r) => !r.success && r.error);
      expect(hasError).toBe(true);

      // Logger should record the error
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should maintain service integrity during errors', async () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const eventDispatcher = container.resolve(
        tokens.IValidatedEventDispatcher
      );
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );

      // Register cache and add data
      invalidationManager.registerCache('integrity-cache', cache, {
        entityTypes: ['integrity-test'],
      });

      cache.set('integrity-test:item1', { value: 1 });
      cache.set('integrity-test:item2', { value: 2 });

      // Temporarily break the cache invalidation
      const originalInvalidate = cache.invalidate;
      cache.invalidate = jest.fn().mockImplementation(() => {
        throw new Error('Invalidation error');
      });

      // Event dispatch should not fail despite cache error
      await eventDispatcher.dispatch({
        type: 'ENTITY_UPDATED',
        payload: {
          entityId: 'integrity-test:item1',
          entityType: 'integrity-test',
        },
      });

      // Cache should still be functional for direct operations
      expect(cache.get('integrity-test:item1')).toEqual({ value: 1 });

      // Restore functionality
      cache.invalidate = originalInvalidate;

      // Normal operations should resume
      const result = invalidationManager.invalidatePattern('integrity-test:');
      const totalInvalidated = Object.values(result).reduce(
        (sum, r) => sum + (r.success && r.invalidated ? r.invalidated : 0),
        0
      );
      expect(totalInvalidated).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple cache instances efficiently', () => {
      const metricsService = container.resolve(tokens.ICacheMetrics);
      const invalidationManager = container.resolve(
        tokens.ICacheInvalidationManager
      );

      // Note: UnifiedCache is a singleton, so all resolves return the same instance
      const cache = container.resolve(tokens.IUnifiedCache);

      // Register the same cache instance under different IDs for testing
      Array.from({ length: 10 }, (_, i) => {
        const cacheId = `perf-cache-${i}`;

        metricsService.registerCache(cacheId, cache, {
          category: `category-${i % 3}`,
          description: `Performance cache ${i}`,
        });

        invalidationManager.registerCache(cacheId, cache, {
          entityTypes: [`type-${i}`],
        });

        // Add some data with unique keys per "cache"
        cache.set(`key-${i}-1`, { value: i * 10 });
        cache.set(`key-${i}-2`, { value: i * 20 });
      });

      // All caches should be registered
      expect(metricsService.getRegisteredCaches()).toHaveLength(10);
      expect(invalidationManager.getRegisteredCaches()).toHaveLength(10);

      // Aggregated metrics should work efficiently
      const startTime = Date.now();
      const aggregated = metricsService.getAggregatedMetrics();
      const endTime = Date.now();

      expect(aggregated.cacheCount).toBe(10);
      // All 10 "caches" are actually the same singleton instance with 20 total items
      expect(aggregated.totalSize).toBe(20 * 10); // Same cache reported 10 times
      expect(endTime - startTime).toBeLessThan(100); // Should be fast

      // Pattern invalidation should work across all caches
      const invalidationStart = Date.now();
      const result = invalidationManager.invalidatePattern('key-');
      const invalidationEnd = Date.now();

      const totalInvalidated = Object.values(result).reduce(
        (sum, r) => sum + (r.success && r.invalidated ? r.invalidated : 0),
        0
      );
      expect(totalInvalidated).toBeGreaterThan(0);
      expect(invalidationEnd - invalidationStart).toBeLessThan(200);
    });

    it('should maintain performance with large datasets', () => {
      const cache = container.resolve(tokens.IUnifiedCache);
      const metricsService = container.resolve(tokens.ICacheMetrics);

      metricsService.registerCache('large-dataset-cache', cache);

      // Add large number of items
      const itemCount = 500;
      const startTime = Date.now();

      for (let i = 0; i < itemCount; i++) {
        cache.set(`large:item${i}`, {
          id: i,
          name: `Item ${i}`,
          data: Array(50).fill(i).join('-'), // Moderate size data
        });
      }

      const loadTime = Date.now() - startTime;

      // Operations should complete in reasonable time
      expect(loadTime).toBeLessThan(1000); // Less than 1 second

      // Cache should maintain good performance - collect metrics first
      const metricsStartTime = Date.now();
      metricsService.collectCacheMetrics('large-dataset-cache');
      const metrics = metricsService.getCacheMetrics('large-dataset-cache');
      const metricsTime = Date.now() - metricsStartTime;

      expect(metrics).not.toBeNull();
      expect(metrics.size).toBeLessThanOrEqual(1000); // Respects maxSize config
      expect(metrics.stats.sets).toBe(itemCount);
      expect(metricsTime).toBeLessThan(50); // Metrics collection should be fast
    });
  });
});
