/**
 * @file Integration tests for AnatomyCacheCoordinator
 * Tests the coordination of cache invalidation across multiple anatomy services
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { registerCore } from '../../../src/dependencyInjection/registrations/coreRegistrations.js';
import { registerWorldAndEntity } from '../../../src/dependencyInjection/registrations/worldAndEntityRegistrations.js';
import { AnatomyCacheCoordinator } from '../../../src/anatomy/cache/anatomyCacheCoordinator.js';

describe('Cache Coordination Integration', () => {
  let testBed;
  let container;
  let coordinator;
  let socketIndex;
  let slotResolver;
  let entityManager;
  let eventBus;

  beforeEach(async () => {
    testBed = createTestBed();

    // Create a minimal container with necessary services
    container = new AppContainer();

    // Register core services
    registerCore(container);

    // Register world and entity services (includes coordinator)
    registerWorldAndEntity(container);

    // Resolve services
    coordinator = container.resolve(tokens.IAnatomyCacheCoordinator);
    socketIndex = container.resolve(tokens.IAnatomySocketIndex);
    slotResolver = container.resolve(tokens.SlotResolver);
    entityManager = container.resolve(tokens.IEntityManager);
    eventBus = container.resolve(tokens.IEventBus);

    expect(coordinator).toBeInstanceOf(AnatomyCacheCoordinator);
  });

  afterEach(() => {
    if (testBed) {
      testBed.cleanup();
    }
  });

  describe('Service Registration', () => {
    it('should resolve AnatomyCacheCoordinator from container', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getCacheCount).toBeDefined();
    });

    it('should have AnatomySocketIndex registered with coordinator', () => {
      // The coordinator should have at least the socket index caches registered
      // since AnatomySocketIndex constructor registers them
      const cacheCount = coordinator.getCacheCount();
      expect(cacheCount).toBeGreaterThanOrEqual(3); // 3 caches from socket index
    });
  });

  describe('Automatic Cache Invalidation', () => {
    it('should invalidate caches when entity_removed event is dispatched', async () => {
      const testEntityId = 'test-entity-123';

      // Register a test cache
      const testCache = new Map([[testEntityId, 'test-data']]);
      coordinator.registerCache('test-cache', testCache);

      // Verify cache has the entity
      expect(testCache.has(testEntityId)).toBe(true);

      // Dispatch entity_removed event
      eventBus.dispatch('core:entity_removed', {
        instanceId: testEntityId,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify cache was invalidated
      expect(testCache.has(testEntityId)).toBe(false);
    });

    it('should invalidate caches when component_added event is dispatched', async () => {
      const testEntityId = 'test-entity-456';

      // Register a test cache
      const testCache = new Map([[testEntityId, 'test-data']]);
      coordinator.registerCache('test-cache', testCache);

      // Verify cache has the entity
      expect(testCache.has(testEntityId)).toBe(true);

      // Dispatch component_added event
      eventBus.dispatch('core:component_added', {
        entity: { id: testEntityId },
        componentId: 'anatomy:sockets',
        componentData: {},
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify cache was invalidated
      expect(testCache.has(testEntityId)).toBe(false);
    });

    it('should invalidate caches when component_removed event is dispatched', async () => {
      const testEntityId = 'test-entity-789';

      // Register a test cache
      const testCache = new Map([[testEntityId, 'test-data']]);
      coordinator.registerCache('test-cache', testCache);

      // Verify cache has the entity
      expect(testCache.has(testEntityId)).toBe(true);

      // Dispatch component_removed event
      eventBus.dispatch('core:component_removed', {
        entity: { id: testEntityId },
        componentId: 'anatomy:sockets',
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify cache was invalidated
      expect(testCache.has(testEntityId)).toBe(false);
    });

    it('should invalidate caches for all entities in batch when components_batch_added event is dispatched', async () => {
      const entity1Id = 'batch-entity-1';
      const entity2Id = 'batch-entity-2';
      const entity3Id = 'batch-entity-3';

      // Register a test cache with multiple entities
      const testCache = new Map([
        [entity1Id, 'data1'],
        [entity2Id, 'data2'],
        [entity3Id, 'data3'],
      ]);
      coordinator.registerCache('test-cache', testCache);

      // Verify all entities are in cache
      expect(testCache.has(entity1Id)).toBe(true);
      expect(testCache.has(entity2Id)).toBe(true);
      expect(testCache.has(entity3Id)).toBe(true);

      // Dispatch batch event for entity1 and entity2
      eventBus.dispatch('core:components_batch_added', {
        updates: [{ instanceId: entity1Id }, { instanceId: entity2Id }],
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify only batched entities were invalidated
      expect(testCache.has(entity1Id)).toBe(false);
      expect(testCache.has(entity2Id)).toBe(false);
      expect(testCache.has(entity3Id)).toBe(true); // Not in batch, should remain
    });
  });

  describe('Event Publishing', () => {
    it('should publish anatomy:cache_invalidated event when invalidating entity', async () => {
      const testEntityId = 'test-entity-event';
      const testCache = new Map([[testEntityId, 'test-data']]);

      coordinator.registerCache('test-cache', testCache);

      // Subscribe to the invalidation event
      let eventReceived = false;
      let eventData = null;

      eventBus.subscribe('anatomy:cache_invalidated', (event) => {
        eventReceived = true;
        eventData = event.payload;
      });

      // Invalidate the entity
      coordinator.invalidateEntity(testEntityId);

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify event was published
      expect(eventReceived).toBe(true);
      expect(eventData).toMatchObject({
        entityId: testEntityId,
        cacheCount: expect.any(Number),
      });
      expect(eventData.cacheCount).toBeGreaterThan(0);
    });

    it('should publish anatomy:caches_cleared event when clearing all caches', async () => {
      // Subscribe to the cleared event
      let eventReceived = false;

      eventBus.subscribe('anatomy:caches_cleared', () => {
        eventReceived = true;
      });

      // Clear all caches
      coordinator.invalidateAll();

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify event was published
      expect(eventReceived).toBe(true);
    });
  });

  describe('Multiple Cache Coordination', () => {
    it('should invalidate multiple registered caches simultaneously', async () => {
      const testEntityId = 'multi-cache-entity';

      // Register multiple test caches
      const cache1 = new Map([[testEntityId, 'data1']]);
      const cache2 = new Map([[testEntityId, 'data2']]);
      const cache3 = new Map([[testEntityId, 'data3']]);

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);
      coordinator.registerCache('cache3', cache3);

      // Verify all caches have the entity
      expect(cache1.has(testEntityId)).toBe(true);
      expect(cache2.has(testEntityId)).toBe(true);
      expect(cache3.has(testEntityId)).toBe(true);

      // Trigger invalidation via event
      eventBus.dispatch('core:entity_removed', {
        instanceId: testEntityId,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify all caches were invalidated
      expect(cache1.has(testEntityId)).toBe(false);
      expect(cache2.has(testEntityId)).toBe(false);
      expect(cache3.has(testEntityId)).toBe(false);
    });
  });

  describe('Cache Isolation', () => {
    it('should only invalidate caches for the affected entity', async () => {
      const entity1Id = 'entity-1';
      const entity2Id = 'entity-2';

      const testCache = new Map([
        [entity1Id, 'data1'],
        [entity2Id, 'data2'],
      ]);

      coordinator.registerCache('test-cache', testCache);

      // Invalidate only entity1
      eventBus.dispatch('core:entity_removed', {
        instanceId: entity1Id,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify only entity1 was invalidated
      expect(testCache.has(entity1Id)).toBe(false);
      expect(testCache.has(entity2Id)).toBe(true); // Should remain
    });
  });

  describe('Error Handling', () => {
    it('should continue coordinating even if one cache fails', async () => {
      const testEntityId = 'error-test-entity';

      // Create a cache that throws on delete
      const errorCache = new Map([[testEntityId, 'data']]);
      errorCache.delete = () => {
        throw new Error('Simulated cache error');
      };

      // Create a normal cache
      const normalCache = new Map([[testEntityId, 'data']]);

      coordinator.registerCache('error-cache', errorCache);
      coordinator.registerCache('normal-cache', normalCache);

      // Invalidate - should handle error gracefully
      eventBus.dispatch('core:entity_removed', {
        instanceId: testEntityId,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Normal cache should still be invalidated
      expect(normalCache.has(testEntityId)).toBe(false);
    });
  });

  describe('Dynamic Cache Registration', () => {
    it('should support registering caches after initialization', async () => {
      const testEntityId = 'dynamic-entity';

      // Create and populate cache
      const dynamicCache = new Map([[testEntityId, 'data']]);

      // Register cache after coordinator is already initialized
      coordinator.registerCache('dynamic-cache', dynamicCache);

      expect(dynamicCache.has(testEntityId)).toBe(true);

      // Trigger invalidation
      eventBus.dispatch('core:entity_removed', {
        instanceId: testEntityId,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify newly registered cache was also invalidated
      expect(dynamicCache.has(testEntityId)).toBe(false);
    });

    it('should support unregistering caches', async () => {
      const testEntityId = 'unregister-entity';

      const testCache = new Map([[testEntityId, 'data']]);
      coordinator.registerCache('temp-cache', testCache);

      // Unregister the cache
      coordinator.unregisterCache('temp-cache');

      // Trigger invalidation
      eventBus.dispatch('core:entity_removed', {
        instanceId: testEntityId,
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Unregistered cache should not be affected
      expect(testCache.has(testEntityId)).toBe(true);
    });
  });

  describe('Clear All Caches', () => {
    it('should clear all registered caches', () => {
      const cache1 = new Map([
        ['entity1', 'data1'],
        ['entity2', 'data2'],
      ]);
      const cache2 = new Map([
        ['entity3', 'data3'],
        ['entity4', 'data4'],
      ]);

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);

      expect(cache1.size).toBe(2);
      expect(cache2.size).toBe(2);

      coordinator.invalidateAll();

      expect(cache1.size).toBe(0);
      expect(cache2.size).toBe(0);
    });
  });
});
