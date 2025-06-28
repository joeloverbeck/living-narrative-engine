/**
 * @file Test suite for ScopeCache location-aware caching behavior
 */

import ScopeCache from '../../../src/scopeDsl/cache.js';
import { jest } from '@jest/globals';

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

  get size() {
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

describe('ScopeCache location-aware caching', () => {
  let mockScopeEngine;
  let mockSafeEventDispatcher;
  let mockLogger;
  let cache;
  let scopeCache;

  beforeEach(() => {
    // Create cache instance
    cache = new MockCache();

    // Create mock scope engine
    mockScopeEngine = new MockScopeEngine();
    mockScopeEngine.resolveFn.mockReturnValue(new Set(['entity1', 'entity2']));

    // Setup other mocks
    mockSafeEventDispatcher = {
      subscribe: jest.fn().mockReturnValue(() => {}),
      dispatch: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create ScopeCache instance
    scopeCache = new ScopeCache({
      cache,
      scopeEngine: mockScopeEngine,
      safeEventDispatcher: mockSafeEventDispatcher,
      logger: mockLogger,
    });
  });

  describe('cache key generation with location', () => {
    it('should generate different cache keys for different locations', () => {
      const ast = { type: 'Source', kind: 'all' };
      const actorEntity = { id: 'actor1' };

      // First call with location1
      const runtimeCtx1 = {
        location: { id: 'location1' },
        entityManager: {},
        jsonLogicEval: {},
      };

      const result1 = scopeCache.resolve(ast, actorEntity, runtimeCtx1);

      // Verify scope engine was called
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledWith(
        ast,
        actorEntity,
        runtimeCtx1
      );

      // Second call with same actor and AST but different location
      const runtimeCtx2 = {
        location: { id: 'location2' },
        entityManager: {},
        jsonLogicEval: {},
      };

      // Mock different result for different location
      mockScopeEngine.resolveFn.mockReturnValue(
        new Set(['entity3', 'entity4'])
      );

      const result2 = scopeCache.resolve(ast, actorEntity, runtimeCtx2);

      // Verify scope engine was called again (cache miss due to different location)
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledWith(
        ast,
        actorEntity,
        runtimeCtx2
      );

      // Results should be different
      expect(result1).not.toEqual(result2);
      expect(Array.from(result1)).toEqual(['entity1', 'entity2']);
      expect(Array.from(result2)).toEqual(['entity3', 'entity4']);
    });

    it('should use cached result when location is the same', () => {
      const ast = { type: 'Source', kind: 'all' };
      const actorEntity = { id: 'actor1' };
      const runtimeCtx = {
        location: { id: 'location1' },
        entityManager: {},
        jsonLogicEval: {},
      };

      // First call
      const result1 = scopeCache.resolve(ast, actorEntity, runtimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);

      // Second call with same context
      const result2 = scopeCache.resolve(ast, actorEntity, runtimeCtx);

      // Should use cache - scope engine not called again
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cache hit')
      );

      // Results should be the same
      expect(result1).toBe(result2);
    });

    it('should handle missing location gracefully', () => {
      const ast = { type: 'Source', kind: 'all' };
      const actorEntity = { id: 'actor1' };

      // Runtime context without location
      const runtimeCtx1 = {
        entityManager: {},
        jsonLogicEval: {},
      };

      const result1 = scopeCache.resolve(ast, actorEntity, runtimeCtx1);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);

      // Another call without location should use cache
      const result2 = scopeCache.resolve(ast, actorEntity, runtimeCtx1);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);
      expect(result1).toBe(result2);
    });

    it('should handle null location', () => {
      const ast = { type: 'Source', kind: 'all' };
      const actorEntity = { id: 'actor1' };

      const runtimeCtx = {
        location: null,
        entityManager: {},
        jsonLogicEval: {},
      };

      const result = scopeCache.resolve(ast, actorEntity, runtimeCtx);
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);
      expect(result).toEqual(new Set(['entity1', 'entity2']));
    });

    it('should distinguish between no location and explicit location', () => {
      const ast = { type: 'Source', kind: 'all' };
      const actorEntity = { id: 'actor1' };

      // First call with no location
      const runtimeCtxNoLocation = {
        entityManager: {},
        jsonLogicEval: {},
      };

      const result1 = scopeCache.resolve(
        ast,
        actorEntity,
        runtimeCtxNoLocation
      );
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(1);

      // Second call with explicit location
      const runtimeCtxWithLocation = {
        location: { id: 'location1' },
        entityManager: {},
        jsonLogicEval: {},
      };

      mockScopeEngine.resolveFn.mockReturnValue(
        new Set(['entity5', 'entity6'])
      );
      const result2 = scopeCache.resolve(
        ast,
        actorEntity,
        runtimeCtxWithLocation
      );

      // Should be a cache miss - different cache keys
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
      expect(result1).not.toEqual(result2);
    });
  });

  describe('complex AST with location changes', () => {
    it('should handle complex AST structures with location changes', () => {
      const complexAst = {
        type: 'Filter',
        parent: {
          type: 'Step',
          field: 'core:position',
          parent: {
            type: 'Source',
            kind: 'entities',
            param: 'core:actor',
          },
        },
        logic: { '==': [{ var: 'location.id' }, { var: 'entity.locationId' }] },
      };

      const actorEntity = { id: 'actor1' };

      // First location
      const runtimeCtx1 = {
        location: { id: 'town' },
        entityManager: {},
        jsonLogicEval: {},
      };

      mockScopeEngine.resolveFn.mockReturnValue(new Set(['npc1', 'npc2']));
      const result1 = scopeCache.resolve(complexAst, actorEntity, runtimeCtx1);

      // Second location
      const runtimeCtx2 = {
        location: { id: 'adventurers_guild' },
        entityManager: {},
        jsonLogicEval: {},
      };

      mockScopeEngine.resolveFn.mockReturnValue(new Set(['npc3', 'npc4']));
      const result2 = scopeCache.resolve(complexAst, actorEntity, runtimeCtx2);

      // Should have called engine twice - once for each location
      expect(mockScopeEngine.resolveFn).toHaveBeenCalledTimes(2);
      expect(Array.from(result1)).toEqual(['npc1', 'npc2']);
      expect(Array.from(result2)).toEqual(['npc3', 'npc4']);
    });
  });
});
