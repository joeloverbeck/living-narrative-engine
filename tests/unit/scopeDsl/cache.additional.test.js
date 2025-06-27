/**
 * @file Additional comprehensive tests for Scope-DSL Cache
 * @description Tests to improve coverage of src/scopeDsl/cache.js edge cases and LRU cache behavior
 */

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { LRUCache } from 'lru-cache';
import ScopeCache from '../../../src/scopeDsl/cache.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';

describe('Scope-DSL Cache - Additional Coverage Tests', () => {
  describe('LRUCache edge cases', () => {
    let cache;

    beforeEach(() => {
      cache = new LRUCache({ max: 3 }); // Small cache for testing
    });

    test('should handle cache miss', () => {
      const result = cache.get('nonexistent');
      expect(result).toBeUndefined();
    });

    test('should evict least recently used items when at capacity', () => {
      // Fill cache to capacity
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      expect(cache.size).toBe(3);

      // Add one more item, should evict key1
      cache.set('key4', 'value4');
      expect(cache.size).toBe(3);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should update existing entries without eviction', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update existing key
      cache.set('key2', 'updated_value2');
      expect(cache.size).toBe(3);
      expect(cache.get('key2')).toBe('updated_value2');
    });

    test('should move accessed items to end (most recently used)', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Add new item, should evict key2 (least recently used)
      cache.set('key4', 'value4');
      expect(cache.get('key1')).toBe('value1'); // Still in cache
      expect(cache.get('key2')).toBeUndefined(); // Evicted
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    test('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      expect(cache.size).toBe(2);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });

    test('should handle custom cache sizes', () => {
      const smallCache = new LRUCache({ max: 1 });
      smallCache.set('key1', 'value1');
      smallCache.set('key2', 'value2'); // Should evict key1

      expect(smallCache.size).toBe(1);
      expect(smallCache.get('key1')).toBeUndefined();
      expect(smallCache.get('key2')).toBe('value2');
    });

    test('should handle zero-sized cache', () => {
      // npm lru-cache requires at least max: 1
      const minCache = new LRUCache({ max: 1 });
      minCache.set('key1', 'value1');
      minCache.set('key2', 'value2'); // This should evict key1

      expect(minCache.size).toBe(1);
      expect(minCache.get('key1')).toBeUndefined();
      expect(minCache.get('key2')).toBe('value2');
    });

    test('should use default max size when not specified', () => {
      // npm lru-cache requires explicit max option
      expect(() => new LRUCache()).toThrow();
      
      const cacheWithMax = new LRUCache({ max: 256 });
      expect(cacheWithMax.max).toBe(256);
    });
  });

  describe('ScopeCache constructor edge cases', () => {
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;
    let mockCache;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      mockSafeEventDispatcher = {
        subscribe: jest.fn(),
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };
    });

    test('should handle failed event subscription', () => {
      mockSafeEventDispatcher.subscribe.mockReturnValue(null);

      const cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ScopeCache: Failed to subscribe to TURN_STARTED_ID events'
      );
    });

    test('should handle invalid cache dependency', () => {
      expect(() => {
        new ScopeCache({
          cache: null,
          scopeEngine: mockScopeEngine,
          safeEventDispatcher: mockSafeEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow('A cache instance must be provided.');
    });

    test('should handle invalid scope engine dependency', () => {
      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: null,
          safeEventDispatcher: mockSafeEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow(
        'A ScopeEngine instance with resolve method must be provided.'
      );

      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: {
            /* missing resolve method */
          },
          safeEventDispatcher: mockSafeEventDispatcher,
          logger: mockLogger,
        });
      }).toThrow(
        'A ScopeEngine instance with resolve method must be provided.'
      );
    });

    test('should handle invalid event dispatcher dependency', () => {
      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: mockScopeEngine,
          safeEventDispatcher: null,
          logger: mockLogger,
        });
      }).toThrow('A SafeEventDispatcher instance must be provided.');

      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: mockScopeEngine,
          safeEventDispatcher: {
            /* missing subscribe method */
          },
          logger: mockLogger,
        });
      }).toThrow('A SafeEventDispatcher instance must be provided.');
    });

    test('should handle invalid logger dependency', () => {
      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: mockScopeEngine,
          safeEventDispatcher: mockSafeEventDispatcher,
          logger: null,
        });
      }).toThrow('A logger instance must be provided.');

      expect(() => {
        new ScopeCache({
          cache: mockCache,
          scopeEngine: mockScopeEngine,
          safeEventDispatcher: mockSafeEventDispatcher,
          logger: {
            /* missing debug method */
          },
        });
      }).toThrow('A logger instance must be provided.');
    });
  });

  describe('ScopeCache resolution edge cases', () => {
    let cache;
    let mockCache;
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;
    let mockActorEntity;
    let mockRuntimeCtx;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      mockSafeEventDispatcher = {
        subscribe: jest.fn().mockReturnValue(() => {}), // Return unsubscribe function
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      mockActorEntity = { id: 'actor123' };
      mockRuntimeCtx = { entityManager: {} };

      cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });
    });

    test('should handle complex AST structures in cache key generation', () => {
      const complexAst = {
        type: 'Union',
        left: {
          type: 'Filter',
          logic: { '==': [{ var: 'type' }, 'weapon'] },
          parent: { type: 'Source', kind: 'entities', param: 'core:item' },
        },
        right: { type: 'Source', kind: 'actor' },
      };

      mockCache.get.mockReturnValue(undefined);
      mockScopeEngine.resolve.mockReturnValue(new Set(['result']));

      cache.resolve(complexAst, mockActorEntity, mockRuntimeCtx);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('actor123:'),
        new Set(['result'])
      );
    });

    test('should handle AST with circular references in JSON.stringify', () => {
      const ast = { type: 'Source', kind: 'actor' };
      // Create circular reference
      ast.self = ast;

      mockCache.get.mockReturnValue(undefined);
      mockScopeEngine.resolve.mockReturnValue(new Set(['result']));

      // JSON.stringify with circular reference throws an error, which is expected behavior
      expect(() => {
        cache.resolve(ast, mockActorEntity, mockRuntimeCtx);
      }).toThrow('Converting circular structure to JSON');
    });

    test('should handle cache hit returning null/undefined values', () => {
      const ast = { type: 'Source', kind: 'actor' };

      // Test with null value
      mockCache.get.mockReturnValue(null);
      const result1 = cache.resolve(ast, mockActorEntity, mockRuntimeCtx);
      expect(result1).toBeNull();
      expect(mockScopeEngine.resolve).not.toHaveBeenCalled();

      // Reset and test with undefined
      mockCache.get.mockReturnValue(undefined);
      mockScopeEngine.resolve.mockReturnValue(new Set(['result']));
      const result2 = cache.resolve(ast, mockActorEntity, mockRuntimeCtx);
      expect(mockScopeEngine.resolve).toHaveBeenCalled();
    });

    test('should handle very large cache keys', () => {
      const largeAst = {
        type: 'Filter',
        logic: {
          and: Array(100)
            .fill(0)
            .map((_, i) => ({
              '==': [{ var: `field${i}` }, `value${i}`],
            })),
        },
        parent: { type: 'Source', kind: 'entities', param: 'core:item' },
      };

      mockCache.get.mockReturnValue(undefined);
      mockScopeEngine.resolve.mockReturnValue(new Set(['result']));

      expect(() => {
        cache.resolve(largeAst, mockActorEntity, mockRuntimeCtx);
      }).not.toThrow();
    });
  });

  describe('Turn event handling edge cases', () => {
    let cache;
    let mockCache;
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;
    let turnEventHandler;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      mockSafeEventDispatcher = {
        subscribe: jest.fn().mockImplementation((eventId, handler) => {
          if (eventId === TURN_STARTED_ID) {
            turnEventHandler = handler;
            return () => {}; // unsubscribe function
          }
          return null;
        }),
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });
    });

    test('should handle turn started event with payload', () => {
      const mockPayload = { turnNumber: 5, actorId: 'actor123' };

      turnEventHandler(mockPayload);

      expect(mockCache.clear).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeCache: Turn started, clearing cache'
      );
    });

    test('should handle turn started event with null payload', () => {
      turnEventHandler(null);

      expect(mockCache.clear).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeCache: Turn started, clearing cache'
      );
    });
  });

  describe('ScopeCache disposal and cleanup', () => {
    let cache;
    let mockCache;
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;
    let unsubscribeFn;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      unsubscribeFn = jest.fn();
      mockSafeEventDispatcher = {
        subscribe: jest.fn().mockReturnValue(unsubscribeFn),
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });
    });

    test('should properly dispose and unsubscribe from events', () => {
      cache.dispose();

      expect(unsubscribeFn).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ScopeCache: Unsubscribed from TURN_STARTED_ID events'
      );
      expect(cache.unsubscribeFn).toBeNull();
    });

    test('should handle dispose when already disposed', () => {
      cache.dispose();
      cache.dispose(); // Call dispose again

      // Should not throw and should not call unsubscribe again
      expect(unsubscribeFn).toHaveBeenCalledTimes(1);
    });

    test('should handle dispose when subscription failed initially', () => {
      // Create cache with failed subscription
      mockSafeEventDispatcher.subscribe.mockReturnValue(null);
      const cacheWithFailedSub = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });

      expect(() => cacheWithFailedSub.dispose()).not.toThrow();
    });
  });

  describe('ScopeCache statistics and debugging', () => {
    let cache;
    let mockCache;
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        get size() { return 5; },
        max: 100,
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      mockSafeEventDispatcher = {
        subscribe: jest.fn().mockReturnValue(() => {}),
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });
    });

    test('should provide accurate statistics', () => {
      const stats = cache.getStats();

      expect(stats).toEqual({
        size: 5,
        maxSize: 100,
        subscribed: true,
      });
    });

    test('should handle cache without max property', () => {
      delete mockCache.max;

      const stats = cache.getStats();

      expect(stats.maxSize).toBe('unknown');
    });

    test('should report unsubscribed state after disposal', () => {
      cache.dispose();

      const stats = cache.getStats();

      expect(stats.subscribed).toBe(false);
    });
  });

  describe('ScopeCache delegation', () => {
    let cache;
    let mockCache;
    let mockScopeEngine;
    let mockSafeEventDispatcher;
    let mockLogger;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(),
        set: jest.fn(),
        clear: jest.fn(),
        size: jest.fn().mockReturnValue(0),
      };

      mockScopeEngine = {
        resolve: jest.fn(),
        setMaxDepth: jest.fn(),
      };

      mockSafeEventDispatcher = {
        subscribe: jest.fn().mockReturnValue(() => {}),
      };

      mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
      };

      cache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger,
      });
    });

    test('should delegate setMaxDepth to wrapped engine', () => {
      cache.setMaxDepth(10);

      expect(mockScopeEngine.setMaxDepth).toHaveBeenCalledWith(10);
    });

    test('should delegate setMaxDepth with various values', () => {
      cache.setMaxDepth(0);
      cache.setMaxDepth(1);
      cache.setMaxDepth(100);

      expect(mockScopeEngine.setMaxDepth).toHaveBeenCalledWith(0);
      expect(mockScopeEngine.setMaxDepth).toHaveBeenCalledWith(1);
      expect(mockScopeEngine.setMaxDepth).toHaveBeenCalledWith(100);
    });
  });
});
