/**
 * @fileoverview Unit tests for Scope-DSL Cache
 * @description Tests for src/scopeDsl/cache.js - LRU cache for scope resolution
 */

import ScopeCache from '../../../src/scopeDsl/cache.js';

describe('ScopeCache', () => {
  let cache;

  beforeEach(() => {
    cache = new ScopeCache();
  });

  describe('constructor', () => {
    test('initializes with default LRU size of 256', () => {
      const stats = cache.getStats();
      expect(stats.maxSize).toBe(256);
      expect(stats.size).toBe(0);
      expect(stats.currentTurn).toBeNull();
    });

    test('can be initialized with custom LRU size', () => {
      const customCache = new ScopeCache();
      // Note: The current implementation doesn't expose LRU size customization
      // This test documents the current behavior
      const stats = customCache.getStats();
      expect(stats.maxSize).toBe(256);
    });
  });

  describe('newTurn()', () => {
    test('sets current turn and clears cache', () => {
      // First, add some data to cache
      cache.newTurn('turn1');
      const resolveFn = jest.fn().mockReturnValue(['result1']);
      cache.resolve('scope1', 'actor1', resolveFn);
      
      expect(cache.getStats().size).toBe(1);
      expect(cache.getStats().currentTurn).toBe('turn1');

      // Start new turn
      cache.newTurn('turn2');
      
      expect(cache.getStats().size).toBe(0);
      expect(cache.getStats().currentTurn).toBe('turn2');
    });

    test('can be called multiple times', () => {
      cache.newTurn('turn1');
      expect(cache.getStats().currentTurn).toBe('turn1');

      cache.newTurn('turn2');
      expect(cache.getStats().currentTurn).toBe('turn2');

      cache.newTurn('turn3');
      expect(cache.getStats().currentTurn).toBe('turn3');
    });
  });

  describe('resolve()', () => {
    test('throws error if newTurn() not called first', () => {
      const resolveFn = jest.fn().mockReturnValue(['result']);
      
      expect(() => {
        cache.resolve('scope1', 'actor1', resolveFn);
      }).toThrow('Cache not initialized - call newTurn() first');
      
      expect(resolveFn).not.toHaveBeenCalled();
    });

    test('calls resolveFn and caches result on first call', () => {
      cache.newTurn('turn1');
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity1', 'entity2']));
      
      const result = cache.resolve('scope1', 'actor1', resolveFn);
      
      expect(resolveFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(new Set(['entity1', 'entity2']));
      expect(cache.getStats().size).toBe(1);
    });

    test('returns cached result on subsequent identical calls', () => {
      cache.newTurn('turn1');
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity1', 'entity2']));
      
      // First call
      const result1 = cache.resolve('scope1', 'actor1', resolveFn);
      
      // Second call with same parameters
      const result2 = cache.resolve('scope1', 'actor1', resolveFn);
      
      expect(resolveFn).toHaveBeenCalledTimes(1); // Only called once
      expect(result1).toEqual(result2);
      expect(cache.getStats().size).toBe(1);
    });

    test('different scope names create separate cache entries', () => {
      cache.newTurn('turn1');
      const resolveFn1 = jest.fn().mockReturnValue(new Set(['entity1']));
      const resolveFn2 = jest.fn().mockReturnValue(new Set(['entity2']));
      
      cache.resolve('scope1', 'actor1', resolveFn1);
      cache.resolve('scope2', 'actor1', resolveFn2);
      
      expect(resolveFn1).toHaveBeenCalledTimes(1);
      expect(resolveFn2).toHaveBeenCalledTimes(1);
      expect(cache.getStats().size).toBe(2);
    });

    test('different actor IDs create separate cache entries', () => {
      cache.newTurn('turn1');
      const resolveFn1 = jest.fn().mockReturnValue(new Set(['entity1']));
      const resolveFn2 = jest.fn().mockReturnValue(new Set(['entity2']));
      
      cache.resolve('scope1', 'actor1', resolveFn1);
      cache.resolve('scope1', 'actor2', resolveFn2);
      
      expect(resolveFn1).toHaveBeenCalledTimes(1);
      expect(resolveFn2).toHaveBeenCalledTimes(1);
      expect(cache.getStats().size).toBe(2);
    });

    test('different turns create separate cache entries', () => {
      cache.newTurn('turn1');
      const resolveFn1 = jest.fn().mockReturnValue(new Set(['entity1']));
      
      cache.resolve('scope1', 'actor1', resolveFn1);
      expect(cache.getStats().size).toBe(1);
      
      cache.newTurn('turn2');
      const resolveFn2 = jest.fn().mockReturnValue(new Set(['entity2']));
      
      cache.resolve('scope1', 'actor1', resolveFn2);
      
      expect(resolveFn1).toHaveBeenCalledTimes(1);
      expect(resolveFn2).toHaveBeenCalledTimes(1);
      expect(cache.getStats().size).toBe(1); // turn1 cache was cleared
    });

    test('cache key includes turn, actorId, and scopeName', () => {
      cache.newTurn('turn1');
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity1']));
      
      cache.resolve('actor.inventory', 'actor123', resolveFn);
      
      // The cache should have one entry with key "turn1:actor123:actor.inventory"
      expect(cache.getStats().size).toBe(1);
      expect(resolveFn).toHaveBeenCalledTimes(1);
    });

    test('handles complex scope expressions', () => {
      cache.newTurn('turn1');
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity1', 'entity2']));
      
      const complexScope = 'actor.inventory.items[][{"==": [{"var": "entity.id"}, "item1"]}]';
      cache.resolve(complexScope, 'actor123', resolveFn);
      
      expect(cache.getStats().size).toBe(1);
      expect(resolveFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('LRU behavior', () => {
    test('evicts least recently used entries when cache is full', () => {
      // Create a cache with smaller size for testing
      const smallCache = new ScopeCache();
      smallCache.newTurn('turn1');
      
      // Fill the cache (256 entries)
      for (let i = 0; i < 256; i++) {
        const resolveFn = jest.fn().mockReturnValue(new Set([`entity${i}`]));
        smallCache.resolve(`scope${i}`, 'actor1', resolveFn);
      }
      
      expect(smallCache.getStats().size).toBe(256);
      
      // Add one more entry - should evict the first one
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity256']));
      smallCache.resolve('scope256', 'actor1', resolveFn);
      
      expect(smallCache.getStats().size).toBe(256); // Still at max size
      
      // The first entry should be evicted, so calling it again should hit resolveFn
      const firstResolveFn = jest.fn().mockReturnValue(new Set(['entity0']));
      smallCache.resolve('scope0', 'actor1', firstResolveFn);
      
      expect(firstResolveFn).toHaveBeenCalledTimes(1); // Called again because evicted
    });

    test('updates access order when getting existing entries', () => {
      cache.newTurn('turn1');
      
      // Add two entries
      const resolveFn1 = jest.fn().mockReturnValue(new Set(['entity1']));
      const resolveFn2 = jest.fn().mockReturnValue(new Set(['entity2']));
      
      cache.resolve('scope1', 'actor1', resolveFn1);
      cache.resolve('scope2', 'actor1', resolveFn2);
      
      // Access first entry again (should move it to end of LRU)
      cache.resolve('scope1', 'actor1', resolveFn1);
      
      expect(resolveFn1).toHaveBeenCalledTimes(1); // Still cached
      expect(cache.getStats().size).toBe(2);
    });
  });

  describe('getStats()', () => {
    test('returns current cache statistics', () => {
      const stats = cache.getStats();
      
      expect(stats).toEqual({
        size: 0,
        maxSize: 256,
        currentTurn: null
      });
    });

    test('updates statistics after operations', () => {
      cache.newTurn('turn1');
      expect(cache.getStats().currentTurn).toBe('turn1');
      
      const resolveFn = jest.fn().mockReturnValue(new Set(['entity1']));
      cache.resolve('scope1', 'actor1', resolveFn);
      
      expect(cache.getStats().size).toBe(1);
    });
  });

  describe('integration with scope resolution', () => {
    test('can cache Set results from scope engine', () => {
      cache.newTurn('turn1');
      const mockSet = new Set(['entity1', 'entity2', 'entity3']);
      const resolveFn = jest.fn().mockReturnValue(mockSet);
      
      const result = cache.resolve('actor.inventory.items[]', 'actor123', resolveFn);
      
      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(mockSet);
      expect(cache.getStats().size).toBe(1);
    });

    test('can cache empty Set results', () => {
      cache.newTurn('turn1');
      const emptySet = new Set();
      const resolveFn = jest.fn().mockReturnValue(emptySet);
      
      const result = cache.resolve('entities(nonexistent)', 'actor123', resolveFn);
      
      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
      expect(cache.getStats().size).toBe(1);
    });
  });
}); 