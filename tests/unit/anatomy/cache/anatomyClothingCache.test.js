/**
 * @file Test suite for AnatomyClothingCache service
 * @see src/anatomy/cache/AnatomyClothingCache.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  AnatomyClothingCache,
  CacheKeyTypes,
} from '../../../../src/anatomy/cache/AnatomyClothingCache.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('AnatomyClothingCache', () => {
  let cache;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    cache = new AnatomyClothingCache({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      expect(cache).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('AnatomyClothingCache initialized')
      );
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxSize: 1000,
        ttl: 600000,
        updateAgeOnGet: false,
        maxMemoryUsage: 52428800, // 50MB
      };

      const customCache = new AnatomyClothingCache(
        { logger: mockLogger },
        customConfig
      );
      expect(customCache).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('maxSize=1000')
      );
    });
  });

  describe('get/set operations', () => {
    it('should store and retrieve values by cache type', () => {
      const key = 'test-key';
      const value = { test: 'data' };

      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, key, value);
      const retrieved = cache.get(CacheKeyTypes.AVAILABLE_SLOTS, key);

      expect(retrieved).toEqual(value);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyClothingCache: Cache hit: ${CacheKeyTypes.AVAILABLE_SLOTS}:${key}`
      );
    });

    it('should return undefined for non-existent keys', () => {
      const result = cache.get(CacheKeyTypes.AVAILABLE_SLOTS, 'non-existent');
      expect(result).toBeUndefined();
    });

    it('should handle different cache types independently', () => {
      const key = 'same-key';
      const value1 = { type: 'slots' };
      const value2 = { type: 'resolution' };

      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, key, value1);
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, key, value2);

      expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, key)).toEqual(value1);
      expect(cache.get(CacheKeyTypes.SLOT_RESOLUTION, key)).toEqual(value2);
    });

    it('should warn about unknown cache types', () => {
      cache.set('unknown-type', 'key', 'value');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyClothingCache: Unknown cache type: unknown-type'
      );

      cache.get('unknown-type', 'key');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyClothingCache: Unknown cache type: unknown-type'
      );
    });

    it('should support custom TTL for individual entries', () => {
      const key = 'custom-ttl-key';
      const value = { data: 'test' };
      const customTTL = 1000; // 1 second

      cache.set(CacheKeyTypes.BLUEPRINT, key, value, { ttl: customTTL });

      // Should exist immediately
      expect(cache.has(CacheKeyTypes.BLUEPRINT, key)).toBe(true);
    });
  });

  describe('has operation', () => {
    it('should return true for existing keys', () => {
      cache.set(CacheKeyTypes.SOCKET_LOOKUP, 'exists', 'value');
      expect(cache.has(CacheKeyTypes.SOCKET_LOOKUP, 'exists')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has(CacheKeyTypes.SOCKET_LOOKUP, 'not-exists')).toBe(false);
    });

    it('should return false for unknown cache types', () => {
      expect(cache.has('unknown-type', 'any-key')).toBe(false);
    });
  });

  describe('delete operation', () => {
    it('should delete specific entries', () => {
      const key = 'to-delete';
      cache.set(CacheKeyTypes.ENTITY_STRUCTURE, key, 'value');

      const deleted = cache.delete(CacheKeyTypes.ENTITY_STRUCTURE, key);

      expect(deleted).toBe(true);
      expect(cache.has(CacheKeyTypes.ENTITY_STRUCTURE, key)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `AnatomyClothingCache: Cache entry deleted: ${CacheKeyTypes.ENTITY_STRUCTURE}:${key}`
      );
    });

    it('should return false when deleting non-existent entries', () => {
      const deleted = cache.delete(
        CacheKeyTypes.ENTITY_STRUCTURE,
        'not-exists'
      );
      expect(deleted).toBe(false);
    });
  });

  describe('clearType operation', () => {
    it('should clear all entries of a specific type', () => {
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'key1', 'value1');
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'key2', 'value2');
      cache.set(CacheKeyTypes.BLUEPRINT, 'key3', 'value3');

      cache.clearType(CacheKeyTypes.AVAILABLE_SLOTS);

      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, 'key1')).toBe(false);
      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, 'key2')).toBe(false);
      expect(cache.has(CacheKeyTypes.BLUEPRINT, 'key3')).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared 2 entries from available_slots cache')
      );
    });

    it('should warn about unknown cache types', () => {
      cache.clearType('unknown-type');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'AnatomyClothingCache: Unknown cache type: unknown-type'
      );
    });
  });

  describe('clearAll operation', () => {
    it('should clear all caches', () => {
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'key1', 'value1');
      cache.set(CacheKeyTypes.BLUEPRINT, 'key2', 'value2');
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, 'key3', 'value3');

      cache.clearAll();

      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, 'key1')).toBe(false);
      expect(cache.has(CacheKeyTypes.BLUEPRINT, 'key2')).toBe(false);
      expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, 'key3')).toBe(false);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all caches (3 total entries)')
      );
    });
  });

  describe('invalidateEntity operation', () => {
    it('should invalidate all entries containing entity ID', () => {
      const entityId = 'entity123';

      // Add entries with entity ID in different formats
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, entityId, 'slots');
      cache.set(
        CacheKeyTypes.SLOT_RESOLUTION,
        `${entityId}:slot1`,
        'resolution'
      );
      cache.set(CacheKeyTypes.ENTITY_STRUCTURE, entityId, 'structure');
      cache.set(CacheKeyTypes.SOCKET_LOOKUP, `root:${entityId}`, 'lookup');
      cache.set(CacheKeyTypes.BLUEPRINT, 'unrelated', 'blueprint');

      cache.invalidateEntity(entityId);

      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, entityId)).toBe(false);
      expect(
        cache.has(CacheKeyTypes.SLOT_RESOLUTION, `${entityId}:slot1`)
      ).toBe(false);
      expect(cache.has(CacheKeyTypes.ENTITY_STRUCTURE, entityId)).toBe(false);
      expect(cache.has(CacheKeyTypes.SOCKET_LOOKUP, `root:${entityId}`)).toBe(
        false
      );
      expect(cache.has(CacheKeyTypes.BLUEPRINT, 'unrelated')).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        `AnatomyClothingCache: Invalidated 4 cache entries for entity ${entityId}`
      );
    });
  });

  describe('invalidatePattern operation', () => {
    it('should invalidate entries matching pattern', () => {
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, 'entity1:slot1', 'value1');
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, 'entity1:slot2', 'value2');
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, 'entity2:slot1', 'value3');
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'entity1', 'value4');

      cache.invalidatePattern('entity1:.*');

      expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, 'entity1:slot1')).toBe(
        false
      );
      expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, 'entity1:slot2')).toBe(
        false
      );
      expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, 'entity2:slot1')).toBe(
        true
      );
      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, 'entity1')).toBe(true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Invalidated 2 cache entries matching pattern')
      );
    });

    it('should invalidate within specific cache type when specified', () => {
      cache.set(CacheKeyTypes.SLOT_RESOLUTION, 'test:1', 'value1');
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'test:1', 'value2');

      cache.invalidatePattern('test:.*', CacheKeyTypes.SLOT_RESOLUTION);

      expect(cache.has(CacheKeyTypes.SLOT_RESOLUTION, 'test:1')).toBe(false);
      expect(cache.has(CacheKeyTypes.AVAILABLE_SLOTS, 'test:1')).toBe(true);
    });
  });

  describe('getStats operation', () => {
    it('should return cache statistics', () => {
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'key1', 'value1');
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'key2', 'value2');
      cache.set(CacheKeyTypes.BLUEPRINT, 'key3', 'value3');

      const stats = cache.getStats();

      expect(stats).toMatchObject({
        totalSize: 3,
        totalItems: 3,
        caches: {
          [CacheKeyTypes.AVAILABLE_SLOTS]: {
            size: 2,
            maxSize: expect.any(Number),
          },
          [CacheKeyTypes.BLUEPRINT]: {
            size: 1,
            maxSize: expect.any(Number),
          },
        },
      });
      expect(stats.memoryUsageMB).toBeDefined();
      expect(stats.maxMemoryUsageMB).toBeDefined();
    });
  });

  describe('static cache key creators', () => {
    it('should create available slots key', () => {
      const key = AnatomyClothingCache.createAvailableSlotsKey('entity123');
      expect(key).toBe('entity123');
    });

    it('should create slot resolution key', () => {
      const key = AnatomyClothingCache.createSlotResolutionKey(
        'entity123',
        'slot456'
      );
      expect(key).toBe('entity123:slot456');
    });

    it('should create blueprint key', () => {
      const key = AnatomyClothingCache.createBlueprintKey('recipe789');
      expect(key).toBe('recipe789');
    });

    it('should create socket lookup key', () => {
      const key = AnatomyClothingCache.createSocketLookupKey(
        'root123',
        'socket456'
      );
      expect(key).toBe('root123:socket456');
    });

    it('should create entity structure key', () => {
      const key = AnatomyClothingCache.createEntityStructureKey('entity123');
      expect(key).toBe('entity123');
    });
  });

  describe('cache size calculation', () => {
    it('should calculate size for different value types', () => {
      // Test with string
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'string-key', 'test string');

      // Test with array
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'array-key', [
        'item1',
        'item2',
        'item3',
      ]);

      // Test with object
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'object-key', {
        field1: 'value1',
        field2: { nested: 'value' },
      });

      // Test with primitive
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'number-key', 42);

      const stats = cache.getStats();
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('cache type configurations', () => {
    it('should apply different configurations to different cache types', () => {
      const config = {
        maxSize: 100,
        ttl: 60000,
      };

      const customCache = new AnatomyClothingCache(
        { logger: mockLogger },
        config
      );

      // Blueprint cache should have different settings
      const stats = customCache.getStats();

      // Blueprint cache should have double the max size
      expect(stats.caches[CacheKeyTypes.BLUEPRINT].maxSize).toBe(200);

      // Available slots cache should have half the TTL (not directly testable without mocking time)
      expect(stats.caches[CacheKeyTypes.AVAILABLE_SLOTS].maxSize).toBe(100);
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'null-key', null);
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, 'undefined-key', undefined);

      expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, 'null-key')).toBe(null);
      expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, 'undefined-key')).toBe(
        undefined
      );
    });

    it('should handle empty strings as keys', () => {
      cache.set(CacheKeyTypes.AVAILABLE_SLOTS, '', 'empty-key-value');
      expect(cache.get(CacheKeyTypes.AVAILABLE_SLOTS, '')).toBe(
        'empty-key-value'
      );
    });

    it('should handle very large objects', () => {
      const largeArray = new Array(1000).fill({ data: 'test data' });
      cache.set(CacheKeyTypes.ENTITY_STRUCTURE, 'large-key', largeArray);

      const retrieved = cache.get(CacheKeyTypes.ENTITY_STRUCTURE, 'large-key');
      expect(retrieved).toEqual(largeArray);
    });
  });
});
