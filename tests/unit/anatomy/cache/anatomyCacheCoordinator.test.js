/**
 * @file Unit tests for AnatomyCacheCoordinator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnatomyCacheCoordinator } from '../../../../src/anatomy/cache/anatomyCacheCoordinator.js';

describe('AnatomyCacheCoordinator', () => {
  let coordinator;
  let mockEventBus;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    coordinator = new AnatomyCacheCoordinator({
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should initialize with event bus subscriptions', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledTimes(4);
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:entity_removed',
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:component_added',
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:component_removed',
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        'core:components_batch_added',
        expect.any(Function)
      );
    });

    it('should throw error when eventBus is missing', () => {
      expect(() => {
        new AnatomyCacheCoordinator({
          eventBus: null,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new AnatomyCacheCoordinator({
          eventBus: mockEventBus,
          logger: null,
        });
      }).toThrow();
    });
  });

  describe('registerCache', () => {
    it('should register a cache', () => {
      const cache = new Map();
      coordinator.registerCache('testCache', cache);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered cache: testCache'
      );
      expect(coordinator.getCacheCount()).toBe(1);
    });

    it('should warn when registering duplicate cache ID', () => {
      const cache1 = new Map();
      const cache2 = new Map();

      coordinator.registerCache('testCache', cache1);
      coordinator.registerCache('testCache', cache2);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache testCache already registered, overwriting'
      );
      expect(coordinator.getCacheCount()).toBe(1);
    });

    it('should register multiple caches', () => {
      const cache1 = new Map();
      const cache2 = new Map();
      const cache3 = new Map();

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);
      coordinator.registerCache('cache3', cache3);

      expect(coordinator.getCacheCount()).toBe(3);
    });
  });

  describe('unregisterCache', () => {
    it('should unregister a cache', () => {
      const cache = new Map();
      coordinator.registerCache('testCache', cache);
      expect(coordinator.getCacheCount()).toBe(1);

      coordinator.unregisterCache('testCache');
      expect(coordinator.getCacheCount()).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Unregistered cache: testCache'
      );
    });

    it('should handle unregistering non-existent cache gracefully', () => {
      coordinator.unregisterCache('nonExistent');
      expect(coordinator.getCacheCount()).toBe(0);
    });
  });

  describe('invalidateEntity', () => {
    it('should invalidate all registered Map-based caches for entity', () => {
      const cache1 = new Map([['entity1', 'data1']]);
      const cache2 = new Map([['entity1', 'data2']]);
      const cache3 = new Map([['entity2', 'data3']]);

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);
      coordinator.registerCache('cache3', cache3);

      coordinator.invalidateEntity('entity1');

      expect(cache1.has('entity1')).toBe(false);
      expect(cache2.has('entity1')).toBe(false);
      expect(cache3.has('entity2')).toBe(true); // Different entity, not invalidated
    });

    it('should invalidate object-based caches with invalidate method', () => {
      const cache = {
        invalidate: jest.fn(),
      };

      coordinator.registerCache('objectCache', cache);
      coordinator.invalidateEntity('entity1');

      expect(cache.invalidate).toHaveBeenCalledWith('entity1');
    });

    it('should warn about caches without invalidation support', () => {
      const unsupportedCache = {};

      coordinator.registerCache('unsupported', unsupportedCache);
      coordinator.invalidateEntity('entity1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("doesn't support invalidation")
      );
    });

    it('should handle errors during cache invalidation', () => {
      const errorCache = new Map();
      errorCache.delete = jest.fn(() => {
        throw new Error('Cache error');
      });

      coordinator.registerCache('errorCache', errorCache);
      coordinator.invalidateEntity('entity1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to invalidate cache'),
        expect.any(Error)
      );
    });

    it('should publish anatomy:cache_invalidated event', () => {
      const cache1 = new Map();
      const cache2 = new Map();

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);

      coordinator.invalidateEntity('entity1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:cache_invalidated',
        expect.objectContaining({
          entityId: 'entity1',
          cacheCount: 2,
        })
      );
    });

    it('should log invalidation operation', () => {
      const cache = new Map([['entity1', 'data']]);
      coordinator.registerCache('testCache', cache);

      coordinator.invalidateEntity('entity1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Invalidating all caches for entity entity1'
      );
    });
  });

  describe('invalidateAll', () => {
    it('should clear all Map-based caches', () => {
      const cache1 = new Map([['entity1', 'data1']]);
      const cache2 = new Map([['entity2', 'data2']]);

      coordinator.registerCache('cache1', cache1);
      coordinator.registerCache('cache2', cache2);

      coordinator.invalidateAll();

      expect(cache1.size).toBe(0);
      expect(cache2.size).toBe(0);
    });

    it('should clear object-based caches with clear method', () => {
      const cache = {
        clear: jest.fn(),
      };

      coordinator.registerCache('objectCache', cache);
      coordinator.invalidateAll();

      expect(cache.clear).toHaveBeenCalled();
    });

    it('should handle errors during cache clearing', () => {
      const errorCache = new Map();
      errorCache.clear = jest.fn(() => {
        throw new Error('Clear error');
      });

      coordinator.registerCache('errorCache', errorCache);
      coordinator.invalidateAll();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear cache'),
        expect.any(Error)
      );
    });

    it('should publish anatomy:caches_cleared event', () => {
      const cache = new Map();
      coordinator.registerCache('cache', cache);

      coordinator.invalidateAll();

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:caches_cleared',
        {}
      );
    });

    it('should log clearing operation', () => {
      coordinator.invalidateAll();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Invalidating all anatomy caches'
      );
    });
  });

  describe('Event Handlers', () => {
    describe('core:entity_removed', () => {
      it('should invalidate cache when entity is removed with instanceId', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        // Find and call the event handler
        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:entity_removed'
        )[1];

        handler({
          type: 'core:entity_removed',
          payload: { instanceId: 'entity1' },
        });

        expect(cache.has('entity1')).toBe(false);
      });

      it('should invalidate cache when entity is removed with entity object', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:entity_removed'
        )[1];

        handler({
          type: 'core:entity_removed',
          payload: { entity: { id: 'entity1' } },
        });

        expect(cache.has('entity1')).toBe(false);
      });

      it('should handle missing entity ID gracefully', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:entity_removed'
        )[1];

        handler({
          type: 'core:entity_removed',
          payload: {},
        });

        // Should not throw, cache should remain unchanged
        expect(cache.has('entity1')).toBe(true);
      });
    });

    describe('core:component_added', () => {
      it('should invalidate cache when component is added', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:component_added'
        )[1];

        handler({
          type: 'core:component_added',
          payload: { entity: { id: 'entity1' } },
        });

        expect(cache.has('entity1')).toBe(false);
      });
    });

    describe('core:component_removed', () => {
      it('should invalidate cache when component is removed', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:component_removed'
        )[1];

        handler({
          type: 'core:component_removed',
          payload: { entity: { id: 'entity1' } },
        });

        expect(cache.has('entity1')).toBe(false);
      });
    });

    describe('core:components_batch_added', () => {
      it('should invalidate cache for all entities in batch', () => {
        const cache = new Map([
          ['entity1', 'data1'],
          ['entity2', 'data2'],
          ['entity3', 'data3'],
        ]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:components_batch_added'
        )[1];

        handler({
          type: 'core:components_batch_added',
          payload: {
            updates: [{ instanceId: 'entity1' }, { instanceId: 'entity2' }],
          },
        });

        expect(cache.has('entity1')).toBe(false);
        expect(cache.has('entity2')).toBe(false);
        expect(cache.has('entity3')).toBe(true); // Not in batch
      });

      it('should handle empty updates array', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:components_batch_added'
        )[1];

        handler({
          type: 'core:components_batch_added',
          payload: { updates: [] },
        });

        // Should not throw
        expect(cache.has('entity1')).toBe(true);
      });

      it('should handle missing updates array', () => {
        const cache = new Map([['entity1', 'data']]);
        coordinator.registerCache('testCache', cache);

        const handler = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === 'core:components_batch_added'
        )[1];

        handler({
          type: 'core:components_batch_added',
          payload: {},
        });

        // Should not throw
        expect(cache.has('entity1')).toBe(true);
      });
    });
  });

  describe('getCacheCount', () => {
    it('should return 0 when no caches are registered', () => {
      expect(coordinator.getCacheCount()).toBe(0);
    });

    it('should return correct count of registered caches', () => {
      coordinator.registerCache('cache1', new Map());
      coordinator.registerCache('cache2', new Map());
      coordinator.registerCache('cache3', new Map());

      expect(coordinator.getCacheCount()).toBe(3);
    });

    it('should update count after unregistering', () => {
      coordinator.registerCache('cache1', new Map());
      coordinator.registerCache('cache2', new Map());
      expect(coordinator.getCacheCount()).toBe(2);

      coordinator.unregisterCache('cache1');
      expect(coordinator.getCacheCount()).toBe(1);
    });
  });

  describe('Mixed Cache Types', () => {
    it('should handle both Map and object-based caches', () => {
      const mapCache = new Map([['entity1', 'data1']]);
      const objectCache = {
        invalidate: jest.fn(),
      };

      coordinator.registerCache('mapCache', mapCache);
      coordinator.registerCache('objectCache', objectCache);

      coordinator.invalidateEntity('entity1');

      expect(mapCache.has('entity1')).toBe(false);
      expect(objectCache.invalidate).toHaveBeenCalledWith('entity1');
    });

    it('should clear both Map and object-based caches', () => {
      const mapCache = new Map([['entity1', 'data1']]);
      const objectCache = {
        clear: jest.fn(),
      };

      coordinator.registerCache('mapCache', mapCache);
      coordinator.registerCache('objectCache', objectCache);

      coordinator.invalidateAll();

      expect(mapCache.size).toBe(0);
      expect(objectCache.clear).toHaveBeenCalled();
    });
  });

  describe('Error Resilience', () => {
    it('should continue invalidating other caches if one fails', () => {
      const errorCache = new Map();
      errorCache.delete = jest.fn(() => {
        throw new Error('Cache error');
      });
      const goodCache = new Map([['entity1', 'data']]);

      coordinator.registerCache('errorCache', errorCache);
      coordinator.registerCache('goodCache', goodCache);

      coordinator.invalidateEntity('entity1');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(goodCache.has('entity1')).toBe(false); // Good cache still invalidated
    });

    it('should still publish event even if some caches fail', () => {
      const errorCache = new Map();
      errorCache.delete = jest.fn(() => {
        throw new Error('Cache error');
      });

      coordinator.registerCache('errorCache', errorCache);
      coordinator.invalidateEntity('entity1');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:cache_invalidated',
        expect.any(Object)
      );
    });
  });
});
