/**
 * @file Tests for AnatomyQueryCache service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  AnatomyQueryCache,
  CacheKeyGenerators,
} from '../../../../src/anatomy/cache/AnatomyQueryCache.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('AnatomyQueryCache', () => {
  let cache;
  let mockLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    cache = new AnatomyQueryCache({ logger: mockLogger });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(1000);
      expect(stats.size).toBe(0);
    });

    it('should initialize with custom options', () => {
      const customCache = new AnatomyQueryCache(
        { logger: mockLogger },
        { maxSize: 500, ttl: 60000 }
      );
      const stats = customCache.getStats();
      expect(stats.maxSize).toBe(500);
    });

    it('should throw error if logger is not provided', () => {
      expect(() => new AnatomyQueryCache({})).toThrow('logger is required');
    });
  });

  describe('basic cache operations', () => {
    it('should set and get values', () => {
      cache.set('test-key', 'test-value', 'root-1');
      expect(cache.get('test-key')).toBe('test-value');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });

    it('should check if key exists', () => {
      cache.set('test-key', 'test-value', 'root-1');
      expect(cache.has('test-key')).toBe(true);
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1', 'root-1');
      cache.set('key2', 'value2', 'root-2');

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('query-specific caching', () => {
    describe('findPartsByType', () => {
      it('should cache and retrieve findPartsByType results', () => {
        const result = ['part1', 'part2'];
        cache.cacheFindPartsByType('root-1', 'leg', result);

        const cached = cache.getCachedFindPartsByType('root-1', 'leg');
        expect(cached).toEqual(result);
      });

      it('should return undefined for uncached findPartsByType', () => {
        const cached = cache.getCachedFindPartsByType('root-1', 'arm');
        expect(cached).toBeUndefined();
      });
    });

    describe('getAllParts', () => {
      it('should cache and retrieve getAllParts results', () => {
        const result = ['part1', 'part2', 'part3'];
        cache.cacheGetAllParts('root-1', result);

        const cached = cache.getCachedGetAllParts('root-1');
        expect(cached).toEqual(result);
      });

      it('should return undefined for uncached getAllParts', () => {
        const cached = cache.getCachedGetAllParts('root-2');
        expect(cached).toBeUndefined();
      });
    });
  });

  describe('invalidateRoot', () => {
    it('should invalidate all entries for a specific root', () => {
      // Cache multiple entries for the same root
      cache.cacheFindPartsByType('root-1', 'leg', ['leg1', 'leg2']);
      cache.cacheFindPartsByType('root-1', 'arm', ['arm1', 'arm2']);
      cache.cacheGetAllParts('root-1', ['part1', 'part2']);

      // Cache entries for different root
      cache.cacheFindPartsByType('root-2', 'leg', ['leg3']);

      // Invalidate root-1
      cache.invalidateRoot('root-1');

      // root-1 entries should be gone
      expect(cache.getCachedFindPartsByType('root-1', 'leg')).toBeUndefined();
      expect(cache.getCachedFindPartsByType('root-1', 'arm')).toBeUndefined();
      expect(cache.getCachedGetAllParts('root-1')).toBeUndefined();

      // root-2 entries should remain
      expect(cache.getCachedFindPartsByType('root-2', 'leg')).toEqual(['leg3']);
    });

    it('should log invalidation count', () => {
      cache.cacheFindPartsByType('root-1', 'leg', ['leg1']);
      cache.cacheFindPartsByType('root-1', 'arm', ['arm1']);

      cache.invalidateRoot('root-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        "AnatomyQueryCache: Invalidated 2 entries for root 'root-1'"
      );
    });
  });

  describe('CacheKeyGenerators', () => {
    it('should generate correct key for findPartsByType', () => {
      const key = CacheKeyGenerators.findPartsByType('root-1', 'leg');
      expect(key).toBe('findPartsByType:::root-1:::leg');
    });

    it('should generate correct key for getAllParts', () => {
      const key = CacheKeyGenerators.getAllParts('root-1');
      expect(key).toBe('getAllParts:::root-1');
    });

    it('should generate correct key for getPath', () => {
      const key = CacheKeyGenerators.getPath('from-1', 'to-1');
      expect(key).toBe('getPath:::from-1:::to-1');
    });

    it('should generate correct key for hasPartWithComponent', () => {
      const key = CacheKeyGenerators.hasPartWithComponent(
        'root-1',
        'comp:test'
      );
      expect(key).toBe('hasPartWithComponent:::root-1:::comp:test');
    });

    it('should generate correct key for hasPartWithComponentValue', () => {
      const key = CacheKeyGenerators.hasPartWithComponentValue(
        'root-1',
        'comp:test',
        'prop.path',
        'value'
      );
      expect(key).toBe(
        'hasPartWithComponentValue:::root-1:::comp:test:::prop.path:::"value"'
      );
    });
  });

  describe('logging', () => {
    it('should log cache hits', () => {
      cache.set('test-key', 'test-value', 'root-1');
      cache.get('test-key');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyQueryCache: Cache hit for key 'test-key'"
      );
    });

    it('should not log for cache misses', () => {
      cache.get('non-existent');

      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Cache hit')
      );
    });

    it('should log when setting values', () => {
      cache.set('test-key', 'test-value', 'root-1');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        "AnatomyQueryCache: Cached result for key 'test-key'"
      );
    });
  });

  describe('stats', () => {
    it('should return correct cache statistics', () => {
      cache.set('key1', 'value1', 'root-1');
      cache.set('key2', 'value2', 'root-1');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.hitRate).toBe(0); // Not implemented yet
    });
  });
});
