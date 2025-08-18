/**
 * @file Tests for CoreMotivationsCacheManager service
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CoreMotivationsCacheManager from '../../../../src/characterBuilder/cache/CoreMotivationsCacheManager.js';
import { CHARACTER_BUILDER_EVENTS } from '../../../../src/characterBuilder/services/characterBuilderService.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

describe('CoreMotivationsCacheManager', () => {
  let cache;
  let mockLogger;
  let mockEventBus;
  let mockSchemaValidator;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEventBus = {
      dispatch: jest.fn(),
    };
    mockSchemaValidator = {
      validateAgainstSchema: jest.fn(),
    };

    cache = new CoreMotivationsCacheManager({
      logger: mockLogger,
      eventBus: mockEventBus,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(100);
      expect(stats.size).toBe(0);
    });

    it('should dispatch CACHE_INITIALIZED event', () => {
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: CHARACTER_BUILDER_EVENTS.CACHE_INITIALIZED,
        payload: {
          maxSize: 100,
          ttlConfig: {
            concepts: 600000,
            directions: 600000,
            cliches: 1800000,
            motivations: null,
          },
          cacheManagerType: 'CoreMotivationsCacheManager',
        },
        timestamp: expect.any(Number),
      });
    });

    it('should throw error if logger is not provided', () => {
      expect(
        () => new CoreMotivationsCacheManager({ eventBus: mockEventBus })
      ).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error if eventBus is not provided', () => {
      expect(
        () => new CoreMotivationsCacheManager({ logger: mockLogger })
      ).toThrow('Missing required dependency: ISafeEventDispatcher');
    });
  });

  describe('basic cache operations', () => {
    it('should set and get values', () => {
      cache.set('test-key', 'test-value');
      expect(cache.get('test-key')).toBe('test-value');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeNull();
    });

    it('should delete values', () => {
      cache.set('test-key', 'test-value');
      expect(cache.delete('test-key')).toBe(true);
      expect(cache.get('test-key')).toBeNull();
    });

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.clearAll();

      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('TTL (Time To Live) functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries with TTL', () => {
      cache.set('test-key', 'test-value', 'concepts'); // 10 minutes TTL

      // Should be available immediately
      expect(cache.get('test-key')).toBe('test-value');

      // Fast forward past TTL
      jest.advanceTimersByTime(700000); // 11+ minutes

      // Should be expired
      expect(cache.get('test-key')).toBeNull();
    });

    it('should not expire entries with null TTL (motivations)', () => {
      cache.set('test-key', 'test-value', 'motivations'); // null TTL

      // Fast forward a long time
      jest.advanceTimersByTime(3600000); // 1 hour

      // Should still be available
      expect(cache.get('test-key')).toBe('test-value');
    });

    it('should use custom TTL when provided', () => {
      cache.set('test-key', 'test-value', 'concepts', 5000); // 5 seconds custom TTL

      // Should be available immediately
      expect(cache.get('test-key')).toBe('test-value');

      // Fast forward past custom TTL
      jest.advanceTimersByTime(6000);

      // Should be expired
      expect(cache.get('test-key')).toBeNull();
    });

    it('should use default TTL for unknown types', () => {
      cache.set('test-key', 'test-value', 'unknown-type');

      // Should be available immediately
      expect(cache.get('test-key')).toBe('test-value');

      // Fast forward past default TTL (10 minutes)
      jest.advanceTimersByTime(700000);

      // Should be expired
      expect(cache.get('test-key')).toBeNull();
    });
  });

  describe('LRU (Least Recently Used) eviction', () => {
    it('should evict LRU entry when cache is full', () => {
      // Fill cache to max size (100)
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Access key1 to make key0 the LRU
      cache.get('key1');

      // Add one more entry, should evict key0
      cache.set('key100', 'value100');

      expect(cache.get('key0')).toBeNull(); // LRU should be evicted
      expect(cache.get('key1')).toBe('value1'); // Recently accessed should remain
      expect(cache.get('key100')).toBe('value100'); // New entry should be present
    });

    it('should dispatch CACHE_EVICTED event on eviction', () => {
      // Fill cache to max size (100) first
      for (let i = 0; i < 100; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      // Clear previous calls after filling cache
      mockEventBus.dispatch.mockClear();

      // Add one more entry to trigger eviction
      cache.set('key100', 'value100');

      // Find the eviction event among all dispatched events
      const evictionCall = mockEventBus.dispatch.mock.calls.find(
        ([event]) => event.type === CHARACTER_BUILDER_EVENTS.CACHE_EVICTED
      );

      expect(evictionCall).toBeTruthy();
      expect(evictionCall[0]).toEqual(
        expect.objectContaining({
          type: CHARACTER_BUILDER_EVENTS.CACHE_EVICTED,
          payload: { key: 'key0' },
        })
      );
    });
  });

  describe('event dispatching', () => {
    it('should dispatch CACHE_HIT event on cache hit', () => {
      cache.set('test-key', 'test-value', 'concepts');
      cache.get('test-key');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CHARACTER_BUILDER_EVENTS.CACHE_HIT,
          payload: {
            key: 'test-key',
            type: 'concepts',
            totalHits: 1,
          },
        })
      );
    });

    it('should dispatch CACHE_MISS event on cache miss', () => {
      cache.get('non-existent');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CHARACTER_BUILDER_EVENTS.CACHE_MISS,
          payload: { key: 'non-existent' },
        })
      );
    });

    it('should handle event dispatch errors gracefully', () => {
      // Create a new cache instance where event dispatch will fail
      const faultyCache = new CoreMotivationsCacheManager({
        logger: mockLogger,
        eventBus: {
          dispatch: jest.fn(() => {
            throw new Error('Event dispatch failed');
          }),
        },
      });

      // Should not throw despite event dispatch failure
      expect(() => faultyCache.set('test-key', 'test-value')).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to dispatch cache event',
        expect.any(Error)
      );
    });
  });

  describe('type-based operations', () => {
    beforeEach(() => {
      cache.set('concept1', 'data1', 'concepts');
      cache.set('concept2', 'data2', 'concepts');
      cache.set('direction1', 'data3', 'directions');
      cache.set('motivation1', 'data4', 'motivations');
    });

    it('should clear entries by type', () => {
      cache.clearType('concepts');

      expect(cache.get('concept1')).toBeNull();
      expect(cache.get('concept2')).toBeNull();
      expect(cache.get('direction1')).toBe('data3'); // Different type should remain
      expect(cache.get('motivation1')).toBe('data4'); // Different type should remain
    });

    it('should invalidate entries by pattern', () => {
      cache.invalidatePattern(/concept/);

      expect(cache.get('concept1')).toBeNull();
      expect(cache.get('concept2')).toBeNull();
      expect(cache.get('direction1')).toBe('data3'); // Doesn't match pattern
      expect(cache.get('motivation1')).toBe('data4'); // Doesn't match pattern
    });

    it('should invalidate entries by string pattern', () => {
      cache.invalidatePattern('direction');

      expect(cache.get('direction1')).toBeNull();
      expect(cache.get('concept1')).toBe('data1'); // Doesn't match pattern
    });
  });

  describe('statistics', () => {
    it('should track hit and miss statistics', () => {
      cache.set('key1', 'value1');

      // Generate hits and misses
      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key3'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track entries by type', () => {
      cache.set('key1', 'value1', 'concepts');
      cache.set('key2', 'value2', 'concepts');
      cache.set('key3', 'value3', 'directions');

      // Generate some hits
      cache.get('key1');
      cache.get('key1');
      cache.get('key3');

      const stats = cache.getStats();
      expect(stats.byType.concepts).toEqual({ count: 2, hits: 2 });
      expect(stats.byType.directions).toEqual({ count: 1, hits: 1 });
    });

    it('should include entry details in statistics', () => {
      cache.set('key1', 'value1', 'concepts');

      const stats = cache.getStats();
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0]).toEqual({
        key: 'key1',
        type: 'concepts',
        hits: 0,
        age: expect.any(Number),
        expiresIn: expect.any(Number),
      });
    });
  });

  describe('cleanup operations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should clean expired entries', () => {
      cache.set('key1', 'value1', 'concepts'); // 10 minutes TTL
      cache.set('key2', 'value2', 'motivations'); // No TTL

      // Fast forward past TTL for concepts
      jest.advanceTimersByTime(700000);

      const cleaned = cache.cleanExpired();

      expect(cleaned).toBe(1);
      expect(cache.get('key1')).toBeNull(); // Should be cleaned
      expect(cache.get('key2')).toBe('value2'); // Should remain
    });
  });

  describe('schema validation', () => {
    beforeEach(() => {
      cache = new CoreMotivationsCacheManager({
        logger: mockLogger,
        eventBus: mockEventBus,
        schemaValidator: mockSchemaValidator,
      });
    });

    it('should validate data when schema validator is provided', () => {
      cache.set('key1', { test: 'data' }, 'concepts');

      expect(mockSchemaValidator.validateAgainstSchema).toHaveBeenCalledWith(
        { test: 'data' },
        'core:concepts-cache-entry'
      );
    });

    it('should continue caching even if validation fails', () => {
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        throw new Error('Validation failed');
      });

      cache.set('key1', { invalid: 'data' }, 'concepts');

      // Should still cache the data
      expect(cache.get('key1')).toEqual({ invalid: 'data' });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cache data validation failed for key1:',
        expect.any(Error)
      );
    });
  });

  describe('input validation', () => {
    it('should throw error for empty cache key', () => {
      expect(() => cache.get('')).toThrow('Invalid key');
      expect(() => cache.get(null)).toThrow('Invalid key');
      expect(() => cache.get(undefined)).toThrow('Invalid key');
    });

    it('should throw error for missing cache data', () => {
      expect(() => cache.set('key1', null)).toThrow('data');
      expect(() => cache.set('key1', undefined)).toThrow('data');
    });

    it('should throw error for invalid cache key in set', () => {
      expect(() => cache.set('', 'value')).toThrow('Invalid key');
      expect(() => cache.set(null, 'value')).toThrow('Invalid key');
    });
  });
});
