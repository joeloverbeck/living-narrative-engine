/**
 * @file Unit tests for Scope-DSL Cache
 * @description Tests for src/scopeDsl/cache.js - Caching wrapper for scope resolution
 */

import ScopeCache, { LRUCache } from '../../../src/scopeDsl/cache.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';

// Mock cache implementation for testing
class MockCache {
  constructor() {
    this.data = new Map();
  }

  get(key) {
    return this.data.get(key);
  }

  set(key, value) {
    this.data.set(key, value);
  }

  clear() {
    this.data.clear();
  }

  size() {
    return this.data.size;
  }
}

// Mock ScopeEngine for testing
class MockScopeEngine {
  constructor() {
    this.maxDepth = 4;
    this.resolveFn = jest.fn();
  }

  resolve(ast, actorEntity, runtimeCtx) {
    return this.resolveFn(ast, actorEntity, runtimeCtx);
  }

  setMaxDepth(n) {
    this.maxDepth = n;
  }
}

// Mock SafeEventDispatcher for testing
class MockSafeEventDispatcher {
  constructor() {
    this.listeners = new Map();
    this.subscribeCallCount = 0;
  }

  subscribe(eventName, listener) {
    this.subscribeCallCount++;
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(eventName);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  dispatch(eventName, payload) {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.forEach(listener => listener(payload));
    }
  }
}

// Mock Logger for testing
class MockLogger {
  constructor() {
    this.debugCalls = [];
    this.errorCalls = [];
  }

  debug(message) {
    this.debugCalls.push(message);
  }

  error(message) {
    this.errorCalls.push(message);
  }
}

describe('ScopeCache', () => {
  let cache;
  let mockCache;
  let mockScopeEngine;
  let mockSafeEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    mockCache = new MockCache();
    mockScopeEngine = new MockScopeEngine();
    mockSafeEventDispatcher = new MockSafeEventDispatcher();
    mockLogger = new MockLogger();
    
    cache = new ScopeCache({
      cache: mockCache,
      scopeEngine: mockScopeEngine,
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger
    });
  });

  describe('constructor', () => {
    test('requires all dependencies to be provided', () => {
      expect(() => new ScopeCache({})).toThrow('A cache instance must be provided.');
      
      expect(() => new ScopeCache({ cache: mockCache })).toThrow('A ScopeEngine instance with resolve method must be provided.');
      
      expect(() => new ScopeCache({ 
        cache: mockCache, 
        scopeEngine: mockScopeEngine 
      })).toThrow('A SafeEventDispatcher instance must be provided.');
      
      expect(() => new ScopeCache({ 
        cache: mockCache, 
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher
      })).toThrow('A logger instance must be provided.');
    });

    test('accepts valid dependencies', () => {
      expect(() => new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      })).not.toThrow();
    });

    test('subscribes to TURN_STARTED_ID events', () => {
      expect(mockSafeEventDispatcher.subscribeCallCount).toBe(1);
      expect(mockSafeEventDispatcher.listeners.has(TURN_STARTED_ID)).toBe(true);
    });

    test('logs successful subscription', () => {
      expect(mockLogger.debugCalls).toContain('ScopeCache: Successfully subscribed to TURN_STARTED_ID events');
    });
  });

  describe('resolve()', () => {
    test('calls scopeEngine.resolve and caches result on first call', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      const expectedResult = new Set(['entity1', 'entity2']);
      
      mockScopeEngine.resolveFn.mockReturnValue(expectedResult);

      const result = cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);

      expect(mockScopeEngine.resolveFn).toHaveBeenCalledWith(mockAst, mockActorEntity, mockRuntimeCtx);
      expect(result).toBe(expectedResult);
      expect(mockCache.size()).toBe(1);
    });

    test('returns cached result on subsequent identical calls', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      const expectedResult = new Set(['entity1', 'entity2']);
      
      mockScopeEngine.resolveFn.mockReturnValue(expectedResult);

      // First call
      const result1 = cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);
      
      // Second call with same parameters
      const result2 = cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);

      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1); // Only called once
      expect(result1).toBe(expectedResult);
      expect(result2).toBe(expectedResult);
      expect(mockCache.size()).toBe(1);
    });

    test('different ASTs create separate cache entries', () => {
      const mockAst1 = { type: 'Source', kind: 'actor' };
      const mockAst2 = { type: 'Source', kind: 'location' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      
      mockScopeEngine.resolveFn
        .mockReturnValueOnce(new Set(['entity1']))
        .mockReturnValueOnce(new Set(['entity2']));

      cache.resolve(mockAst1, mockActorEntity, mockRuntimeCtx);
      cache.resolve(mockAst2, mockActorEntity, mockRuntimeCtx);

      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
      expect(mockCache.size()).toBe(2);
    });

    test('different actor IDs create separate cache entries', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity1 = { id: 'actor123' };
      const mockActorEntity2 = { id: 'actor456' };
      const mockRuntimeCtx = { entityManager: {} };
      
      mockScopeEngine.resolveFn
        .mockReturnValueOnce(new Set(['entity1']))
        .mockReturnValueOnce(new Set(['entity2']));

      cache.resolve(mockAst, mockActorEntity1, mockRuntimeCtx);
      cache.resolve(mockAst, mockActorEntity2, mockRuntimeCtx);

      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
      expect(mockCache.size()).toBe(2);
    });
  });

  describe('automatic cache invalidation', () => {
    test('clears cache when TURN_STARTED_ID event is dispatched', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      
      mockScopeEngine.resolveFn.mockReturnValue(new Set(['entity1']));

      // Add something to cache
      cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);
      expect(mockCache.size()).toBe(1);

      // Dispatch turn started event
      mockSafeEventDispatcher.dispatch(TURN_STARTED_ID, { entityId: 'actor123' });

      // Cache should be cleared
      expect(mockCache.size()).toBe(0);
      expect(mockLogger.debugCalls).toContain('ScopeCache: Turn started, clearing cache');
    });

    test('cache miss after turn started requires new resolution', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      
      mockScopeEngine.resolveFn.mockReturnValue(new Set(['entity1']));

      // First call - cache miss
      cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);

      // Second call - cache hit
      cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);

      // Turn started - clears cache
      mockSafeEventDispatcher.dispatch(TURN_STARTED_ID, { entityId: 'actor123' });

      // Third call - cache miss again
      cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('setMaxDepth()', () => {
    test('delegates to wrapped ScopeEngine', () => {
      const spy = jest.spyOn(mockScopeEngine, 'setMaxDepth');
      
      cache.setMaxDepth(10);
      
      expect(spy).toHaveBeenCalledWith(10);
      expect(mockScopeEngine.maxDepth).toBe(10);
    });
  });

  describe('getStats()', () => {
    test('returns cache statistics', () => {
      const stats = cache.getStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 'unknown', // MockCache doesn't have maxSize
        subscribed: true,
      });
    });

    test('returns maxSize when available from cache implementation', () => {
      const lruCache = new LRUCache(128);
      const scopeCache = new ScopeCache({
        cache: lruCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });
      
      const stats = scopeCache.getStats();

      expect(stats).toEqual({
        size: 0,
        maxSize: 128,
        subscribed: true,
      });
    });

    test('updates size after operations', () => {
      const mockAst = { type: 'Source', kind: 'actor' };
      const mockActorEntity = { id: 'actor123' };
      const mockRuntimeCtx = { entityManager: {} };
      
      mockScopeEngine.resolveFn.mockReturnValue(new Set(['entity1']));
      
      cache.resolve(mockAst, mockActorEntity, mockRuntimeCtx);

      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('dispose()', () => {
    test('unsubscribes from events', () => {
      const unsubscribeFn = jest.fn();
      mockSafeEventDispatcher.subscribe = jest.fn().mockReturnValue(unsubscribeFn);
      
      const newCache = new ScopeCache({
        cache: mockCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });

      newCache.dispose();

      expect(unsubscribeFn).toHaveBeenCalled();
      expect(newCache.unsubscribeFn).toBeNull();
    });

    test('logs successful unsubscription', () => {
      cache.dispose();
      
      expect(mockLogger.debugCalls).toContain('ScopeCache: Unsubscribed from TURN_STARTED_ID events');
    });
  });

  describe('LRU behavior with LRUCache', () => {
    test('evicts least recently used entries when cache is full', () => {
      const lruCache = new LRUCache(2); // Small cache for testing
      const cachedScopeEngine = new ScopeCache({
        cache: lruCache,
        scopeEngine: mockScopeEngine,
        safeEventDispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });

      const mockRuntimeCtx = { entityManager: {} };
      const mockActorEntity = { id: 'actor123' };
      
      mockScopeEngine.resolveFn
        .mockReturnValueOnce(new Set(['entity1']))
        .mockReturnValueOnce(new Set(['entity2']))
        .mockReturnValueOnce(new Set(['entity3']))
        .mockReturnValueOnce(new Set(['entity1'])); // This should be called again due to eviction

      // Fill the cache
      cachedScopeEngine.resolve({ type: 'Source', kind: 'actor' }, mockActorEntity, mockRuntimeCtx);
      cachedScopeEngine.resolve({ type: 'Source', kind: 'location' }, mockActorEntity, mockRuntimeCtx);
      expect(lruCache.size()).toBe(2);

      // Add one more entry - should evict the first one
      cachedScopeEngine.resolve({ type: 'Source', kind: 'entities', param: 'core:item' }, mockActorEntity, mockRuntimeCtx);
      expect(lruCache.size()).toBe(2); // Still at max size

      // The first entry should be evicted, so calling it again should hit the ScopeEngine
      cachedScopeEngine.resolve({ type: 'Source', kind: 'actor' }, mockActorEntity, mockRuntimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(4); // Called again because evicted
    });
  });
});
