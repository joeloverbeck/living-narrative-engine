/**
 * @file Unit tests for CacheInvalidationManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import {
  CacheInvalidationManager,
  CacheInvalidationEvents,
} from '../../../src/cache/CacheInvalidationManager.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('CacheInvalidationManager', () => {
  let testBed;
  let manager;
  let mockLogger;
  let mockValidatedEventDispatcher;
  let mockCache;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockValidatedEventDispatcher = testBed.createMock(
      'validatedEventDispatcher',
      ['dispatch']
    );

    mockCache = testBed.createMock('cache', ['invalidate', 'clear']);
    mockCache.invalidate.mockReturnValue(5);

    manager = new CacheInvalidationManager({
      logger: mockLogger,
      validatedEventDispatcher: mockValidatedEventDispatcher,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Construction and Configuration', () => {
    it('should create manager with default configuration', () => {
      expect(manager).toBeDefined();
    });

    it('should validate logger dependency', () => {
      expect(() => {
        new CacheInvalidationManager({
          logger: null,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        });
      }).toThrow();
    });

    it('should validate validated event dispatcher dependency', () => {
      expect(() => {
        new CacheInvalidationManager({
          logger: mockLogger,
          validatedEventDispatcher: null,
        });
      }).toThrow();
    });
  });

  describe('Cache Registration', () => {
    it('should register cache with basic metadata', () => {
      manager.registerCache('test-cache', mockCache);

      const caches = manager.getRegisteredCaches();
      expect(caches).toHaveLength(1);
      expect(caches[0]).toEqual('test-cache');
    });

    it('should register cache with entity types', () => {
      manager.registerCache('test-cache', mockCache, {
        entityTypes: ['actor', 'item'],
      });

      const caches = manager.getRegisteredCaches();
      expect(caches).toHaveLength(1);
      expect(caches[0]).toEqual('test-cache');
    });

    it('should register cache with component types', () => {
      manager.registerCache('test-cache', mockCache, {
        componentTypes: ['stats', 'inventory'],
      });

      const caches = manager.getRegisteredCaches();
      expect(caches).toHaveLength(1);
      expect(caches[0]).toEqual('test-cache');
    });

    it('should throw error for invalid cache ID', () => {
      expect(() => {
        manager.registerCache('', mockCache);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        manager.registerCache(null, mockCache);
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error for invalid cache object', () => {
      expect(() => {
        manager.registerCache('test-cache', null);
      }).toThrow(InvalidArgumentError);

      expect(() => {
        manager.registerCache('test-cache', {});
      }).toThrow(InvalidArgumentError);
    });

    it('should allow duplicate cache registration (overwrites)', () => {
      manager.registerCache('test-cache', mockCache);
      const anotherCache = testBed.createMock('cache', ['invalidate', 'clear']);

      expect(() => {
        manager.registerCache('test-cache', anotherCache);
      }).not.toThrow();

      // The cache should be overwritten
      expect(manager.getRegisteredCaches()).toHaveLength(1);
    });

    it('should handle cache registration with all metadata options', () => {
      const metadata = {
        entityTypes: ['actor', 'item'],
        componentTypes: ['stats', 'inventory'],
        keyPatterns: [/^actor:/],
        description: 'Test cache',
      };

      manager.registerCache('full-cache', mockCache, metadata);

      const caches = manager.getRegisteredCaches();
      expect(caches).toContain('full-cache');
    });
  });

  describe('Cache Unregistration', () => {
    beforeEach(() => {
      manager.registerCache('test-cache', mockCache);
    });

    it('should unregister existing cache', () => {
      const result = manager.unregisterCache('test-cache');

      expect(result).toBe(true);
      expect(manager.getRegisteredCaches()).toHaveLength(0);
    });

    it('should return false for non-existent cache', () => {
      const result = manager.unregisterCache('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('Pattern-Based Invalidation', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache, { entityTypes: ['actor'] });
      manager.registerCache(
        'cache2',
        testBed.createMock('cache', ['invalidate', 'clear']),
        {
          entityTypes: ['item'],
        }
      );
    });

    it('should invalidate caches by string pattern', () => {
      const result = manager.invalidatePattern('actor:');

      expect(result['cache1']).toBeDefined();
      expect(result['cache1'].success).toBe(true);
      expect(result['cache1'].invalidated).toBe(5);
      expect(mockCache.invalidate).toHaveBeenCalledWith('actor:');
    });

    it('should invalidate caches by regex pattern', () => {
      const pattern = /^actor:/;
      const result = manager.invalidatePattern(pattern);

      expect(result['cache1']).toBeDefined();
      expect(result['cache1'].success).toBe(true);
      expect(mockCache.invalidate).toHaveBeenCalledWith(pattern);
    });

    it('should handle empty invalidation results', () => {
      mockCache.invalidate.mockReturnValue(0);

      const result = manager.invalidatePattern('nonexistent:');

      expect(result['cache1'].invalidated).toBe(0);
    });

    it('should handle invalidation errors gracefully', () => {
      mockCache.invalidate.mockImplementation(() => {
        throw new Error('Cache error');
      });

      const result = manager.invalidatePattern('actor:');

      expect(result['cache1'].success).toBe(false);
      expect(result['cache1'].error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should warn when targeted cache is missing for pattern invalidation', () => {
      const result = manager.invalidatePattern('actor:', ['unknown-cache']);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Cache not found for pattern invalidation: unknown-cache'
        )
      );
    });

    it('should log when dispatching the invalidation event fails', () => {
      mockValidatedEventDispatcher.dispatch.mockImplementation(() => {
        throw new Error('dispatch failed');
      });

      manager.invalidatePattern('actor:');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to dispatch invalidation event: CACHE_PATTERN_INVALIDATION'
        ),
        expect.any(Error)
      );
    });
  });

  describe('Entity-Based Invalidation', () => {
    beforeEach(() => {
      manager.registerCache('actor-cache', mockCache, {
        entityTypes: ['actor'],
      });
      const mockCache2 = testBed.createMock('cache', ['invalidate', 'clear']);
      mockCache2.invalidate.mockReturnValue(3);
      manager.registerCache('item-cache', mockCache2, {
        entityTypes: ['item'],
      });
      const mockCache3 = testBed.createMock('cache', ['invalidate', 'clear']);
      mockCache3.invalidate.mockReturnValue(2);
      manager.registerCache('all-cache', mockCache3, {
        entityTypes: ['actor', 'item'],
      });
    });

    it('should invalidate caches for specific entity', () => {
      const result = manager.invalidateEntity('actor:player');

      expect(result['actor-cache']).toBeDefined();
      expect(result['actor-cache'].success).toBe(true);
      expect(mockCache.invalidate).toHaveBeenCalled();
    });

    it('should throw error for invalid entity ID', () => {
      expect(() => {
        manager.invalidateEntity('');
      }).toThrow(InvalidArgumentError);
    });

    it('should throw error for null entity ID', () => {
      expect(() => {
        manager.invalidateEntity(null);
      }).toThrow(InvalidArgumentError);
    });

    it('should handle dependency invalidation failures gracefully', () => {
      const failingCache = testBed.createMock('failingCache', [
        'invalidate',
        'clear',
      ]);
      failingCache.invalidate.mockImplementation(() => {
        throw new Error('dependency failure');
      });
      manager.registerCache('failing-cache', failingCache, {
        entityTypes: ['actor'],
      });
      manager.addDependency('actor:player', 'failing-cache');

      const result = manager.invalidateEntity('actor:player', ['actor-cache']);

      expect(result['failing-cache'].success).toBe(false);
      expect(result['failing-cache'].error).toBe('dependency failure');
    });

    it('should skip redundant dependency invalidations when results already exist', () => {
      const extraCache = testBed.createMock('extraCache', [
        'invalidate',
        'clear',
      ]);
      extraCache.invalidate.mockReturnValue(4);
      manager.registerCache('extra-cache', extraCache, {
        entityTypes: ['actor'],
      });
      manager.addDependency('actor:player', 'extra-cache');

      const result = manager.invalidateEntity('actor:player');

      expect(result['extra-cache']).toEqual({ success: true, invalidated: 4 });
      expect(extraCache.invalidate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache Clearing', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache);
      manager.registerCache(
        'cache2',
        testBed.createMock('cache', ['clear', 'invalidate'])
      );
    });

    it('should clear all registered caches', () => {
      const result = manager.clearCaches();

      expect(result['cache1']).toBeDefined();
      expect(result['cache1'].success).toBe(true);
      expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should clear specific caches', () => {
      const result = manager.clearCaches(['cache1']);

      expect(result['cache1']).toBeDefined();
      expect(result['cache1'].success).toBe(true);
      expect(mockCache.clear).toHaveBeenCalled();
    });

    it('should handle clear errors gracefully', () => {
      mockCache.clear.mockImplementation(() => {
        throw new Error('Clear error');
      });

      const result = manager.clearCaches();

      expect(result['cache1'].success).toBe(false);
      expect(result['cache1'].error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should warn when clearing unregistered caches', () => {
      const result = manager.clearCaches(['missing-cache']);

      expect(result).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cache not found for clearing: missing-cache')
      );
    });

    it('should skip listener cleanup when event integration is disabled during destroy', () => {
      const localLogger = testBed.createMockLogger();
      const disabledManager = new CacheInvalidationManager(
        {
          logger: localLogger,
          validatedEventDispatcher: mockValidatedEventDispatcher,
        },
        { enableEventIntegration: false }
      );

      disabledManager.destroy();

      expect(localLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('CacheInvalidationManager destroyed')
      );
    });
  });

  describe('Dependency Management', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache, { entityTypes: ['actor'] });
    });

    it('should add dependency mapping', () => {
      expect(() => {
        manager.addDependency('actor:player', 'cache1');
      }).not.toThrow();
    });

    it('should throw error when adding dependency to non-existent cache', () => {
      expect(() => {
        manager.addDependency('actor:player', 'non-existent');
      }).toThrow(InvalidArgumentError);
    });

    it('should remove dependency mapping', () => {
      manager.addDependency('actor:player', 'cache1');
      expect(() => {
        manager.removeDependency('actor:player', 'cache1');
      }).not.toThrow();
    });

    it('should remove all dependencies for a key', () => {
      manager.addDependency('actor:player', 'cache1');
      expect(() => {
        manager.removeDependency('actor:player');
      }).not.toThrow();
    });

    it('should clean dependency mappings when unregistering the final cache', () => {
      manager.addDependency('solo:actor', 'cache1');

      manager.unregisterCache('cache1');

      const mappings = manager.getDependencyMappings();
      expect(mappings['solo:actor']).toBeUndefined();
    });

    it('should return early when removing a dependency for an unknown key', () => {
      manager.removeDependency('non-existent');

      const mappings = manager.getDependencyMappings();
      expect(mappings['non-existent']).toBeUndefined();
    });

    it('should reuse existing dependency sets on repeated registrations', () => {
      manager.addDependency('actor:duplicate', 'cache1');
      manager.addDependency('actor:duplicate', 'cache1');

      const mappings = manager.getDependencyMappings();
      expect(mappings['actor:duplicate']).toEqual(['cache1']);
    });

    it('should retain dependency mappings when other caches remain registered', () => {
      const secondCache = testBed.createMock('cache', ['invalidate', 'clear']);
      manager.registerCache('cache2', secondCache, { entityTypes: ['actor'] });
      manager.addDependency('actor:shared', 'cache1');
      manager.addDependency('actor:shared', 'cache2');

      manager.unregisterCache('cache1');

      const mappings = manager.getDependencyMappings();
      expect(mappings['actor:shared']).toEqual(['cache2']);
    });

    it('should keep dependency mappings when removing only one of many caches', () => {
      const secondCache = testBed.createMock('cache', ['invalidate', 'clear']);
      manager.registerCache('cache2', secondCache, { entityTypes: ['actor'] });
      manager.addDependency('actor:multi', 'cache1');
      manager.addDependency('actor:multi', 'cache2');

      manager.removeDependency('actor:multi', 'cache1');

      const mappings = manager.getDependencyMappings();
      expect(mappings['actor:multi']).toEqual(['cache2']);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache, {
        description: 'Test cache 1',
      });
      manager.registerCache(
        'cache2',
        testBed.createMock('cache', ['invalidate', 'clear']),
        { description: 'Test cache 2' }
      );
    });

    it('should provide statistics', () => {
      const stats = manager.getStats();

      expect(stats.registeredCaches).toBe(2);
      expect(stats.dependencyMappings).toBeDefined();
      expect(stats.config).toBeDefined();
    });

    it('should provide dependency mappings', () => {
      manager.addDependency('actor:player', 'cache1');
      const mappings = manager.getDependencyMappings();

      expect(mappings['actor:player']).toContain('cache1');
    });

    it('should provide empty statistics when no caches registered', () => {
      const emptyManager = new CacheInvalidationManager({
        logger: mockLogger,
        validatedEventDispatcher: mockValidatedEventDispatcher,
      });

      const stats = emptyManager.getStats();

      expect(stats.registeredCaches).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent operations safely', () => {
      manager.registerCache('test-cache', mockCache);

      // Simulate concurrent invalidations
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(manager.invalidatePattern(`test:${i}`))
      );

      return Promise.all(promises).then((results) => {
        expect(results).toHaveLength(10);
        expect(mockCache.invalidate).toHaveBeenCalledTimes(10);
      });
    });
  });

  describe('Event integration flows', () => {
    it('should return zero handlers invoked for unknown event types', () => {
      const handledCount = manager.emitEvent('UNKNOWN_EVENT');

      expect(handledCount).toBe(0);
      expect(manager.getStats().eventsHandled).toBe(0);
    });

    it('should process component modification events', () => {
      manager.registerCache('component-cache', mockCache, {
        componentTypes: ['health'],
        entityTypes: ['entity-1'],
      });

      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      const handledCount = manager.emitEvent('COMPONENT_MODIFIED', {
        payload: { entityId: 'entity-1', componentId: 'health' },
      });

      expect(handledCount).toBe(1);
      expect(invalidateEntitySpy).toHaveBeenCalledWith('entity-1', [
        'component-cache',
      ]);
      expect(manager.getStats().eventsHandled).toBe(1);

      invalidateEntitySpy.mockRestore();
    });

    it('should process component modification events using entity metadata when component types do not match', () => {
      manager.registerCache('entity-cache', mockCache, {
        componentTypes: [],
        entityTypes: ['entity-3'],
      });

      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      manager.emitEvent('COMPONENT_MODIFIED', {
        payload: { entityId: 'entity-3', componentId: 'non-matching' },
      });

      expect(invalidateEntitySpy).toHaveBeenCalledWith('entity-3', [
        'entity-cache',
      ]);

      invalidateEntitySpy.mockRestore();
    });

    it('should ignore component modification events missing payload details', () => {
      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      const handledCount = manager.emitEvent('COMPONENT_MODIFIED', {
        payload: { entityId: 'entity-2' },
      });

      expect(handledCount).toBe(1);
      expect(invalidateEntitySpy).not.toHaveBeenCalled();
      expect(manager.getStats().eventsHandled).toBe(1);

      invalidateEntitySpy.mockRestore();
    });

    it('should skip component invalidation when metadata does not match any cache', () => {
      manager.registerCache('mismatch-cache', mockCache, {
        componentTypes: ['speed'],
        entityTypes: ['entity-9'],
      });

      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      const handledCount = manager.emitEvent('COMPONENT_MODIFIED', {
        payload: { entityId: 'entity-4', componentId: 'health' },
      });

      expect(handledCount).toBe(1);
      expect(invalidateEntitySpy).not.toHaveBeenCalled();

      invalidateEntitySpy.mockRestore();
    });

    it('should handle component modification events without an event object', () => {
      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      const handledCount = manager.emitEvent('COMPONENT_MODIFIED');

      expect(handledCount).toBe(1);
      expect(invalidateEntitySpy).not.toHaveBeenCalled();

      invalidateEntitySpy.mockRestore();
    });

    it('should process entity movement events and log handler failures', () => {
      const invalidatePatternSpy = jest
        .spyOn(manager, 'invalidatePattern')
        .mockImplementation(() => {
          throw new Error('movement failure');
        });

      const handledCount = manager.emitEvent('ENTITY_MOVED', {
        payload: { entityId: 'entity-2', fromLocation: 'A', toLocation: 'B' },
      });

      expect(handledCount).toBe(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error handling event: ENTITY_MOVED'),
        expect.any(Error)
      );

      invalidatePatternSpy.mockRestore();
    });

    it('should process entity movement events with valid payloads', () => {
      const handledCount = manager.emitEvent('ENTITY_MOVED', {
        payload: { entityId: 'entity-3', fromLocation: 'A', toLocation: 'B' },
      });

      expect(handledCount).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Entity movement invalidation: entity-3 (A -> B)'
        )
      );
    });

    it('should ignore entity movement events without an entity identifier', () => {
      const invalidatePatternSpy = jest.spyOn(manager, 'invalidatePattern');

      manager.emitEvent('ENTITY_MOVED', { payload: { fromLocation: 'A' } });

      expect(invalidatePatternSpy).not.toHaveBeenCalled();

      invalidatePatternSpy.mockRestore();
    });

    it('should handle entity movement events without any payload', () => {
      const invalidatePatternSpy = jest.spyOn(manager, 'invalidatePattern');

      const handledCount = manager.emitEvent('ENTITY_MOVED');

      expect(handledCount).toBe(1);
      expect(invalidatePatternSpy).not.toHaveBeenCalled();

      invalidatePatternSpy.mockRestore();
    });

    it('should process explicit invalidation request events', () => {
      const patternSpy = jest
        .spyOn(manager, 'invalidatePattern')
        .mockReturnValue({});
      const entitySpy = jest
        .spyOn(manager, 'invalidateEntity')
        .mockReturnValue({});

      manager.emitEvent(CacheInvalidationEvents.CACHE_INVALIDATION_REQUESTED, {
        payload: { pattern: 'pattern:*', cacheIds: ['cache-a'] },
      });
      manager.emitEvent(CacheInvalidationEvents.CACHE_INVALIDATION_REQUESTED, {
        payload: { entityId: 'entity-3', cacheIds: ['cache-b'] },
      });

      expect(patternSpy).toHaveBeenCalledWith('pattern:*', ['cache-a']);
      expect(entitySpy).toHaveBeenCalledWith('entity-3', ['cache-b']);
      expect(manager.getStats().eventsHandled).toBe(2);

      patternSpy.mockRestore();
      entitySpy.mockRestore();
    });

    it('should ignore explicit invalidation requests without payload data', () => {
      const patternSpy = jest.spyOn(manager, 'invalidatePattern');
      const entitySpy = jest.spyOn(manager, 'invalidateEntity');

      const handledCount = manager.emitEvent(
        CacheInvalidationEvents.CACHE_INVALIDATION_REQUESTED
      );

      expect(handledCount).toBe(1);
      expect(patternSpy).not.toHaveBeenCalled();
      expect(entitySpy).not.toHaveBeenCalled();

      patternSpy.mockRestore();
      entitySpy.mockRestore();
    });

    it('should process entity creation and deletion events', () => {
      const invalidateEntitySpy = jest
        .spyOn(manager, 'invalidateEntity')
        .mockReturnValue({});

      manager.emitEvent('ENTITY_CREATED', {
        payload: { entityId: 'entity-4' },
      });
      manager.emitEvent('ENTITY_DELETED', {
        payload: { entityId: 'entity-5' },
      });

      expect(invalidateEntitySpy).toHaveBeenNthCalledWith(1, 'entity-4');
      expect(invalidateEntitySpy).toHaveBeenNthCalledWith(2, 'entity-5');
      expect(manager.getStats().eventsHandled).toBe(2);

      invalidateEntitySpy.mockRestore();
    });

    it('should ignore entity change events without identifiers', () => {
      const invalidateEntitySpy = jest.spyOn(manager, 'invalidateEntity');

      manager.emitEvent('ENTITY_CREATED', { payload: {} });
      manager.emitEvent('ENTITY_CREATED');

      expect(invalidateEntitySpy).not.toHaveBeenCalled();

      invalidateEntitySpy.mockRestore();
    });
  });
});
