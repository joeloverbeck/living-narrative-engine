/**
 * @file Unit tests for CacheInvalidationManager
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { CacheInvalidationManager } from '../../../src/cache/CacheInvalidationManager.js';
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
    mockValidatedEventDispatcher = testBed.createMock('validatedEventDispatcher', [
      'dispatch'
    ]);

    mockCache = testBed.createMock('cache', [
      'invalidate',
      'clear'
    ]);
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
        entityTypes: ['actor', 'item']
      });

      const caches = manager.getRegisteredCaches();
      expect(caches).toHaveLength(1);
      expect(caches[0]).toEqual('test-cache');
    });

    it('should register cache with component types', () => {
      manager.registerCache('test-cache', mockCache, {
        componentTypes: ['stats', 'inventory']
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
        description: 'Test cache'
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
      manager.registerCache('cache2', testBed.createMock('cache', ['invalidate', 'clear']), {
        entityTypes: ['item']
      });
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
  });

  describe('Entity-Based Invalidation', () => {
    beforeEach(() => {
      manager.registerCache('actor-cache', mockCache, { entityTypes: ['actor'] });
      const mockCache2 = testBed.createMock('cache', ['invalidate', 'clear']);
      mockCache2.invalidate.mockReturnValue(3);
      manager.registerCache('item-cache', mockCache2, {
        entityTypes: ['item']
      });
      const mockCache3 = testBed.createMock('cache', ['invalidate', 'clear']);
      mockCache3.invalidate.mockReturnValue(2);
      manager.registerCache('all-cache', mockCache3, {
        entityTypes: ['actor', 'item']
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
  });

  describe('Cache Clearing', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache);
      manager.registerCache('cache2', testBed.createMock('cache', ['clear', 'invalidate']));
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
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      manager.registerCache('cache1', mockCache, { description: 'Test cache 1' });
      manager.registerCache('cache2', testBed.createMock('cache', ['invalidate', 'clear']), { description: 'Test cache 2' });
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

      return Promise.all(promises).then(results => {
        expect(results).toHaveLength(10);
        expect(mockCache.invalidate).toHaveBeenCalledTimes(10);
      });
    });
  });
});